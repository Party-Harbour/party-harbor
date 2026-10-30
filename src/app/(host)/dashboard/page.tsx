import type { Metadata } from "next";
import Link from "next/link";
import { setTaskStatus } from "@/actions/tasks";
import { EventCover } from "@/components/event-cover";
import { Icon } from "@/components/icons";
import { Card, EVENT_STATUS_LABEL, EVENT_STATUS_TONE, EmptyState, LinkButton, Pill } from "@/components/ui";
import { requireHost } from "@/lib/auth";
import { countdownLabel, daysUntil, formatDateTime } from "@/lib/dates";
import { getEventTasks, listEventSummaries, listHouseholds, listOpenTasks, type EventSummary } from "@/lib/queries";
import { getTheme } from "@/lib/themes";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const host = await requireHost();
  const [summaries, openTasks, households] = await Promise.all([
    listEventSummaries(),
    listOpenTasks(8),
    listHouseholds(),
  ]);
  const now = new Date();
  const upcoming = summaries.filter(
    (e) => e.status !== "archived" && daysUntil(e.startsAt, e.timezone, now) >= 0,
  );
  const next = upcoming[0];
  const nextTasks = next ? await getEventTasks(next.id) : [];
  const nextDone = nextTasks.filter((t) => t.status === "done").length;
  const people = households.reduce((n, h) => n + h.members.length, 0);
  const confirmed = upcoming.reduce((n, e) => n + e.attending, 0);
  const pending = upcoming.reduce((n, e) => n + e.pending, 0);
  const dueThisWeek = openTasks.filter(
    (t) => t.dueAt && t.dueAt.getTime() - now.getTime() < 7 * 86_400_000,
  ).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-navy">
            {greeting(now.getHours())}, {host.displayName}! 👋
          </h1>
          <p className="mt-1 text-sm text-navy/70">
            {upcoming.length === 0
              ? "Nothing on the horizon yet."
              : `You have ${upcoming.length} upcoming ${upcoming.length === 1 ? "event" : "events"} and ${dueThisWeek} ${dueThisWeek === 1 ? "task" : "tasks"} due this week.`}
          </p>
        </div>
        <LinkButton href="/events/new">
          <Icon.Plus size={16} /> Create event
        </LinkButton>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<Icon.Calendar size={20} />} tone="bg-coral/25 text-coral-deep" value={upcoming.length} label="Upcoming events" />
        <StatTile icon={<Icon.Users size={20} />} tone="bg-sky text-navy" value={people} label="People in contacts" hint={`${households.length} households`} />
        <StatTile icon={<Icon.CheckSquare size={20} />} tone="bg-sage text-sage-deep" value={confirmed} label="RSVPs confirmed" />
        <StatTile icon={<Icon.Clock size={20} />} tone="bg-sun/40 text-navy" value={pending} label="Awaiting reply" />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy">Upcoming events</h2>
          <Link href="/events" className="flex items-center gap-1 text-sm font-medium text-navy hover:underline">
            View all <Icon.ArrowRight size={14} />
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <EmptyState>
            Nothing on the calendar yet.{" "}
            <Link href="/events/new" className="underline">
              Create an event
            </Link>
            .
          </EmptyState>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {upcoming.slice(0, 6).map((e) => (
              <EventCard key={e.id} event={e} now={now} />
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy">My tasks</h2>
            {next ? (
              <Link href={`/events/${next.id}/tasks`} className="text-sm font-medium text-navy hover:underline">
                View all
              </Link>
            ) : null}
          </div>
          {openTasks.length === 0 ? (
            <p className="text-sm text-navy/60">All caught up.</p>
          ) : (
            <ul className="divide-y divide-navy/10">
              {openTasks.map((t) => {
                const overdue = t.dueAt ? t.dueAt < now : false;
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                    <form action={setTaskStatus}>
                      <input type="hidden" name="taskId" value={t.id} />
                      <input type="hidden" name="eventId" value={t.eventId} />
                      <input type="hidden" name="status" value="done" />
                      <button
                        type="submit"
                        aria-label={`Mark “${t.title}” done`}
                        className="flex h-6 w-6 items-center justify-center rounded-md border-2 border-coral text-transparent hover:bg-coral/20 hover:text-navy"
                      >
                        <Icon.Check size={14} />
                      </button>
                    </form>
                    <div className="min-w-0 flex-1">
                      <Link href={`/events/${t.eventId}/tasks`} className="block truncate font-medium text-navy hover:underline">
                        {t.title}
                      </Link>
                      <span className="text-xs text-navy/60">
                        {t.eventTitle}
                        {t.assigneeName ? ` · ${t.assigneeName}` : ""}
                      </span>
                    </div>
                    {t.dueAt ? (
                      <span className={"whitespace-nowrap text-xs " + (overdue ? "font-semibold text-coral-deep" : "text-navy/60")}>
                        {overdue ? "Overdue" : countdownLabel(t.dueAt, t.eventTimezone, now)}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-lg font-semibold text-navy">Quick actions</h2>
            <div className="grid gap-2">
              <QuickAction href="/events/new" icon={<Icon.Plus size={16} />}>New event</QuickAction>
              <QuickAction href="/contacts" icon={<Icon.Users size={16} />}>Add a household</QuickAction>
              {next ? (
                <QuickAction href={`/events/${next.id}/guests`} icon={<Icon.Link size={16} />}>
                  Invite guests to {next.title}
                </QuickAction>
              ) : null}
            </div>
          </Card>
          {next ? (
            <Card>
              <h2 className="text-lg font-semibold text-navy">Planning progress</h2>
              <p className="text-sm text-navy/70">{next.title}</p>
              <Progress done={nextDone} total={nextTasks.length} />
              <p className="mt-2 text-xs text-navy/60">
                {next.attending} of {next.invited} households confirmed
                {next.invited ? ` (${Math.round((next.attending / next.invited) * 100)}%)` : ""}
              </p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  tone,
  value,
  label,
  hint,
}: {
  icon: React.ReactNode;
  tone: string;
  value: number;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-navy/5">
      <span className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-xl " + tone}>{icon}</span>
      <div className="min-w-0">
        <div className="font-display text-2xl font-semibold leading-none text-navy">{value}</div>
        <div className="truncate text-sm text-navy/70">{label}</div>
        {hint ? <div className="text-xs text-navy/50">{hint}</div> : null}
      </div>
    </div>
  );
}

function EventCard({ event: e, now }: { event: EventSummary; now: Date }) {
  const pct = e.invited ? Math.round((e.attending / e.invited) * 100) : 0;
  const theme = getTheme(e.theme);
  return (
    <li className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-navy/5">
      <Link href={`/events/${e.id}`} className="block focus-visible:outline-2 focus-visible:outline-sky">
        <EventCover event={e} className="h-36" />
      </Link>
      <div className="space-y-2 p-4">
        <Link href={`/events/${e.id}`} className="block font-display text-lg font-semibold leading-tight text-navy hover:underline">
          {e.title}
        </Link>
        <ul className="space-y-1 text-sm text-navy/80">
          <li className="flex items-center gap-2">
            <Icon.Calendar size={15} className="shrink-0 text-navy/50" />
            {formatDateTime(e.startsAt, e.timezone)}
          </li>
          {e.venueName ? (
            <li className="flex items-center gap-2">
              <Icon.MapPin size={15} className="shrink-0 text-navy/50" />
              {e.venueName}
            </li>
          ) : null}
          <li className="flex items-center gap-2">
            <Icon.Users size={15} className="shrink-0 text-navy/50" />
            {e.invited} invited · {e.attending} confirmed{e.invited ? ` (${pct}%)` : ""}
          </li>
          <li className="flex items-center gap-2">
            <Icon.Clock size={15} className="shrink-0 text-coral-deep" />
            <span className="font-semibold text-coral-deep">{countdownLabel(e.startsAt, e.timezone, now)}</span>
            {e.pending ? <span className="text-navy/60">· {e.pending} pending</span> : null}
          </li>
        </ul>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Pill tone={EVENT_STATUS_TONE[e.status]}>{EVENT_STATUS_LABEL[e.status]}</Pill>
          <span className="rounded-full px-2.5 py-0.5 text-xs font-medium text-navy" style={{ background: theme.chip }}>
            {theme.label}
          </span>
          {e.openTasks ? (
            <Pill tone={e.overdueTasks ? "bad" : "neutral"}>
              {e.openTasks} task{e.openTasks === 1 ? "" : "s"}
              {e.overdueTasks ? ` · ${e.overdueTasks} overdue` : ""}
            </Pill>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function QuickAction({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-2 rounded-lg border border-navy/15 px-3 text-sm font-medium text-navy hover:bg-cream"
    >
      {icon}
      {children}
    </Link>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-navy/60">
        <span>Tasks</span>
        <span>
          {done}/{total} · {pct}%
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-cream">
        <div className="h-full rounded-full bg-sage-deep" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
