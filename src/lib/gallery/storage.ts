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

/** Where processed photos live. Keep it outside synced folders, like the database. */
export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads"));
}

/** Absolute path for a storage key, refusing anything that escapes the upload directory. */
export function resolveKey(key: string): string {
  const root = uploadDir();
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
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
  await mkdir(path.join(uploadDir(), eventId), { recursive: true });
  await writeFile(resolveKey(storageKey), data);
  await writeFile(resolveKey(thumbKey), thumb);
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
  return readFile(resolveKey(key));
}

export async function removeStored(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => rm(resolveKey(k), { force: true })));
}
