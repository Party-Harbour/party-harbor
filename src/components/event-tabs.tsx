"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function EventTabs({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const base = `/events/${eventId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/guests`, label: "Guests" },
    { href: `${base}/tasks`, label: "Tasks" },
    { href: `${base}/contributions`, label: "Contributions" },
    { href: `${base}/contest`, label: "Contest" },
    { href: `${base}/edit`, label: "Edit" },
  ];
  return (
    <nav aria-label="Event sections" className="overflow-x-auto">
      <ul className="flex gap-1">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={
                  "inline-block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium " +
                  (active
                    ? "border-coral text-navy"
                    : "border-transparent text-navy/60 hover:text-navy")
                }
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
