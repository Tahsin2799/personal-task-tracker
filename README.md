# Bird-Watcher

A field book for up to five people's work: Trello-style boards with Jira-style planning
(epics, story points, sprints), for personal errands, team projects and research.

What works today: personal and team workspaces, invite-only accounts, **My Work** and an
**Inbox** across everything; drag-and-drop boards with Jira-style tiles you can edit in place;
table and calendar views; epics, subtasks, story points, sprints, backlog, burndown and
velocity, throughput and sprint tallies; recurring entries; comments with @mentions, activity
history and live updates; email (inbox batches and a morning due-date reminder); file attachments
and card covers; ⌘K search; and research tools (experiments, milestones, references, BibTeX import).

- Product: [PRODUCT.md](PRODUCT.md) · Design system: [DESIGN.md](DESIGN.md)
- Roadmap and data model: [docs/PLAN.md](docs/PLAN.md)

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Postgres, Auth, RLS)

## Local development

Requires Node 20+ and Docker (for the local Supabase stack).

```bash
npm install
npm run db:start            # starts Supabase in Docker, applies migrations and seed
cp .env.example .env.local  # then fill in keys from `npx supabase status`
npm run dev                 # http://localhost:3000
```

The seed creates three **synthetic** demo accounts (password `birdwatcher`):
`nadia@example.com`, `ishan@example.com`, `clara@example.com`.

| URL | What |
|---|---|
| http://localhost:3000 | The app |
| http://127.0.0.1:54323 | Supabase Studio |
| http://127.0.0.1:54324 | Mailpit: invite and password-reset emails land here |

### Scripts

| Script | Does |
|---|---|
| `npm run db:reset` | Drop and rebuild the local DB from migrations + `supabase/seed.sql` |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` after a schema change |
| `npm run typecheck` / `npm run lint` | Static checks |

### Schema changes

```bash
npx supabase migration new <name>   # write SQL in supabase/migrations/
npm run db:reset && npm run db:types
```

Authorization lives in the database: every table has Row Level Security, and the app uses
the signed-in user's session for all reads and writes. The secret key is used server-side
only, to send invite emails and by the email worker.

## Email

Every 10 minutes `pg_cron` (in the database) calls `/api/cron/email` with `CRON_SECRET`. The
worker batches in-app notifications nobody has read after a few minutes into one email per
person, and once a day after 07:00 in each person's time zone sends what is overdue, due today
or due tomorrow. People switch either off on their Account page.

Mail goes out over plain SMTP (`SMTP_*` in `.env.example`), so a free sender is enough: a Gmail
app password (500 a day) or Brevo (300 a day) covers five people. Locally it lands in Mailpit at
http://127.0.0.1:54324; the seed points the scheduler at the dev server, so it runs on its own
while `npm run dev` is up. To run it by hand:

```bash
curl -X POST localhost:3000/api/cron/email -H "Authorization: Bearer local-dev-cron-secret"
```

## Accounts

Sign-up is disabled. Workspace owners and admins invite people from **Members & settings**;
new addresses get an email to set a password. The database refuses a sixth account.

## Deploying

1. Create a Supabase project (free tier), `npx supabase link --project-ref <ref>`, `npx supabase db push`.
2. Auth → Providers → Email: turn off "Allow new users to sign up". Auth → URL Configuration: set
   the Site URL to the Vercel URL and add it to the redirect URLs. Paste
   `supabase/templates/invite.html` and `recovery.html` into Auth → Email Templates.
3. Auth → SMTP: use the same SMTP sender as below (the built-in one is heavily rate-limited).
4. Vercel env vars (Hobby plan): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
   `SMTP_FROM`, and `CRON_SECRET` (a long random string).
5. In the Supabase SQL editor, point the email scheduler at the app:

   ```sql
   select vault.create_secret('https://<your-app>.vercel.app/api/cron/email', 'email_worker_url');
   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
   ```
