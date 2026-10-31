import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { guestClaim, guestRsvp, guestUnclaim } from "@/actions/guest";
import { guestRemovePhoto } from "@/actions/photos";
import { ActionForm } from "@/components/action-form";
import { Countdown } from "@/components/countdown";
import { EventCover } from "@/components/event-cover";
import { GuestContest } from "@/components/guest-contest";
import { Icon } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { PhotoGrid, PhotoThumb, PhotoTile, smallDangerClass } from "@/components/photo-tile";
import { PhotoUpload } from "@/components/photo-upload";
import { Button, Field, RSVP_LABEL, TextArea, inputClass } from "@/components/ui";
import { getDb, schema } from "@/db";
import { getContestView, getGuestContestState } from "@/lib/contest";
import { formatDate, formatTime } from "@/lib/dates";
import { guestCanUpload, guestCanViewGallery, listEventPhotos } from "@/lib/gallery";
import { guestCanRespond, resolveInvite } from "@/lib/guest";
import { getEventContributions } from "@/lib/queries";
import { getTheme, themeVars } from "@/lib/themes";

export const metadata: Metadata = {
  title: "Your invitation",
  robots: { index: false, follow: false },
};

export default async function GuestEventPage({ params, searchParams }: PageProps<"/e/[token]">) {
  const { token } = await params;
  const { photos: uploadedCount, photoError } = await searchParams;
  const resolved = await resolveInvite(token);

  if (!resolved) {
    return (
      <Shell>
        <div className="pt-10 text-center">
          <LogoMark size={56} className="mx-auto" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-navy">This invitation link isn&apos;t active</h1>
          <p className="mt-2 text-navy/70">
            It may have been replaced or the event may have ended. Ask your host for a fresh link.
          </p>
        </div>
      </Shell>
    );
  }

  const { event, household, invite } = resolved;
  const theme = getTheme(event.theme);
  const db = await getDb();
  const [rsvp] = await db.select().from(schema.rsvps).where(eq(schema.rsvps.inviteId, invite.id));
  const mine = await db
    .select()
    .from(schema.contributions)
    .where(and(eq(schema.contributions.inviteId, invite.id), eq(schema.contributions.eventId, event.id)));
  const { slots } = await getEventContributions(event.id);
  const contestView = await getContestView(event.id);
  const contestState = contestView
    ? await getGuestContestState(contestView.contest, invite.id, rsvp)
    : null;
  const open = guestCanRespond(event);
  const tz = event.timezone;
  const replied = rsvp && rsvp.status !== "pending";

  const canUpload = guestCanUpload(event);
  const gallery = guestCanViewGallery(event) ? await listEventPhotos(event.id, ["visible", "pending"]) : [];
  const visiblePhotos = gallery.filter((p) => p.state === "visible");
  const myPending = gallery.filter((p) => p.state === "pending" && p.inviteId === invite.id);
  const showGallery = guestCanViewGallery(event) && (visiblePhotos.length > 0 || canUpload);
  const memories = event.status === "memories";
  const galleryTitle = memories ? "Memories" : "Photos";
  const gallerySection = showGallery ? (
    <section id="photos" className="scroll-mt-4 rounded-3xl bg-white p-5 shadow-card ring-1 ring-navy/5 sm:p-6">
      <h2 className="t-accent flex items-center gap-2 font-display text-2xl font-semibold">
        <Icon.Camera size={22} /> {galleryTitle}
      </h2>
      <p className="mt-1 text-sm text-navy/70">
        {memories
          ? "Thanks for coming! Here are the photos so far."
          : canUpload
            ? "Snap something? Add it here for everyone at the party to see."
            : "Photos the hosts have shared."}
        {canUpload && !event.galleryAutoApprove ? " Photos appear once the hosts have had a look." : ""}
      </p>
      {uploadedCount ? (
        <p role="status" className="mt-3 rounded-md bg-sage/40 px-3 py-2 text-sm text-navy">
          {uploadedCount} photo{uploadedCount === "1" ? "" : "s"} added{event.galleryAutoApprove ? "" : ", waiting for the hosts"}. Thank you!
        </p>
      ) : null}
      {photoError ? (
        <p role="alert" className="mt-3 rounded-md bg-coral/20 px-3 py-2 text-sm text-navy">
          {photoError}
        </p>
      ) : null}
      {canUpload ? (
        <div className="mt-4">
          <PhotoUpload fields={{ token }} returnTo={`/e/${token}#photos`} buttonClass="t-btn" />
        </div>
      ) : null}
      {myPending.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-navy/70">Your photos waiting for the hosts</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {myPending.map((p) => (
              <li key={p.id} className="t-soft flex items-center gap-2 rounded-lg p-1.5 pr-2 text-xs">
                <PhotoThumb id={p.id} token={token} className="h-12 w-12 rounded-md" />
                <form action={guestRemovePhoto}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="photoId" value={p.id} />
                  <button type="submit" className="text-coral-deep hover:underline">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {visiblePhotos.length > 0 ? (
        <div className="mt-4">
          <PhotoGrid>
            {visiblePhotos.map((p) => (
              <PhotoTile
                key={p.id}
                photo={p}
                token={token}
                byline={p.inviteId === invite.id ? "Yours" : p.uploaderName}
                actions={
                  p.inviteId === invite.id ? (
                    <form action={guestRemovePhoto}>
                      <input type="hidden" name="token" value={token} />
                      <input type="hidden" name="photoId" value={p.id} />
                      <button type="submit" className={smallDangerClass}>
                        Remove
                      </button>
                    </form>
                  ) : null
                }
              />
            ))}
          </PhotoGrid>
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-navy/20 px-4 py-5 text-center text-sm text-navy/60">
          No photos yet{canUpload ? ". Be the first!" : "."}
        </p>
      )}
    </section>
  ) : null;

  return (
    <Shell style={themeVars(theme)}>
      <header className="text-center">
        <div className="flex items-center justify-center gap-2">
          <LogoMark size={30} />
          <span className="font-display text-lg font-semibold text-navy">Party Harbor</span>
        </div>
        <p className="t-highlight mt-3 font-script text-5xl leading-none">You&apos;re invited!</p>
        <p className="mt-1 text-sm text-navy/70">{household.name}, save the date.</p>
      </header>

      <section className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-navy/5">
        <EventCover event={event} className="h-48 sm:h-60" rounded="rounded-t-3xl" />
        <div className="space-y-4 p-5 sm:p-6">
          <h1 className="t-accent font-display text-3xl font-semibold leading-tight">{event.title}</h1>
          <ul className="space-y-1.5 text-navy/85">
            <li className="flex items-center gap-2.5">
              <Icon.Calendar size={18} className="t-accent shrink-0" />
              {formatDate(event.startsAt, tz)}
            </li>
            <li className="flex items-center gap-2.5">
              <Icon.Clock size={18} className="t-accent shrink-0" />
              {formatTime(event.startsAt, tz)}
              {event.endsAt ? ` – ${formatTime(event.endsAt, tz)}` : ""}
            </li>
            {event.venueName ? (
              <li className="flex items-start gap-2.5">
                <Icon.MapPin size={18} className="t-accent mt-0.5 shrink-0" />
                <span>
                  {event.venueName}
                  {event.venueAddress ? <span className="block text-sm text-navy/60">{event.venueAddress}</span> : null}
                </span>
              </li>
            ) : null}
          </ul>
          {event.description ? <p className="whitespace-pre-line text-navy/85">{event.description}</p> : null}
          <Countdown startsAt={event.startsAt.toISOString()} />
          {open ? (
            <a
              href="#rsvp"
              className="t-btn flex min-h-12 items-center justify-center gap-2 rounded-xl text-base font-semibold shadow-card transition"
            >
              {replied ? "Update my RSVP" : "RSVP now"} <Icon.ArrowRight size={18} />
            </a>
          ) : null}
          <nav aria-label="On this page" className="divide-y divide-navy/10 rounded-xl border border-navy/10">
            {[
              ["#rsvp", "Can you make it?"],
              event.whatToBring ? ["#bring", "What to bring"] : null,
              ["#signup", "Sign up to bring something"],
              contestView ? ["#contest", contestView.contest.title] : null,
              showGallery ? ["#photos", galleryTitle] : null,
            ]
              .filter((x): x is [string, string] => x !== null)
              .map(([href, label]) => (
                <a key={href} href={href} className="flex min-h-11 items-center justify-between px-4 text-sm font-medium text-navy hover:bg-cream">
                  {label}
                  <Icon.ChevronRight size={16} className="text-navy/40" />
                </a>
              ))}
          </nav>
        </div>
      </section>

      {memories ? gallerySection : null}

      <section id="rsvp" className="scroll-mt-4 rounded-3xl bg-white p-5 shadow-card ring-1 ring-navy/5 sm:p-6">
        <h2 className="t-accent font-display text-2xl font-semibold">Can you make it?</h2>
        {replied ? (
          <p className="mt-1 text-sm text-sage-deep">
            Your current reply: <strong>{RSVP_LABEL[rsvp.status]}</strong>
            {rsvp.status !== "declined" ? ` (${rsvp.adults} adults, ${rsvp.children} children)` : ""}.
            {open ? " You can change it below." : ""}
          </p>
        ) : null}
        {!open ? (
          <p className="mt-2 text-sm text-navy/70">
            {event.status === "invitations_open"
              ? "The RSVP deadline has passed. Reach out to your host if plans change."
              : event.status === "memories"
                ? "Thanks for coming! Photos and memories will appear here as the hosts share them."
                : "RSVPs are closed for this event."}
          </p>
        ) : (
          <ActionForm action={guestRsvp.bind(null, token)} className="mt-4 space-y-4">
            <fieldset className="grid gap-2 sm:grid-cols-3">
              <legend className="sr-only">Reply</legend>
              {(["attending", "maybe", "declined"] as const).map((s) => (
                <label
                  key={s}
                  className="t-ring flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium text-navy has-[:checked]:bg-(--t-soft)"
                >
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    defaultChecked={rsvp?.status === s}
                    className="h-4 w-4 accent-(--t-accent)"
                    required
                  />
                  {RSVP_LABEL[s]}
                </label>
              ))}
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Adults" name="adults" type="number" min={0} max={20} defaultValue={rsvp?.adults ?? 2} />
              <Field label="Children" name="children" type="number" min={0} max={20} defaultValue={rsvp?.children ?? 0} />
            </div>
            <Field label="Note for the hosts (optional)" name="note">
              <TextArea id="f-note" name="note" defaultValue={rsvp?.note ?? ""} className="min-h-16" />
            </Field>
            <Button type="submit" className="t-btn w-full text-base sm:w-auto">
              Send reply
            </Button>
          </ActionForm>
        )}
      </section>

      {event.whatToBring ? (
        <section id="bring" className="t-soft scroll-mt-4 rounded-3xl p-5 sm:p-6">
          <h2 className="t-accent font-display text-2xl font-semibold">What to bring</h2>
          <p className="mt-2 whitespace-pre-line text-navy/85">{event.whatToBring}</p>
        </section>
      ) : null}

      {slots.length > 0 || mine.length > 0 || open ? (
        <section id="signup" className="scroll-mt-4 rounded-3xl bg-white p-5 shadow-card ring-1 ring-navy/5 sm:p-6">
          <h2 className="t-accent font-display text-2xl font-semibold">Sign up to bring something</h2>
          {mine.length > 0 ? (
            <div className="mt-3">
              <h3 className="text-sm font-medium text-navy/70">You&apos;re bringing</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {mine.map((c) => (
                  <li key={c.id} className="t-soft flex items-center justify-between gap-2 rounded-lg px-3 py-2">
                    <span>
                      {c.description}
                      {c.quantity > 1 ? ` ×${c.quantity}` : ""}
                    </span>
                    {open ? (
                      <form action={guestUnclaim}>
                        <input type="hidden" name="token" value={token} />
                        <input type="hidden" name="contributionId" value={c.id} />
                        <button type="submit" className="min-h-8 px-2 text-xs text-coral-deep hover:underline">
                          Remove
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {open ? (
            <ActionForm action={guestClaim.bind(null, token)} className="mt-4 space-y-3">
              {slots.length > 0 ? (
                <Field label="Pick a slot" name="slotId">
                  <select id="f-slotId" name="slotId" className={inputClass} defaultValue="">
                    <option value="">Something else (describe below)</option>
                    {slots.map((s) => {
                      const left = s.capacity === null ? null : s.capacity - s.claims.length;
                      const full = left !== null && left <= 0;
                      return (
                        <option key={s.id} value={s.id} disabled={full}>
                          {s.category}: {s.title}
                          {left === null ? "" : full ? " (full)" : ` (${left} left)`}
                        </option>
                      );
                    })}
                  </select>
                </Field>
              ) : null}
              <Field label="What exactly?" name="description" placeholder="Grandma's snickerdoodles" hint="Optional if you picked a slot." />
              <Field label="How many" name="quantity" type="number" min={1} defaultValue={1} />
              <Button type="submit" className="t-btn">
                Add it
              </Button>
            </ActionForm>
          ) : null}
        </section>
      ) : null}

      {contestView && contestState ? (
        <div id="contest" className="scroll-mt-4">
          <GuestContest token={token} view={contestView} state={contestState} inviteId={invite.id} canUpload={canUpload} />
        </div>
      ) : null}

      {!memories ? gallerySection : null}

      <footer className="pt-2 text-center text-xs text-navy/50">
        This link is just for your household. Please don&apos;t forward it.
      </footer>
    </Shell>
  );
}

function Shell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="t-bg flex flex-1 flex-col" style={style}>
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-6 sm:py-10">{children}</main>
    </div>
  );
}
