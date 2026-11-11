"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "./icons";
import { MAX_FILES_PER_UPLOAD } from "@/lib/gallery/urls";

/** Photos at or under this size are sent untouched; larger ones are shrunk first. */
const SEND_AS_IS_BYTES = 3 * 1024 * 1024;
/** A little above the server's stored size so its own resize has pixels to work with. */
const SHRINK_EDGE = 2400;

/**
 * Phone photos run 5-12 MB and serverless hosts refuse request bodies over a
 * few MB, so big photos are redrawn smaller as JPEG before sending. Anything
 * the browser can't decode (or that is already small) goes up unchanged and
 * the server has the final say.
 */
async function shrink(file: File): Promise<File> {
  if (file.size <= SEND_AS_IS_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, SHRINK_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    for (const quality of [0.86, 0.72, 0.58]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= SEND_AS_IS_BYTES) {
        const base = file.name.includes(".") ? file.name.slice(0, file.name.lastIndexOf(".")) : file.name || "photo";
        return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
      }
    }
  } catch {
    // Not decodable here (some HEIC, odd formats): let the server try the original.
  }
  return file;
}

/**
 * A multipart form posting to /api/photos/upload. Without JavaScript it is a
 * plain form post. With it, photos are shrunk in the browser and sent one per
 * request, with a running count. `fields` carries the authorization context
 * (token, or eventId for hosts).
 */
export function PhotoUpload({
  fields,
  returnTo,
  buttonClass = "bg-navy text-white hover:bg-navy/90",
  label = "Add photos",
  single = false,
  withCaption = true,
}: {
  fields: Record<string, string>;
  returnTo: string;
  buttonClass?: string;
  label?: string;
  single?: boolean;
  withCaption?: boolean;
}) {
  const [count, setCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const picker = form.elements.namedItem("files");
    const chosen = picker instanceof HTMLInputElement ? Array.from(picker.files ?? []) : [];
    if (chosen.length === 0) return;
    const caption = form.elements.namedItem("caption");
    setSending(true);

    const files = chosen.slice(0, MAX_FILES_PER_UPLOAD);
    const errors: string[] = [];
    if (chosen.length > files.length) errors.push(`Up to ${MAX_FILES_PER_UPLOAD} photos at a time; the first ${files.length} were sent.`);
    let stored = 0;
    for (let i = 0; i < files.length; i++) {
      const original = files[i];
      setProgress(files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : "Uploading…");
      const body = new FormData();
      for (const [k, v] of Object.entries(fields)) body.set(k, v);
      body.set("returnTo", returnTo);
      body.set("respond", "json");
      if (caption instanceof HTMLInputElement && caption.value.trim()) body.set("caption", caption.value.trim());
      const file = await shrink(original);
      body.set("files", file, file.name);
      try {
        const res = await fetch("/api/photos/upload", { method: "POST", body });
        if (res.status === 413) {
          errors.push(`${original.name || "photo"}: too large to send. Try a smaller copy.`);
          continue;
        }
        const result = (await res.json()) as { stored?: number; error?: string | null };
        stored += result.stored ?? 0;
        if (result.error) errors.push(result.error);
      } catch {
        errors.push(`${original.name || "photo"}: the upload didn't go through.`);
      }
    }

    const next = new URL(returnTo, window.location.origin);
    next.searchParams.delete("photos");
    next.searchParams.delete("photoError");
    if (stored > 0) next.searchParams.set("photos", String(stored));
    if (errors.length > 0) next.searchParams.set("photoError", errors.join(" "));
    window.location.assign(next);
  }
  const id = `upload-${Object.values(fields).join("-").replace(/[^a-z0-9]/gi, "").slice(0, 24)}`;

  return (
    <form
      method="post"
      action="/api/photos/upload"
      encType="multipart/form-data"
      onSubmit={onSubmit}
      className={single ? "mt-2 flex flex-wrap items-center gap-2 text-sm" : "space-y-3"}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="returnTo" value={returnTo} />
      <label
        htmlFor={id}
        className={
          single
            ? "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-navy/20 bg-white px-2.5 text-xs font-medium text-navy hover:bg-cream"
            : "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-navy/20 bg-cream/60 px-4 py-4 text-center text-sm text-navy hover:border-navy/40"
        }
      >
        <Icon.Camera size={single ? 14 : 22} className="text-navy/60" />
        <span className="font-medium">
          {count === 0
            ? single
              ? "Choose a photo"
              : "Choose photos"
            : `${count} photo${count === 1 ? "" : "s"} selected`}
        </span>
        {!single ? (
          <span className="text-xs text-navy/60">
            JPG, PNG, WebP or HEIC · up to {MAX_FILES_PER_UPLOAD} at a time · 20 MB each
          </span>
        ) : null}
        <input
          id={id}
          type="file"
          name="files"
          accept="image/*"
          multiple={!single}
          required
          className="sr-only"
          onChange={(e) => setCount(e.currentTarget.files?.length ?? 0)}
        />
      </label>
      {withCaption && !single ? (
        <input
          type="text"
          name="caption"
          maxLength={200}
          placeholder="Caption (optional)"
          className="min-h-11 w-full rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm text-navy placeholder:text-navy/40"
        />
      ) : null}
      <button
        type="submit"
        disabled={sending || count === 0}
        className={
          (single ? "min-h-9 rounded-md px-3 text-xs font-medium " : "inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium ") +
          "transition disabled:opacity-50 " +
          buttonClass
        }
      >
        {sending ? progress || "Uploading…" : label}
      </button>
    </form>
  );
}
