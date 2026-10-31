"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { snapshotFromEvent, summarizeSnapshot } from "@/lib/templates";
import { optional, str, type ActionState } from "@/lib/action-state";

export async function saveEventAsTemplate(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const host = await requireHost();
  const captured = await snapshotFromEvent(eventId);
  if (!captured) return { error: "That event no longer exists." };
  const name = str(formData, "name") || captured.event.title;
  if (name.length > 120) return { error: "Keep the template name under 120 characters." };
  const db = await getDb();
  const [row] = await db
    .insert(schema.eventTemplates)
    .values({
      name,
      description: optional(formData, "description"),
      sourceEventId: eventId,
      snapshot: captured.snapshot,
      createdBy: host.id,
    })
    .returning({ id: schema.eventTemplates.id });
  await db.insert(schema.auditLog).values({
    actor: host.email,
    eventId,
    action: "template.saved",
    metadata: { templateId: row.id, name, ...summarizeSnapshot(captured.snapshot) },
  });
  revalidatePath("/templates");
  return { ok: true, message: `Saved “${name}” to Templates.` };
}

export async function deleteTemplate(formData: FormData): Promise<void> {
  const host = await requireHost();
  const templateId = str(formData, "templateId");
  if (!templateId) return;
  const db = await getDb();
  const [row] = await db
    .delete(schema.eventTemplates)
    .where(eq(schema.eventTemplates.id, templateId))
    .returning({ name: schema.eventTemplates.name });
  if (!row) return;
  await db.insert(schema.auditLog).values({
    actor: host.email,
    action: "template.deleted",
    metadata: { templateId, name: row.name },
  });
  revalidatePath("/templates");
}
