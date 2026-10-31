import { TEMPLATES as MESSAGE_TEMPLATES } from "@/lib/messaging/templates";
import type { TemplateSnapshot } from "./types";

export type BuiltinTemplate = {
  key: string;
  name: string;
  description: string;
  snapshot: TemplateSnapshot;
};

const msg = (key: string) => {
  const t = MESSAGE_TEMPLATES.find((m) => m.key === key);
  if (!t || t.relativeDays === null) throw new Error(`message template ${key} is not relative`);
  return { label: t.label, segment: t.segment, body: t.body, at: { days: t.relativeDays, time: t.relativeTime } };
};

const DEFAULT_TZ = "America/New_York";

/**
 * The PRD's real-world events (section 8), ready to start from. Hosts can
 * edit everything after creating the event, and save their own version as a
 * template once it's the way they like it.
 */
export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    key: "cookie-exchange",
    name: "Christmas Cookie Exchange",
    description: "Households bring named cookies, everyone votes in a few categories, winners are revealed at the party.",
    snapshot: {
      version: 1,
      event: {
        title: "Christmas Cookie Exchange",
        description:
          "Bring a batch of your favourite holiday cookies to share and swap. Every household gets to vote, and we reveal the winners before everyone heads home with a box of assorted cookies.",
        timezone: DEFAULT_TZ,
        durationMinutes: 180,
        rsvpDeadline: { days: -7, time: "20:00" },
        venueName: null,
        venueAddress: null,
        whatToBring:
          "Three dozen of one kind of cookie (one dozen to taste, two to swap), a container to take cookies home in, and the recipe if you're willing to share it.",
        theme: "celebration",
        coverImageUrl: null,
        galleryPolicy: "contribute",
        galleryAutoApprove: true,
      },
      slots: [
        { category: "Drinks", title: "Hot chocolate", capacity: 1, notes: "Enough for a crowd; marshmallows welcome." },
        { category: "Drinks", title: "Mulled cider", capacity: 1, notes: null },
        { category: "Savoury", title: "Something savoury to balance the sugar", capacity: 3, notes: "Cheese board, sausage rolls, veggie tray…" },
        { category: "Supplies", title: "Cookie boxes or bags for taking cookies home", capacity: 1, notes: null },
      ],
      tasks: [
        { title: "Send invitation links", notes: null, priority: "high", assigneeId: null, due: { days: -21, time: "18:00" } },
        { title: "Print ballots and scorecards as a backup", notes: "In case phones are low on battery.", priority: "normal", assigneeId: null, due: { days: -2, time: "18:00" } },
        { title: "Set out the cookie table with name cards", notes: "One card per household entry.", priority: "normal", assigneeId: null, due: { days: 0, time: "12:00" } },
        { title: "Pick up prizes for each category", notes: null, priority: "normal", assigneeId: null, due: { days: -3, time: "18:00" } },
        { title: "Open voting once everyone has tasted", notes: "Freeze entries first, then open voting from the Contest tab.", priority: "high", assigneeId: null, due: { days: 0, time: "15:00" } },
      ],
      contest: {
        title: "Cookie Exchange",
        entryNoun: "cookie",
        selfVotePolicy: "disallowed",
        voterEligibility: "all_invited",
        showBakers: true,
        categories: ["Best Overall", "Most Festive", "Best Kid-Made"],
      },
      messages: [msg("rsvp_reminder"), msg("logistics"), msg("thank_you")],
    },
  },
  {
    key: "carnival",
    name: "Carnival: Hot Dogs & Cotton Candy",
    description: "Food stations, rented equipment, a signature drink and a supply checklist that includes the ice.",
    snapshot: {
      version: 1,
      event: {
        title: "Backyard Carnival",
        description:
          "Hot dogs off the roller grill, fresh cotton candy, games in the yard and a signature drink for the grown-ups. Come hungry and bring the kids.",
        timezone: DEFAULT_TZ,
        durationMinutes: 240,
        rsvpDeadline: { days: -10, time: "20:00" },
        venueName: null,
        venueAddress: null,
        whatToBring: "Just yourselves, sunscreen and a lawn chair if you have one. Sign up for a station or a side below if you'd like to help.",
        theme: "sunset",
        coverImageUrl: null,
        galleryPolicy: "contribute",
        galleryAutoApprove: true,
      },
      slots: [
        { category: "Stations", title: "Run the hot dog station", capacity: 2, notes: "Buns, toppings and the roller grill are provided." },
        { category: "Stations", title: "Spin cotton candy", capacity: 2, notes: "We'll show you how; sugar floss provided." },
        { category: "Stations", title: "Mix the signature drink", capacity: 1, notes: null },
        { category: "Sides", title: "A side dish or salad", capacity: 4, notes: null },
        { category: "Sides", title: "Chips and snacks", capacity: 2, notes: null },
        { category: "Supplies", title: "Bags of ice", capacity: 3, notes: "Two bags each, please." },
        { category: "Supplies", title: "Coolers", capacity: 2, notes: null },
      ],
      tasks: [
        { title: "Reserve the hot dog roller and cotton candy machine", notes: "Confirm pickup and return times.", priority: "high", assigneeId: null, due: { days: -21, time: "18:00" } },
        { title: "Order signature drink ingredients", notes: null, priority: "normal", assigneeId: null, due: { days: -7, time: "18:00" } },
        { title: "Buy hot dogs, buns, toppings and cotton candy sugar", notes: "Count from the RSVP headcount plus a margin.", priority: "high", assigneeId: null, due: { days: -2, time: "18:00" } },
        { title: "Check the supply list: ice, cups, napkins, paper boats, sticks", notes: null, priority: "normal", assigneeId: null, due: { days: -1, time: "18:00" } },
        { title: "Confirm equipment and vendor arrival times", notes: null, priority: "high", assigneeId: null, due: { days: -1, time: "12:00" } },
        { title: "Set up stations and test the machines", notes: "Cotton candy machine needs 10 minutes to heat.", priority: "high", assigneeId: null, due: { days: 0, time: "10:00" } },
        { title: "Return the rented equipment", notes: null, priority: "normal", assigneeId: null, due: { days: 1, time: "12:00" } },
      ],
      contest: null,
      messages: [msg("rsvp_reminder"), msg("logistics"), msg("thank_you")],
    },
  },
  {
    key: "fall-bonfire",
    name: "Fall Bonfire",
    description: "A simple one: household RSVPs, potluck slots, a food-truck heads-up, a shared gallery and a thank-you.",
    snapshot: {
      version: 1,
      event: {
        title: "Fall Bonfire",
        description: "Fire, blankets, s'mores and whatever you'd like to share. The food truck rolls up around sunset.",
        timezone: DEFAULT_TZ,
        durationMinutes: 240,
        rsvpDeadline: { days: -5, time: "20:00" },
        venueName: null,
        venueAddress: null,
        whatToBring: "A camp chair or blanket, a layer for when it cools off, and a potluck dish if you've signed up for one.",
        theme: "earth",
        coverImageUrl: null,
        galleryPolicy: "contribute",
        galleryAutoApprove: true,
      },
      slots: [
        { category: "Potluck", title: "A warm dish (chili, soup, mac and cheese)", capacity: 3, notes: null },
        { category: "Potluck", title: "A dessert", capacity: 3, notes: null },
        { category: "Potluck", title: "S'mores supplies", capacity: 1, notes: "Graham crackers, chocolate and marshmallows for a crowd." },
        { category: "Drinks", title: "Cider or cocoa", capacity: 2, notes: null },
        { category: "Supplies", title: "Firewood", capacity: 2, notes: "A bundle or two each." },
      ],
      tasks: [
        { title: "Book the food truck", notes: "Confirm arrival time and whether they need power.", priority: "high", assigneeId: null, due: { days: -21, time: "18:00" } },
        { title: "Check the burn rules and the forecast", notes: null, priority: "normal", assigneeId: null, due: { days: -3, time: "18:00" } },
        { title: "Set up seating, lights and the fire pit", notes: null, priority: "normal", assigneeId: null, due: { days: 0, time: "14:00" } },
        { title: "Bucket of water and a hose by the fire", notes: null, priority: "high", assigneeId: null, due: { days: 0, time: "16:00" } },
      ],
      contest: null,
      messages: [
        msg("rsvp_reminder"),
        {
          label: "Food truck heads-up (T−1)",
          segment: "not_declined",
          body: "{{event}} is tomorrow at {{time}}! The food truck arrives around sunset, so come hungry. Details: {{link}} — {{host}}",
          at: { days: -1, time: "17:00" },
        },
        msg("thank_you"),
      ],
    },
  },
];

export function getBuiltinTemplate(key: string): BuiltinTemplate | null {
  return BUILTIN_TEMPLATES.find((t) => t.key === key) ?? null;
}
