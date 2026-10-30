"use client";

import { useActionState } from "react";
import type { ActionState, FormAction } from "@/lib/action-state";

type Props = {
  action: FormAction;
  children: React.ReactNode;
  className?: string;
};

/**
 * A form wired to a server action that returns { error | message }.
 * Children stay server-rendered; only the pending/error plumbing is client side.
 */
export function ActionForm({ action, children, className }: Props) {
  const [state, formAction, pending] = useActionState(action, null as ActionState);
  return (
    <form action={formAction} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state?.error ? (
        <p role="alert" className="mt-3 rounded-md bg-coral/20 px-3 py-2 text-sm text-navy">
          {state.error}
        </p>
      ) : null}
      {state?.message ? (
        <p role="status" className="mt-3 rounded-md bg-sage/40 px-3 py-2 text-sm text-navy">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
