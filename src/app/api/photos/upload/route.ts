import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getDb, schema } from "@/db";
import { getCurrentHost } from "@/lib/auth";
import { guestCanUpload, ingestFiles } from "@/lib/gallery";
import { resolveInvite } from "@/lib/guest";
import { getEvent } from "@/lib/queries";

/** Decoding and resizing a large photo, then writing two copies to storage. */
export const maxDuration = 60;

/**
 * Multipart upload target for plain HTML forms (works without JavaScript and
 * sidesteps the server-action body limit). Authorizes as a host (session +
 * eventId) or a guest (invitation token), stores the files, then redirects
 * back to `returnTo` with ?photos=<n> or ?photoError=<message>.
 *
 * The upload form's script sends one shrunken photo per request with
 * respond=json (serverless hosts cap request bodies at a few MB) and gets
 * { stored, error } back instead of a redirect.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const token = str("token");
  const returnTo = safeReturnTo(str("returnTo"), token ? `/e/${token}` : "/events");
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const caption = str("caption") || null;
  const entryId = str("entryId") || null;
  const wantsJson = str("respond") === "json";
  const reply = (params: Record<string, string | null>) =>
    wantsJson
      ? NextResponse.json({ stored: Number(params.photos ?? 0), error: params.photoError ?? null })
      : back(req, returnTo, params);

  const db = await getDb();
  let result: Awaited<ReturnType<typeof ingestFiles>>;

  if (token) {
    const resolved = await resolveInvite(token);
    if (!resolved) return NextResponse.json({ error: "invalid link" }, { status: 403 });
    if (!guestCanUpload(resolved.event)) return reply({ photoError: "Photo uploads are closed for this event." });
    if (entryId) {
      // Guests may only attach photos to their own entries.
      const [entry] = await db
        .select({ id: schema.contestEntries.id })
        .from(schema.contestEntries)
        .innerJoin(schema.contests, eq(schema.contestEntries.contestId, schema.contests.id))
        .where(
          and(
            eq(schema.contestEntries.id, entryId),
            eq(schema.contests.eventId, resolved.event.id),
            eq(schema.contestEntries.inviteId, resolved.invite.id),
          ),
        );
      if (!entry) return reply({ photoError: "That entry isn't yours." });
    }
    result = await ingestFiles({
      event: resolved.event,
      files,
      inviteId: resolved.invite.id,
      contestEntryId: entryId,
      caption,
      autoApprove: resolved.event.galleryAutoApprove,
      actor: `guest:${resolved.household.name}`,
    });
    revalidatePath(`/e/${token}`);
    revalidatePath(`/events/${resolved.event.id}`, "layout");
  } else {
    const host = await getCurrentHost();
    if (!host) {
      return wantsJson
        ? NextResponse.json({ stored: 0, error: "Your session expired. Sign in again." }, { status: 401 })
        : NextResponse.redirect(new URL("/login", req.nextUrl.origin), 303);
    }
    const event = await getEvent(str("eventId"));
    if (!event) return NextResponse.json({ error: "unknown event" }, { status: 404 });
    if (entryId) {
      const [entry] = await db
        .select({ id: schema.contestEntries.id })
        .from(schema.contestEntries)
        .innerJoin(schema.contests, eq(schema.contestEntries.contestId, schema.contests.id))
        .where(and(eq(schema.contestEntries.id, entryId), eq(schema.contests.eventId, event.id)));
      if (!entry) return reply({ photoError: "That entry doesn't belong to this event." });
    }
    result = await ingestFiles({
      event,
      files,
      uploadedBy: host.id,
      contestEntryId: entryId,
      caption,
      autoApprove: true,
      actor: host.email,
    });
    revalidatePath(`/events/${event.id}`, "layout");
    revalidatePath("/e", "layout");
  }
  revalidatePath("/events");
  revalidatePath("/dashboard");

  return reply({
    photos: result.stored > 0 ? String(result.stored) : null,
    photoError: result.errors.length > 0 ? result.errors.join(" ") : null,
  });
}

function safeReturnTo(value: string, fallback: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function back(req: NextRequest, returnTo: string, params: Record<string, string | null>) {
  const url = new URL(returnTo, req.nextUrl.origin);
  url.searchParams.delete("photos");
  url.searchParams.delete("photoError");
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}
