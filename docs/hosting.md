# Hosting Party Harbor on Supabase and Vercel

Locally the app is self-contained: an embedded Postgres, photos on disk, a timer that sends due messages. Hosted, three things move:

| Piece            | Local                         | Hosted                                              |
| ---------------- | ----------------------------- | --------------------------------------------------- |
| Database         | PGlite under `data/pgdata`    | Supabase Postgres, when `DATABASE_URL` is set       |
| Photos           | Files under `UPLOAD_DIR`      | A private Supabase Storage bucket                   |
| Once-a-minute    | In-process timer              | A scheduler calling `/api/cron/dispatch`            |

Nothing changes for local development. Leave the hosted variables out of `.env.local` and `npm run dev` keeps using the embedded database, so real party data and test data never mix.

## 1. Supabase: collect three values

Create a project (Free plan is enough), then:

1. **Database URL.** Click **Connect** at the top of the dashboard and copy the **Transaction pooler** string (port `6543`). Replace `[YOUR-PASSWORD]` with the database password. If the password has characters like `@ : / ? #`, percent-encode them (`@` becomes `%40`), or reset the password to letters and digits under Database → Settings.
2. **Project URL.** Settings → API (or the Connect dialog): `https://<project-ref>.supabase.co`.
3. **Secret key.** Settings → API Keys → the **secret** key (`sb_secret_…`). The older `service_role` key also works. This key bypasses row-level security: it belongs only in server-side environment variables, never in the browser, the repo or a chat.

The app creates its private storage bucket (`party-photos`) the first time someone uploads a photo.

## 2. Generate two secrets

Run each of these once and keep the output with your other secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use one result as `INVITE_TOKEN_KEY` and a second, separate result as `CRON_SECRET`.

`INVITE_TOKEN_KEY` encrypts invitation links so they can be re-sent. If it changes after invitations exist, those stored links can no longer be shown or re-sent (guests' existing links keep working; you would generate new ones to see them again).

## 3. Vercel: import and configure

Import the GitHub repository as a new project. Next.js is detected automatically. Before the first deploy, add these under Settings → Environment Variables, for the **Production** environment:

| Variable              | Value                                                                    |
| --------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`        | The transaction pooler string from step 1                                |
| `SUPABASE_URL`        | The project URL from step 1                                              |
| `SUPABASE_SECRET_KEY` | The secret key from step 1                                               |
| `INVITE_TOKEN_KEY`    | First generated secret                                                   |
| `CRON_SECRET`         | Second generated secret                                                  |
| `SEED_HOST_PASSWORD`  | The password both host accounts start with. 12 characters or more.      |

Optional: `NEXT_PUBLIC_APP_URL` (set it once you attach a custom domain, e.g. `https://party.example.com`; until then links use the domain Vercel assigns), and the Twilio variables from `.env.example` when you are ready to send real texts.

Then deploy. The build runs `npm run vercel-build`, which applies the SQL migrations in `drizzle/` and, on an empty database, creates the two host accounts (`rita@partyharbor.local` and `randy@partyharbor.local`) with `SEED_HOST_PASSWORD`. No sample events or households are created on a hosted database. Preview deployments never touch the database schema.

If the build fails at the migrate step, the log line starting `[db:migrate] failed:` says why. The usual causes are a missing variable or a database password that needs percent-encoding.

## 4. Supabase: the once-a-minute scheduler

Vercel's free plan runs scheduled jobs once a day, which is too coarse for reminders. `vercel.json` keeps that daily run as a safety net; Supabase does the real work.

In the Supabase dashboard, open Integrations and enable **Cron** (`pg_cron`) and, under Database → Extensions, **pg_net**. Then run this in the SQL editor, with your deployed address and your `CRON_SECRET`:

```sql
select cron.schedule(
  'party-harbor-dispatch',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-APP.vercel.app/api/cron/dispatch',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  );
  $$
);
```

Each call sends whatever messages and digests are due. The jobs table is the source of truth, so a missed minute loses nothing. To stop it: `select cron.unschedule('party-harbor-dispatch');`.

## 5. After the first deploy

- Sign in as each host and check the Digest page settings (time zone, hour, mobile number).
- Upload a photo to an event: this creates the storage bucket and proves the secret key works.
- Open `https://YOUR-APP.vercel.app/api/cron/dispatch` while signed in as a host. A JSON reply with `"ok": true` means the dispatcher runs.

## Later changes to the schema

Edit `src/db/schema.ts`, run `npx drizzle-kit generate --name <what-changed>`, commit the new files under `drizzle/`. The next production deploy applies them. To apply by hand against any Postgres: set `DATABASE_URL` in your shell and run `npm run db:migrate`.

## Good to know

- **Photo size.** Serverless hosts refuse request bodies over a few MB, so the upload form shrinks large photos in the browser and sends one per request. With JavaScript off, only small photos get through on a hosted site.
- **Connections.** The pool is small (5 per server instance) and prepared statements are off, which is what Supabase's transaction pooler expects. `DATABASE_POOL_MAX` overrides the pool size.
- **Sign-in.** There is no sign-up page and no password-reset flow yet; the two host accounts and their starting password come from the seed. There is also no limit on sign-in attempts yet, so pick a long passphrase.
- **This repository is public.** Never commit `.env.local`, connection strings, keys, or real guest data.
