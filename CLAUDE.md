# CLAUDE.md

Standing context for this repository. Read before making changes.

---

## 1. What this is

**Inter-Office Memo Management System** — a multi-tenant web app where organizations route internal memos through an ordered, sequential approval workflow (e.g. Employee → Dept. Head → Finance → Director → CEO), with a permanent history of every action.

University project (CSE226, North South University). Full requirements: `docs/PRD.md`. Deadline: **midnight, 29 August 2026**.

### The three things that must be correct
Everything else is secondary to these. A convincing UI over broken logic fails the grading.

1. **Tenant isolation** — no query may ever return another organization's row.
2. **Sequential workflow correctness** — only the current step's assignee may act, and only in order.
3. **Server-side authorization** — hiding a UI element is not authorization.

---

## 2. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript, strict mode |
| ORM | Prisma **6.19.3 — pinned**, see §3 |
| Database | PostgreSQL (Neon) |
| Auth | Auth.js (NextAuth v5), Credentials provider, JWT session |
| Hashing | `bcryptjs`, cost 12 — pure JS, no native build step (matters on Windows and on Vercel's serverless runtime) |
| Validation | Zod on every route handler input |
| Styling | Tailwind CSS + shadcn/ui |
| Rich text | Tiptap, output sanitized server-side with `sanitize-html` |
| File storage | Supabase Storage, private bucket, signed URLs |
| PDF | `@react-pdf/renderer` on a server route |
| Hosting | Vercel |

Do not swap any of these without being asked. A stack change this late is fatal.

---

## 3. Commands

### Version pinning — read first

`prisma` and `@prisma/client` are pinned to **6.19.3** and must stay in lockstep.

```bash
npm i -D prisma@6.19.3
npm i @prisma/client@6.19.3
```

`package.json` must carry exact versions, not ranges:

```json
"dependencies":    { "@prisma/client": "6.19.3" },
"devDependencies": { "prisma": "6.19.3" }
```

Prisma 7 removed `url = env("DATABASE_URL")` from the datasource block and moved it into `prisma.config.ts`. Installing it against this schema fails with `P1012: The datasource property 'url' is no longer supported`. If that error appears, the fix is to reinstall 6.19.3 — **never** to rewrite the schema. Do not run `npm i prisma@latest` or `npm update prisma` on this project.

### Everyday commands

```bash
npm run dev              # local dev server
npm run build            # production build
npx prisma migrate dev   # create + apply a migration locally
npx prisma db push       # sync schema without a migration (dev only)
npx prisma generate      # regenerate the client after a schema change
npx prisma studio        # inspect data
npm run seed             # load demo orgs, users, memos ("tsx prisma/seed.ts")
npm run lint
npx tsc --noEmit         # typecheck
```

Environment variables live in `.env`. `.env.example` is committed; `.env` never is.

---

## 4. Directory layout

```
app/
  (auth)/login, register-org, forgot-password
  (app)/dashboard, inbox, memos, memos/[id], memos/new, search, notifications, profile
  (admin)/admin/organization, departments, users, categories, templates, reports, audit
  api/...                     route handlers
lib/
  auth.ts       session helpers, requireSession(), requireAdmin()
  tenant.ts     tenant-scoped data access — MANDATORY for all tenant tables
  workflow.ts   the workflow state machine — all transitions live here
  audit.ts      logAudit()
  notify.ts     createNotification()
  validation/   Zod schemas
components/
prisma/schema.prisma, prisma/seed.ts
docs/PRD.md
```

---

## 5. Non-negotiable engineering rules

1. **Never call `prisma.<tenantModel>` directly in feature code.** Go through `lib/tenant.ts`, which injects `organizationId` from the session. Direct Prisma access is allowed only inside `lib/`.
2. **`organizationId` comes from the session only.** Never read it from a request body, query string, or route param. If client input contains it, ignore it.
3. **Every route handler follows this order:** resolve session (401) → role check (403) → tenant-scoped fetch (404 if absent) → business rule check, e.g. turn order (403) → Zod validation (400) → transactional write + audit log → response.
4. **A cross-tenant fetch returns 404, not 403.** Do not confirm that another org's record exists.
5. **All workflow transitions go through `lib/workflow.ts`.** No transition logic in components, pages, or route handlers — they call the service and return its result.
6. **Every mutation that changes workflow state runs in a `prisma.$transaction`** together with its audit log and notification writes.
7. **History is append-only.** Never update or delete `WorkflowAction`, `AuditLog`, `Comment`, or `MemoVersion` rows. There must be no API route that does so.
8. **Sanitize rich-text HTML server-side** before it is stored, not just before it is rendered.
9. **No raw SQL string interpolation.** Prisma query methods only.
10. **Generic error responses.** No stack traces, ORM messages, or "user not found" vs "wrong password" distinctions leaking to the client.

---

## 6. Workflow engine contract

State machine and full rules: `docs/PRD.md` §6. Summary of the invariants to preserve:

- Exactly one `WorkflowStep` is `CURRENT` while a memo is active; `memo.currentStepId` points at it.
- An action is permitted only when `step.id === memo.currentStepId` **and** the caller is `step.assigneeId` or holds an active delegation from them.
- `REJECT` requires a comment; `REQUEST_CHANGES` requires a comment. Enforce in Zod and again in the service.
- `REJECT` is terminal: memo → `REJECTED`, remaining steps → `SKIPPED`, `currentStepId` cleared.
- `REQUEST_CHANGES` returns control to the author: memo → `CHANGES_REQUESTED`. The author edits, and resubmission creates a new `MemoVersion`, increments `submissionCycle`, and restarts the sequence at position 1.
- Approving the last step sets `APPROVED`, `completedAt`, `finalApproverId`, and makes the memo read-only for ordinary users.
- Every action writes a `WorkflowAction` row — that table, not the mutable `WorkflowStep`, is the source of truth for the timeline.

Write these as pure functions taking `(memo, step, actor, input)` and returning the intended writes, so the logic is testable without a request.

---

## 7. Design direction

The subject is an office routing slip — the paper form that used to be stapled to a memo and initialed by each desk it crossed. The UI is that slip, made reliable. Precise, administrative, quietly confident. Not a startup dashboard.

**Palette** (define as CSS variables in `globals.css`, use nowhere else literally):
- `--ink: #16202B` — primary text, headers
- `--paper: #FBFAF7` — app background
- `--rule: #D8D3C7` — hairlines, dividers, table borders
- `--stamp: #A3242B` — rejection, urgent
- `--seal: #2F5D50` — approved, success
- `--pending: #B8791F` — changes requested, awaiting action

**Type:**
- Display/headings: **Archivo** — tight tracking, weight 600, sentence case.
- Body/UI: **Inter**.
- Data face: **IBM Plex Mono** — memo numbers, timestamps, step positions, file sizes. This is the detail that makes the product feel like a records system; use it consistently.

**Signature element:** the workflow stepper on the memo detail page, rendered as a vertical routing rail — one row per position, mono position number, assignee and designation, and a stamped action mark (approved / rejected / changes requested) with a mono timestamp. Completed steps are solid, the current step is outlined and highlighted, future steps are muted. This is the one place to spend visual boldness; keep everything around it quiet.

**Quality floor, always:** responsive to 375px, visible keyboard focus rings, `prefers-reduced-motion` respected, real empty states ("No memos are waiting on you."), status and priority communicated by label as well as color.

**Copy rules:** active voice, sentence case, name the action and keep the name through the flow — a button that says "Approve memo" produces a toast that says "Memo approved." Errors state what happened and what to do; they never apologize or stay vague.

---

## 8. Build order

Phases, from `docs/PRD.md` §14. Deploy to Vercel at the end of Phase 0 and redeploy after every phase.

0. Setup + empty deploy
1. Schema, migrations, seed, auth, tenant guard, route protection
2. Memo CRUD, drafts, numbering, categories, attachments, detail page
3. **Workflow engine** ← highest risk, do not compress
4. Inbox, sent, completed, dashboards, search, admin screens
5. Templates, versioning, reports, PDF export
6. Security pass, demo data, final deploy, documentation

If time runs short, drop delegation and email first, then reports and PDF export. Never drop workflow correctness, tenant isolation, or server-side authorization.

---

## 9. Definition of done for any feature

- Authorization is enforced in the route handler, not only in the UI.
- The query is tenant-scoped through `lib/tenant.ts`.
- Input is validated with Zod.
- The mutation writes an audit record in the same transaction.
- Affected users get a notification where the PRD calls for one.
- The screen works at 375px width.
- A second-organization account cannot reach the data by URL.

---

## 10. Submission notes

The complete AI prompt and response history is a graded deliverable — do not clear or prune session logs, including failed attempts and debugging. Redact any credential that appears in a prompt and mark it `[REDACTED]`, keeping the surrounding interaction intact. No secrets in the repo, the ZIP, or the history.
