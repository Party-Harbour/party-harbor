# Hosting Party Harbor on Supabase and Vercel

Locally the app is self-contained: an embedded Postgres, photos on disk, a timer that sends due messages. Hosted, three things move:

| Piece            | Local                         | Hosted                                              |
| ---------------- | ----------------------------- | --------------------------------------------------- |
| Database         | PGlite under `data/pgdata`    | Supabase Postgres, when `DATABASE_URL` is set       |
| Photos           | Files under `UPLOAD_DIR`      | A private Supabase Storage bucket                   |
| Once-a-minute    | In-process timer              | A scheduler calling `/api/cron/dispatch`            |

Nothing changes for local development. Leave the hosted variables out of `.env.local` and `npm run dev` keeps using the embedded database, so real party data and test data never mix.

## 1. Supabase: collect two values

Create a project (Free plan is enough), then:

1. **Database URL.** Click **Connect** at the top of the dashboard ([direct link](https://supabase.com/dashboard/project/_?showConnect=true)). Under **Connection Method**, choose **Transaction pooler**, then copy the string (it ends in `:6543/postgres`). The dialog opens on "Direct connection", which Vercel cannot reach, so do switch it. If you already saved the Direct string, you can keep it and add `SUPABASE_POOLER_HOST` (for example `aws-0-us-east-1.pooler.supabase.com`, the host shown in the Transaction pooler string) and the app converts it for you. Replace `[YOUR-PASSWORD]`, brackets included, with the database password. If the password has characters like `@ : / ? #`, percent-encode them (`@` becomes `%40`), or reset the password to letters and digits under [Database → Settings](https://supabase.com/dashboard/project/_/database/settings).
2. **Secret key.** [Project Settings → API Keys](https://supabase.com/dashboard/project/_/settings/api-keys) → under "Secret keys", copy the key (`sb_secret_…`). The older `service_role` key also works. This key bypasses row-level security: it belongs only in server-side environment variables, never in the browser, the repo or a chat.

The project URL (`https://<project-ref>.supabase.co`) is read from the database URL, so there is nothing else to copy. Set `SUPABASE_URL` yourself only if your database is somewhere other than Supabase.

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
| `SUPABASE_SECRET_KEY` | The secret key from step 1                                               |
| `INVITE_TOKEN_KEY`    | First generated secret                                                   |
| `CRON_SECRET`         | Second generated secret                                                  |
| `HOST_SIGNUP_CODE`    | A code of 8 characters or more that you give to each host. Opens `/signup`. |

Optional: `NEXT_PUBLIC_APP_URL` (set it once you attach a custom domain, e.g. `https://party.example.com`; until then links use the domain Vercel assigns), and the Twilio variables from `.env.example` when you are ready to send real texts.

Then deploy. If the project was already deployed before the variables were added, open Deployments and choose **Redeploy** on the latest one: variables only take effect on a new build. The build runs `npm run vercel-build`, which applies the SQL migrations in `drizzle/`. No sample events or households are created on a hosted database. Preview deployments never touch the database schema.

If the build fails at the migrate step, the log line starting `[db:migrate] failed:` says why. The usual causes are a missing variable or a database password that needs percent-encoding.

### Creating the host accounts

Open `https://YOUR-APP.vercel.app/signup`. Each host enters a name, an email (used only to sign in), a password of 10 characters or more, and the sign-up code. Every host sees every guest list, which is why the page is closed to anyone without the code. Ten wrong codes in fifteen minutes pause sign-up for the rest of that window.

When everyone has an account, delete `HOST_SIGNUP_CODE` in Vercel and redeploy. The sign-up page then reports that sign-up is closed. Add the variable back whenever you want to let another host in.

Prefer to create accounts at deploy time instead? Set `SEED_HOSTS` (`Name <email>, Name <email>`) and `SEED_HOST_PASSWORD` (12 characters or more). On an empty database the build creates those hosts with that shared starting password.

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

- Create each host account at `/signup`, then check the Digest page settings (time zone, hour, mobile number).
- Upload a photo to an event: this creates the storage bucket and proves the secret key works.
- Open `https://YOUR-APP.vercel.app/api/cron/dispatch` while signed in as a host. A JSON reply with `"ok": true` means the dispatcher runs.

## Later changes to the schema

Edit `src/db/schema.ts`, run `npx drizzle-kit generate --name <what-changed>`, commit the new files under `drizzle/`. The next production deploy applies them. To apply by hand against any Postgres: set `DATABASE_URL` in your shell and run `npm run db:migrate`.

## Good to know

- **Photo size.** Serverless hosts refuse request bodies over a few MB, so the upload form shrinks large photos in the browser and sends one per request. With JavaScript off, only small photos get through on a hosted site.
- **Connections.** The pool is small (5 per server instance) and prepared statements are off, which is what Supabase's transaction pooler expects. `DATABASE_POOL_MAX` overrides the pool size.
- **Sign-in.** An account pauses for fifteen minutes after eight wrong passwords. There is no password-reset flow yet, so keep passwords somewhere safe.
- **This repository is public.** Never commit `.env.local`, connection strings, keys, or real guest data.
