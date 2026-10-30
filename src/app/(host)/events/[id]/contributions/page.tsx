import { notFound } from "next/navigation";
import { createSlot, deleteSlot, hostRemoveContribution } from "@/actions/contributions";
import { ActionForm } from "@/components/action-form";
import { Button, Card, EmptyState, Field, Pill, SectionTitle, TextArea } from "@/components/ui";
import { getEvent, getEventContributions } from "@/lib/queries";

export default async function ContributionsPage({ params }: PageProps<"/events/[id]/contributions">) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  const { slots, freeform } = await getEventContributions(id);
  const categories = Array.from(new Set(slots.map((s) => s.category)));

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        {slots.length === 0 ? (
          <EmptyState>No sign-up slots yet. Add some on the right, or let guests add free-form items.</EmptyState>
        ) : (
          categories.map((cat) => (
            <section key={cat}>
              <SectionTitle>{cat}</SectionTitle>
              <ul className="space-y-2">
                {slots
                  .filter((s) => s.category === cat)
                  .map((s) => {
                    const claimed = s.claims.length;
                    const full = s.capacity !== null && claimed >= s.capacity;
                    return (
                      <Card key={s.id} as="li" className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="font-medium text-navy">{s.title}</h3>
                            {s.notes ? <p className="text-sm text-navy/70">{s.notes}</p> : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Pill tone={full ? "good" : "info"}>
                              {s.capacity === null ? `${claimed} signed up` : `${claimed} / ${s.capacity}`}
                            </Pill>
                            <form action={deleteSlot}>
                              <input type="hidden" name="slotId" value={s.id} />
                              <input type="hidden" name="eventId" value={id} />
                              <button
                                type="submit"
                                className="min-h-9 rounded-md border border-coral-deep/40 px-2 text-xs font-medium text-coral-deep hover:bg-coral/15"
                              >
                                Remove slot
                              </button>
                            </form>
                          </div>
                        </div>
                        {s.claims.length > 0 ? (
                          <ul className="mt-2 space-y-1 text-sm">
                            {s.claims.map((c) => (
                              <ClaimRow key={c.id} claim={c} eventId={id} />
                            ))}
                          </ul>
                        ) : null}
                      </Card>
                    );
                  })}
              </ul>
            </section>
          ))
        )}

        {freeform.length > 0 ? (
          <section>
            <SectionTitle>Other items guests are bringing</SectionTitle>
            <Card>
              <ul className="space-y-1 text-sm">
                {freeform.map((c) => (
                  <ClaimRow key={c.id} claim={c} eventId={id} />
                ))}
              </ul>
            </Card>
          </section>
        ) : null}
      </div>

      <Card className="h-fit">
        <SectionTitle>Add a sign-up slot</SectionTitle>
        <ActionForm action={createSlot.bind(null, id)} className="space-y-3">
          <Field label="Category" name="category" placeholder="Potluck, Drinks, Supplies…" list="categories" />
          <datalist id="categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Field label="Title" name="title" required placeholder="Side dish" />
          <Field label="How many can claim it" name="capacity" type="number" min={1} hint="Leave blank for unlimited." />
          <Field label="Notes" name="notes">
            <TextArea id="f-slot-notes" name="notes" className="min-h-16" />
          </Field>
          <Button type="submit">Add slot</Button>
        </ActionForm>
      </Card>
    </div>
  );
}

function ClaimRow({
  claim,
  eventId,
}: {
  claim: { id: string; description: string; quantity: number; householdName: string };
  eventId: string;
}) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span>
        <span className="font-medium">{claim.householdName}</span>: {claim.description}
        {claim.quantity > 1 ? ` ×${claim.quantity}` : ""}
      </span>
      <form action={hostRemoveContribution}>
        <input type="hidden" name="contributionId" value={claim.id} />
        <input type="hidden" name="eventId" value={eventId} />
        <button type="submit" className="min-h-8 px-2 text-xs text-coral-deep hover:underline">
          Remove
        </button>
      </form>
    </li>
  );
}
