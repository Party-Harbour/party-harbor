import type { Metadata } from "next";
import { addContact, createHousehold, deleteContact, deleteHousehold } from "@/actions/contacts";
import { ActionForm } from "@/components/action-form";
import { Button, Card, EmptyState, Field, PageHeader, Pill, SectionTitle, Select } from "@/components/ui";
import { CONSENT_STATES } from "@/db/schema";
import { listHouseholds } from "@/lib/queries";

export const metadata: Metadata = { title: "Contacts" };

const CONSENT_LABEL: Record<string, string> = {
  unknown: "Consent unknown",
  opted_in: "Opted in",
  opted_out: "Opted out",
};

export default async function ContactsPage() {
  const households = await listHouseholds();
  const people = households.reduce((n, h) => n + h.members.length, 0);

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle={`${households.length} households · ${people} people. One directory, reused across every event.`}
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-3">
          {households.length === 0 ? (
            <EmptyState>No households yet. Add one on the right.</EmptyState>
          ) : (
            households.map((h) => (
              <Card key={h.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-navy">{h.name}</h2>
                    {h.notes ? <p className="text-sm text-navy/70">{h.notes}</p> : null}
                  </div>
                  <form action={deleteHousehold}>
                    <input type="hidden" name="householdId" value={h.id} />
                    <button
                      type="submit"
                      className="min-h-9 rounded-md border border-coral-deep/40 px-2 text-xs font-medium text-coral-deep hover:bg-coral/15"
                    >
                      Delete household
                    </button>
                  </form>
                </div>
                {h.members.length === 0 ? (
                  <p className="mt-2 text-sm text-navy/60">No people yet.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-navy/10 text-sm">
                    {h.members.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-navy">{m.displayName}</span>
                          {m.isChild ? <Pill tone="info">Child</Pill> : null}
                          {m.phoneE164 ? <span className="text-navy/70">{m.phoneE164}</span> : null}
                          {m.email ? <span className="text-navy/70">{m.email}</span> : null}
                          {!m.isChild ? (
                            <Pill tone={m.consentState === "opted_in" ? "good" : m.consentState === "opted_out" ? "bad" : "neutral"}>
                              {CONSENT_LABEL[m.consentState]}
                            </Pill>
                          ) : null}
                        </div>
                        <form action={deleteContact}>
                          <input type="hidden" name="contactId" value={m.id} />
                          <button type="submit" className="min-h-8 px-2 text-xs text-coral-deep hover:underline">
                            Remove
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-navy">Add a person</summary>
                  <ActionForm action={addContact} className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="householdId" value={h.id} />
                    <Field label="Name" name="displayName" required />
                    <Field label="Mobile" name="phone" type="tel" placeholder="555 555 0100" />
                    <Field label="Email" name="email" type="email" />
                    <Field label="Messaging consent" name="consentState">
                      <Select id={`consent-${h.id}`} name="consentState" defaultValue="unknown">
                        {CONSENT_STATES.map((c) => (
                          <option key={c} value={c}>
                            {CONSENT_LABEL[c]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" name="isChild" className="h-4 w-4 accent-navy" /> Child
                    </label>
                    <div className="sm:col-span-2">
                      <Button type="submit" variant="ghost" className="border border-navy/20">
                        Add person
                      </Button>
                    </div>
                  </ActionForm>
                </details>
              </Card>
            ))
          )}
        </section>

        <Card className="h-fit">
          <SectionTitle>New household</SectionTitle>
          <ActionForm action={createHousehold} className="space-y-3">
            <Field label="Household name" name="name" required placeholder="The Harbors" />
            <Field label="Notes" name="notes" placeholder="Allergies, how you know them…" />
            <Button type="submit">Add household</Button>
          </ActionForm>
          <p className="mt-4 text-xs text-navy/60">
            A phone number is not permission to text. Record consent before any messaging goes out.
          </p>
        </Card>
      </div>
    </>
  );
}
