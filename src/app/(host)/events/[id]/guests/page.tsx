import { notFound } from "next/navigation";
import { generateInvites, hostSetRsvp, regenerateInvite, revokeInvite } from "@/actions/invites";
import { InviteGenerator, RegenerateLink } from "@/components/invite-links";
import { Card, EmptyState, Pill, RSVP_LABEL, RSVP_TONE, SectionTitle } from "@/components/ui";
import { RSVP_STATUSES } from "@/db/schema";
import { getEvent, getEventGuests, listHouseholds } from "@/lib/queries";

export default async function GuestsPage({ params }: PageProps<"/events/[id]/guests">) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  const [guests, households] = await Promise.all([getEventGuests(id), listHouseholds()]);
  const activeGuests = guests.filter((g) => !g.invite.revokedAt);
  const revokedGuests = guests.filter((g) => g.invite.revokedAt);
  const invitedIds = new Set(activeGuests.map((g) => g.household.id));
  const uninvited = households
    .filter((h) => !invitedIds.has(h.id))
    .map((h) => ({ id: h.id, name: h.name }));

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>Invite households</SectionTitle>
        <InviteGenerator action={generateInvites.bind(null, id)} households={uninvited} />
      </Card>

      <section>
        <SectionTitle>Guest list ({activeGuests.length})</SectionTitle>
        {activeGuests.length === 0 ? (
          <EmptyState>No households invited yet.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {activeGuests.map((g) => {
              const status = g.rsvp?.status ?? "pending";
              return (
                <Card key={g.invite.id} as="li">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-navy">{g.household.name}</h3>
                      <p className="text-sm text-navy/70">
                        {g.members.map((m) => m.displayName + (m.isChild ? " (child)" : "")).join(", ") ||
                          "No contacts listed"}
                      </p>
                      {g.rsvp?.note ? (
                        <p className="mt-1 text-sm italic text-navy/80">“{g.rsvp.note}”</p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <Pill tone={RSVP_TONE[status]}>{RSVP_LABEL[status]}</Pill>
                      {g.rsvp && status !== "declined" ? (
                        <p className="mt-1 text-xs text-navy/60">
                          {g.rsvp.adults} adult{g.rsvp.adults === 1 ? "" : "s"}, {g.rsvp.children} child
                          {g.rsvp.children === 1 ? "" : "ren"}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-navy/10 pt-3 text-xs">
                    <form action={hostSetRsvp} className="flex flex-wrap items-center gap-1">
                      <input type="hidden" name="inviteId" value={g.invite.id} />
                      <input type="hidden" name="eventId" value={id} />
                      <label className="sr-only" htmlFor={`st-${g.invite.id}`}>
                        Reply
                      </label>
                      <select
                        id={`st-${g.invite.id}`}
                        name="status"
                        defaultValue={status === "pending" ? "attending" : status}
                        className="min-h-9 rounded-md border border-navy/20 bg-white px-2"
                      >
                        {RSVP_STATUSES.filter((s) => s !== "pending").map((s) => (
                          <option key={s} value={s}>
                            {RSVP_LABEL[s]}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1">
                        Adults
                        <input
                          type="number"
                          name="adults"
                          min={0}
                          defaultValue={g.rsvp?.adults ?? 0}
                          className="min-h-9 w-14 rounded-md border border-navy/20 px-2"
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        Kids
                        <input
                          type="number"
                          name="children"
                          min={0}
                          defaultValue={g.rsvp?.children ?? 0}
                          className="min-h-9 w-14 rounded-md border border-navy/20 px-2"
                        />
                      </label>
                      <button
                        type="submit"
                        className="min-h-9 rounded-md bg-navy px-2 font-medium text-white hover:bg-navy/90"
                      >
                        Record reply
                      </button>
                    </form>
                    <span className="mx-1 hidden text-navy/30 sm:inline">|</span>
                    <RegenerateLink action={regenerateInvite.bind(null, g.invite.id)} />
                    <form action={revokeInvite}>
                      <input type="hidden" name="inviteId" value={g.invite.id} />
                      <input type="hidden" name="eventId" value={id} />
                      <button
                        type="submit"
                        className="min-h-9 rounded-md border border-coral-deep/40 px-2 font-medium text-coral-deep hover:bg-coral/15"
                      >
                        Revoke link
                      </button>
                    </form>
                  </div>
                </Card>
              );
            })}
          </ul>
        )}
      </section>

      {revokedGuests.length > 0 ? (
        <section>
          <SectionTitle>Revoked ({revokedGuests.length})</SectionTitle>
          <Card>
            <ul className="space-y-2 text-sm">
              {revokedGuests.map((g) => (
                <li key={g.invite.id} className="flex items-center justify-between gap-2">
                  <span className="text-navy/70">{g.household.name}</span>
                  <RegenerateLink action={regenerateInvite.bind(null, g.invite.id)} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
