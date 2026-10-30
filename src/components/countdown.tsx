"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}
const clientNow = () => Math.floor(Date.now() / 60_000) * 60_000;
const serverNow = () => null;

/** Days / hours / minutes until the event, ticking once a minute after hydration. */
export function Countdown({ startsAt, label }: { startsAt: string; label?: string }) {
  const now = useSyncExternalStore(subscribe, clientNow, serverNow);

  const target = new Date(startsAt).getTime();
  const diff = now === null ? null : Math.max(0, target - now);
  const days = diff === null ? null : Math.floor(diff / 86_400_000);
  const hours = diff === null ? null : Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = diff === null ? null : Math.floor((diff % 3_600_000) / 60_000);

  if (diff === 0) {
    return <p className="t-accent text-center font-display text-lg font-semibold">It&apos;s happening now!</p>;
  }

  const tiles: [string, number | null][] = [
    ["Days", days],
    ["Hours", hours],
    ["Minutes", minutes],
  ];
  return (
    <div>
      {label ? <p className="mb-2 text-center text-xs uppercase tracking-wide text-navy/60">{label}</p> : null}
      <div className="grid grid-cols-3 gap-2" role="timer" aria-live="off">
        {tiles.map(([name, value]) => (
          <div key={name} className="t-soft rounded-xl px-2 py-2 text-center">
            <div className="t-accent font-display text-2xl font-semibold tabular-nums">
              {value === null ? "–" : value}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-navy/60">{name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
