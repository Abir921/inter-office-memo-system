# Product Requirements Document (PRD)
## Inter-Office Memo Management System (Multi-Tenant)

| Field | Value |
|---|---|
| Course | CSE226 — Foundations of Vibe Coding |
| Institution | North South University, Dept. of ECE |
| Semester | Summer 2026 |
| Deadline | Midnight, 29 August 2026 |
| Document version | 1.0 |
| Purpose | Implementation spec to be fed to Claude Code |

---

## 1. Product Overview

A web-based, **multi-tenant** system for managing internal office memos. Any organization can register, add departments and users, and route memos through an **ordered sequential approval workflow** (e.g. Employee → Dept. Head → Finance → Director → CEO). Every action — approval, rejection, comment, change request — is permanently recorded in an immutable history.

### 1.1 Core Value Proposition
Replace paper/email memo routing with a system that guarantees: correct routing order, complete audit trail, and strict isolation between organizations.

### 1.2 The Three Things That Must Be Perfect
The grading explicitly warns that a convincing UI over broken logic fails. These three are non-negotiable:

1. **Tenant isolation** — no query may ever return another organization's row.
2. **Sequential workflow correctness** — only the current step's assignee can act.
3. **Server-side authorization** — hiding a button is not authorization.

---

## 2. Scope

### 2.1 In Scope (P0 — must ship)
Auth, org/tenant management, departments, users & roles, memo CRUD + drafts, sequential workflow engine, workflow actions, statuses, inbox/sent/completed, memo detail + timeline, comments, attachments, in-app notifications, search & filter, dashboards, audit log, security hardening, deployment.

### 2.2 In Scope (P1 — should ship)
Workflow templates, memo categories management, reporting/statistics, PDF export, memo versioning.

### 2.3 In Scope (P2 — nice to have)
Delegation, email notifications, rich-text memo body with full formatting toolbar.

### 2.4 Out of Scope
Real-time websockets, mobile native apps, SSO/LDAP, e-signatures, i18n.

---

## 3. Recommended Technology Stack

### 3.1 Primary Recommendation
| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Single codebase for frontend + backend; server actions/route handlers keep authorization on the server by default |
| ORM | **Prisma** | Schema-as-code, migrations, parameterized queries (SQL-injection safe by default) |
| Database | **PostgreSQL (Neon or Supabase free tier)** | Serverless-friendly, free, supports row-level constraints |
| Auth | **Auth.js (NextAuth v5) with Credentials provider** + `bcrypt`/`argon2` hashing, JWT or DB sessions | Fast to wire, session in httpOnly cookie |
| File storage | **Supabase Storage** (or UploadThing) with private buckets + signed URLs | Satisfies "no access by guessing the URL" |
| UI | **Tailwind CSS + shadcn/ui** | Responsive fast, consistent components |
| Rich text | **Tiptap** (or `react-quill`) storing sanitized HTML | Basic rich text requirement |
| PDF export | **@react-pdf/renderer** or Puppeteer on a server route | Server-side rendering of the memo |
| Hosting | **Vercel** (app) + **Neon/Supabase** (DB) | HTTPS by default, free, one-command deploy |

### 3.2 Alternative Stack
Django + Django REST + PostgreSQL + Render/Railway, with `django-allauth` and Django's built-in permissions. Choose this only if you prefer Python; it costs more setup time for the frontend.

> **Decision rule:** pick one stack now and do not change it. With ~2 days remaining, a stack change is fatal.

---

## 4. Roles and Permissions

### 4.1 Roles
- **ORG_ADMIN** — administers one organization.
- **USER** — regular employee.
- *(Optional)* **SUPER_ADMIN** — platform-level, creates/inspects organizations. Useful for the demo of "create an organization".

### 4.2 Permission Matrix

| Capability | ORG_ADMIN | USER |
|---|:--:|:--:|
| Update organization info, logo, contact | ✅ | ❌ |
| Create/rename/deactivate departments | ✅ | ❌ |
| Invite/create users, activate/deactivate | ✅ | ❌ |
| Assign roles and departments | ✅ | ❌ |
| Manage memo categories | ✅ | ❌ |
| Manage workflow templates | ✅ | ❌ |
| View org-level statistics & reports | ✅ | ❌ |
| View any memo in own org | ✅ (read-only) | ❌ |
| Create / edit / delete own drafts | ✅ | ✅ |
| Submit memo, define workflow | ✅ | ✅ |
| Act on a workflow step assigned to them | ✅ | ✅ |
| Comment on memos they participate in | ✅ | ✅ |
| View own inbox / sent / completed | ✅ | ✅ |
| Manage own profile & password | ✅ | ✅ |

**Rule:** every permission check runs server-side, inside the route handler/server action, before any DB write. UI conditionals are cosmetic only.

---

## 5. Data Model

Every tenant-scoped table carries `organizationId`. All queries are executed through a helper that injects the caller's `organizationId` — never a raw `findUnique({ where: { id } })` on tenant data.

### 5.1 Entities

**Organization**
`id, name, slug (unique identifier), logoUrl, contactEmail, contactPhone, address, isActive, settings (json), createdAt`

**Department**
`id, organizationId, name, description, isActive, createdAt`
Unique: `(organizationId, name)`

**User**
`id, organizationId, name, email, passwordHash, designation, departmentId, role (SUPER_ADMIN|ORG_ADMIN|USER), status (ACTIVE|INACTIVE), avatarUrl, mustChangePassword, createdAt, lastLoginAt`
Unique: `(organizationId, email)` — email is unique per tenant, not globally.

**PasswordResetToken**
`id, userId, tokenHash, expiresAt, usedAt, createdAt` — stores the hash, never the raw token; single-use.

**UserInvite**
`id, organizationId, email, name, designation, departmentId, role, tokenHash, expiresAt, acceptedAt, createdById, createdAt` — backs the "invite users" path in spec §2.1.

**MemoSequence**
`id, organizationId, year, lastNumber` — per-org, per-year counter for memo numbers, incremented inside the memo-creation transaction so numbers never collide or leak another tenant's volume.

**MemoCategory**
`id, organizationId, name, description, isActive`
Seed: Administrative, Financial, Procurement, HR, Academic, Technical, General.

**Memo**
`id, organizationId, memoNumber (unique per org, e.g. NORTHWIND-2026-0001), subject, bodyHtml, authorId, departmentId, categoryId, templateId, priority (NORMAL|HIGH|URGENT), status, currentStepId, currentVersion, submissionCycle, submittedAt, completedAt, finalApproverId, lastActivityAt, createdAt, updatedAt`
`lastActivityAt` powers the "last activity date" column in the Sent list (§7.7).

**WorkflowStep** — the *mutable* view of the workflow: one row per position per submission cycle.
`id, organizationId, memoId, submissionCycle, position (int, 1-based), assigneeId, positionLabel (e.g. "Finance Manager"), state (PENDING|CURRENT|COMPLETED|SKIPPED), createdAt, updatedAt`
Unique: `(memoId, submissionCycle, position)`

**WorkflowAction** — the *append-only* record of every decision, and the source of truth for the timeline.
`id, organizationId, memoId, stepId, submissionCycle, position, action (APPROVE|REJECT|COMMENT|REQUEST_CHANGES|REVIEW_COMPLETE), actorId, actedOnBehalfOfId (delegation), comment, createdAt`
Never updated, never deleted. Splitting the mutable step state from the immutable decision record is what satisfies "the system must not silently overwrite history" across resubmission cycles.

**WorkflowTemplate**
`id, organizationId, name, description, isActive`
**WorkflowTemplateStep**
`id, templateId, position, positionLabel, defaultDepartmentId (nullable)`

**MemoVersion**
`id, organizationId, memoId, versionNumber, subject, bodyHtml, editedById, createdAt, submissionCycle (int)`

**Comment**
`id, organizationId, memoId, authorId, text, type (GENERAL|APPROVAL|REJECTION|CHANGE_REQUEST), workflowStepId (nullable), createdAt`
Comments are append-only for USER role.

**Attachment**
`id, organizationId, memoId, fileName, storageKey, mimeType, sizeBytes, uploadedById, uploadedAt, isDeleted`

**Notification**
`id, organizationId, userId, memoId, type, title, message, isRead, createdAt`

**AuditLog**
`id, organizationId, userId, eventType, entityType, entityId, description, ipAddress, createdAt`
No update/delete endpoints exist for this table.

**Delegation** *(P2)*
`id, organizationId, delegatorId, delegateId, startDate, endDate, reason, status (ACTIVE|EXPIRED|CANCELLED)`

### 5.2 Multi-Tenancy Strategy
Shared database, shared schema, **discriminator column** (`organizationId`) — documented as such in the report.

Enforcement layers:
1. Session carries `organizationId`; it is **never** accepted from the request body or a query param.
2. A single data-access wrapper (e.g. `db.scoped(session.organizationId)`) applies the filter automatically.
3. Every mutation re-verifies `record.organizationId === session.organizationId` before writing.
4. Compound unique keys prevent cross-tenant ID collisions from mattering.
5. Optional hardening: Postgres Row-Level Security policies.

---

## 6. Memo Lifecycle (State Machine)

### 6.1 Statuses
`DRAFT → SUBMITTED → PENDING_REVIEW / PENDING_APPROVAL → (CHANGES_REQUESTED → back to author) → APPROVED | REJECTED | CANCELLED`

### 6.2 Transition Table

| From | Event | Actor | To |
|---|---|---|---|
| DRAFT | submit | author | SUBMITTED → PENDING_APPROVAL |
| PENDING_APPROVAL | approve (not last step) | current assignee | PENDING_APPROVAL (advance to next step) |
| PENDING_APPROVAL | approve (last step) | current assignee | APPROVED |
| PENDING_APPROVAL | reject (comment required) | current assignee | REJECTED (terminal) |
| PENDING_APPROVAL | request changes (comment required) | current assignee | CHANGES_REQUESTED |
| CHANGES_REQUESTED | resubmit (new version) | author | PENDING_APPROVAL (restarts from step 1 or resumes — see 6.4) |
| DRAFT / PENDING_APPROVAL | cancel | author or ORG_ADMIN | CANCELLED |
| APPROVED / REJECTED | — | — | terminal, read-only |

### 6.3 Workflow Engine Rules
1. On submit, the author supplies an ordered list of `(position, assigneeId, positionLabel)`. Positions must be contiguous starting at 1. Assignees must belong to the same organization and be ACTIVE.
2. Exactly one step is `CURRENT` at any time while the memo is active.
3. **Turn enforcement:** an action is rejected with HTTP 403 unless `step.id === memo.currentStepId` **and** (`step.assigneeId === session.userId` **or** the caller holds an ACTIVE delegation from `step.assigneeId`).
4. On approve: mark step COMPLETED with action + timestamp + optional comment, set next step CURRENT, update `memo.currentStepId`, notify next assignee, write audit record. Wrap in a **DB transaction**.
5. On reject: mark step COMPLETED with REJECT + mandatory comment, set memo REJECTED, clear `currentStepId`, notify author, remaining steps → SKIPPED.
6. On request changes: mandatory comment; memo → CHANGES_REQUESTED; control returns to the author (or to the specified earlier participant); notify author.
7. On resubmit: create a new `MemoVersion`, increment `memo.submissionCycle`, and insert a **fresh set of `WorkflowStep` rows for the new cycle** with position 1 set to CURRENT. The previous cycle's step rows and all `WorkflowAction` rows are left untouched, so the earlier round of decisions survives verbatim. (Restarting from position 1 is the default; document the choice in the report.)
8. Prevent double-action with an optimistic check on `memo.updatedAt` or a row-level lock.

### 6.4 History Preservation
Old workflow decisions are **never overwritten**. Either keep step rows per submission cycle, or write every decision into an append-only `WorkflowAction` table. Timeline is built from Audit/WorkflowAction + Comment records ordered by `createdAt`.

---

## 7. Functional Requirements by Module

### 7.1 Authentication (P0)
- Login (email + password, scoped by org via email uniqueness per org or an org selector).
- Logout (session destroyed server-side).
- Change password (requires current password).
- Forgot password → token emailed or displayed in dev; token single-use, expiring in 60 min.
- View/update profile: name, designation, avatar. Email and role editable only by admin.
- Inactive users cannot log in.
- Passwords hashed with bcrypt (cost ≥ 12) or argon2id. Never store or log plaintext.

### 7.2 Organization Management (P0)
- Org registration flow creating the org + its first ORG_ADMIN (also used in the demo).
- Admin can edit name, logo, contact info, settings.
- Org-level stats on the admin dashboard.

### 7.3 Department Management (P0)
- CRUD (deactivate, not hard-delete). Deactivation preserves historical memos and user links.

### 7.4 User Management (P0)
- Admin creates users with a temporary password or invite link.
- Assign department, designation, role. Activate/deactivate.
- Listing with search + filter by department, role, status.

### 7.5 Memo Creation (P0)
- Auto-generated memo number: `{ORG_SLUG}-{YYYY}-{SEQ}` — sequence generated per organization inside a transaction (no global counter).
- Fields: subject, rich-text body, department (defaults to author's), category, priority, attachments, workflow participants.
- Save as draft or submit directly.

### 7.6 Drafts (P0)
- Author-only visibility, editable and deletable while DRAFT.
- Drafts never appear in anyone's inbox.
- Submission records the event and locks editing (edits only via the versioning path).

### 7.7 Inbox / Sent / Completed (P0)
- **Inbox:** memos where the current step is assigned to me. Columns: memo number, subject, sender, department, priority, status, submitted date, required action, age pending (e.g. "2d 4h").
- **Sent/My Memos:** memo number, subject, status, current participant, priority, submission date, last activity.
- **Completed:** approved/rejected memos I'm authorized to see.
- All three support sort + filter (status, priority, department, category, date range).

### 7.8 Memo Detail & Timeline (P0)
- Full memo header, body, attachments, current status badge, current assignee.
- **Workflow tracker:** visual stepper marking completed / current / future steps, with actor, action, timestamp and comment per completed step.
- **Chronological timeline** merging creation, submission, approvals, comments, change requests, resubmissions, attachment uploads.
- Action panel visible **and permitted** only for the current assignee.

### 7.9 Comments (P0)
- Add comment (participants + author + org admin only).
- Displayed chronologically, typed and visually distinguished: General / Approval / Rejection / Change Request.
- No edit/delete endpoints for USER role.

### 7.10 Attachments (P0)
- Upload on create/draft/resubmit. Max 10 MB per file; allowlist: pdf, docx, xlsx, png, jpg, txt, csv.
- Validate MIME type **and** extension server-side; store with a random `storageKey` (UUID), never the original filename.
- Download route checks memo authorization, then streams the file or issues a short-lived signed URL. Direct bucket access is disabled.
- Display filename, size, uploader, timestamp.

### 7.11 Notifications (P0)
- In-app bell with unread count and mark-as-read.
- Triggered on: action required, approved, rejected, changes requested, comment added, resubmitted, workflow completed, assigned to a workflow.
- Email notification optional (P2) via Resend/SMTP.

### 7.12 Search & Filtering (P0)
- Search across memo number, subject, body, author, department, category, status, priority, date range.
- Body search uses a case-insensitive `contains` on the sanitized HTML at this data volume; store a plain-text copy of the body if results look noisy. Postgres full-text search is an optional upgrade, not a requirement.
- Every query is tenant-scoped **and** authorization-scoped: results include only memos the user authored, participates in, or (for admins) belongs to their org.

### 7.13 Dashboard (P0)
- **User:** awaiting my action, my submitted memos, recently completed, pending approvals, pending reviews, urgent memos, recent activity, counts by status.
- **Admin:** all of the above plus users, active users, departments, total memos, pending/completed/rejected workflows, recent system activity.

### 7.14 Memo Categories (P1)
Admin CRUD with active/inactive; used as a memo field and a filter.

### 7.15 Workflow Templates (P1)
- Admin defines named templates with ordered position labels (Purchase Request, Leave Request, Procurement Request as seeds).
- On memo creation, the author picks a template and maps a real user to each position, or builds a custom workflow.

### 7.16 Versioning (P1)
- A version snapshot is written on every submission and resubmission.
- Version list on the memo detail page with a diff-free read-only viewer.
- Historical versions are immutable.

### 7.17 Audit Log (P1)
- Written for every event listed in spec §18, via one central `logAudit()` helper called inside the same transaction as the mutation.
- Admin-only viewer with filters by event type, user, date range.

### 7.18 Reporting (P1)
- Counts by status, department, category; urgent count; pending approvals; rejected; change requests; **average workflow completion time** (mean of `completedAt − submittedAt` for APPROVED memos).
- Filters: date range, department, category, status. Simple bar/pie charts.

### 7.19 PDF Export (P1)
- Server-rendered PDF containing org info + logo, memo number, subject, author, department, date, body, attachment references, workflow participants, approval history, comments, final status.
- Prominent status stamp: APPROVED / REJECTED / IN PROGRESS.

### 7.20 Delegation (P2)
- Create delegation (delegate, start, end, reason). While active, the delegate sees the delegator's pending items and may act.
- Actions display as "Delegate X acting on behalf of Y" — stored in `actedById` + `actedOnBehalfOfId`.

---

## 8. API Surface (route handlers)

```
POST   /api/auth/register-org        POST   /api/auth/login
POST   /api/auth/logout              POST   /api/auth/forgot-password
POST   /api/auth/reset-password      POST   /api/auth/change-password

GET    /api/org                      PATCH  /api/org
GET    /api/departments              POST   /api/departments
PATCH  /api/departments/:id
GET    /api/users                    POST   /api/users
PATCH  /api/users/:id                PATCH  /api/users/:id/status

GET    /api/memos?scope=inbox|sent|completed&filters...
POST   /api/memos                    GET    /api/memos/:id
PATCH  /api/memos/:id                DELETE /api/memos/:id      (draft only)
POST   /api/memos/:id/submit         POST   /api/memos/:id/resubmit
POST   /api/memos/:id/cancel
POST   /api/memos/:id/steps/:stepId/action   { action, comment }
GET    /api/memos/:id/versions       GET    /api/memos/:id/export-pdf
POST   /api/memos/:id/comments
POST   /api/memos/:id/attachments    GET    /api/attachments/:id/download

GET    /api/categories               POST /api/categories       PATCH /api/categories/:id
GET    /api/templates                POST /api/templates        PATCH /api/templates/:id
GET    /api/notifications            POST /api/notifications/:id/read
GET    /api/search?q=...
GET    /api/dashboard                GET  /api/reports
GET    /api/audit-logs
POST   /api/delegations              PATCH /api/delegations/:id
```

Every handler: (1) resolve session → 401 if absent; (2) role check → 403; (3) tenant-scoped fetch → 404 if not in tenant; (4) business-rule check (turn order) → 403; (5) validate input with Zod; (6) transactional write + audit; (7) return a generic error message on failure.

---

## 9. UI Requirements

Pages: Login, Register Organization, Dashboard, Inbox, My Memos, Completed, Create/Edit Memo, Memo Detail (workflow + timeline + comments + attachments), Notifications, Search, Profile, Admin (Organization, Departments, Users, Categories, Templates, Reports, Audit Log).

Design rules:
- Responsive down to 375 px (sidebar collapses to a bottom/hamburger nav; tables become cards).
- The **current status and required action must be visually obvious**: colored status badges (Draft grey, Pending blue, Changes Requested amber, Approved green, Rejected red, Cancelled slate) and priority chips (Normal / High / Urgent).
- The workflow stepper is the visual centerpiece of the memo detail page.
- Empty states, loading skeletons, and toast confirmations for every mutation.

---

## 10. Security Checklist (maps to spec §21)

- [ ] All protected routes require a valid session (middleware + per-handler check).
- [ ] Authorization enforced server-side in every handler.
- [ ] `organizationId` taken only from the session, never from client input.
- [ ] Every tenant query filtered by `organizationId`; cross-tenant fetch returns 404.
- [ ] Workflow turn order enforced server-side.
- [ ] Passwords hashed with bcrypt(12+)/argon2id.
- [ ] Session cookie: `httpOnly`, `secure`, `sameSite=lax`, sensible expiry.
- [ ] All input validated with Zod (type, length, enum, format).
- [ ] Rich-text body sanitized server-side (DOMPurify/sanitize-html) → XSS prevented.
- [ ] ORM parameterized queries only; no string-concatenated SQL.
- [ ] CSRF protection on state-changing routes.
- [ ] File uploads: size cap, extension + MIME allowlist, randomized storage key, no execution path.
- [ ] Attachment download authorized per memo; private bucket + signed URL.
- [ ] Generic error messages; stack traces never returned to the client.
- [ ] Rate limiting on login and password-reset endpoints.
- [ ] HTTPS enforced in production; security headers set.
- [ ] `.env` never committed; `.env.example` provided instead.

---

## 11. Seed / Demo Data

Two organizations, to prove isolation:

**Org A — "Northwind Corp"** (`northwind`)
- Departments: Administration, Finance, HR, Procurement, Engineering
- `admin@northwind.test` (ORG_ADMIN), `karim@northwind.test` (Employee, Engineering), `head@northwind.test` (Dept. Head), `finance@northwind.test` (Finance Manager), `director@northwind.test` (Director), `ceo@northwind.test` (CEO)
- Memos in each state: draft, in-progress at step 2, changes-requested, approved, rejected.

**Org B — "Beacon Ltd"** (`beacon`)
- `admin@beacon.test`, `sara@beacon.test` — used to demonstrate that Org B cannot see Org A's memos.

Password for all demo accounts: one shared non-production value, documented in the submission (not in the repo).

---

## 12. Acceptance Criteria (from spec §28 — the demo script)

| # | Scenario | Passes when |
|---|---|---|
| 1 | Create an organization | Registration creates org + admin; login works |
| 2 | Create multiple users | Admin adds users with departments and roles |
| 3 | Create a memo | Memo saved with an auto-generated number |
| 4 | Define a sequential workflow | Ordered participants persisted with positions |
| 5 | Submit the memo | Status → Pending; step 1 becomes CURRENT |
| 6 | Log in as participant 1 | Memo appears in their inbox with the required action |
| 7 | Approve / reject / comment / request changes | Action recorded with actor, timestamp, comment |
| 8 | Memo moves to the next participant | Step 2 becomes CURRENT; step 3's user gets 403 if they try to act early |
| 9 | Complete workflow history | Timeline shows every action chronologically |
| 10 | Final approval or rejection | Status APPROVED with final approver + timestamp; memo read-only |
| 11 | Notifications | Recipients see unread in-app notifications for each event |
| 12 | Search and filtering | Results respect authorization and tenant boundary |
| 13 | Administrative functionality | Departments, users, categories, templates, reports usable |
| 14 | **Cross-tenant denial** | Org B user requesting Org A's memo URL gets 404/403, and search never surfaces it |

---

## 13. Deliverables Checklist (spec §§23–27, 29)

- [ ] **A. Deployed app** at a public HTTPS URL, functional at submission time.
- [ ] **B. Project documentation** covering: system overview, requirements implemented, technology stack, architecture (with diagram), database design + multi-tenancy explanation, workflow design, security, vibe-coding process, known limitations, deployment info.
- [ ] **C. Source code ZIP**: full source, migrations, config files, dependency definitions, `.env.example`, seed script, installation/build/run instructions. **No secrets.**
- [ ] **D. AI prompt & response history**: complete, chronological, unedited, including failed attempts and debugging. Export the Claude Code sessions rather than rewriting them. Redact any credential that leaked into a prompt and mark it `[REDACTED]`. A summary does **not** satisfy this.
- [ ] **E. Demonstration credentials** for a regular user, an org admin, and a second-organization user.

> ⚠️ **Start capturing the AI history from the very first prompt.** Keep every Claude Code session; do not clear the project's session directory. This is a graded deliverable of its own.

---

## 14. Build Plan (27–29 August)

**Phase 0 — Setup (1 h)**
Repo, Next.js + TS + Tailwind + shadcn, Prisma, Neon DB, deploy an empty app to Vercel immediately to prove the pipeline works.

**Phase 1 — Data + Auth (3 h)**
Full Prisma schema, migrations, seed script, Auth.js login/logout, session with `organizationId`, tenant-scoped DB helper, route protection middleware.

**Phase 2 — Memo core (4 h)**
Memo CRUD, drafts, memo numbering, categories, attachments upload/download, memo detail page.

**Phase 3 — Workflow engine (4 h)** ← *the highest-risk piece; do not compress it*
Step creation on submit, turn-order enforcement, approve/reject/request-changes/resubmit, status transitions, timeline, comments, notifications, audit log.

**Phase 4 — Surfaces (3 h)**
Inbox, sent, completed, dashboards, search & filters, admin screens.

**Phase 5 — P1 features (3 h)**
Templates, versioning, reports, PDF export.

**Phase 6 — Harden, seed, deploy, document (4 h)**
Security checklist pass, cross-tenant penetration test by hand, demo data, final deploy, documentation, AI history export.

*If time runs short, drop P2 (delegation, email) and then §7.18/§7.19 (reports, PDF). Never drop workflow correctness, tenant isolation, or server-side authorization.*

---

## 15. Requirements Traceability

| Spec § | Requirement | PRD § | Priority |
|---|---|---|---|
| 2.1 | Multi-tenant orgs | 5.2, 7.2 | P0 |
| 2.2 | Authentication | 7.1 | P0 |
| 2.3 | Roles & permissions | 4 | P0 |
| 3.1 | Memo creation | 7.5 | P0 |
| 3.2 | Drafts | 7.6 | P0 |
| 4 | Workflow | 6, 7.8 | P0 |
| 4.1 | Workflow actions | 6.3 | P0 |
| 4.2 | Sequence enforcement | 6.3 (rule 3) | P0 |
| 4.3 | Completion | 6.2 | P0 |
| 4.4 | Reject / request changes | 6.2, 6.3 | P0 |
| 5 | Statuses | 6.1 | P0 |
| 6 | Inbox / sent / completed | 7.7 | P0 |
| 7 | Detail & timeline | 7.8 | P0 |
| 8 | Comments | 7.9 | P0 |
| 9 | Attachments | 7.10 | P0 |
| 10 | Notifications | 7.11 | P0 |
| 11 | Search & filtering | 7.12 | P0 |
| 12 | Dashboard | 7.13 | P0 |
| 13 | Departments | 7.3 | P0 |
| 14 | Categories | 7.14 | P1 |
| 15 | Workflow templates | 7.15 | P1 |
| 16 | Delegation | 7.20 | P2 |
| 17 | Versioning | 7.16 | P1 |
| 18 | Audit log | 7.17 | P1 |
| 19 | Reporting | 7.18 | P1 |
| 20 | PDF export | 7.19 | P1 |
| 21 | Security | 10 | P0 |
| 22 | UI | 9 | P0 |
| 23 | Deployment | 13, 14 | P0 |
| 24–27 | Submission artifacts | 13 | P0 |
| 28 | Demonstration | 12 | P0 |

---

## 16. Notes for Claude Code

- Build in this order: **schema → auth → tenant guard → workflow engine → UI**. The workflow engine is the graded core; write it before polishing screens.
- Put every workflow transition in **one service module** (`lib/workflow.ts`) with pure, testable functions, and call it from the route handlers. Do not scatter transition logic across pages.
- Write a `lib/tenant.ts` guard and use it everywhere; forbid direct `prisma.memo.findUnique` calls in feature code.
- Deploy at the end of Phase 0 and redeploy after every phase, so a broken deploy is never discovered on the last night.
- After the build, manually verify item 14 of the acceptance table by logging in as `sara@beacon.test` and pasting an Org A memo URL.
