# Party Harbor

**Every gathering has a home.**

Party Harbor is a small, self-hostable web app for coordinating private get-togethers: the cookie exchange, the bonfire, the birthday in the back yard. Hosts plan in one place. Each invited household gets a single private link and never needs an account or an app.

It is built for a household, not a business. No ads, no tracking, no guest sign-ups, and your guest list stays in your own database.

## What it does

| Area              | What you get                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Invitations**   | One unguessable link per household. Replace or revoke any link.                                                      |
| **RSVPs**         | A household replies once for everyone: attending, maybe or no, with adults, children and a note.                     |
| **Who brings what** | Sign-up slots with limits ("Hot cocoa, 1 needed") plus free-form offers.                                           |
| **Tasks**         | A to-do list per event with due dates, priorities and assignees. Overdue work is flagged everywhere.                 |
| **Contests**      | Entries, categories, a frozen ballot, one vote per household per category, a live tally, then a reveal.              |
| **Photos**        | A private gallery per event. Guests can add photos; hosts can require approval. Location data is stripped.           |
| **Messages**      | Text a segment of the guest list now, at a set time, or relative to the event. Consent and quiet hours are enforced. |
| **Templates**     | Save any event as a template or clone it for next year. Three starter templates are included.                        |
| **Digest**        | A daily or weekly summary for each host of what changed and what needs attention.                                    |

For a tour of every screen, read the **[walkthrough](docs/walkthrough.md)**.

## Try it on your computer

You need [Node.js](https://nodejs.org) 20 or newer. Nothing else: the app runs its own embedded Postgres database.

```bash
git clone https://github.com/Party-Harbour/party-harbor.git
cd party-harbor
npm install
npm run dev
```

Open http://localhost:3000 and sign in with one of the sample host accounts:

| Host     | Email                     | Password     |
| -------- | ------------------------- | ------------ |
| Host One | `host1@partyharbor.local` | `harbor-dev` |
| Host Two | `host2@partyharbor.local` | `harbor-dev` |

The first start also creates three sample events and four made-up households so there is something to click on. Texts are printed to the terminal instead of being sent.

To use your own names, copy `.env.example` to `.env.local` before the first start and set:

```bash
SEED_HOSTS="Alex <alex@example.com>, Sam <sam@example.com>"
SEED_HOST_PASSWORD="something-only-you-know"
```

To start over, stop the server and delete the `data` folder.

> **Project folder inside OneDrive, Dropbox or iCloud?** Set `PGLITE_DATA_DIR` and `UPLOAD_DIR` in `.env.local` to folders outside the synced tree. Sync clients lock files, and the database then fails to start with "could not create lock file".

## Put it online

The same code runs on [Supabase](https://supabase.com) (database and photo storage) and [Vercel](https://vercel.com) (the app), both on their free plans. In short:

1. Create a Supabase project and copy its connection string, project URL and secret key.
2. Import this repository into Vercel and add the environment variables.
3. Deploy. Database tables are created during the build.
4. Open `/signup`, enter your sign-up code, and create your host account.

The step-by-step version, including the once-a-minute scheduler for reminders, is in **[docs/hosting.md](docs/hosting.md)**.

## Host accounts

- **Hosted:** set `HOST_SIGNUP_CODE` and each host creates their own account at `/signup`. Without the code the sign-up page is closed. Every host can see every guest list, so the code is what keeps strangers out. Remove it once everyone has signed up.
- **Local:** an empty database is seeded with the accounts in `SEED_HOSTS` (two sample hosts by default).
- Sign-in pauses for fifteen minutes after eight wrong passwords. There is no password reset yet.

## How it is built

- [Next.js](https://nextjs.org) 16 (App Router, server actions), React 19, TypeScript, Tailwind CSS v4
- [Drizzle ORM](https://orm.drizzle.team) on Postgres: embedded [PGlite](https://pglite.dev) locally, any Postgres when `DATABASE_URL` is set
- [sharp](https://sharp.pixelplumbing.com) for photo processing; local disk or a private Supabase Storage bucket
- A durable message queue in the database (per-recipient jobs, retries, idempotency), with a console provider and a Twilio adapter
- No client-side framework state, no external services required to run it

```
src/app/(host)/      host pages (need a session)
src/app/e/[token]/   the guest page behind each invitation link
src/app/login/       sign in          src/app/signup/   gated sign-up
src/app/api/         photo upload and proxy, cron dispatch, inbound SMS
src/actions/         server actions (every host action checks the session)
src/db/              schema, embedded/hosted database selection, first-run seed
src/lib/             auth, dates, messaging/, gallery/, templates/, digest/
scripts/migrate.ts   deploy-time migrations for a hosted database
drizzle/             generated SQL migrations
docs/                walkthrough and hosting guide
```

Useful commands:

```bash
npm run dev            # start the app
npm run lint           # eslint
npx tsc --noEmit       # type check (run `npx next typegen` first)
npx drizzle-kit generate --name what-changed   # after editing src/db/schema.ts
npm run db:migrate     # apply migrations to the database in DATABASE_URL
```

All settings are listed with comments in [.env.example](.env.example).

## Privacy by design

- Guests see only their own household's replies and entries.
- Invitation tokens are stored hashed for lookups and encrypted for re-sending.
- Texts go only to adults with a recorded opt-in, never between 9 pm and 8 am, and STOP is honoured automatically.
- Photos lose their EXIF and GPS data, and are served only to a signed-in host or a guest holding a valid link.
- Significant actions are written to an audit log.
- The sample data in this repository is entirely made up.

## Not built yet

Email and WhatsApp messages, gallery download as a ZIP, voting by text reply, co-host permission levels, password reset, and an API for outside tools.

## Contributing

Issues and pull requests are welcome. Please keep real names, phone numbers and other personal data out of code, fixtures, screenshots and issue reports. Run `npm run lint` and `npx tsc --noEmit` before opening a pull request.

## Design

Colours and type follow a "Coastal Sunset" palette defined in `src/app/globals.css`: navy for text and controls, coral for highlights and date badges. Headings use Fraunces, the "You're invited!" line uses Caveat, and body text is Geist, all open-licensed. Each event picks one of four themes (Coastal Classic, Sunset Warmth, Celebration Bright, Modern Earth) from `src/lib/themes.ts`, which sets the colours of its guest page and its cover art.
