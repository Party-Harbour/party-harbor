import { notFound } from "next/navigation";
import { updateEvent } from "@/actions/events";
import { EventForm } from "@/components/event-form";
import { Card } from "@/components/ui";
import { getEvent } from "@/lib/queries";

export default async function EditEventPage({ params }: PageProps<"/events/[id]/edit">) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  return (
    <Card className="mx-auto max-w-2xl">
      <EventForm event={event} action={updateEvent.bind(null, event.id)} submitLabel="Save changes" />
    </Card>
  );
}
