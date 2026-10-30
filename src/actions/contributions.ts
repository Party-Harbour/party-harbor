"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { optional, str, type ActionState } from "@/lib/action-state";

function revalidateContributions(eventId: string) {
  revalidatePath(`/events/${eventId}`, "layout");
}

export async function createSlot(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireHost();
  const title = str(formData, "title");
  const category = str(formData, "category") || "General";
  if (!title) return { error: "Give the slot a title." };
  const capRaw = str(formData, "capacity");
  const capacity = capRaw ? Number.parseInt(capRaw, 10) : null;
  if (capRaw && (!Number.isFinite(capacity) || (capacity as number) < 1)) {
    return { error: "Capacity must be a whole number of 1 or more, or blank for unlimited." };
  }
  const db = await getDb();
  await db.insert(schema.contributionSlots).values({
    eventId,
    title,
    category,
    capacity,
    notes: optional(formData, "notes"),
    sortOrder: Date.now() % 1_000_000,
  });
  revalidateContributions(eventId);
  return { ok: true, message: `Added “${title}”.` };
}

export async function deleteSlot(formData: FormData): Promise<void> {
  await requireHost();
  const slotId = str(formData, "slotId");
  const eventId = str(formData, "eventId");
  if (!slotId || !eventId) return;
  const db = await getDb();
  await db
    .delete(schema.contributionSlots)
    .where(and(eq(schema.contributionSlots.id, slotId), eq(schema.contributionSlots.eventId, eventId)));
  revalidateContributions(eventId);
}

export async function hostRemoveContribution(formData: FormData): Promise<void> {
  const host = await requireHost();
  const contributionId = str(formData, "contributionId");
  const eventId = str(formData, "eventId");
  if (!contributionId || !eventId) return;
  const db = await getDb();
  await db
    .delete(schema.contributions)
    .where(and(eq(schema.contributions.id, contributionId), eq(schema.contributions.eventId, eventId)));
  await db.insert(schema.auditLog).values({
    actor: host.email,
    eventId,
    action: "contribution.host_removed",
    metadata: { contributionId },
  });
  revalidateContributions(eventId);
}
