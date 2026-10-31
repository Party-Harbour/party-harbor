import type { DigestEvent, DigestSummary } from "./build";

const MAX_EVENTS = 4;

/** Short "when" wording for an event inside a digest. */
export function whenLabel(e: Pick<DigestEvent, "daysUntil">): string {
  if (e.daysUntil === 0) return "today";
  if (e.daysUntil === 1) return "tomorrow";
  if (e.daysUntil < 0) return `${-e.daysUntil} day${e.daysUntil === -1 ? "" : "s"} ago`;
  return `in ${e.daysUntil} days`;
}

const when = whenLabel;

function eventLines(e: DigestEvent): string[] {
  const lines = [`${e.title} · ${when(e)}`];
  const r = e.rsvp;
  if (r.invited > 0) {
    const bits = [`${r.attending} attending (${r.headcount} people)`];
    if (r.maybe) bits.push(`${r.maybe} maybe`);
    if (r.pending) bits.push(`${r.pending} no reply`);
    lines.push(`  RSVPs: ${bits.join(", ")}${r.newReplies ? ` · +${r.newReplies} new` : ""}`);
  } else if (e.status === "draft" || e.status === "invitations_open") {
    lines.push("  No households invited yet");
  }
  if (e.tasks.open > 0) {
    lines.push(`  Tasks: ${e.tasks.open} open${e.tasks.overdue ? `, ${e.tasks.overdue} overdue` : ""}`);
    if (e.tasks.dueSoon.length) lines.push(`  Due soon: ${e.tasks.dueSoon.join("; ")}`);
  }
  if (e.contributions.slots > 0) {
    lines.push(`  Sign-ups: ${e.contributions.unfilled} of ${e.contributions.slots} slots still open${e.contributions.newClaims ? ` · +${e.contributions.newClaims} new` : ""}`);
  }
  if (e.contest) {
    lines.push(`  ${e.contest.title}: ${e.contest.status.replace("_", " ")}, ${e.contest.entries} entries, ${e.contest.votes} votes`);
  }
  if (e.photos.added) lines.push(`  Photos: +${e.photos.added} new (${e.photos.total} total)`);
  if (e.messages.upcoming.length) lines.push(`  Going out today: ${e.messages.upcoming.join("; ")}`);
  for (const a of e.alerts) lines.push(`  ! ${a}`);
  return lines;
}

/** SMS-friendly plain text. Stays readable in an iMessage bubble and in the app. */
export function renderDigestText(summary: DigestSummary, opts: { hostName: string; baseUrl: string; dateLabel: string }): string {
  const head = `Party Harbor digest for ${opts.hostName}, ${opts.dateLabel}`;
  if (summary.events.length === 0) {
    return `${head}\nNothing on the calendar right now. Plan something at ${opts.baseUrl}/events/new`;
  }
  const shown = summary.events.slice(0, MAX_EVENTS);
  const body = shown.flatMap(eventLines);
  const more = summary.events.length - shown.length;
  if (more > 0) body.push(`+${more} more event${more === 1 ? "" : "s"}`);
  const alerts = summary.alertCount ? `${summary.alertCount} thing${summary.alertCount === 1 ? "" : "s"} need a look` : "Nothing needs attention";
  return [head, alerts, "", ...body, "", `Dashboard: ${opts.baseUrl}/dashboard`].join("\n");
}
