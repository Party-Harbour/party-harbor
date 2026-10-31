import type { Metadata } from "next";
import Link from "next/link";
import { createEvent } from "@/actions/events";
import { EventForm } from "@/components/event-form";
import { Icon } from "@/components/icons";
import { Card, PageHeader } from "@/components/ui";
import { describeSummary, eventDefaultsFrom, resolveTemplateRef, summarizeSnapshot } from "@/lib/templates";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage({ searchParams }: PageProps<"/events/new">) {
  const { template, from } = await searchParams;
  const ref = typeof from === "string" && from ? `event:${from}` : typeof template === "string" ? template : null;
  const source = await resolveTemplateRef(ref);
  const defaults = source ? await eventDefaultsFrom(source) : undefined;
  const summary = source ? describeSummary(summarizeSnapshot(source.snapshot)) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={source?.kind === "event" ? "Clone event" : "New event"}
        subtitle="Events start as drafts; open invitations when you're ready."
      />
      {ref && !source ? (
        <p role="alert" className="mb-4 rounded-md bg-coral/20 px-3 py-2 text-sm text-navy">
          That template couldn&apos;t be found, so this is a blank event.{" "}
          <Link href="/templates" className="underline">
            Pick another
          </Link>
          .
        </p>
      ) : null}
      {source ? (
        <Card className="mb-4 bg-sky-soft">
          <p className="flex items-start gap-2 text-sm text-navy">
            <Icon.Layers size={18} className="mt-0.5 shrink-0 text-navy/60" />
            <span>
              <strong>{source.kind === "event" ? `Cloning “${source.name}”` : `Starting from “${source.name}”`}</strong>
              <span className="block text-navy/70">
                Once you save, this event gets {summary}. Dates follow the start you pick below.
                {source.kind === "event" ? " Guests, RSVPs, entries and photos stay with the original." : ""}
              </span>
              <Link href="/events/new" className="mt-1 inline-block text-xs underline">
                Start blank instead
              </Link>
            </span>
          </p>
        </Card>
      ) : (
        <p className="mb-4 text-sm text-navy/70">
          Or start from a{" "}
          <Link href="/templates" className="underline">
            template
          </Link>
          .
        </p>
      )}
      <Card>
        <EventForm action={createEvent} defaults={defaults} submitLabel="Create event">
          {source ? <input type="hidden" name="templateRef" value={source.ref} /> : null}
        </EventForm>
      </Card>
    </div>
  );
}
