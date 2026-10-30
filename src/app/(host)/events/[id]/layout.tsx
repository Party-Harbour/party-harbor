import { notFound } from "next/navigation";
import { EventCover } from "@/components/event-cover";
import { EventTabs } from "@/components/event-tabs";
import { Icon } from "@/components/icons";
import { EVENT_STATUS_LABEL, EVENT_STATUS_TONE, Pill } from "@/components/ui";
import { countdownLabel, formatDateTime } from "@/lib/dates";
import { getEvent } from "@/lib/queries";
import { getTheme } from "@/lib/themes";

export default async function EventLayout({ children, params }: LayoutProps<"/events/[id]">) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  const theme = getTheme(event.theme);

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-navy/5">
        <EventCover event={event} className="h-36 sm:h-44" rounded="rounded-t-2xl" />
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-navy sm:text-3xl">{event.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-navy/70">
              <span className="flex items-center gap-1.5">
                <Icon.Calendar size={15} className="text-navy/50" />
                {formatDateTime(event.startsAt, event.timezone)}
              </span>
              {event.venueName ? (
                <span className="flex items-center gap-1.5">
                  <Icon.MapPin size={15} className="text-navy/50" />
                  {event.venueName}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-coral px-3 py-1 text-sm font-semibold text-navy">
              {countdownLabel(event.startsAt, event.timezone)}
            </span>
            <Pill tone={EVENT_STATUS_TONE[event.status]}>{EVENT_STATUS_LABEL[event.status]}</Pill>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium text-navy" style={{ background: theme.chip }}>
              {theme.label}
            </span>
          </div>
        </header>
        <div className="px-5">
          <EventTabs eventId={event.id} />
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
