import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signUp } from "@/actions/auth";
import { ActionForm } from "@/components/action-form";
import { HarborScene, Wordmark } from "@/components/logo";
import { TimeZoneField } from "@/components/timezone-field";
import { Button, Field } from "@/components/ui";
import { getCurrentHost } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH, signupOpen } from "@/lib/signup";

export const metadata: Metadata = { title: "Create a host account" };

export default async function SignupPage() {
  const host = await getCurrentHost();
  if (host) redirect("/dashboard");
  const open = signupOpen();

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
          <h1 className="mt-6 font-display text-2xl font-semibold text-navy">Create your host account</h1>
          {open ? (
            <>
              <p className="text-sm text-navy/70">
                Hosts plan the gatherings and see every guest list. Guests never need an account: they use the link in
                their invitation.
              </p>
              <ActionForm action={signUp} className="mt-5 space-y-4">
                <Field label="Your name" name="displayName" autoComplete="given-name" maxLength={40} required hint="How the app greets you, and how you appear on tasks." />
                <Field label="Email" name="email" type="email" autoComplete="username" maxLength={254} required hint="Only used to sign in." />
                <Field
                  label="Password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  hint={`At least ${MIN_PASSWORD_LENGTH} characters. A few unrelated words works well.`}
                />
                <Field label="Password again" name="passwordAgain" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
                <Field
                  label="Sign-up code"
                  name="code"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  hint="From whoever set up this Party Harbor."
                />
                <TimeZoneField />
                <Button type="submit" className="w-full">
                  Create account
                </Button>
              </ActionForm>
            </>
          ) : (
            <p className="mt-2 rounded-lg bg-cream px-3 py-3 text-sm text-navy">
              Sign-up is closed right now. Ask the person who runs this Party Harbor to open it, or sign in if you already
              have an account.
            </p>
          )}
          <p className="mt-5 text-sm text-navy/70">
            Already a host?{" "}
            <Link href="/login" className="font-medium text-navy underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
