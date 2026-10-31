"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { MAX_FILES_PER_UPLOAD } from "@/lib/gallery/urls";

/**
 * A plain multipart form posting to /api/photos/upload. Works without
 * JavaScript; with it, shows the selected count and a sending state.
 * `fields` carries the authorization context (token, or eventId for hosts).
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
  const id = `upload-${Object.values(fields).join("-").replace(/[^a-z0-9]/gi, "").slice(0, 24)}`;

  return (
    <form
      method="post"
      action="/api/photos/upload"
      encType="multipart/form-data"
      onSubmit={() => setSending(true)}
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
        {sending ? "Uploading…" : label}
      </button>
    </form>
  );
}
