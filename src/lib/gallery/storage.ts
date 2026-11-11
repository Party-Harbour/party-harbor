import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";

/** A problem with one upload that the user can fix (wrong type, too big…). */
export class UploadError extends Error {}

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** Longest edge of the stored copy. Phone photos are 4000px+; this keeps pages quick on cellular. */
export const MAX_EDGE = 2000;
export const THUMB_EDGE = 640;

const READABLE = new Set(["jpeg", "png", "webp", "gif", "avif", "heif", "tiff"]);

// --- Backends ----------------------------------------------------------------
// Local disk for development; a private Supabase Storage bucket when
// SUPABASE_URL and a server-side key are set (serverless hosts have no
// permanent disk). Either way photos are only ever served through the
// authenticated proxy route, never straight from storage.

const KEY_SHAPE = /^[A-Za-z0-9_-]+[/][A-Za-z0-9_.-]+$/;

function assertKey(key: string): void {
  if (!KEY_SHAPE.test(key) || key.includes("..")) throw new Error("Invalid storage key");
}

/** Where processed photos live locally. Keep it outside synced folders, like the database. */
export function uploadDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads"));
}

/** Absolute path for a storage key, refusing anything that escapes the upload directory. */
export function resolveKey(key: string): string {
  assertKey(key);
  const root = uploadDir();
  const full = path.resolve(/*turbopackIgnore: true*/ root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

type SupabaseStorage = { url: string; key: string; bucket: string };

function supabaseStorage(): SupabaseStorage | null {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  // The server-side key: a "secret" key (sb_secret_…) or the legacy service_role key.
  const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !key) return null;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "party-photos";
  return { url: url.replace(/[/]+$/, ""), key, bucket };
}

export function storageBackend(): "supabase" | "local" {
  return supabaseStorage() ? "supabase" : "local";
}

function supabaseFetch(cfg: SupabaseStorage, pathname: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("apikey", cfg.key);
  headers.set("Authorization", `Bearer ${cfg.key}`);
  return fetch(`${cfg.url}/storage/v1${pathname}`, { ...init, headers, cache: "no-store" });
}

let bucketReady: Promise<void> | null = null;

/** Creates the private bucket on first use so there is nothing to click in the dashboard. */
function ensureBucket(cfg: SupabaseStorage): Promise<void> {
  bucketReady ??= (async () => {
    const res = await supabaseFetch(cfg, "/bucket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cfg.bucket, name: cfg.bucket, public: false }),
    });
    if (res.ok) return;
    const text = await res.text();
    // "already exists" comes back as 400 or 409 depending on the API version.
    if (/exist/i.test(text)) return;
    throw new Error(`Could not create storage bucket (${res.status}): ${text.slice(0, 200)}`);
  })().catch((err) => {
    bucketReady = null;
    throw err;
  });
  return bucketReady;
}

async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  assertKey(key);
  const cfg = supabaseStorage();
  if (!cfg) {
    const full = resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
    return;
  }
  const send = () =>
    supabaseFetch(cfg, `/object/${cfg.bucket}/${key}`, {
      method: "POST",
      headers: { "Content-Type": contentType, "x-upsert": "true", "Cache-Control": "max-age=31536000" },
      body: new Uint8Array(body),
    });
  let res = await send();
  if (!res.ok && (res.status === 404 || res.status === 400)) {
    const text = await res.text();
    if (!/bucket/i.test(text)) throw new Error(`Storage upload failed (${res.status}): ${text.slice(0, 200)}`);
    await ensureBucket(cfg);
    res = await send();
  }
  if (!res.ok) throw new Error(`Storage upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

export type StoredImage = {
  storageKey: string;
  thumbKey: string;
  mime: string;
  bytes: number;
  width: number;
  height: number;
};

/**
 * Validates the bytes are really an image, auto-rotates, resizes, strips all
 * metadata (EXIF/GPS) and writes a full-size copy plus a WebP thumbnail.
 * The original is never kept.
 */
export async function storeImage(eventId: string, photoId: string, input: Buffer): Promise<StoredImage> {
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: 80_000_000 }).metadata();
  } catch {
    throw new UploadError("That file isn't a photo we can read. JPG, PNG, WebP or HEIC work best.");
  }
  if (!meta.format || !READABLE.has(meta.format)) {
    throw new UploadError("That file isn't a photo we can read. JPG, PNG, WebP or HEIC work best.");
  }
  const keepPng = meta.format === "png" && meta.hasAlpha === true;

  const full = sharp(input, { limitInputPixels: 80_000_000 })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });
  const { data, info } = await (keepPng ? full.png({ compressionLevel: 8 }) : full.jpeg({ quality: 85, mozjpeg: true })).toBuffer({
    resolveWithObject: true,
  });
  const thumb = await sharp(input, { limitInputPixels: 80_000_000 })
    .rotate()
    .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  const ext = keepPng ? "png" : "jpg";
  const storageKey = `${eventId}/${photoId}.${ext}`;
  const thumbKey = `${eventId}/${photoId}.thumb.webp`;
  await putObject(storageKey, data, keepPng ? "image/png" : "image/jpeg");
  try {
    await putObject(thumbKey, thumb, "image/webp");
  } catch (err) {
    await removeStored([storageKey]).catch(() => {});
    throw err;
  }
  return {
    storageKey,
    thumbKey,
    mime: keepPng ? "image/png" : "image/jpeg",
    bytes: data.byteLength,
    width: info.width,
    height: info.height,
  };
}

export async function readStored(key: string): Promise<Buffer> {
  assertKey(key);
  const cfg = supabaseStorage();
  if (!cfg) return readFile(resolveKey(key));
  const res = await supabaseFetch(cfg, `/object/${cfg.bucket}/${key}`);
  if (!res.ok) throw new Error(`Storage read failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

export async function removeStored(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  keys.forEach(assertKey);
  const cfg = supabaseStorage();
  if (!cfg) {
    await Promise.all(keys.map((k) => rm(resolveKey(k), { force: true })));
    return;
  }
  const res = await supabaseFetch(cfg, `/object/${cfg.bucket}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: keys }),
  });
  if (!res.ok) throw new Error(`Storage delete failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
}
