import { notFound } from "next/navigation";
import { setEventStatus } from "@/actions/events";
import { saveEventAsTemplate } from "@/actions/templates";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { Button, Card, EVENT_STATUS_LABEL, Field, LinkButton, SectionTitle, Stat } from "@/components/ui";
import type { Event } from "@/db/schema";
import { formatDateTime } from "@/lib/dates";
import { CONTEST_STATUS_LABEL, getContestView } from "@/lib/contest";
import { getEventTasks, listEventSummaries } from "@/lib/queries";

const NEXT_STATUS: Partial<Record<Event["status"], Event["status"][]>> = {
  draft: ["invitations_open"],
  invitations_open: ["rsvp_closed", "live"],
  rsvp_closed: ["live", "invitations_open"],
  live: ["memories"],
  memories: ["archived"],
  archived: ["memories"],
};

export default async function EventOverviewPage({ params, searchParams }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const { setup, skipped } = await searchParams;
  const summaries = await listEventSummaries();
  const event = summaries.find((e) => e.id === id);
  if (!event) notFound();
  const [tasks, contest] = await Promise.all([getEventTasks(id), getContestView(id)]);
  const openTasks = tasks.filter((t) => t.status !== "done").slice(0, 5);
  const votesCast = contest
    ? Object.values(contest.tallies).reduce(
        (n, byEntry) => n + Object.values(byEntry).reduce((a, b) => a + b, 0),
        0,
      )
    : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        {typeof setup === "string" && setup ? (
          <p role="status" className="rounded-md bg-sage/40 px-3 py-2 text-sm text-navy">
            Set up from “{setup}”. Have a look at the Tasks, Contributions, Contest and Messages tabs and change anything you like.
            {typeof skipped === "string" && Number(skipped) > 0
              ? ` ${skipped} scheduled message${skipped === "1" ? " was" : "s were"} left out because its send time has already passed.`
              : ""}
          </p>
        ) : null}
        <section>
          <SectionTitle>At a glance</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Invited" value={event.invited} hint="households" />
            <Stat label="Attending" value={event.attending} hint={`${event.headcount} people`} />
            <Stat label="Awaiting reply" value={event.pending} />
            <Stat
              label="Open tasks"
              value={event.openTasks}
              hint={event.overdueTasks ? `${event.overdueTasks} overdue` : undefined}
            />
          </div>
        </section>

        <Card>
          <SectionTitle>Details</SectionTitle>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="When">
              {formatDateTime(event.startsAt, event.timezone)}
              {event.endsAt ? ` → ${formatDateTime(event.endsAt, event.timezone)}` : ""}
            </Detail>
            <Detail label="Where">
              {event.venueName ?? "—"}
              {event.venueAddress ? <span className="block text-navy/70">{event.venueAddress}</span> : null}
            </Detail>
            <Detail label="RSVP deadline">
              {event.rsvpDeadline ? formatDateTime(event.rsvpDeadline, event.timezone) : "None"}
            </Detail>
            <Detail label="Time zone">{event.timezone}</Detail>
            {event.description ? (
              <Detail label="Description" wide>
                {event.description}
              </Detail>
            ) : null}
            {event.whatToBring ? (
              <Detail label="What to bring" wide>
                {event.whatToBring}
              </Detail>
            ) : null}
          </dl>
          <div className="mt-4">
            <LinkButton href={`/events/${event.id}/edit`} variant="ghost">
              Edit details
            </LinkButton>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <SectionTitle>Status</SectionTitle>
          <p className="mb-3 text-sm text-navy/70">
            Currently <strong>{EVENT_STATUS_LABEL[event.status]}</strong>.
            {event.status === "draft" ? " Guests can't open their links until invitations are open." : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {(NEXT_STATUS[event.status] ?? []).map((s) => (
              <form key={s} action={setEventStatus}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="status" value={s} />
                <Button type="submit" variant={s === "archived" ? "danger" : "secondary"}>
                  Mark {EVENT_STATUS_LABEL[s].toLowerCase()}
                </Button>
              </form>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle>Contest</SectionTitle>
          {contest ? (
            <p className="text-sm text-navy/70">
              <strong className="text-navy">{contest.contest.title}</strong> ·{" "}
              {CONTEST_STATUS_LABEL[contest.contest.status]} · {contest.entries.length} entries ·{" "}
              {votesCast} votes cast
            </p>
          ) : (
            <p className="text-sm text-navy/70">No contest set up for this event.</p>
          )}
          <div className="mt-3">
            <LinkButton href={`/events/${event.id}/contest`} variant="ghost">
              {contest ? "Manage contest" : "Set up a contest"}
            </LinkButton>
          </div>
        </Card>

        <Card>
          <SectionTitle>Next tasks</SectionTitle>
          {openTasks.length === 0 ? (
            <p className="text-sm text-navy/60">All caught up.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {openTasks.map((t) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <span>{t.title}</span>
                  <span className="text-navy/60">{t.assigneeName ?? "Unassigned"}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <LinkButton href={`/events/${event.id}/tasks`} variant="ghost">
              All tasks
            </LinkButton>
          </div>
        </Card>

        <Card>
          <SectionTitle>Reuse this plan</SectionTitle>
          <p className="text-sm text-navy/70">
            Settings, tasks, contribution slots, the contest set-up and reminders tied to the date. Guests, RSVPs, entries and photos stay here.
          </p>
          <div className="mt-3">
            <LinkButton href={`/events/new?from=${event.id}`} variant="secondary">
              <Icon.Layers size={16} /> Clone for next time
            </LinkButton>
          </div>
          <ActionForm action={saveEventAsTemplate.bind(null, event.id)} className="mt-4 space-y-2">
            <Field label="Save as a template" name="name" defaultValue={event.title} maxLength={120} placeholder="Template name" />
            <Button type="submit" variant="ghost" className="border border-navy/20">
              Save template
            </Button>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs uppercase tracking-wide text-navy/60">{label}</dt>
      <dd className="whitespace-pre-line text-navy">{children}</dd>
    </div>
  );
}
