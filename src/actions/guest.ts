"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { RSVP_STATUSES, type Rsvp } from "@/db/schema";
import { guestCanRespond, resolveInvite } from "@/lib/guest";
import { getContestView } from "@/lib/contest";
import { int, optional, str, type ActionState } from "@/lib/action-state";

function revalidateGuest(token: string, eventId: string) {
  revalidatePath(`/e/${token}`);
  revalidatePath(`/events/${eventId}`, "layout");
  revalidatePath("/dashboard");
}

export async function guestRsvp(
  token: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const resolved = await resolveInvite(token);
  if (!resolved) return { error: "This invitation link is no longer valid." };
  if (!guestCanRespond(resolved.event)) return { error: "RSVPs are closed for this event." };

  const status = str(formData, "status") as Rsvp["status"];
  if (!RSVP_STATUSES.includes(status) || status === "pending") {
    return { error: "Choose whether you can make it." };
  }
  const attending = status !== "declined";
  const adults = attending ? Math.max(0, int(formData, "adults")) : 0;
  const children = attending ? Math.max(0, int(formData, "children")) : 0;
  if (attending && adults + children === 0) return { error: "Tell us how many are coming." };

  const db = await getDb();
  const values = {
    eventId: resolved.event.id,
    inviteId: resolved.invite.id,
    status,
    adults,
    children,
    note: optional(formData, "note"),
    updatedAt: new Date(),
  };
  await db
    .insert(schema.rsvps)
    .values(values)
    .onConflictDoUpdate({
      target: schema.rsvps.inviteId,
      set: { status, adults, children, note: values.note, updatedAt: values.updatedAt },
    });
  await db.insert(schema.auditLog).values({
    actor: `guest:${resolved.household.name}`,
    eventId: resolved.event.id,
    action: "rsvp.updated",
    metadata: { status, adults, children },
  });
  revalidateGuest(token, resolved.event.id);
  return { ok: true, message: "Thanks, your reply is saved." };
}

export async function guestClaim(
  token: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const resolved = await resolveInvite(token);
  if (!resolved) return { error: "This invitation link is no longer valid." };
  if (!guestCanRespond(resolved.event)) return { error: "Sign-ups are closed for this event." };

  const slotId = optional(formData, "slotId");
  const description = str(formData, "description");
  const quantity = Math.max(1, int(formData, "quantity", 1));
  if (!slotId && !description) return { error: "Describe what you'll bring." };

  const db = await getDb();
  try {
    await db.transaction(async (tx) => {
      let finalDescription = description;
      if (slotId) {
        const [slot] = await tx
          .select()
          .from(schema.contributionSlots)
          .where(
            and(
              eq(schema.contributionSlots.id, slotId),
              eq(schema.contributionSlots.eventId, resolved.event.id),
            ),
          );
        if (!slot) throw new Error("That sign-up option no longer exists.");
        if (slot.capacity !== null) {
          const [{ n }] = await tx
            .select({ n: count() })
            .from(schema.contributions)
            .where(eq(schema.contributions.slotId, slotId));
          if (n >= slot.capacity) throw new Error(`“${slot.title}” is already fully claimed.`);
        }
        finalDescription = description || slot.title;
      }
      await tx.insert(schema.contributions).values({
        eventId: resolved.event.id,
        slotId,
        inviteId: resolved.invite.id,
        description: finalDescription,
        quantity,
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/contributions_slot_invite/.test(msg)) {
      return { error: "Your household already claimed that one." };
    }
    return { error: msg || "Could not save that. Please try again." };
  }
  await db.insert(schema.auditLog).values({
    actor: `guest:${resolved.household.name}`,
    eventId: resolved.event.id,
    action: "contribution.created",
    metadata: { slotId, description, quantity },
  });
  revalidateGuest(token, resolved.event.id);
  return { ok: true, message: "Added. Thank you!" };
}

export async function guestAddEntry(
  token: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const resolved = await resolveInvite(token);
  if (!resolved) return { error: "This invitation link is no longer valid." };
  const view = await getContestView(resolved.event.id);
  if (!view) return { error: "There is no contest for this event." };
  if (view.contest.status !== "collecting") return { error: "Entries are closed." };
  const displayName = str(formData, "displayName");
  if (!displayName) return { error: `Give your ${view.contest.entryNoun} a name.` };

  const db = await getDb();
  await db.insert(schema.contestEntries).values({
    contestId: view.contest.id,
    inviteId: resolved.invite.id,
    displayName,
    description: optional(formData, "description"),
    dietaryTags: optional(formData, "dietaryTags"),
  });
  await db.insert(schema.auditLog).values({
    actor: `guest:${resolved.household.name}`,
    eventId: resolved.event.id,
    action: "contest.entry_added",
    metadata: { displayName },
  });
  revalidateGuest(token, resolved.event.id);
  return { ok: true, message: `“${displayName}” is entered.` };
}

export async function guestRemoveEntry(formData: FormData): Promise<void> {
  const token = str(formData, "token");
  const entryId = str(formData, "entryId");
  const resolved = await resolveInvite(token);
  if (!resolved || !entryId) return;
  const view = await getContestView(resolved.event.id);
  if (!view || view.contest.status !== "collecting") return;
  const db = await getDb();
  await db
    .delete(schema.contestEntries)
    .where(
      and(
        eq(schema.contestEntries.id, entryId),
        eq(schema.contestEntries.inviteId, resolved.invite.id),
      ),
    );
  revalidateGuest(token, resolved.event.id);
}

/**
 * Casts or changes this household's vote in each category it picked.
 * Server-side checks: voting is open, voter is eligible, entry is on the
 * frozen ballot, and self-votes follow the contest policy. The unique index on
 * (category, invite) guarantees one ballot per household per category.
 */
export async function guestVote(
  token: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const resolved = await resolveInvite(token);
  if (!resolved) return { error: "This invitation link is no longer valid." };
  const view = await getContestView(resolved.event.id);
  if (!view) return { error: "There is no contest for this event." };
  if (view.contest.status !== "voting") return { error: "Voting isn't open right now." };

  const db = await getDb();
  if (view.contest.voterEligibility === "attending_only") {
    const [rsvp] = await db
      .select({ status: schema.rsvps.status })
      .from(schema.rsvps)
      .where(eq(schema.rsvps.inviteId, resolved.invite.id));
    if (rsvp?.status !== "attending") {
      return { error: "Only households who RSVP'd as attending can vote." };
    }
  }

  const approved = new Map(view.entries.filter((e) => e.approved).map((e) => [e.id, e]));
  const picks: { categoryId: string; entryId: string }[] = [];
  for (const category of view.categories) {
    const entryId = str(formData, `vote:${category.id}`);
    if (!entryId) continue;
    const entry = approved.get(entryId);
    if (!entry) return { error: "One of your picks is no longer on the ballot." };
    if (view.contest.selfVotePolicy === "disallowed" && entry.inviteId === resolved.invite.id) {
      return { error: `You can't vote for your own ${view.contest.entryNoun} in “${category.title}”.` };
    }
    picks.push({ categoryId: category.id, entryId });
  }
  if (picks.length === 0) return { error: "Pick at least one favourite." };

  for (const p of picks) {
    await db
      .insert(schema.votes)
      .values({
        contestId: view.contest.id,
        categoryId: p.categoryId,
        entryId: p.entryId,
        inviteId: resolved.invite.id,
      })
      .onConflictDoUpdate({
        target: [schema.votes.categoryId, schema.votes.inviteId],
        set: { entryId: p.entryId, createdAt: new Date() },
      });
  }
  await db.insert(schema.auditLog).values({
    actor: `guest:${resolved.household.name}`,
    eventId: resolved.event.id,
    action: "contest.vote",
    metadata: { categories: picks.length, ballotVersion: view.contest.ballotVersion },
  });
  revalidateGuest(token, resolved.event.id);
  return {
    ok: true,
    message: picks.length === view.categories.length ? "Your votes are in!" : "Saved. You can still vote in the other categories.",
  };
}

export async function guestUnclaim(formData: FormData): Promise<void> {
  const token = str(formData, "token");
  const contributionId = str(formData, "contributionId");
  const resolved = await resolveInvite(token);
  if (!resolved || !contributionId) return;
  if (!guestCanRespond(resolved.event)) return;
  const db = await getDb();
  await db
    .delete(schema.contributions)
    .where(
      and(
        eq(schema.contributions.id, contributionId),
        eq(schema.contributions.inviteId, resolved.invite.id),
      ),
    );
  revalidateGuest(token, resolved.event.id);
}
