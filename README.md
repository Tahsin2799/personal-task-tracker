# Bird-Watcher

A field book for up to five people's work: Trello-style boards with Jira-style planning
(epics, story points, sprints), for personal errands, team projects and research.

What works today: personal and team workspaces, invite-only accounts, **My Work** and an
**Inbox** across everything; drag-and-drop boards with Jira-style tiles you can edit in place;
table and calendar views; epics, subtasks, story points, sprints, backlog, burndown and
velocity; comments with @mentions, activity history and live updates; file attachments and
card covers; ⌘K search; and research tools (experiments, milestones, references).

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
only, to send invite emails.

## Accounts

Sign-up is disabled. Workspace owners and admins invite people from **Members & settings**;
new addresses get an email to set a password. The database refuses a sixth account.

## Deploying

See the deployment checklist at the end of [docs/PLAN.md](docs/PLAN.md).
