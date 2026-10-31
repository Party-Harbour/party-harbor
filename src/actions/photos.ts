"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { GALLERY_POLICIES, PHOTO_STATES, type Event, type Photo } from "@/db/schema";
import { requireHost } from "@/lib/auth";
import { deletePhotoRecord, getPhoto } from "@/lib/gallery";
import { resolveInvite } from "@/lib/guest";
import { str, type ActionState } from "@/lib/action-state";

function revalidateGallery(eventId: string) {
  revalidatePath(`/events/${eventId}`, "layout");
  revalidatePath("/events");
  revalidatePath("/dashboard");
  revalidatePath("/e", "layout");
}

async function audit(actor: string, eventId: string, action: string, metadata: unknown) {
  const db = await getDb();
  await db.insert(schema.auditLog).values({ actor, eventId, action, metadata });
}

/** Loads a photo and checks it belongs to the event named in the form. */
async function hostPhoto(formData: FormData): Promise<{ photo: Photo; eventId: string; email: string } | null> {
  const host = await requireHost();
  const photoId = str(formData, "photoId");
  const eventId = str(formData, "eventId");
  const photo = await getPhoto(photoId);
  if (!photo || photo.eventId !== eventId) return null;
  return { photo, eventId, email: host.email };
}

export async function setPhotoState(formData: FormData): Promise<void> {
  const ctx = await hostPhoto(formData);
  if (!ctx) return;
  const state = str(formData, "state") as Photo["state"];
  if (!PHOTO_STATES.includes(state)) return;
  const db = await getDb();
  await db.update(schema.photos).set({ state }).where(eq(schema.photos.id, ctx.photo.id));
  if (state !== "visible" && ctx.photo.id) {
    // A hidden photo should not stay on the cover.
    await db
      .update(schema.events)
      .set({ coverPhotoId: null })
      .where(and(eq(schema.events.id, ctx.eventId), eq(schema.events.coverPhotoId, ctx.photo.id)));
  }
  await audit(ctx.email, ctx.eventId, `photo.${state}`, { photoId: ctx.photo.id });
  revalidateGallery(ctx.eventId);
}

export async function approveAllPending(formData: FormData): Promise<void> {
  const host = await requireHost();
  const eventId = str(formData, "eventId");
  const db = await getDb();
  const rows = await db
    .update(schema.photos)
    .set({ state: "visible" })
    .where(and(eq(schema.photos.eventId, eventId), eq(schema.photos.state, "pending")))
    .returning({ id: schema.photos.id });
  if (rows.length > 0) await audit(host.email, eventId, "photo.visible", { ids: rows.map((r) => r.id) });
  revalidateGallery(eventId);
}

export async function deletePhoto(formData: FormData): Promise<void> {
  const ctx = await hostPhoto(formData);
  if (!ctx) return;
  await deletePhotoRecord(ctx.photo);
  await audit(ctx.email, ctx.eventId, "photo.deleted", { photoId: ctx.photo.id, by: "host" });
  revalidateGallery(ctx.eventId);
}

/** photoId empty clears the cover photo (the pasted cover URL, if any, shows again). */
export async function setCoverPhoto(formData: FormData): Promise<void> {
  const host = await requireHost();
  const eventId = str(formData, "eventId");
  const photoId = str(formData, "photoId");
  const db = await getDb();
  if (photoId) {
    const photo = await getPhoto(photoId);
    if (!photo || photo.eventId !== eventId || photo.state !== "visible") return;
  }
  await db
    .update(schema.events)
    .set({ coverPhotoId: photoId || null, updatedAt: new Date() })
    .where(eq(schema.events.id, eventId));
  await audit(host.email, eventId, "event.cover", { photoId: photoId || null });
  revalidateGallery(eventId);
}

export async function updateGallerySettings(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const host = await requireHost();
  const policy = str(formData, "galleryPolicy") as Event["galleryPolicy"];
  if (!GALLERY_POLICIES.includes(policy)) return { error: "Pick a gallery setting." };
  const autoApprove = formData.get("galleryAutoApprove") === "on";
  const db = await getDb();
  await db
    .update(schema.events)
    .set({ galleryPolicy: policy, galleryAutoApprove: autoApprove, updatedAt: new Date() })
    .where(eq(schema.events.id, eventId));
  await audit(host.email, eventId, "event.gallery_settings", { policy, autoApprove });
  revalidateGallery(eventId);
  return { ok: true, message: "Gallery settings saved." };
}

/** Guests can remove photos their own household uploaded. */
export async function guestRemovePhoto(formData: FormData): Promise<void> {
  const token = str(formData, "token");
  const resolved = await resolveInvite(token);
  if (!resolved) return;
  const photo = await getPhoto(str(formData, "photoId"));
  if (!photo || photo.eventId !== resolved.event.id || photo.inviteId !== resolved.invite.id) return;
  await deletePhotoRecord(photo);
  await audit(`guest:${resolved.household.name}`, resolved.event.id, "photo.deleted", { photoId: photo.id, by: "guest" });
  revalidatePath(`/e/${token}`);
  revalidateGallery(resolved.event.id);
}
