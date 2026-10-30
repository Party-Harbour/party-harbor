import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelMessageAction, createMessage, retryJobAction, runQueueNow } from "@/actions/messages";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { Button, Card, EmptyState, Field, Pill, SectionTitle, Select, TextArea } from "@/components/ui";
import { MESSAGE_SEGMENTS, type MessageJob } from "@/db/schema";
import { formatDateTime, utcToWall } from "@/lib/dates";
import { QUIET_HOURS, resolveRecipients, summarizeReach } from "@/lib/messaging/queue";
import { listEventMessages } from "@/lib/messaging/queries";
import { PLACEHOLDERS, SEGMENT_LABEL, TEMPLATES } from "@/lib/messaging/templates";
import { getEvent } from "@/lib/queries";

const JOB_TONE: Record<MessageJob["state"], "neutral" | "good" | "warn" | "bad" | "info"> = {
  queued: "info",
  sending: "info",
  sent: "good",
  failed: "warn",
  dead: "bad",
  cancelled: "neutral",
  skipped: "neutral",
};

const MESSAGE_TONE = { scheduled: "info", sending: "warn", sent: "good", cancelled: "neutral" } as const;

export default async function MessagesPage({ params, searchParams }: PageProps<"/events/[id]/messages">) {
  const { id } = await params;
  const { template: templateKey } = await searchParams;
  const event = await getEvent(id);
  if (!event) notFound();
  const template = TEMPLATES.find((t) => t.key === templateKey);
  const [list, ...reaches] = await Promise.all([
    listEventMessages(id),
    ...MESSAGE_SEGMENTS.map(async (s) => ({ segment: s, reach: summarizeReach(await resolveRecipients(id, s)) })),
  ]);
  const provider = (process.env.MESSAGING_PROVIDER ?? "log").toLowerCase();
  const soon = new Date();
  soon.setHours(soon.getHours() + 1, 0, 0, 0);
  const defaultAt = utcToWall(soon, event.timezone);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <Card>
          <SectionTitle>Compose</SectionTitle>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <Link
                key={t.key}
                href={`/events/${id}/messages?template=${t.key}`}
                className={
                  "rounded-full border px-3 py-1 text-xs font-medium " +
                  (template?.key === t.key
                    ? "border-navy bg-navy text-white"
                    : "border-navy/20 text-navy hover:bg-cream")
                }
              >
                {t.label}
              </Link>
            ))}
          </div>
          <ActionForm key={template?.key ?? "blank"} action={createMessage.bind(null, id)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Label (for your list)" name="label" defaultValue={template?.label ?? ""} placeholder="RSVP reminder" />
              <Field label="Send to" name="segment">
                <Select id="f-segment" name="segment" defaultValue={template?.segment ?? "all_invited"}>
                  {MESSAGE_SEGMENTS.map((s) => (
                    <option key={s} value={s}>
                      {SEGMENT_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Message" name="body">
              <TextArea id="f-body" name="body" required maxLength={1000} defaultValue={template?.body ?? ""} className="min-h-28" />
            </Field>
            <details className="text-xs text-navy/70">
              <summary className="cursor-pointer font-medium text-navy">Placeholders you can use</summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {PLACEHOLDERS.map(([p, d]) => (
                  <li key={p}>
                    <code className="rounded bg-cream px-1">{p}</code> {d}
                  </li>
                ))}
              </ul>
            </details>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-navy">When</legend>
              <label className="flex min-h-10 items-center gap-2 text-sm">
                <input type="radio" name="scheduleMode" value="now" defaultChecked={!template || template.relativeDays === null} className="accent-navy" />
                Send now
              </label>
              <label className="flex min-h-10 flex-wrap items-center gap-2 text-sm">
                <input type="radio" name="scheduleMode" value="at" className="accent-navy" />
                At a specific time
                <input type="datetime-local" name="at" defaultValue={defaultAt} className="min-h-9 rounded-md border border-navy/20 px-2" />
              </label>
              <label className="flex min-h-10 flex-wrap items-center gap-2 text-sm">
                <input type="radio" name="scheduleMode" value="relative" defaultChecked={!!template && template.relativeDays !== null} className="accent-navy" />
                Relative to the event:
                <input type="number" name="relativeDays" defaultValue={template?.relativeDays ?? -7} className="min-h-9 w-16 rounded-md border border-navy/20 px-2" />
                days (negative = before) at
                <input type="time" name="relativeTime" defaultValue={template?.relativeTime ?? "10:00"} className="min-h-9 rounded-md border border-navy/20 px-2" />
              </label>
              <p className="text-xs text-navy/60">
                Times are in {event.timezone}. Nothing goes out between {QUIET_HOURS.start}:00 and {QUIET_HOURS.end}:00; it waits for the morning. Relative messages move with the event date.
              </p>
            </fieldset>
            <Button type="submit">
              <Icon.Mail size={16} /> Queue message
            </Button>
          </ActionForm>
        </Card>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle>Sent and scheduled</SectionTitle>
            <form action={runQueueNow}>
              <input type="hidden" name="eventId" value={id} />
              <Button type="submit" variant="ghost" className="border border-navy/20">
                Run queue now
              </Button>
            </form>
          </div>
          {list.length === 0 ? (
            <EmptyState>Nothing sent yet.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {list.map((m) => (
                <Card key={m.id} as="li" className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-navy">{m.label}</h3>
                      <p className="text-xs text-navy/60">
                        {SEGMENT_LABEL[m.segment]} · {formatDateTime(m.scheduledAt, event.timezone)}
                        {m.relativeDays !== null ? ` (${m.relativeDays >= 0 ? "+" : ""}${m.relativeDays} days from the event)` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill tone={MESSAGE_TONE[m.status]}>{m.status}</Pill>
                      {m.status === "scheduled" || m.status === "sending" ? (
                        <form action={cancelMessageAction}>
                          <input type="hidden" name="messageId" value={m.id} />
                          <input type="hidden" name="eventId" value={id} />
                          <button type="submit" className="min-h-8 rounded-md border border-coral-deep/40 px-2 text-xs font-medium text-coral-deep hover:bg-coral/15">
                            Cancel
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-line rounded-lg bg-cream px-3 py-2 text-sm text-navy/85">{m.body}</p>
                  <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {(Object.keys(m.counts) as MessageJob["state"][])
                      .filter((s) => m.counts[s] > 0)
                      .map((s) => (
                        <Pill key={s} tone={JOB_TONE[s]}>
                          {m.counts[s]} {s}
                        </Pill>
                      ))}
                  </p>
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-navy/70">Recipients ({m.jobs.length})</summary>
                    <ul className="mt-2 divide-y divide-navy/10">
                      {m.jobs.map((j) => (
                        <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                          <span className="min-w-0 flex-1">
                            <span className="font-medium text-navy">{j.recipientName}</span>
                            <span className="text-navy/60"> {j.toPhone ?? ""}</span>
                            {j.skipReason ? <span className="block text-navy/60">{j.skipReason}</span> : null}
                            {j.lastError ? <span className="block text-coral-deep">{j.lastError}</span> : null}
                            {j.state === "failed" ? (
                              <span className="block text-navy/60">Retry {formatDateTime(j.nextAttemptAt, event.timezone)}</span>
                            ) : null}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Pill tone={JOB_TONE[j.state]}>
                              {j.state}
                              {j.attempts > 1 ? ` ×${j.attempts}` : ""}
                            </Pill>
                            {j.state === "dead" || j.state === "failed" ? (
                              <form action={retryJobAction}>
                                <input type="hidden" name="jobId" value={j.id} />
                                <input type="hidden" name="eventId" value={id} />
                                <button type="submit" className="min-h-7 rounded-md border border-navy/20 px-2 font-medium text-navy hover:bg-sky/40">
                                  Retry
                                </button>
                              </form>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </Card>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="space-y-4">
        <Card>
          <SectionTitle>Who can be reached</SectionTitle>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-navy/60">
              <tr>
                <th className="py-1 font-medium">Segment</th>
                <th className="py-1 text-right font-medium">Will get it</th>
                <th className="py-1 text-right font-medium">Skipped</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {reaches.map(({ segment, reach }) => (
                <tr key={segment}>
                  <td className="py-1.5">{SEGMENT_LABEL[segment]}</td>
                  <td className="py-1.5 text-right font-semibold text-navy">{reach.eligible}</td>
                  <td className="py-1.5 text-right text-navy/60">{reach.noPhone + reach.noConsent + reach.optedOut}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-navy/60">
            Only adults with a mobile number and recorded consent are messaged. Fix gaps in{" "}
            <Link href="/contacts" className="underline">
              Contacts
            </Link>
            . A phone number alone is never treated as permission.
          </p>
        </Card>
        <Card>
          <SectionTitle>Sending</SectionTitle>
          <p className="text-sm text-navy/80">
            Provider: <strong>{provider}</strong>
            {provider === "log" ? " (local only: messages are written to the server log, nothing is texted)." : "."}
          </p>
          <p className="mt-2 text-xs text-navy/60">
            Due messages go out once a minute while the server runs, or when a scheduler hits the dispatch endpoint. Failed sends retry with backoff, then land as “dead” for you to retry.
          </p>
        </Card>
      </div>
    </div>
  );
}
