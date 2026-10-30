import type { Event, messageSegment } from "@/db/schema";

export type MessageSegmentValue = (typeof messageSegment.enumValues)[number];
export type { Event };
