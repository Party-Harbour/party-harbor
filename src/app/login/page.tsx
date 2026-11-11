import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { HarborScene, Wordmark } from "@/components/logo";
import { Button, Field } from "@/components/ui";
import { signIn } from "@/actions/auth";
import { isHostedDatabase } from "@/db";
import { seedHosts } from "@/db/seed";
import { getCurrentHost } from "@/lib/auth";
import { signupOpen } from "@/lib/signup";

export const metadata: Metadata = { title: "Host sign in" };

/** "a@x or b@x": the accounts a fresh local database starts with. */
function devHostEmails(): string {
  try {
    return seedHosts().map((h) => h.email).join(" or ");
  } catch {
    return "the accounts in SEED_HOSTS";
  }
}

export default async function LoginPage() {
  const host = await getCurrentHost();
  if (host) redirect("/dashboard");
  // The seeded local credentials are public knowledge; never advertise them on a hosted site.
  const showDevHint = !isHostedDatabase() && !process.env.VERCEL;
  const devEmails = showDevHint ? devHostEmails() : "";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-navy/5 md:grid-cols-[1fr_1.1fr]">
        <div className="relative hidden md:block">
          <HarborScene className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-x-0 bottom-0 p-6">
            <p className="font-script text-3xl text-navy">Every gathering has a home.</p>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          <Wordmark tagline={false} />
          <h1 className="mt-6 font-display text-2xl font-semibold text-navy">Welcome back, hosts</h1>
          <p className="text-sm text-navy/70">Sign in to see what&apos;s on the horizon.</p>
          <ActionForm action={signIn} className="mt-5 space-y-4">
            <Field label="Email" name="email" type="email" autoComplete="username" required />
            <Field label="Password" name="password" type="password" autoComplete="current-password" required />
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </ActionForm>
          {signupOpen() ? (
            <p className="mt-5 text-sm text-navy/70">
              New host?{" "}
              <Link href="/signup" className="font-medium text-navy underline">
                Create your account
              </Link>
            </p>
          ) : null}
          {showDevHint ? (
            <p className="mt-5 text-xs text-navy/60">
              Local dev accounts: {devEmails}, password “harbor-dev” unless you set SEED_HOST_PASSWORD.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
