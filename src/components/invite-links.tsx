"use client";

import { useActionState, useState } from "react";
import type { InviteState } from "@/actions/invites";
import { Button } from "./ui";

type InviteAction = (prev: InviteState, formData: FormData) => Promise<InviteState>;

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="min-h-9 rounded-md border border-navy/20 px-2 text-xs font-medium text-navy hover:bg-sky/40"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt("Copy this link:", text);
        }
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function LinkList({ state }: { state: InviteState }) {
  if (!state?.links?.length) return null;
  return (
    <div className="mt-4 rounded-lg bg-sage/30 p-3">
      <p className="mb-2 text-sm font-medium text-navy">
        New links. Copy them now: only a fingerprint is stored, so they won&apos;t be shown again.
      </p>
      <ul className="space-y-2">
        {state.links.map((l) => (
          <li key={l.url} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{l.householdName}</span>
            <code className="max-w-full flex-1 truncate rounded bg-white px-2 py-1 text-xs">{l.url}</code>
            <CopyButton text={l.url} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InviteGenerator({
  action,
  households,
}: {
  action: InviteAction;
  households: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction}>
      {households.length === 0 ? (
        <p className="text-sm text-navy/60">Every household in your contacts is already invited.</p>
      ) : (
        <fieldset disabled={pending} className="space-y-2">
          <legend className="mb-2 text-sm text-navy/70">Pick households to invite:</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {households.map((h) => (
              <label key={h.id} className="flex min-h-11 items-center gap-2 rounded-md border border-navy/10 px-3 text-sm">
                <input type="checkbox" name="householdId" value={h.id} className="h-4 w-4 accent-navy" />
                {h.name}
              </label>
            ))}
          </div>
          <Button type="submit" className="mt-2">
            {pending ? "Generating…" : "Generate invitation links"}
          </Button>
        </fieldset>
      )}
      {state?.error ? (
        <p role="alert" className="mt-3 rounded-md bg-coral/20 px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}
      <LinkList state={state} />
    </form>
  );
}

export function RegenerateLink({ action }: { action: InviteAction }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={pending}
        className="min-h-9 rounded-md border border-navy/20 px-2 text-xs font-medium text-navy hover:bg-sky/40 disabled:opacity-50"
      >
        {pending ? "…" : "New link"}
      </button>
      {state?.links?.[0] ? (
        <span className="ml-2 inline-flex items-center gap-1 text-xs">
          <code className="max-w-56 truncate rounded bg-sage/30 px-1.5 py-0.5">{state.links[0].url}</code>
          <CopyButton text={state.links[0].url} />
        </span>
      ) : null}
      {state?.error ? <span className="ml-2 text-xs text-coral-deep">{state.error}</span> : null}
    </form>
  );
}
