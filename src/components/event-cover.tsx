import type { Event } from "@/db/schema";
import { getTheme, themeVars } from "@/lib/themes";

function monthDay(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { month: get("month").toUpperCase(), day: get("day") };
}

/**
 * Cover art for an event: the host's photo when one is set, otherwise a themed
 * gradient with the theme's glyphs. Carries the month/day badge from the mock-ups.
 */
export function EventCover({
  event,
  className = "h-40",
  badge = true,
  rounded = "rounded-t-2xl",
}: {
  event: Pick<Event, "title" | "startsAt" | "timezone" | "theme" | "coverImageUrl">;
  className?: string;
  badge?: boolean;
  rounded?: string;
}) {
  const theme = getTheme(event.theme);
  const { month, day } = monthDay(event.startsAt, event.timezone);
  return (
    <div className={`relative w-full overflow-hidden ${rounded} ${className}`} style={themeVars(theme)}>
      {event.coverImageUrl ? (
        // Host-supplied URL; plain img keeps external hosts out of next.config.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.coverImageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-5xl"
          style={{
            background: "linear-gradient(135deg, var(--t-g1), var(--t-g2) 55%, var(--t-g3))",
          }}
        >
          <span className="drop-shadow-sm" aria-hidden>
            {theme.glyphs}
          </span>
        </div>
      )}
      {badge ? (
        <div className="absolute bottom-3 left-3 rounded-lg bg-white px-2.5 py-1 text-center shadow">
          <div className="text-[10px] font-semibold tracking-wide text-coral-deep">{month}</div>
          <div className="-mt-0.5 text-lg font-bold leading-6 text-navy">{day}</div>
        </div>
      ) : null}
    </div>
  );
}
