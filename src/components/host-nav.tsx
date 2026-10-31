"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: Icon.Home },
  { href: "/events", label: "Events", icon: Icon.Calendar },
  { href: "/contacts", label: "Contacts", icon: Icon.Users },
  { href: "/templates", label: "Templates", icon: Icon.Layers },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="space-y-1">
      {items.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition " +
              (active ? "bg-sky-soft text-navy" : "text-navy/70 hover:bg-cream hover:text-navy")
            }
          >
            <n.icon size={18} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-navy/10 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {items.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={
              "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium " +
              (active ? "text-navy" : "text-navy/60")
            }
          >
            <n.icon size={20} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
