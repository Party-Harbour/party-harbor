import type { Metadata } from "next";
import Link from "next/link";
import { sendDigestNow, updateDigestSettings } from "@/actions/digest";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { Button, Card, EmptyState, Field, PageHeader, Pill, SectionTitle, Select } from "@/components/ui";
import type { Digest } from "@/db/schema";
import { requireHost } from "@/lib/auth";
import { COMMON_TIME_ZONES, WEEKDAY_LABEL, formatDateTime } from "@/lib/dates";
import { getDigestUser, listDigests, summaryOf, whenLabel, type DigestEvent } from "@/lib/digest";

export const metadata: Metadata = { title: "Digest" };

const STATUS_TONE = { ready: "info", sent: "good", failed: "bad" } as const;
const STATUS_LABEL = { ready: "In app", sent: "Texted", failed: "Text failed" } as const;

export default async function DigestPage() {
  const host = await requireHost();
  const [user, history] = await Promise.all([getDigestUser(host.id), listDigests(host.id)]);
  if (!user) return null;
  const latest = history[0];
  const summary = latest ? summaryOf(latest) : null;
  const tz = user.timezone;
  const zones = COMMON_TIME_ZONES.includes(tz) ? COMMON_TIME_ZONES : [tz, ...COMMON_TIME_ZONES];
  const provider = (process.env.MESSAGING_PROVIDER ?? "log").toLowerCase();

  return (
    <>
      <PageHeader
        title="Digest"
        subtitle="Where every event stands, what changed since last time, and anything that needs a look. Texted to you on a schedule and kept here."
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <SectionTitle>Latest digest</SectionTitle>
              {latest ? <DigestMeta d={latest} tz={tz} /> : null}
            </div>
            {!latest || !summary ? (
              <EmptyState>
                No digest yet. The first scheduled one arrives at {user.digestHour}:00 {user.timezone}, or send one now from the right.
              </EmptyState>
            ) : summary.events.length === 0 ? (
              <EmptyState>Nothing on the calendar at the moment, so there was nothing to report.</EmptyState>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-navy/70">
                  {summary.alertCount === 0 ? "Nothing needs attention." : `${summary.alertCount} thing${summary.alertCount === 1 ? "" : "s"} need a look.`}{" "}
                  Covers changes since {formatDateTime(new Date(summary.since), tz)}.
                </p>
                {summary.events.map((e) => (
                  <EventCard key={e.id} e={e} />
                ))}
                <details className="rounded-xl bg-white p-4 shadow-card ring-1 ring-navy/5">
                  <summary className="cursor-pointer text-sm font-medium text-navy">Text version (what gets sent)</summary>
                  <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-navy">{latest.body}</pre>
                </details>
              </div>
            )}
          </section>

          {history.length > 1 ? (
            <section>
              <SectionTitle>Earlier</SectionTitle>
              <ul className="divide-y divide-navy/10 rounded-xl bg-white shadow-card ring-1 ring-navy/5">
                {history.slice(1).map((d) => {
                  const s = summaryOf(d);
                  return (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <span className="text-navy">
                        {formatDateTime(d.createdAt, tz)}
                        <span className="text-navy/60">
                          {" "}
                          · {d.trigger === "manual" ? "sent by hand" : "scheduled"}
                          {s ? ` · ${s.events.length} event${s.events.length === 1 ? "" : "s"}, ${s.alertCount} alert${s.alertCount === 1 ? "" : "s"}` : ""}
                        </span>
                      </span>
                      <DigestMeta d={d} tz={tz} compact />
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <SectionTitle>Send one now</SectionTitle>
            <p className="mb-3 text-sm text-navy/70">
              Handy before a planning chat. {user.phoneE164 ? `Goes to ${user.phoneE164} and shows here.` : "Shows here; add a mobile number below to get it by text."}
            </p>
            <ActionForm action={sendDigestNow}>
              <Button type="submit">
                <Icon.Mail size={16} /> Send me a digest
              </Button>
            </ActionForm>
          </Card>

          <Card>
            <SectionTitle>Schedule</SectionTitle>
            <ActionForm action={updateDigestSettings} className="space-y-3">
              <Field label="How often" name="digestFrequency">
                <Select id="f-digestFrequency" name="digestFrequency" defaultValue={user.digestFrequency}>
                  <option value="daily">Every day</option>
                  <option value="weekly">Once a week</option>
                  <option value="off">Off</option>
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="At" name="digestHour">
                  <Select id="f-digestHour" name="digestHour" defaultValue={String(user.digestHour)}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {h === 0 ? "12 am" : h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="On (weekly)" name="digestWeekday">
                  <Select id="f-digestWeekday" name="digestWeekday" defaultValue={String(user.digestWeekday)}>
                    {WEEKDAY_LABEL.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Your time zone" name="timezone">
                <Select id="f-timezone" name="timezone" defaultValue={tz}>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Mobile number (optional)"
                name="phone"
                type="tel"
                defaultValue={user.phoneE164 ?? ""}
                placeholder="+1 555 123 4567"
                hint={
                  provider === "log"
                    ? "Texts are printed to the dev server console until a provider is configured."
                    : "Digests go out through the same provider as guest messages."
                }
              />
              <Button type="submit" variant="ghost" className="border border-navy/20">
                Save
              </Button>
            </ActionForm>
            <p className="mt-3 text-xs text-navy/60">
              One digest per period, however many times the heartbeat runs. If the server was asleep at the hour, it catches up as soon as it&apos;s back that same day.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

function DigestMeta({ d, tz, compact }: { d: Digest; tz: string; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2 text-xs text-navy/60">
      {!compact ? formatDateTime(d.createdAt, tz) : null}
      <Pill tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Pill>
      {d.status === "failed" && d.error && !compact ? <span className="text-coral-deep">{d.error}</span> : null}
    </span>
  );
}

function EventCard({ e }: { e: DigestEvent }) {
  const r = e.rsvp;
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-navy">
          <Link href={`/events/${e.id}`} className="hover:underline">
            {e.title}
          </Link>
        </h3>
        <span className="text-sm font-semibold text-coral-deep">{whenLabel(e)}</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Attending" value={r.attending} hint={`${r.headcount} people${r.newReplies ? ` · +${r.newReplies} new` : ""}`} />
        <Stat label="No reply" value={r.pending} hint={`${r.invited} invited`} />
        <Stat label="Open tasks" value={e.tasks.open} hint={e.tasks.overdue ? `${e.tasks.overdue} overdue` : undefined} warn={e.tasks.overdue > 0} />
        <Stat label="Slots open" value={e.contributions.unfilled} hint={`of ${e.contributions.slots}${e.contributions.newClaims ? ` · +${e.contributions.newClaims} new` : ""}`} />
      </dl>
      {e.contest || e.photos.added || e.messages.upcoming.length || e.tasks.dueSoon.length ? (
        <ul className="mt-3 space-y-1 text-sm text-navy/80">
          {e.contest ? (
            <li>
              {e.contest.title}: {e.contest.status.replace("_", " ")}, {e.contest.entries} entries, {e.contest.votes} votes
            </li>
          ) : null}
          {e.tasks.dueSoon.length ? <li>Due in the next two days: {e.tasks.dueSoon.join("; ")}</li> : null}
          {e.photos.added ? <li>{e.photos.added} new photo{e.photos.added === 1 ? "" : "s"}</li> : null}
          {e.messages.upcoming.length ? <li>Going out in the next 24 hours: {e.messages.upcoming.join("; ")}</li> : null}
        </ul>
      ) : null}
      {e.alerts.length ? (
        <ul className="mt-3 space-y-1">
          {e.alerts.map((a) => (
            <li key={a} className="flex items-start gap-2 rounded-md bg-peach/50 px-3 py-1.5 text-sm text-navy">
              <Icon.Alert size={16} className="mt-0.5 shrink-0 text-coral-deep" />
              {a}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: number; hint?: string; warn?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-navy/60">{label}</dt>
      <dd className={"text-xl font-semibold " + (warn ? "text-coral-deep" : "text-navy")}>{value}</dd>
      {hint ? <dd className="text-xs text-navy/60">{hint}</dd> : null}
    </div>
  );
}
