import type { Metadata } from "next";
import Link from "next/link";
import { EventCover } from "@/components/event-cover";
import { Icon } from "@/components/icons";
import {
  EVENT_STATUS_LABEL,
  EVENT_STATUS_TONE,
  EmptyState,
  LinkButton,
  PageHeader,
  Pill,
  SectionTitle,
} from "@/components/ui";
import { countdownLabel, daysUntil, formatDateTime } from "@/lib/dates";
import { listEventSummaries, type EventSummary } from "@/lib/queries";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  const all = await listEventSummaries();
  const now = new Date();
  const upcoming = all.filter((e) => daysUntil(e.startsAt, e.timezone, now) >= 0);
  const past = all.filter((e) => daysUntil(e.startsAt, e.timezone, now) < 0).reverse();

  return (
    <>
      <PageHeader
        title="Events"
        subtitle={`${all.length} total`}
        actions={
          <LinkButton href="/events/new">
            <Icon.Plus size={16} /> New event
          </LinkButton>
        }
      />
      <SectionTitle>Upcoming</SectionTitle>
      <EventList events={upcoming} now={now} empty="No upcoming events." />
      <div className="mt-8">
        <SectionTitle>Past</SectionTitle>
        <EventList events={past} now={now} empty="No past events yet." />
      </div>
    </>
  );
}

function EventList({ events, now, empty }: { events: EventSummary[]; now: Date; empty: string }) {
  if (events.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {events.map((e) => (
        <li key={e.id} className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-navy/5">
          <Link href={`/events/${e.id}`} className="block">
            <EventCover event={e} className="h-32" />
          </Link>
          <div className="space-y-1.5 p-4">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/events/${e.id}`} className="font-display text-lg font-semibold leading-tight text-navy hover:underline">
                {e.title}
              </Link>
              <Pill tone={EVENT_STATUS_TONE[e.status]}>{EVENT_STATUS_LABEL[e.status]}</Pill>
            </div>
            <p className="flex items-center gap-2 text-sm text-navy/80">
              <Icon.Calendar size={15} className="text-navy/50" />
              {formatDateTime(e.startsAt, e.timezone)}
            </p>
            <p className="text-sm text-navy/70">
              <span className="font-semibold text-coral-deep">{countdownLabel(e.startsAt, e.timezone, now)}</span> ·{" "}
              {e.attending} attending · {e.pending} awaiting reply
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
