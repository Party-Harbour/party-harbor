"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { CONSENT_STATES, type Contact } from "@/db/schema";
import { requireHost } from "@/lib/auth";
import { optional, str, type ActionState } from "@/lib/action-state";
import { normalizePhone } from "@/lib/phone";

export async function createHousehold(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireHost();
  const name = str(formData, "name");
  if (!name) return { error: "Give the household a name." };
  const db = await getDb();
  await db.insert(schema.households).values({ name, notes: optional(formData, "notes") });
  revalidatePath("/contacts");
  return { ok: true, message: `Added ${name}.` };
}

export async function addContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireHost();
  const householdId = str(formData, "householdId");
  const displayName = str(formData, "displayName");
  if (!householdId || !displayName) return { error: "A name is required." };
  const phoneRaw = optional(formData, "phone");
  const phoneE164 = normalizePhone(phoneRaw);
  if (phoneRaw && !phoneE164) return { error: "That phone number doesn't look right. Use 10 digits or +country code." };
  const consent = str(formData, "consentState") as Contact["consentState"];
  const db = await getDb();
  await db.insert(schema.contacts).values({
    householdId,
    displayName,
    phoneE164,
    email: optional(formData, "email"),
    isChild: formData.get("isChild") === "on",
    consentState: CONSENT_STATES.includes(consent) ? consent : "unknown",
  });
  revalidatePath("/contacts");
  return { ok: true, message: `Added ${displayName}.` };
}

export async function deleteContact(formData: FormData): Promise<void> {
  await requireHost();
  const id = str(formData, "contactId");
  if (!id) return;
  const db = await getDb();
  await db.delete(schema.contacts).where(eq(schema.contacts.id, id));
  revalidatePath("/contacts");
}

export async function deleteHousehold(formData: FormData): Promise<void> {
  await requireHost();
  const id = str(formData, "householdId");
  if (!id) return;
  const db = await getDb();
  await db.delete(schema.households).where(eq(schema.households.id, id));
  revalidatePath("/contacts");
  revalidatePath("/events", "layout");
}
