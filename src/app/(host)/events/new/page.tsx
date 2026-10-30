import type { Metadata } from "next";
import { createEvent } from "@/actions/events";
import { EventForm } from "@/components/event-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New event" subtitle="Events start as drafts; open invitations when you're ready." />
      <Card>
        <EventForm action={createEvent} submitLabel="Create event" />
      </Card>
    </div>
  );
}
