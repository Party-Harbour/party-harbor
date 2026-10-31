import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Event, Photo } from "@/db/schema";
import { MAX_FILE_BYTES, removeStored, storeImage, UploadError } from "./storage";
import { MAX_FILES_PER_UPLOAD } from "./urls";

const { photos, households, eventInvites, users, contestEntries } = schema;

export { UploadError };

/** Per-event cap (PRD: storage quotas). Override with GALLERY_MAX_PHOTOS. */
export function maxPhotosPerEvent(): number {
  const n = Number(process.env.GALLERY_MAX_PHOTOS);
  return Number.isFinite(n) && n > 0 ? n : 500;
}

export function guestCanViewGallery(event: Pick<Event, "galleryPolicy">): boolean {
  return event.galleryPolicy !== "hidden";
}

export function guestCanUpload(event: Pick<Event, "galleryPolicy">): boolean {
  return event.galleryPolicy === "contribute";
}

export type PhotoRow = Photo & { uploaderName: string | null; entryName: string | null };

export async function listEventPhotos(eventId: string, states?: Photo["state"][]): Promise<PhotoRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ photo: photos, household: households.name, host: users.displayName, entry: contestEntries.displayName })
    .from(photos)
    .leftJoin(eventInvites, eq(photos.inviteId, eventInvites.id))
    .leftJoin(households, eq(eventInvites.householdId, households.id))
    .leftJoin(users, eq(photos.uploadedBy, users.id))
    .leftJoin(contestEntries, eq(photos.contestEntryId, contestEntries.id))
    .where(and(eq(photos.eventId, eventId), states ? inArray(photos.state, states) : undefined))
    .orderBy(desc(photos.createdAt));
  return rows.map((r) => ({ ...r.photo, uploaderName: r.household ?? r.host ?? null, entryName: r.entry }));
}

export async function getPhoto(id: string): Promise<Photo | null> {
  const db = await getDb();
  const [row] = await db.select().from(photos).where(eq(photos.id, id));
  return row ?? null;
}

export async function countEventPhotos(eventId: string): Promise<{ count: number; bytes: number }> {
  const db = await getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int`, bytes: sql<number>`coalesce(sum(${photos.bytes}), 0)::int` })
    .from(photos)
    .where(eq(photos.eventId, eventId));
  return row ?? { count: 0, bytes: 0 };
}

/** First visible photo per contest entry, for ballots and entry lists. */
export async function photosByEntry(entryIds: string[]): Promise<Record<string, string>> {
  if (entryIds.length === 0) return {};
  const db = await getDb();
  const rows = await db
    .select({ id: photos.id, entryId: photos.contestEntryId })
    .from(photos)
    .where(and(inArray(photos.contestEntryId, entryIds), eq(photos.state, "visible")))
    .orderBy(desc(photos.createdAt));
  const out: Record<string, string> = {};
  for (const r of rows) if (r.entryId && !(r.entryId in out)) out[r.entryId] = r.id;
  return out;
}

export type IngestInput = {
  event: Event;
  files: File[];
  /** Guest upload: the household's invite. */
  inviteId?: string;
  /** Host upload. */
  uploadedBy?: string;
  contestEntryId?: string | null;
  caption?: string | null;
  autoApprove: boolean;
  actor: string;
};

export type IngestResult = { stored: number; errors: string[] };

/**
 * Validates, processes and records a batch of uploads. Each file is handled
 * on its own so one bad file doesn't sink the rest; the caller shows errors.
 */
export async function ingestFiles(input: IngestInput): Promise<IngestResult> {
  const db = await getDb();
  const errors: string[] = [];
  const files = input.files.filter((f) => f.size > 0);
  if (files.length === 0) return { stored: 0, errors: ["Choose at least one photo."] };
  if (files.length > MAX_FILES_PER_UPLOAD) {
    return { stored: 0, errors: [`Up to ${MAX_FILES_PER_UPLOAD} photos at a time, please.`] };
  }
  const { count } = await countEventPhotos(input.event.id);
  const room = maxPhotosPerEvent() - count;
  if (room <= 0) return { stored: 0, errors: ["This event's gallery is full. Ask the hosts to make room."] };

  const ids: string[] = [];
  for (const file of files.slice(0, room)) {
    const name = file.name || "photo";
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`${name}: larger than ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`);
      continue;
    }
    // No MIME pre-check: browsers and curl label files inconsistently, and
    // storeImage decodes the bytes, which is the only check that matters.
    const id = randomUUID();
    let stored: Awaited<ReturnType<typeof storeImage>> | null = null;
    try {
      stored = await storeImage(input.event.id, id, Buffer.from(await file.arrayBuffer()));
      await db.insert(photos).values({
        id,
        eventId: input.event.id,
        inviteId: input.inviteId ?? null,
        uploadedBy: input.uploadedBy ?? null,
        contestEntryId: input.contestEntryId ?? null,
        caption: input.caption ?? null,
        state: input.autoApprove ? "visible" : "pending",
        ...stored,
      });
      ids.push(id);
    } catch (err) {
      if (stored) await removeStored([stored.storageKey, stored.thumbKey]).catch(() => {});
      errors.push(`${name}: ${err instanceof UploadError ? err.message : "couldn't be saved."}`);
      if (!(err instanceof UploadError)) console.error("[gallery] ingest failed", err);
    }
  }
  if (files.length > room) errors.push(`Only ${room} more photo${room === 1 ? "" : "s"} fit in this gallery.`);

  if (ids.length > 0) {
    await db.insert(schema.auditLog).values({
      actor: input.actor,
      eventId: input.event.id,
      action: "photo.uploaded",
      metadata: { count: ids.length, ids, contestEntryId: input.contestEntryId ?? null, pending: !input.autoApprove },
    });
  }
  return { stored: ids.length, errors };
}

export async function deletePhotoRecord(photo: Photo): Promise<void> {
  const db = await getDb();
  await db.delete(photos).where(eq(photos.id, photo.id));
  await removeStored([photo.storageKey, photo.thumbKey]).catch((err) => console.error("[gallery] remove failed", err));
}
