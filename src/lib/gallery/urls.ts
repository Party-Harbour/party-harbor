// Client-safe helpers (no server-only import): used by server and client components.

export type PhotoVariant = "full" | "thumb";

/**
 * URL for a photo served by the authenticated proxy. Hosts are authorized by
 * session; guests pass their invitation token, which scopes access to that
 * event. The event's cover photo is public to anyone with the link.
 */
export function photoUrl(id: string, variant: PhotoVariant, opts: { token?: string; download?: boolean } = {}): string {
  const q = new URLSearchParams();
  if (opts.token) q.set("t", opts.token);
  if (opts.download) q.set("download", "1");
  const qs = q.toString();
  return `/api/photos/${id}/${variant}${qs ? `?${qs}` : ""}`;
}

export const MAX_FILES_PER_UPLOAD = 12;
