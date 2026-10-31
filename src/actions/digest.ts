"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { DIGEST_FREQUENCIES, type User } from "@/db/schema";
import { requireHost } from "@/lib/auth";
import { isValidTimeZone } from "@/lib/dates";
import { getDigestUser, sendDigest } from "@/lib/digest";
import { normalizePhone } from "@/lib/phone";
import { int, str, type ActionState } from "@/lib/action-state";

export async function updateDigestSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const host = await requireHost();
  const frequency = str(formData, "digestFrequency") as User["digestFrequency"];
  if (!DIGEST_FREQUENCIES.includes(frequency)) return { error: "Pick how often you'd like the digest." };
  const hour = int(formData, "digestHour", 8);
  if (hour < 0 || hour > 23) return { error: "The hour must be between 0 and 23." };
  const weekday = int(formData, "digestWeekday", 1);
  if (weekday < 0 || weekday > 6) return { error: "Pick a day of the week." };
  const timezone = str(formData, "timezone");
  if (!isValidTimeZone(timezone)) return { error: "Pick a valid time zone." };
  const phoneRaw = str(formData, "phone");
  const phoneE164 = normalizePhone(phoneRaw || null);
  if (phoneRaw && !phoneE164) return { error: "That phone number doesn't look right. Use 10 digits or +country code." };

  const db = await getDb();
  await db
    .update(schema.users)
    .set({ digestFrequency: frequency, digestHour: hour, digestWeekday: weekday, timezone, phoneE164 })
    .where(eq(schema.users.id, host.id));
  await db.insert(schema.auditLog).values({
    actor: host.email,
    action: "digest.settings",
    metadata: { frequency, hour, weekday, timezone, hasPhone: !!phoneE164 },
  });
  revalidatePath("/digest");
  return { ok: true, message: frequency === "off" ? "Digest turned off. You can still send one by hand." : "Digest settings saved." };
}

export async function sendDigestNow(): Promise<ActionState> {
  const host = await requireHost();
  const user = await getDigestUser(host.id);
  if (!user) return { error: "Couldn't load your settings." };
  const outcome = await sendDigest(user, "manual", `manual:${Date.now()}`);
  revalidatePath("/digest");
  if (!outcome) return { error: "A digest for this moment already exists." };
  if (outcome.error) return { error: `The digest is ready below, but texting it failed: ${outcome.error}` };
  if (outcome.delivered) return { ok: true, message: `Digest texted to ${user.phoneE164}. It's also below.` };
  return { ok: true, message: "Digest ready below. Add a mobile number to get it by text." };
}
