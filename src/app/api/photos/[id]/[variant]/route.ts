import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb, schema } from "@/db";
import { getCurrentHost } from "@/lib/auth";
import { getPhoto, guestCanViewGallery } from "@/lib/gallery";
import { readStored } from "@/lib/gallery/storage";
import { resolveInvite } from "@/lib/guest";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Authenticated proxy for gallery files (PRD section 11 "Read" policy).
 * Hosts: any photo. Guests (?t=token): visible photos of their event, plus
 * their own pending ones. Anyone: the event's cover photo. Everything else 404s
 * so unauthorized callers learn nothing.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/photos/[id]/[variant]">) {
  const { id, variant } = await ctx.params;
  if ((variant !== "full" && variant !== "thumb") || !UUID.test(id)) return notFound();
  const photo = await getPhoto(id);
  if (!photo) return notFound();

  const db = await getDb();
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, photo.eventId));
  if (!event) return notFound();

  let allowed = event.coverPhotoId === photo.id;
  if (!allowed && (await getCurrentHost())) allowed = true;
  if (!allowed) {
    const token = req.nextUrl.searchParams.get("t");
    const resolved = token ? await resolveInvite(token) : null;
    if (
      resolved &&
      resolved.event.id === photo.eventId &&
      guestCanViewGallery(resolved.event) &&
      (photo.state === "visible" || photo.inviteId === resolved.invite.id)
    ) {
      allowed = true;
    }
  }
  if (!allowed) return notFound();

  let body: Buffer;
  try {
    body = await readStored(variant === "thumb" ? photo.thumbKey : photo.storageKey);
  } catch {
    return notFound();
  }
  const mime = variant === "thumb" ? "image/webp" : photo.mime;
  const headers = new Headers({
    "Content-Type": mime,
    "Content-Length": String(body.byteLength),
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
  if (req.nextUrl.searchParams.get("download") === "1") {
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    headers.set("Content-Disposition", `attachment; filename="party-harbor-${photo.id.slice(0, 8)}.${ext}"`);
  }
  return new NextResponse(new Uint8Array(body), { headers });
}

function notFound() {
  return NextResponse.json({ error: "not found" }, { status: 404 });
}
