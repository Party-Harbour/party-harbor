import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const eventStatus = pgEnum("event_status", [
  "draft",
  "invitations_open",
  "rsvp_closed",
  "live",
  "memories",
  "archived",
]);

export const rsvpStatus = pgEnum("rsvp_status", [
  "pending",
  "attending",
  "maybe",
  "declined",
]);

export const taskStatus = pgEnum("task_status", ["todo", "in_progress", "done"]);
export const taskPriority = pgEnum("task_priority", ["low", "normal", "high"]);
export const consentState = pgEnum("consent_state", [
  "unknown",
  "opted_in",
  "opted_out",
]);
export const userRole = pgEnum("user_role", ["owner", "cohost"]);
export const eventTheme = pgEnum("event_theme", ["coastal", "sunset", "celebration", "earth"]);

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("owner"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  notes: text("notes"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  phoneE164: text("phone_e164"),
  email: text("email"),
  isChild: boolean("is_child").notNull().default(false),
  consentState: consentState("consent_state").notNull().default("unknown"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at"),
  timezone: text("timezone").notNull(),
  status: eventStatus("status").notNull().default("draft"),
  theme: eventTheme("theme").notNull().default("coastal"),
  coverImageUrl: text("cover_image_url"),
  venueName: text("venue_name"),
  venueAddress: text("venue_address"),
  rsvpDeadline: ts("rsvp_deadline"),
  whatToBring: text("what_to_bring"),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const eventInvites = pgTable(
  "event_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: ts("expires_at"),
    revokedAt: ts("revoked_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("event_invites_event_household").on(t.eventId, t.householdId)],
);

export const rsvps = pgTable("rsvps", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  inviteId: uuid("invite_id")
    .notNull()
    .unique()
    .references(() => eventInvites.id, { onDelete: "cascade" }),
  status: rsvpStatus("status").notNull().default("pending"),
  adults: integer("adults").notNull().default(0),
  children: integer("children").notNull().default(0),
  note: text("note"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const contributionSlots = pgTable("contribution_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  title: text("title").notNull(),
  capacity: integer("capacity"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const contributions = pgTable(
  "contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    slotId: uuid("slot_id").references(() => contributionSlots.id, {
      onDelete: "cascade",
    }),
    inviteId: uuid("invite_id")
      .notNull()
      .references(() => eventInvites.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("contributions_slot_invite").on(t.slotId, t.inviteId)],
);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  notes: text("notes"),
  assigneeId: uuid("assignee_id").references(() => users.id, {
    onDelete: "set null",
  }),
  dueAt: ts("due_at"),
  status: taskStatus("status").notNull().default("todo"),
  priority: taskPriority("priority").notNull().default("normal"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const contestStatus = pgEnum("contest_status", [
  "collecting",
  "frozen",
  "voting",
  "closed",
  "revealed",
]);
export const selfVotePolicy = pgEnum("self_vote_policy", ["allowed", "disallowed"]);
export const voterEligibility = pgEnum("voter_eligibility", ["all_invited", "attending_only"]);

/** One contest per event (the cookie exchange ballot, a chili cook-off, …). */
export const contests = pgTable("contests", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .unique()
    .references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  entryNoun: text("entry_noun").notNull().default("cookie"),
  status: contestStatus("status").notNull().default("collecting"),
  selfVotePolicy: selfVotePolicy("self_vote_policy").notNull().default("disallowed"),
  voterEligibility: voterEligibility("voter_eligibility").notNull().default("all_invited"),
  // Whether guests see which household entered each item (hosts always do).
  showBakers: boolean("show_bakers").notNull().default(true),
  ballotVersion: integer("ballot_version").notNull().default(1),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const contestCategories = pgTable("contest_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  contestId: uuid("contest_id")
    .notNull()
    .references(() => contests.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const contestEntries = pgTable("contest_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  contestId: uuid("contest_id")
    .notNull()
    .references(() => contests.id, { onDelete: "cascade" }),
  // The baker's household. Private to hosts; never shown on the ballot.
  inviteId: uuid("invite_id").references(() => eventInvites.id, { onDelete: "set null" }),
  displayName: text("display_name").notNull(),
  description: text("description"),
  dietaryTags: text("dietary_tags"),
  approved: boolean("approved").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const votes = pgTable(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contestId: uuid("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => contestCategories.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => contestEntries.id, { onDelete: "cascade" }),
    inviteId: uuid("invite_id")
      .notNull()
      .references(() => eventInvites.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  // One ballot per household per category (PRD section 15).
  (t) => [uniqueIndex("votes_category_invite").on(t.categoryId, t.inviteId)],
);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: text("actor").notNull(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  metadata: jsonb("metadata"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Household = typeof households.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Event = typeof events.$inferSelect;
export type EventInvite = typeof eventInvites.$inferSelect;
export type Rsvp = typeof rsvps.$inferSelect;
export type ContributionSlot = typeof contributionSlots.$inferSelect;
export type Contribution = typeof contributions.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Contest = typeof contests.$inferSelect;
export type ContestCategory = typeof contestCategories.$inferSelect;
export type ContestEntry = typeof contestEntries.$inferSelect;
export type Vote = typeof votes.$inferSelect;

export const EVENT_THEMES = eventTheme.enumValues;
export const CONTEST_STATUSES = contestStatus.enumValues;
export const SELF_VOTE_POLICIES = selfVotePolicy.enumValues;
export const VOTER_ELIGIBILITIES = voterEligibility.enumValues;

export const EVENT_STATUSES = eventStatus.enumValues;
export const RSVP_STATUSES = rsvpStatus.enumValues;
export const TASK_STATUSES = taskStatus.enumValues;
export const TASK_PRIORITIES = taskPriority.enumValues;
export const CONSENT_STATES = consentState.enumValues;
