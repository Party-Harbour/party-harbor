import type { Event, MessageSegmentValue } from "./types";

export const PLACEHOLDERS = [
  ["{{first_name}}", "Recipient's first name"],
  ["{{household}}", "Household name"],
  ["{{event}}", "Event title"],
  ["{{date}}", "Event date"],
  ["{{time}}", "Start time"],
  ["{{venue}}", "Venue name"],
  ["{{link}}", "The household's private invitation link"],
  ["{{host}}", "Your name"],
] as const;

export type Template = {
  key: string;
  label: string;
  segment: MessageSegmentValue;
  /** Days relative to the event start (negative = before). null = send now. */
  relativeDays: number | null;
  relativeTime: string;
  body: string;
};

/** The PRD's automation table (section 12), as ready-to-schedule templates. */
export const TEMPLATES: Template[] = [
  {
    key: "invite",
    label: "Invitation link",
    segment: "all_invited",
    relativeDays: null,
    relativeTime: "10:00",
    body: "Hi {{first_name}}! You're invited to {{event}} on {{date}} at {{time}}. RSVP and see the details here: {{link}} — {{host}}",
  },
  {
    key: "rsvp_reminder",
    label: "RSVP reminder (T−7)",
    segment: "pending_rsvp",
    relativeDays: -7,
    relativeTime: "10:00",
    body: "Hi {{first_name}}, {{event}} is a week away ({{date}}). Could you let us know if you can make it? {{link}} — {{host}}",
  },
  {
    key: "logistics",
    label: "Logistics (T−2)",
    segment: "not_declined",
    relativeDays: -2,
    relativeTime: "17:00",
    body: "{{event}} is this {{date}} at {{time}}, {{venue}}. Here's what to bring and the schedule: {{link}} See you soon! — {{host}}",
  },
  {
    key: "voting_open",
    label: "Voting is open",
    segment: "attending",
    relativeDays: null,
    relativeTime: "15:00",
    body: "Voting is open for {{event}}! Pick your favourites here: {{link}} — {{host}}",
  },
  {
    key: "thank_you",
    label: "Thank you (T+1)",
    segment: "attending",
    relativeDays: 1,
    relativeTime: "10:00",
    body: "Thank you for coming to {{event}}, {{first_name}}! Photos and memories will appear at {{link}} — {{host}}",
  },
];

export type RenderContext = {
  first_name: string;
  household: string;
  event: string;
  date: string;
  time: string;
  venue: string;
  link: string;
  host: string;
};

export function renderTemplate(body: string, ctx: RenderContext): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key: string) =>
    key in ctx ? ctx[key as keyof RenderContext] : m,
  );
}

export function usesLink(body: string): boolean {
  return /\{\{\s*link\s*\}\}/.test(body);
}

export const SEGMENT_LABEL: Record<MessageSegmentValue, string> = {
  all_invited: "Everyone invited",
  pending_rsvp: "Hasn't replied yet",
  attending: "Attending",
  not_declined: "Attending, maybe, or no reply",
};

export type { Event };
