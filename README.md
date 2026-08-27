# Inter-Office Memo Management System

A multi-tenant web application for routing internal office memos through an
ordered, sequential approval workflow, with a permanent record of every action.

Course project — CSE226, North South University, Dept. of ECE.

Full requirements: [`docs/PRD.md`](docs/PRD.md).
Engineering rules and design direction: [`CLAUDE.md`](CLAUDE.md).

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15.5 (App Router) + TypeScript, strict mode |
| ORM | Prisma **6.19.3 — pinned** |
| Database | PostgreSQL (Neon) |
| Auth | Auth.js (NextAuth v5), Credentials provider, JWT session |
| Hashing | `bcryptjs`, cost 12 |
| Validation | Zod on every route handler input |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Rich text | Tiptap, sanitized server-side with `sanitize-html` |
| File storage | Supabase Storage, private bucket, signed URLs |
| PDF | `@react-pdf/renderer` on a server route |
| Hosting | Vercel |

---

## Running it locally

Requires Node.js 20 or newer.

```bash
# 1. install dependencies
npm install

# 2. create your environment file
cp .env.example .env
#    then fill in DATABASE_URL and AUTH_SECRET (see .env.example for how)

# 3. create the database tables
npx prisma migrate dev

# 4. load the demo organizations, users and memos
npm run seed

# 5. start the dev server at http://localhost:3000
npm run dev
```

### Other commands

| Command | What it does |
|---|---|
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm run typecheck` | TypeScript check, no output emitted |
| `npm run lint` | ESLint |
| `npm run db:studio` | Browse the database in a local GUI |
| `npm run db:push` | Sync schema without creating a migration (dev only) |
| `npm run verify` | Security checks: tenant isolation, turn order, XSS, uploads |
| `npm run check` | Typecheck + lint. Safe to run while `npm run dev` is going |
| `npm run clean` | Delete the `.next` build cache. **Stop the dev server first** |

### If you see "Cannot find module './1331.js'"

The `.next` folder holds a stale or half-written build. `npm run dev` and
`npm run build` share that folder, so running a production build while the dev
server is going will corrupt it.

Stop the dev server (Ctrl+C), then:

```bash
npm run clean
npm run dev
```

Use `npm run check` rather than `npm run build` when the dev server is running.

---

## ⚠️ Prisma is pinned to 6.19.3

`prisma` and `@prisma/client` must stay in lockstep at **6.19.3**.

Prisma 7 removed `url = env("DATABASE_URL")` from the datasource block. Installing
it against this schema fails with `P1012: The datasource property 'url' is no
longer supported`. If you see that error, reinstall 6.19.3 — do **not** rewrite
the schema.

```bash
npm i -D prisma@6.19.3 --save-exact
npm i @prisma/client@6.19.3 --save-exact
```

Never run `npm i prisma@latest`, `npm update prisma`, or `npm audit fix --force`
on this project. The last one silently upgrades Prisma to 7.

---

## Architecture notes

**Multi-tenancy** is shared-database, shared-schema, with an `organizationId`
discriminator column on every tenant-scoped table. `organizationId` is read from
the session and never from client input. All feature-code queries go through
`lib/tenant.ts`; direct `prisma.*` access is confined to `lib/`.

**The workflow engine** lives entirely in `lib/workflow.ts` as pure functions
over `(memo, step, actor, input)`. Route handlers call it and return its result;
no transition logic exists in components or pages.

**History is append-only.** `WorkflowAction`, `AuditLog`, `Comment` and
`MemoVersion` rows are written once and never updated or deleted. There is no
API route that does so. Resubmission creates a new cycle of `WorkflowStep` rows
rather than overwriting the previous round's decisions.

---

## Environment variables

See [`.env.example`](.env.example). `.env` is never committed.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `AUTH_SECRET` | Signs the session JWT |
| `AUTH_URL` | Base URL of the app |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (attachments) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase key (attachments) |
| `SUPABASE_STORAGE_BUCKET` | Private bucket name for attachments |
