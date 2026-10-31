import type { Metadata } from "next";
import Link from "next/link";
import { deleteTemplate } from "@/actions/templates";
import { Icon } from "@/components/icons";
import { Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { BUILTIN_TEMPLATES, describeSummary, listSavedTemplates, summarizeSnapshot, type TemplateSnapshot } from "@/lib/templates";
import { getTheme } from "@/lib/themes";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const saved = await listSavedTemplates();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  return (
    <>
      <PageHeader
        title="Templates"
        subtitle="Reusable plans: settings, tasks, contribution slots, contest set-up and reminders. Guest lists never travel with a template."
      />

      <SectionTitle>Your templates</SectionTitle>
      {saved.length === 0 ? (
        <EmptyState>
          Nothing saved yet. Open any event and choose <strong>Save as template</strong> on its overview, or clone it straight into next year.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {saved.map((t) => (
            <TemplateCard
              key={t.id}
              name={t.name}
              description={t.description}
              snapshot={t.snapshot}
              useHref={`/events/new?template=saved:${t.id}`}
              meta={
                <>
                  {t.sourceTitle && t.sourceEventId ? (
                    <>
                      From{" "}
                      <Link href={`/events/${t.sourceEventId}`} className="underline">
                        {t.sourceTitle}
                      </Link>{" "}
                      ·{" "}
                    </>
                  ) : null}
                  saved {formatDateTime(t.createdAt, tz)}
                </>
              }
              actions={
                <form action={deleteTemplate}>
                  <input type="hidden" name="templateId" value={t.id} />
                  <button type="submit" className="min-h-9 rounded-md px-2 text-xs font-medium text-coral-deep hover:underline">
                    Delete
                  </button>
                </form>
              }
            />
          ))}
        </ul>
      )}

      <div className="mt-8">
        <SectionTitle>Starter templates</SectionTitle>
        <p className="mb-3 text-sm text-navy/70">The three parties the app was designed around. Use one, then change anything you like.</p>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {BUILTIN_TEMPLATES.map((t) => (
            <TemplateCard
              key={t.key}
              name={t.name}
              description={t.description}
              snapshot={t.snapshot}
              useHref={`/events/new?template=builtin:${t.key}`}
              meta="Built in"
            />
          ))}
        </ul>
      </div>
    </>
  );
}

function TemplateCard({
  name,
  description,
  snapshot,
  useHref,
  meta,
  actions,
}: {
  name: string;
  description: string | null;
  snapshot: TemplateSnapshot;
  useHref: string;
  meta: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const theme = getTheme(snapshot.event.theme);
  return (
    <Card as="li" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg font-semibold leading-tight text-navy">{name}</h3>
        <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium text-navy" style={{ background: theme.chip }}>
          {theme.label}
        </span>
      </div>
      {description ? <p className="text-sm text-navy/80">{description}</p> : null}
      <p className="flex items-start gap-1.5 text-xs text-navy/70">
        <Icon.Layers size={14} className="mt-0.5 shrink-0 text-navy/50" />
        {describeSummary(summarizeSnapshot(snapshot))}
      </p>
      <p className="text-xs text-navy/60">{meta}</p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <LinkButton href={useHref} variant="secondary">
          <Icon.Plus size={16} /> Use template
        </LinkButton>
        {actions}
      </div>
    </Card>
  );
}
