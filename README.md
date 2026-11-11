# Party Harbor

Every gathering has a home. A self-hostable, mobile-first app for coordinating private household gatherings: contacts, invitations, household RSVPs, contributions, tasks and countdowns. Guests get a private link and never need an account.

This is the local-first MVP built from the Party Harbor PRD v1.0.

## Run it locally

Requirements: Node 20 or newer. No database install needed: the app runs an embedded Postgres (PGlite) that stores its files under `data/pgdata`.

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with one of the seeded host accounts:

| Host  | Email                     | Password     |
| ----- | ------------------------- | ------------ |
| Rita  | rita@partyharbor.local    | `harbor-dev` |
| Randy | randy@partyharbor.local   | `harbor-dev` |

Set `SEED_HOST_PASSWORD` in `.env.local` before the first start to pick a different password. The first start also seeds three sample events and four synthetic households so there is something to click on.

To start over with an empty database, stop the dev server and delete the data folder.

If the project folder is inside OneDrive (or Dropbox, iCloud…), set `PGLITE_DATA_DIR` in `.env.local` to a folder outside the synced tree, such as `C:\Users\you\AppData\Local\PartyHarbor\pgdata`. Sync clients lock files and Postgres then fails to start with "could not create lock file".

## What works today

- Host sign-in with sessions (two owner accounts)
- Dashboard: upcoming events with countdowns, RSVP counts, open and overdue tasks
- Events: create, edit, lifecycle status (draft → invitations open → RSVP closed → underway → memories → archived)
- Contacts: households and people, child flag, messaging-consent record
- Guest invitation links: one per household, unguessable, stored hashed, revocable and regenerable
- Guest page: event details, household RSVP (adults/children/note), sign-up slots with capacity, free-form "I'll bring…"
- Hosts can record replies received by phone, manage tasks per event, and manage contribution slots
- Contest voting (one contest per event): guests enter their bakes from their link, hosts approve entries and freeze the ballot, open voting, see a live tally, close and reveal. One vote per household per category (database-enforced), self-vote policy, eligibility by RSVP, ties shared, every status change audited.

- Messaging: compose to a segment (everyone, no reply yet, attending, not declined) with placeholders, send now or schedule at a time or relative to the event (reminders move if the date moves). Durable per-recipient jobs with idempotency keys, retries with backoff, dead-letter and retry, quiet hours (21:00–08:00 event time), consent enforced (adults with a number and recorded opt-in only), delivery log, STOP/START handling on the inbound webhook. Local provider logs texts to the console; Twilio adapter behind the same interface.

- Photo gallery per event: hosts and invited guests upload photos (plain forms, up to 12 at a time); files are checked by decoding them, auto-rotated, resized to 2000px, stripped of EXIF/GPS, and stored outside the database with a WebP thumbnail. Hosts set guest access (hidden / view / view and add), choose whether guest photos wait for approval, hide, delete, download, pick a cover photo, and see storage against a per-event cap. Guests see who added each photo, can remove their own, and can attach a photo to their contest entry, which then shows on the ballot and in results. Every image is served through an authenticated proxy (host session or invitation token); only the cover photo is public.

- Event templates and cloning: any event can be saved as a template or cloned for next time. A template carries settings, contribution slots, tasks, the contest set-up and reminders scheduled relative to the date, never guests, RSVPs, claims, entries, votes or photos. Three starter templates from the PRD (Christmas Cookie Exchange, Carnival, Fall Bonfire) are built in. Creating from a template lays everything out against the date you pick; cloning suggests the same time a year on. Households invited after a reminder is scheduled are added to it automatically.

- Host digest: each host gets a summary of every live event (RSVPs and headcount, open and overdue tasks, unfilled sign-up slots, contest state, new photos, texts going out today) plus what changed since the last digest and a list of things that need a look (overdue tasks, passed RSVP deadlines, undeliverable texts, photos or entries awaiting approval, drafts close to the date). Daily or weekly at an hour you choose in your own time zone, texted through the messaging provider when you add a mobile number, always readable on the Digest page with history. One per period however often the heartbeat runs; "Send me a digest" works any time.

## Photos locally

Uploads go to `UPLOAD_DIR` (default `./data/uploads`, gitignored); keep it outside synced folders like the database. `GALLERY_MAX_PHOTOS` caps each event (default 500). Phones usually send HEIC as JPEG through the browser; if a raw HEIC gets through, the upload is refused with a clear message.

## Messaging locally

With `MESSAGING_PROVIDER` unset, outgoing texts are printed to the dev server console instead of sent. Due messages and host digests go out once a minute while the server runs (an in-process heartbeat), or when something calls `/api/cron/dispatch` (a host session or `CRON_SECRET`). Digest links use `NEXT_PUBLIC_APP_URL` when set, otherwise `http://localhost:3000`. To send for real, set the Twilio variables in `.env.local` and point Twilio's inbound SMS webhook at `/api/sms/inbound`. Carrier A2P registration applies before texting anyone outside your household.

Invitation links are stored hashed for lookups plus encrypted for resending; the key is generated next to the database folder (or set `INVITE_TOKEN_KEY`).

## Not built yet (per the PRD phases)

WhatsApp and email adapters (digests and guest messages are SMS or in-app for now), gallery ZIP export and retention expiry, the external agent API, SMS reply voting, multi-host co-host permissions, and password reset or sign-in rate limiting.

## Hosting

The same code runs on Supabase and Vercel: set `DATABASE_URL` and the app uses that Postgres instead of the embedded one, set the Supabase URL and secret key and photos go to a private storage bucket, and a scheduler calls `/api/cron/dispatch` in place of the local timer. Migrations and the first host accounts are applied at deploy time by `npm run db:migrate`. Step-by-step instructions are in [docs/hosting.md](docs/hosting.md).

## Project layout

```
src/app/(host)/      host portal pages (require a session)
src/app/e/[token]/   guest microsite
src/app/login/       host sign-in
src/actions/         server actions (all host actions call requireHost)
src/db/schema.ts     Drizzle schema (Postgres)
src/db/index.ts      picks the embedded database or DATABASE_URL (postgres.ts)
scripts/migrate.ts   deploy-time migrations + host accounts for a hosted database
src/db/seed.ts       first-run synthetic data
src/lib/             auth, tokens, dates, queries, messaging/, gallery/, templates/, digest/ (build, render, schedule)
src/app/api/         upload + photo proxy, cron dispatch, inbound SMS
drizzle/             generated SQL migrations (run automatically at startup)
```

After changing `src/db/schema.ts`, run `npx drizzle-kit generate` to produce a new migration.

## Design

Coastal Sunset tokens from the PRD live in `src/app/globals.css`. Navy carries primary text and controls; coral is reserved for highlights and date badges. Headings use Fraunces, the "You're invited!" line uses Caveat, body text is Geist (all open-licensed Google Fonts).

Each event picks one of the four PRD themes (Coastal Classic, Sunset Warmth, Celebration Bright, Modern Earth), defined in `src/lib/themes.ts`. The theme drives the guest page's colours and the cover art fallback; hosts can also paste a cover photo link. The original PRD mock-ups are in `docs/mockups/` for reference.
