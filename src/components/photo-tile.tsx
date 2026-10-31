import type { ReactNode } from "react";
import type { Photo } from "@/db/schema";
import { photoUrl } from "@/lib/gallery/urls";

/** Thumbnail image served by the authenticated proxy (plain img: same-origin, no loader). */
export function PhotoThumb({
  id,
  alt = "",
  token,
  className = "h-10 w-10 rounded-md",
}: {
  id: string;
  alt?: string;
  token?: string;
  className?: string;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={photoUrl(id, "thumb", { token })} alt={alt} loading="lazy" className={`shrink-0 object-cover ${className}`} />;
}

export function PhotoGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{children}</ul>;
}

export function PhotoTile({
  photo,
  token,
  byline,
  badge,
  actions,
}: {
  photo: Pick<Photo, "id" | "caption" | "state" | "createdAt">;
  token?: string;
  byline?: string | null;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  const alt = photo.caption ?? "Party photo";
  return (
    <li className="group overflow-hidden rounded-xl bg-white shadow-card ring-1 ring-navy/5">
      <a
        href={photoUrl(photo.id, "full", { token })}
        target="_blank"
        rel="noopener"
        className="relative block aspect-square bg-cream"
        aria-label={`Open ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl(photo.id, "thumb", { token })}
          alt={alt}
          loading="lazy"
          className={"h-full w-full object-cover transition group-hover:scale-[1.02] " + (photo.state === "visible" ? "" : "opacity-60")}
        />
        {badge ? <div className="absolute left-2 top-2">{badge}</div> : null}
      </a>
      {photo.caption || byline || actions ? (
        <div className="space-y-1 px-2.5 py-2 text-xs">
          {photo.caption ? <p className="line-clamp-2 text-navy">{photo.caption}</p> : null}
          {byline ? <p className="text-navy/60">{byline}</p> : null}
          {actions ? <div className="flex flex-wrap gap-1 pt-1">{actions}</div> : null}
        </div>
      ) : null}
    </li>
  );
}

export const smallActionClass = "min-h-8 rounded-md border border-navy/20 bg-white px-2 text-xs font-medium text-navy hover:bg-sky/40";
export const smallDangerClass = "min-h-8 rounded-md border border-coral-deep/40 bg-white px-2 text-xs font-medium text-coral-deep hover:bg-coral/15";
