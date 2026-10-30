"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { TASK_PRIORITIES, TASK_STATUSES, type Task } from "@/db/schema";
import { requireHost } from "@/lib/auth";
import { wallToUtc } from "@/lib/dates";
import { optional, str, type ActionState } from "@/lib/action-state";
import { getEvent } from "@/lib/queries";

function revalidateTasks(eventId: string) {
  revalidatePath("/dashboard");
  revalidatePath(`/events/${eventId}`, "layout");
}

export async function createTask(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireHost();
  const event = await getEvent(eventId);
  if (!event) return { error: "Event not found." };
  const title = str(formData, "title");
  if (!title) return { error: "Give the task a title." };
  const dueRaw = str(formData, "dueAt");
  const dueAt = dueRaw ? wallToUtc(dueRaw, event.timezone) : null;
  if (dueRaw && !dueAt) return { error: "The due date is not valid." };
  const priority = str(formData, "priority") as Task["priority"];
  const assigneeId = optional(formData, "assigneeId");

  const db = await getDb();
  await db.insert(schema.tasks).values({
    eventId,
    title,
    notes: optional(formData, "notes"),
    assigneeId,
    dueAt,
    priority: TASK_PRIORITIES.includes(priority) ? priority : "normal",
  });
  revalidateTasks(eventId);
  return { ok: true, message: `Added “${title}”.` };
}

export async function setTaskStatus(formData: FormData): Promise<void> {
  await requireHost();
  const taskId = str(formData, "taskId");
  const eventId = str(formData, "eventId");
  const status = str(formData, "status") as Task["status"];
  if (!taskId || !eventId || !TASK_STATUSES.includes(status)) return;
  const db = await getDb();
  await db
    .update(schema.tasks)
    .set({ status })
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.eventId, eventId)));
  revalidateTasks(eventId);
}

export async function deleteTask(formData: FormData): Promise<void> {
  await requireHost();
  const taskId = str(formData, "taskId");
  const eventId = str(formData, "eventId");
  if (!taskId || !eventId) return;
  const db = await getDb();
  await db
    .delete(schema.tasks)
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.eventId, eventId)));
  revalidateTasks(eventId);
}
