import type { Contest, Event, Task } from "@/db/schema";
import {
  EVENT_THEMES,
  GALLERY_POLICIES,
  MESSAGE_SEGMENTS,
  SELF_VOTE_POLICIES,
  TASK_PRIORITIES,
  VOTER_ELIGIBILITIES,
} from "@/db/schema";
import type { MessageSegmentValue } from "@/lib/messaging/types";

/** A moment relative to the event start: whole days (negative = before) at a wall-clock time. */
export type RelativeMoment = { days: number; time: string };

/**
 * Everything a template carries. Dates are stored relative to the event start
 * so the plan lands on whatever date the next party is. Guest data (invites,
 * RSVPs, claims, entries, votes, photos) is never part of a snapshot.
 */
export type TemplateSnapshot = {
  version: 1;
  event: {
    title: string;
    description: string | null;
    timezone: string;
    durationMinutes: number | null;
    rsvpDeadline: RelativeMoment | null;
    venueName: string | null;
    venueAddress: string | null;
    whatToBring: string | null;
    theme: Event["theme"];
    coverImageUrl: string | null;
    galleryPolicy: Event["galleryPolicy"];
    galleryAutoApprove: boolean;
  };
  slots: { category: string; title: string; capacity: number | null; notes: string | null }[];
  tasks: {
    title: string;
    notes: string | null;
    priority: Task["priority"];
    assigneeId: string | null;
    due: RelativeMoment | null;
  }[];
  contest: {
    title: string;
    entryNoun: string;
    selfVotePolicy: Contest["selfVotePolicy"];
    voterEligibility: Contest["voterEligibility"];
    showBakers: boolean;
    categories: string[];
  } | null;
  messages: { label: string; segment: MessageSegmentValue; body: string; at: RelativeMoment }[];
};

export type SnapshotSummary = { slots: number; tasks: number; messages: number; contest: boolean };

export function summarizeSnapshot(s: TemplateSnapshot): SnapshotSummary {
  return { slots: s.slots.length, tasks: s.tasks.length, messages: s.messages.length, contest: s.contest !== null };
}

/** "3 tasks · 2 contribution slots · a contest · 2 scheduled messages" */
export function describeSummary(s: SnapshotSummary): string {
  const n = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
  const parts = [
    s.tasks ? n(s.tasks, "task") : null,
    s.slots ? n(s.slots, "contribution slot") : null,
    s.contest ? "a contest" : null,
    s.messages ? n(s.messages, "scheduled message") : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "event details only";
}

const TIME_RE = /^\d{2}:\d{2}$/;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const strOr = (v: unknown, fallback: string): string => strOrNull(v) ?? fallback;
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
const intOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null);

function moment(v: unknown): RelativeMoment | null {
  if (!isRecord(v)) return null;
  const days = intOrNull(v.days);
  const time = typeof v.time === "string" && TIME_RE.test(v.time) ? v.time : null;
  return days === null || time === null ? null : { days, time };
}

/**
 * Turns whatever is in the jsonb column (or a pasted file) into a well-formed
 * snapshot. Unknown fields are dropped and bad values fall back to defaults,
 * so an old or hand-edited template can't break event creation.
 */
export function normalizeSnapshot(raw: unknown): TemplateSnapshot {
  const r = isRecord(raw) ? raw : {};
  const ev = isRecord(r.event) ? r.event : {};
  const list = (v: unknown) => (Array.isArray(v) ? v.filter(isRecord) : []);

  const slots = list(r.slots)
    .map((s) => ({
      category: strOr(s.category, "General"),
      title: strOr(s.title, ""),
      capacity: (() => {
        const c = intOrNull(s.capacity);
        return c !== null && c >= 1 ? c : null;
      })(),
      notes: strOrNull(s.notes),
    }))
    .filter((s) => s.title);

  const tasks = list(r.tasks)
    .map((t) => ({
      title: strOr(t.title, ""),
      notes: strOrNull(t.notes),
      priority: oneOf(t.priority, TASK_PRIORITIES, "normal"),
      assigneeId: strOrNull(t.assigneeId),
      due: moment(t.due),
    }))
    .filter((t) => t.title);

  const contest = isRecord(r.contest)
    ? {
        title: strOr(r.contest.title, "Contest"),
        entryNoun: strOr(r.contest.entryNoun, "entry").toLowerCase(),
        selfVotePolicy: oneOf(r.contest.selfVotePolicy, SELF_VOTE_POLICIES, "disallowed"),
        voterEligibility: oneOf(r.contest.voterEligibility, VOTER_ELIGIBILITIES, "all_invited"),
        showBakers: r.contest.showBakers !== false,
        categories: Array.isArray(r.contest.categories)
          ? r.contest.categories.filter((c): c is string => typeof c === "string" && c.trim() !== "")
          : [],
      }
    : null;

  const messages = list(r.messages)
    .map((m) => ({
      label: strOr(m.label, ""),
      segment: oneOf(m.segment, MESSAGE_SEGMENTS, "all_invited"),
      body: strOr(m.body, ""),
      at: moment(m.at),
    }))
    .filter((m): m is typeof m & { at: RelativeMoment } => m.body !== "" && m.at !== null)
    .map((m) => ({ ...m, label: m.label || m.body.slice(0, 40) }));

  return {
    version: 1,
    event: {
      title: strOr(ev.title, "Untitled event"),
      description: strOrNull(ev.description),
      timezone: strOr(ev.timezone, "UTC"),
      durationMinutes: (() => {
        const d = intOrNull(ev.durationMinutes);
        return d !== null && d > 0 ? d : null;
      })(),
      rsvpDeadline: moment(ev.rsvpDeadline),
      venueName: strOrNull(ev.venueName),
      venueAddress: strOrNull(ev.venueAddress),
      whatToBring: strOrNull(ev.whatToBring),
      theme: oneOf(ev.theme, EVENT_THEMES, "coastal"),
      coverImageUrl: (() => {
        const u = strOrNull(ev.coverImageUrl);
        return u && /^https?:\/\//i.test(u) ? u : null;
      })(),
      galleryPolicy: oneOf(ev.galleryPolicy, GALLERY_POLICIES, "contribute"),
      galleryAutoApprove: ev.galleryAutoApprove !== false,
    },
    slots,
    tasks,
    contest,
    messages,
  };
}
