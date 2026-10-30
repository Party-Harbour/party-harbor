import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-navy text-white hover:bg-navy/90 focus-visible:outline-navy",
  secondary:
    "bg-coral text-navy font-semibold hover:bg-coral/90 focus-visible:outline-navy",
  ghost:
    "bg-transparent text-navy hover:bg-sky/40 focus-visible:outline-navy",
  danger:
    "bg-white text-coral-deep border border-coral-deep/40 hover:bg-coral/15 focus-visible:outline-coral-deep",
};

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button className={cx(buttonBase, buttonStyles[variant], className)} {...props} />
  );
}

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={cx(buttonBase, buttonStyles[variant], className)} {...props} />;
}

export function Card({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "li";
}) {
  return (
    <Tag className={cx("rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy/5", className)}>
      {children}
    </Tag>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-navy sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-navy/70">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-lg font-semibold text-navy">{children}</h2>;
}

const inputStyles =
  "w-full rounded-lg border border-navy/20 bg-white px-3 py-2 text-navy placeholder:text-navy/40 focus:border-navy focus:outline-2 focus:outline-offset-1 focus:outline-sky min-h-11";

export function Field({
  label,
  name,
  hint,
  children,
  ...input
}: ComponentProps<"input"> & { label: string; name: string; hint?: string; children?: ReactNode }) {
  const id = input.id ?? `f-${name}`;
  return (
    <label htmlFor={id} className="block text-sm">
      <span className="mb-1 block font-medium text-navy">{label}</span>
      {children ?? <input id={id} name={name} className={inputStyles} {...input} />}
      {hint ? <span className="mt-1 block text-xs text-navy/60">{hint}</span> : null}
    </label>
  );
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputStyles, "min-h-24", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputStyles, className)} {...props} />;
}

export const inputClass = inputStyles;

type Tone = "neutral" | "good" | "warn" | "bad" | "info";
const toneStyles: Record<Tone, string> = {
  neutral: "bg-navy/10 text-navy",
  good: "bg-sage text-navy",
  warn: "bg-peach text-navy",
  bad: "bg-coral text-navy",
  info: "bg-sky text-navy",
};

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneStyles[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-navy/20 px-4 py-6 text-center text-sm text-navy/60">
      {children}
    </p>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg bg-cream px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-navy/60">{label}</div>
      <div className="text-2xl font-semibold text-navy">{value}</div>
      {hint ? <div className="text-xs text-navy/60">{hint}</div> : null}
    </div>
  );
}

export const EVENT_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  invitations_open: "Invitations open",
  rsvp_closed: "RSVP closed",
  live: "Underway",
  memories: "Memories",
  archived: "Archived",
};

export const EVENT_STATUS_TONE: Record<string, Tone> = {
  draft: "neutral",
  invitations_open: "info",
  rsvp_closed: "warn",
  live: "good",
  memories: "good",
  archived: "neutral",
};

export const RSVP_LABEL: Record<string, string> = {
  pending: "No reply yet",
  attending: "Attending",
  maybe: "Maybe",
  declined: "Can't make it",
};

export const RSVP_TONE: Record<string, Tone> = {
  pending: "neutral",
  attending: "good",
  maybe: "warn",
  declined: "bad",
};
