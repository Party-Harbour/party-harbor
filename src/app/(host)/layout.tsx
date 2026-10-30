import Link from "next/link";
import { requireHost } from "@/lib/auth";
import { signOut } from "@/actions/auth";
import { Icon } from "@/components/icons";
import { BottomNav, SidebarNav } from "@/components/host-nav";
import { HarborScene, LogoMark, Wordmark } from "@/components/logo";

export default async function HostLayout({ children }: LayoutProps<"/">) {
  const host = await requireHost();
  const initials = host.displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-full flex-1 lg:grid lg:grid-cols-[256px_1fr]">
      {/* Desktop sidebar, as in the mock-ups */}
      <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:flex-col lg:border-r lg:border-navy/10 lg:bg-white">
        <div className="px-5 pb-2 pt-5">
          <Link href="/dashboard" className="inline-block rounded-md focus-visible:outline-2 focus-visible:outline-sky">
            <Wordmark />
          </Link>
        </div>
        <div className="px-3 pt-3">
          <SidebarNav />
        </div>
        <div className="relative mt-auto">
          <HarborScene className="block h-44 w-full" />
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-xl bg-white/95 p-3 shadow-card">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
              {initials}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-semibold text-navy">{host.displayName}</span>
              <span className="block text-xs text-navy/60">Host</span>
            </span>
            <form action={signOut}>
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-md text-navy/60 hover:bg-cream hover:text-navy"
              >
                <Icon.Logout size={18} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-navy/10 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
          <Link href="/dashboard" className="flex items-center gap-2 font-display text-lg font-semibold text-navy">
            <LogoMark size={28} /> Party Harbor
          </Link>
          <form action={signOut} className="flex items-center gap-2 text-sm">
            <span className="text-navy/70">Hi, {host.displayName}</span>
            <button
              type="submit"
              aria-label="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-md text-navy/60 hover:bg-cream"
            >
              <Icon.Logout size={18} />
            </button>
          </form>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 lg:px-8 lg:pb-10">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
