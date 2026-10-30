import { notFound } from "next/navigation";
import {
  addCategory,
  createContest,
  deleteCategory,
  deleteEntry,
  hostAddEntry,
  setContestStatus,
  setEntryApproved,
  updateContestSettings,
} from "@/actions/contest";
import { ActionForm } from "@/components/action-form";
import { Button, Card, EmptyState, Field, Pill, SectionTitle, Select, TextArea } from "@/components/ui";
import type { Contest } from "@/db/schema";
import { CONTEST_STATUS_LABEL, computeResults, getContestView, type ContestView } from "@/lib/contest";
import { getEvent, getEventGuests } from "@/lib/queries";

export default async function ContestPage({ params }: PageProps<"/events/[id]/contest">) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  const view = await getContestView(id);

  if (!view) {
    return (
      <Card className="mx-auto max-w-xl">
        <SectionTitle>Set up a contest</SectionTitle>
        <p className="mb-4 text-sm text-navy/70">
          Guests enter their bakes from their invitation link, you freeze the ballot, open voting, and
          reveal the winners when you&apos;re ready.
        </p>
        <ActionForm action={createContest.bind(null, id)} className="space-y-3">
          <SettingsFields />
          <Button type="submit">Create contest</Button>
        </ActionForm>
      </Card>
    );
  }

  const guests = (await getEventGuests(id)).filter((g) => !g.invite.revokedAt);
  const { contest, categories, entries } = view;
  const approvedCount = entries.filter((e) => e.approved).length;
  const editable = contest.status === "collecting" || contest.status === "frozen";
  const results = computeResults(view);

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>
              {contest.title}
            </SectionTitle>
            <Pill tone={STATUS_TONE[contest.status]}>{CONTEST_STATUS_LABEL[contest.status]}</Pill>
          </div>
          <StatusControls view={view} eventId={id} approvedCount={approvedCount} />
        </Card>

        <section>
          <SectionTitle>
            Entries ({entries.length}
            {entries.length !== approvedCount ? `, ${approvedCount} on ballot` : ""})
          </SectionTitle>
          {entries.length === 0 ? (
            <EmptyState>No entries yet. Guests add theirs from their invitation page, or add one on the right.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {entries.map((e) => (
                <Card key={e.id} as="li" className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={"font-medium " + (e.approved ? "text-navy" : "text-navy/50 line-through")}>
                        {e.displayName}
                      </span>
                      {!e.approved ? <Pill tone="neutral">Hidden from ballot</Pill> : null}
                      {e.dietaryTags ? <Pill tone="info">{e.dietaryTags}</Pill> : null}
                    </div>
                    <p className="text-xs text-navy/60">
                      Baker: {e.bakerName ?? "Host-entered"}{" "}
                      <span className="text-navy/40">({contest.showBakers ? "shown to guests" : "private"})</span>
                      {e.description ? ` · ${e.description}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1 text-xs">
                    {editable ? (
                      <form action={setEntryApproved}>
                        <input type="hidden" name="eventId" value={id} />
                        <input type="hidden" name="entryId" value={e.id} />
                        <input type="hidden" name="approved" value={e.approved ? "false" : "true"} />
                        <button type="submit" className="min-h-9 rounded-md border border-navy/20 px-2 font-medium text-navy hover:bg-sky/40">
                          {e.approved ? "Hide" : "Approve"}
                        </button>
                      </form>
                    ) : null}
                    <form action={deleteEntry}>
                      <input type="hidden" name="eventId" value={id} />
                      <input type="hidden" name="entryId" value={e.id} />
                      <button
                        type="submit"
                        className="min-h-9 rounded-md border border-coral-deep/40 px-2 font-medium text-coral-deep hover:bg-coral/15"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </Card>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle>
            {contest.status === "revealed" ? "Results" : "Live tally"}{" "}
            <span className="text-sm font-normal text-navy/60">(hosts only until revealed)</span>
          </SectionTitle>
          {categories.length === 0 ? (
            <EmptyState>Add at least one category.</EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {results.map((r) => (
                <Card key={r.category.id}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-navy">{r.category.title}</h3>
                    <span className="text-xs text-navy/60">
                      {view.votersByCategory[r.category.id] ?? 0} of {view.eligibleVoters} voted
                    </span>
                  </div>
                  {r.rows.length === 0 ? (
                    <p className="mt-2 text-sm text-navy/60">No approved entries.</p>
                  ) : (
                    <ol className="mt-3 space-y-2">
                      {r.rows.map((row) => (
                        <li key={row.entry.id} className="text-sm">
                          <div className="flex justify-between gap-2">
                            <span className={row.winner ? "font-semibold text-navy" : "text-navy"}>
                              {row.winner ? "🏆 " : ""}
                              {row.entry.displayName}
                            </span>
                            <span className="text-navy/70">
                              {row.count} · {row.pct}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded bg-cream">
                            <div className="h-full bg-coral" style={{ width: `${row.pct}%` }} />
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                  {editable ? (
                    <form action={deleteCategory} className="mt-3">
                      <input type="hidden" name="eventId" value={id} />
                      <input type="hidden" name="categoryId" value={r.category.id} />
                      <button type="submit" className="text-xs text-coral-deep hover:underline">
                        Remove category
                      </button>
                    </form>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="space-y-6">
        {editable ? (
          <Card>
            <SectionTitle>Add a category</SectionTitle>
            <ActionForm action={addCategory.bind(null, id)} className="space-y-3">
              <Field label="Category" name="title" required placeholder="Most Creative" />
              <Button type="submit" variant="ghost" className="border border-navy/20">
                Add category
              </Button>
            </ActionForm>
          </Card>
        ) : null}

        {contest.status === "collecting" ? (
          <Card>
            <SectionTitle>Add an entry</SectionTitle>
            <ActionForm action={hostAddEntry.bind(null, id)} className="space-y-3">
              <Field label={`${cap(contest.entryNoun)} name`} name="displayName" required />
              <Field label="Baker (private)" name="inviteId">
                <Select id="f-inviteId" name="inviteId" defaultValue="">
                  <option value="">Not a guest household</option>
                  {guests.map((g) => (
                    <option key={g.invite.id} value={g.invite.id}>
                      {g.household.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Dietary tags" name="dietaryTags" placeholder="nut-free, gluten-free" />
              <Field label="Description" name="description">
                <TextArea id="f-entry-desc" name="description" className="min-h-16" />
              </Field>
              <Button type="submit" variant="ghost" className="border border-navy/20">
                Add entry
              </Button>
            </ActionForm>
          </Card>
        ) : null}

        <Card>
          <SectionTitle>Settings</SectionTitle>
          <ActionForm action={updateContestSettings.bind(null, id)} className="space-y-3">
            <SettingsFields contest={contest} />
            <Button type="submit" variant="ghost" className="border border-navy/20">
              Save settings
            </Button>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}

const STATUS_TONE = {
  collecting: "info",
  frozen: "warn",
  voting: "good",
  closed: "neutral",
  revealed: "good",
} as const;

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function SettingsFields({ contest }: { contest?: Contest }) {
  return (
    <>
      <Field label="Contest title" name="title" defaultValue={contest?.title ?? "Cookie Exchange"} required />
      <Field
        label="What guests enter"
        name="entryNoun"
        defaultValue={contest?.entryNoun ?? "cookie"}
        hint="Used in guest wording, e.g. “name your cookie”."
      />
      <label className="flex min-h-11 items-center gap-2 text-sm text-navy">
        <input
          type="checkbox"
          name="showBakers"
          defaultChecked={contest?.showBakers ?? true}
          className="h-4 w-4 accent-navy"
        />
        Show guests who entered each {contest?.entryNoun ?? "cookie"}
      </label>
      <Field label="Self-voting" name="selfVotePolicy">
        <Select id="f-selfVotePolicy" name="selfVotePolicy" defaultValue={contest?.selfVotePolicy ?? "disallowed"}>
          <option value="disallowed">Not allowed (default)</option>
          <option value="allowed">Allowed</option>
        </Select>
      </Field>
      <Field label="Who can vote" name="voterEligibility">
        <Select id="f-voterEligibility" name="voterEligibility" defaultValue={contest?.voterEligibility ?? "all_invited"}>
          <option value="all_invited">Every invited household</option>
          <option value="attending_only">Only households attending</option>
        </Select>
      </Field>
    </>
  );
}

function StatusControls({
  view,
  eventId,
  approvedCount,
}: {
  view: ContestView;
  eventId: string;
  approvedCount: number;
}) {
  const { contest, categories } = view;
  const canFreeze = categories.length > 0 && approvedCount >= 2;
  const explain: Record<Contest["status"], string> = {
    collecting: canFreeze
      ? "Guests can add entries. Freeze the ballot when the list is final."
      : "Guests can add entries. You need at least one category and two approved entries to freeze the ballot.",
    frozen: "Entries are locked. Open voting when you're ready; reopening entries is logged as an override.",
    voting: "Guests are voting from their invitation page. Standings stay hidden from them.",
    closed: "Voting is closed. Check the tally, then reveal the winners to guests.",
    revealed: "Guests can see the winners and percentages on their invitation page.",
  };
  const buttons: { status: Contest["status"]; label: string; variant: "secondary" | "ghost" | "danger"; disabled?: boolean }[] = {
    collecting: [{ status: "frozen" as const, label: "Freeze ballot", variant: "secondary" as const, disabled: !canFreeze }],
    frozen: [
      { status: "voting" as const, label: "Open voting", variant: "secondary" as const },
      { status: "collecting" as const, label: "Reopen entries (override)", variant: "danger" as const },
    ],
    voting: [{ status: "closed" as const, label: "Close voting", variant: "secondary" as const }],
    closed: [
      { status: "revealed" as const, label: "Reveal results", variant: "secondary" as const },
      { status: "voting" as const, label: "Reopen voting (override)", variant: "danger" as const },
    ],
    revealed: [{ status: "closed" as const, label: "Hide results again", variant: "ghost" as const }],
  }[contest.status];

  return (
    <div>
      <p className="mb-3 text-sm text-navy/70">{explain[contest.status]}</p>
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <form key={b.status} action={setContestStatus}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="status" value={b.status} />
            <Button type="submit" variant={b.variant} disabled={b.disabled}>
              {b.label}
            </Button>
          </form>
        ))}
      </div>
      <p className="mt-3 text-xs text-navy/50">Ballot version {contest.ballotVersion}</p>
    </div>
  );
}
