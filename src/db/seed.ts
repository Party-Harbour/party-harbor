import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";
import { hashPassword } from "@/lib/password";
import { wallToUtc } from "@/lib/dates";

type Db = PgliteDatabase<typeof schema>;

// First-run seed for local development. All names are synthetic, per the
// PRD's rule that no real attendee data ships in fixtures.
export async function seedIfEmpty(db: Db) {
  const existing = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (existing.length > 0) return;

  const password = process.env.SEED_HOST_PASSWORD ?? "harbor-dev";
  const tz = "America/New_York";

  const [rita, randy] = await db
    .insert(schema.users)
    .values([
      {
        email: "rita@partyharbor.local",
        displayName: "Rita",
        passwordHash: hashPassword(password),
        role: "owner",
      },
      {
        email: "randy@partyharbor.local",
        displayName: "Randy",
        passwordHash: hashPassword(password),
        role: "owner",
      },
    ])
    .returning();

  const householdRows = await db
    .insert(schema.households)
    .values([
      { name: "The Harbor Family", notes: "Sample household (synthetic)" },
      { name: "The Lighthouse Crew" },
      { name: "The Driftwoods" },
      { name: "The Tidewaters" },
    ])
    .returning();
  const [harbor, lighthouse, driftwood, tidewater] = householdRows;

  await db.insert(schema.contacts).values([
    { householdId: harbor.id, displayName: "Sam Harbor", phoneE164: "+15555550101", consentState: "opted_in" },
    { householdId: harbor.id, displayName: "Alex Harbor", phoneE164: "+15555550102", consentState: "opted_in" },
    { householdId: harbor.id, displayName: "Juniper Harbor", isChild: true },
    { householdId: lighthouse.id, displayName: "Morgan Light", phoneE164: "+15555550201", consentState: "opted_in" },
    { householdId: lighthouse.id, displayName: "Casey Light", email: "casey@example.com" },
    { householdId: driftwood.id, displayName: "Riley Drift", phoneE164: "+15555550301", consentState: "unknown" },
    { householdId: driftwood.id, displayName: "Rowan Drift", isChild: true },
    { householdId: driftwood.id, displayName: "Sage Drift", isChild: true },
    { householdId: tidewater.id, displayName: "Jordan Tide", phoneE164: "+15555550401", consentState: "opted_in" },
  ]);

  const [cookies, bonfire, carnival] = await db
    .insert(schema.events)
    .values([
      {
        title: "Christmas Cookie Exchange",
        description:
          "Bring a dozen of your signature cookie, vote in the categories, take home a mixed box.",
        startsAt: wallToUtc("2026-12-13T15:00", tz)!,
        endsAt: wallToUtc("2026-12-13T18:00", tz)!,
        timezone: tz,
        status: "invitations_open",
        theme: "celebration",
        venueName: "Our house",
        venueAddress: "123 Harbor Lane",
        rsvpDeadline: wallToUtc("2026-12-06T23:59", tz)!,
        whatToBring:
          "One dozen cookies per entry, plus the recipe card if you want to share it.",
        createdBy: rita.id,
      },
      {
        title: "Fall Bonfire",
        description: "Potluck, s'mores, and a food truck around dusk.",
        startsAt: wallToUtc("2026-11-14T17:00", tz)!,
        endsAt: wallToUtc("2026-11-14T21:00", tz)!,
        timezone: tz,
        status: "invitations_open",
        theme: "earth",
        venueName: "Back field",
        rsvpDeadline: wallToUtc("2026-11-10T23:59", tz)!,
        whatToBring: "A potluck dish, camp chairs, and a layer for after sunset.",
        createdBy: randy.id,
      },
      {
        title: "Carnival Party",
        description: "Hot dogs, cotton candy, signature drinks, and games.",
        startsAt: wallToUtc("2027-06-12T14:00", tz)!,
        timezone: tz,
        status: "draft",
        theme: "sunset",
        venueName: "Our house",
        createdBy: randy.id,
      },
    ])
    .returning();

  await db.insert(schema.tasks).values([
    { eventId: cookies.id, title: "Set up voting categories", assigneeId: rita.id, dueAt: wallToUtc("2026-12-01T18:00", tz), priority: "high" },
    { eventId: cookies.id, title: "Buy takeaway boxes", assigneeId: randy.id, dueAt: wallToUtc("2026-12-10T18:00", tz) },
    { eventId: cookies.id, title: "Print ballot cards", assigneeId: rita.id, dueAt: wallToUtc("2026-12-12T18:00", tz), status: "in_progress" },
    { eventId: bonfire.id, title: "Confirm food truck", assigneeId: randy.id, dueAt: wallToUtc("2026-11-05T18:00", tz), priority: "high" },
    { eventId: bonfire.id, title: "Stack firewood", assigneeId: randy.id, dueAt: wallToUtc("2026-11-13T18:00", tz) },
    { eventId: bonfire.id, title: "Buy s'mores supplies", assigneeId: rita.id, dueAt: wallToUtc("2026-11-12T18:00", tz), status: "done" },
    { eventId: carnival.id, title: "Rent cotton candy machine", assigneeId: rita.id, dueAt: wallToUtc("2027-05-20T18:00", tz) },
  ]);

  await db.insert(schema.contributionSlots).values([
    { eventId: cookies.id, category: "Cookies", title: "Cookie entry", capacity: null, notes: "One entry per baker", sortOrder: 0 },
    { eventId: cookies.id, category: "Drinks", title: "Hot cocoa", capacity: 1, sortOrder: 1 },
    { eventId: cookies.id, category: "Drinks", title: "Mulled cider", capacity: 1, sortOrder: 2 },
    { eventId: bonfire.id, category: "Potluck", title: "Main dish", capacity: 3, sortOrder: 0 },
    { eventId: bonfire.id, category: "Potluck", title: "Side dish", capacity: 4, sortOrder: 1 },
    { eventId: bonfire.id, category: "Potluck", title: "Dessert", capacity: 3, sortOrder: 2 },
    { eventId: bonfire.id, category: "Supplies", title: "Bag of ice", capacity: 2, sortOrder: 3 },
  ]);

  const [contest] = await db
    .insert(schema.contests)
    .values({ eventId: cookies.id, title: "Cookie Exchange", entryNoun: "cookie" })
    .returning();
  await db.insert(schema.contestCategories).values([
    { contestId: contest.id, title: "Best Overall", sortOrder: 0 },
    { contestId: contest.id, title: "Most Festive", sortOrder: 1 },
    { contestId: contest.id, title: "Best Classic", sortOrder: 2 },
  ]);

  await db.insert(schema.auditLog).values({
    actor: "system",
    action: "seed.initial",
    metadata: { hosts: [rita.email, randy.email] },
  });
}
