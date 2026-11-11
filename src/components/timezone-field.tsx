"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Hidden input carrying the browser's time zone, so a new account starts on the right clock. */
export function TimeZoneField({ name = "timezone" }: { name?: string }) {
  const zone = useSyncExternalStore(
    subscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    () => "",
  );
  return <input type="hidden" name={name} value={zone} />;
}
