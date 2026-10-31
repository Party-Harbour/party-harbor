import { guestAddEntry, guestRemoveEntry, guestVote } from "@/actions/guest";
import { ActionForm } from "./action-form";
import { Icon } from "./icons";
import { PhotoThumb } from "./photo-tile";
import { PhotoUpload } from "./photo-upload";
import { Button, Field, Pill, TextArea } from "./ui";
import { computeResults, type ContestView, type EntryRow, type GuestContestState } from "@/lib/contest";

const STATUS_LABEL = {
  collecting: "Entries open",
  frozen: "Ballot set",
  voting: "Voting open",
  closed: "Voting closed",
  revealed: "Results",
} as const;

export function GuestContest({
  token,
  view,
  state,
  inviteId,
  canUpload,
}: {
  token: string;
  view: ContestView;
  state: GuestContestState;
  inviteId: string;
  canUpload: boolean;
}) {
  const { contest, categories } = view;
  const noun = contest.entryNoun;
  const approved = view.entries.filter((e) => e.approved);
  const photoOf = (entryId: string) => view.entries.find((e) => e.id === entryId)?.photoId ?? null;
  const thumb = (entryId: string, size = "h-10 w-10 rounded-md") => {
    const id = photoOf(entryId);
    return id ? <PhotoThumb id={id} token={token} className={size} /> : null;
  };
  const entriesEditable = contest.status === "collecting" || contest.status === "frozen";
  const by = (e: EntryRow) =>
    contest.showBakers && e.bakerName ? (
      <span className="text-navy/60"> · {e.inviteId === inviteId ? "yours" : e.bakerName}</span>
    ) : e.inviteId === inviteId ? (
      <span className="text-navy/60"> · yours</span>
    ) : null;

  return (
    <section className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-navy/5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="t-accent flex items-center gap-2 font-display text-2xl font-semibold">
          <Icon.Trophy size={22} /> {contest.title}
        </h2>
        <Pill tone={contest.status === "voting" || contest.status === "revealed" ? "good" : "info"}>
          {STATUS_LABEL[contest.status]}
        </Pill>
      </div>

      {state.myEntries.length > 0 ? (
        <div className="mt-3">
          <h3 className="text-sm font-medium text-navy/70">Your entries</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {state.myEntries.map((e) => (
              <li key={e.id} className="t-soft rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    {thumb(e.id, "h-12 w-12 rounded-lg")}
                    <span>
                      {e.displayName}
                      {e.dietaryTags ? <span className="text-navy/60"> · {e.dietaryTags}</span> : null}
                      {!e.approved ? <span className="text-navy/60"> · awaiting host approval</span> : null}
                    </span>
                  </span>
                  {contest.status === "collecting" ? (
                    <form action={guestRemoveEntry}>
                      <input type="hidden" name="token" value={token} />
                      <input type="hidden" name="entryId" value={e.id} />
                      <button type="submit" className="min-h-8 px-2 text-xs text-coral-deep hover:underline">
                        Remove
                      </button>
                    </form>
                  ) : null}
                </div>
                {entriesEditable && canUpload ? (
                  <PhotoUpload
                    single
                    fields={{ token, entryId: e.id }}
                    returnTo={`/e/${token}#contest`}
                    label={photoOf(e.id) ? "Replace photo" : "Add photo"}
                    buttonClass="t-btn"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {contest.status === "collecting" ? (
        <ActionForm action={guestAddEntry.bind(null, token)} className="mt-4 space-y-3">
          <p className="text-sm text-navy/70">What {noun} will you be bringing? Add it so it&apos;s on the ballot.</p>
          <Field label={`${cap(noun)} name`} name="displayName" required placeholder="Peppermint crinkles" />
          <Field label="Allergens or dietary notes (optional)" name="dietaryTags" placeholder="contains nuts, gluten-free" />
          <Field label="A line about it (optional)" name="description">
            <TextArea id="f-entry-description" name="description" className="min-h-16" />
          </Field>
          <Button type="submit" className="t-btn">
            Enter my {noun}
          </Button>
        </ActionForm>
      ) : null}

      {(contest.status === "collecting" || contest.status === "frozen") && approved.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-navy/70">
            {contest.status === "frozen" ? "On the ballot" : "Entered so far"} ({approved.length})
          </h3>
          <ul className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
            {approved.map((e) => (
              <li key={e.id} className="flex items-center gap-2 rounded-lg border border-navy/10 px-3 py-2">
                {thumb(e.id)}
                <span>
                  {e.displayName}
                  {by(e)}
                </span>
              </li>
            ))}
          </ul>
          {contest.status === "frozen" ? (
            <p className="mt-2 text-sm text-navy/70">Voting opens when the hosts say so.</p>
          ) : null}
        </div>
      ) : null}

      {contest.status === "voting" ? (
        !state.eligible ? (
          <p className="mt-3 text-sm text-navy/70">Voting is open for households attending the event.</p>
        ) : (
          <ActionForm action={guestVote.bind(null, token)} className="mt-4 space-y-5">
            <p className="text-sm text-navy/70">
              Pick your favourite in each category. You can change your mind until voting closes.
            </p>
            {categories.map((cat) => {
              const options = approved.filter(
                (e) => contest.selfVotePolicy === "allowed" || e.inviteId !== inviteId,
              );
              return (
                <fieldset key={cat.id}>
                  <legend className="t-accent mb-2 font-semibold">{cat.title}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {options.map((e) => (
                      <label
                        key={e.id}
                        className="t-ring flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm text-navy has-[:checked]:bg-(--t-soft)"
                      >
                        <input
                          type="radio"
                          name={`vote:${cat.id}`}
                          value={e.id}
                          defaultChecked={state.myVotes[cat.id] === e.id}
                          className="h-4 w-4 accent-(--t-accent)"
                        />
                        {thumb(e.id)}
                        <span>
                          {e.displayName}
                          {by(e)}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
            <Button type="submit" className="t-btn w-full text-base sm:w-auto">
              {Object.keys(state.myVotes).length > 0 ? "Update my votes" : "Cast my votes"}
            </Button>
          </ActionForm>
        )
      ) : null}

      {contest.status === "closed" ? (
        <p className="mt-3 text-sm text-navy/70">Voting has closed. The hosts will reveal the winners soon.</p>
      ) : null}

      {contest.status === "revealed" ? (
        <div className="mt-4 space-y-5">
          {computeResults(view).map((r) => {
            const winners = r.rows.filter((row) => row.winner);
            return (
              <div key={r.category.id}>
                <h3 className="t-accent font-display text-lg font-semibold">{r.category.title}</h3>
                {r.total === 0 ? (
                  <p className="text-sm text-navy/60">No votes were cast.</p>
                ) : (
                  <>
                    <p className="text-sm text-navy">
                      🏆 {winners.map((w) => w.entry.displayName).join(" & ")}
                      {winners.length > 1 ? " (tie)" : ""}
                    </p>
                    <ol className="mt-2 space-y-1.5">
                      {r.rows.map((row, i) => (
                        <li key={row.entry.id} className="text-xs text-navy/80">
                          <div className="flex items-center gap-2">
                            <span className="t-chip flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-navy">
                              {i + 1}
                            </span>
                            {thumb(row.entry.id, "h-6 w-6 rounded")}
                            <span className="flex-1 truncate">
                              {row.entry.displayName}
                              {by(row.entry)}
                            </span>
                            <span className="tabular-nums">{row.pct}%</span>
                          </div>
                          <div className="ml-7 mt-1 h-1.5 overflow-hidden rounded bg-cream">
                            <div className="h-full rounded" style={{ width: `${row.pct}%`, background: "var(--t-accent)" }} />
                          </div>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
