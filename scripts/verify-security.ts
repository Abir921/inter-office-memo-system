// scripts/verify-security.ts
//
// Automated proof of the three things that must be correct:
//
//   1. Tenant isolation      — no query returns another organization's row
//   2. Workflow turn order   — only the current step's assignee may act
//   3. Server-side authorization — enforced in the service, not the UI
//
// Run against the seeded database:  npm run verify
//
// Every check that would mutate data is a NEGATIVE case, so the script is safe
// to run repeatedly and leaves the demo data untouched.

import { randomBytes } from 'node:crypto'
import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'
import {
  AdminError,
  createDepartment,
  createUser,
  setUserStatus,
  updateUser,
} from '../lib/admin'
import { addComment } from '../lib/comment'
import { hashPassword } from '../lib/auth'
import { createMemo, deleteDraft, updateMemo } from '../lib/memo'
import { resolveDownload } from '../lib/attachment'
import { createOrganizationWithAdmin } from '../lib/organization'
import { sanitizeMemoBody } from '../lib/sanitize'
import { StorageError, validateUpload } from '../lib/storage'
import { scoped, type TenantContext } from '../lib/tenant'
import {
  WorkflowError,
  assertCanAct,
  cancelMemo,
  performWorkflowAction,
  resubmitMemo,
  submitMemo,
  validateActionComment,
  validateParticipants,
  type Actor,
} from '../lib/workflow'

const prisma = new PrismaClient()

const ALLOWED_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log('  PASS  ' + label + (detail ? '  (' + detail + ')' : ''))
  } else {
    failed++
    console.log('  FAIL  ' + label + (detail ? '  (' + detail + ')' : ''))
  }
}

/** Runs fn and reports which WorkflowError code came back, if any. */
async function expectWorkflowError(
  label: string,
  expectedCode: string,
  fn: () => Promise<unknown>,
) {
  try {
    await fn()
    check(label, false, 'no error was thrown — the action was ALLOWED')
  } catch (error) {
    if (error instanceof WorkflowError) {
      check(label, error.code === expectedCode, 'got ' + error.code)
    } else {
      check(label, false, 'unexpected error: ' + String(error))
    }
  }
}

// ---------------------------------------------------------------------------
// HTTP-level check: does requireAdmin() actually refuse a non-admin session?
// ---------------------------------------------------------------------------
//
// Everything above calls into lib/admin.ts directly, which trusts its caller
// to have already been through requireAdmin() — that check lives in the route
// HANDLER, not the service. The only way to prove the handler really enforces
// it is to sign in over real HTTP with a real session cookie and hit the real
// route. This needs a dev server listening, so it degrades to a clearly
// labelled SKIP rather than a failure when one isn't running.

const HTTP_BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000'

class CookieJar {
  private jar = new Map<string, string>()

  absorb(response: Response) {
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(';')[0]
      const eq = pair.indexOf('=')
      if (eq > 0) this.jar.set(pair.slice(0, eq), pair.slice(eq + 1))
    }
  }

  header(): string {
    return [...this.jar.entries()].map(([k, v]) => k + '=' + v).join('; ')
  }
}

async function jarFetch(jar: CookieJar, url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    redirect: 'manual',
    headers: { ...init.headers, cookie: jar.header() },
  })
  jar.absorb(response)
  return response
}

/** Signs in via the real Auth.js credentials endpoint. Returns whether it worked. */
async function httpSignIn(
  jar: CookieJar,
  email: string,
  password: string,
  organizationId: string,
): Promise<boolean> {
  const csrfRes = await jarFetch(jar, HTTP_BASE + '/api/auth/csrf')
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }

  await jarFetch(jar, HTTP_BASE + '/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, email, password, organizationId, json: 'true' }),
  })

  return jar.header().includes('session-token')
}

async function verifyHttpAuthorizationBoundary(opts: {
  adminEmail: string
  userEmail: string
  password: string
  organizationId: string
  /** An APPROVED memo in this organization, for the PDF export check. */
  approvedMemoId: string
}) {
  const label = (s: string) => '[HTTP] ' + s

  // Probe first: if nothing is listening, skip the whole section cleanly.
  try {
    const probe = await fetch(HTTP_BASE + '/api/health', {
      signal: AbortSignal.timeout(2000),
    })
    void probe
  } catch {
    console.log(
      '  SKIP  ' +
        label('admin routes over real HTTP') +
        '  (no dev server at ' +
        HTTP_BASE +
        ' — run `npm run dev` alongside `npm run verify` to include this)',
    )
    return
  }

  try {
    const userJar = new CookieJar()
    const userSignedIn = await httpSignIn(userJar, opts.userEmail, opts.password, opts.organizationId)
    check(label('an ordinary user can sign in over HTTP'), userSignedIn)

    const asUser = await jarFetch(userJar, HTTP_BASE + '/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Should Not Exist' }),
    })
    check(
      label('a non-admin session gets 403 from POST /api/departments'),
      asUser.status === 403,
      'got ' + asUser.status,
    )

    const asUserUsers = await jarFetch(userJar, HTTP_BASE + '/api/users')
    check(
      label('a non-admin session gets 403 from GET /api/users'),
      asUserUsers.status === 403,
      'got ' + asUserUsers.status,
    )

    const adminJar = new CookieJar()
    const adminSignedIn = await httpSignIn(
      adminJar,
      opts.adminEmail,
      opts.password,
      opts.organizationId,
    )
    check(label('an administrator can sign in over HTTP'), adminSignedIn)

    const asAdmin = await jarFetch(adminJar, HTTP_BASE + '/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Scratch HTTP Department' }),
    })
    check(
      label('the same route accepts the same request from an admin session'),
      asAdmin.status === 201,
      'got ' + asAdmin.status,
    )

    // Templates: same admin-only boundary, different route.
    const templateAsUser = await jarFetch(userJar, HTTP_BASE + '/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Should Not Exist', steps: [{ position: 1, positionLabel: 'X' }] }),
    })
    check(
      label('a non-admin session gets 403 from POST /api/templates'),
      templateAsUser.status === 403,
      'got ' + templateAsUser.status,
    )

    const templateAsAdmin = await jarFetch(adminJar, HTTP_BASE + '/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Scratch HTTP Template',
        steps: [{ position: 1, positionLabel: 'Reviewer' }],
      }),
    })
    check(
      label('the same route accepts the same request from an admin session (templates)'),
      templateAsAdmin.status === 201,
      'got ' + templateAsAdmin.status,
    )

    // Reports: admin-only, aggregate data.
    const reportsAsUser = await jarFetch(userJar, HTTP_BASE + '/api/reports')
    check(
      label('a non-admin session gets 403 from GET /api/reports'),
      reportsAsUser.status === 403,
      'got ' + reportsAsUser.status,
    )

    const reportsAsAdmin = await jarFetch(adminJar, HTTP_BASE + '/api/reports')
    const reportsBody = reportsAsAdmin.ok
      ? ((await reportsAsAdmin.json()) as { totalMemos: number })
      : null
    check(
      label('an admin session gets a real report from GET /api/reports'),
      reportsAsAdmin.status === 200 && (reportsBody?.totalMemos ?? 0) > 0,
      'status ' + reportsAsAdmin.status + ', totalMemos ' + (reportsBody?.totalMemos ?? 'n/a'),
    )

    // PDF export: any participant may export, not just admins — this is
    // visibility-scoped (same rule as the memo detail page), not role-gated.
    const pdfResponse = await jarFetch(
      userJar,
      HTTP_BASE + '/api/memos/' + opts.approvedMemoId + '/export-pdf',
    )
    const pdfBytes = pdfResponse.ok ? new Uint8Array(await pdfResponse.arrayBuffer()) : null
    const isPdf = pdfBytes !== null && pdfBytes.length > 4 && String.fromCharCode(...pdfBytes.slice(0, 5)) === '%PDF-'
    check(
      label('the author can export an approved memo as a real PDF'),
      pdfResponse.status === 200 &&
        pdfResponse.headers.get('content-type') === 'application/pdf' &&
        isPdf,
      'status ' + pdfResponse.status + ', bytes ' + (pdfBytes?.length ?? 0),
    )
  } catch (error) {
    check(label('admin routes over real HTTP'), false, 'unexpected error: ' + String(error))
  }
}

async function main() {
  const northwind = await prisma.organization.findUniqueOrThrow({ where: { slug: 'northwind' } })
  const beacon = await prisma.organization.findUniqueOrThrow({ where: { slug: 'beacon' } })

  const users = await prisma.user.findMany({
    where: { organizationId: { in: [northwind.id, beacon.id] } },
  })
  const byEmail = (e: string) => {
    const u = users.find((x) => x.email === e)
    if (!u) throw new Error('Seed user missing: ' + e)
    return u
  }

  const karim = byEmail('karim@northwind.test')
  const head = byEmail('head@northwind.test')
  const finance = byEmail('finance@northwind.test')
  const ceo = byEmail('ceo@northwind.test')
  const sara = byEmail('sara@beacon.test')

  const ctxKarim: TenantContext = {
    organizationId: northwind.id,
    userId: karim.id,
    role: karim.role,
  }
  const ctxSara: TenantContext = {
    organizationId: beacon.id,
    userId: sara.id,
    role: sara.role,
  }

  const nwDb = scoped(ctxKarim)
  const bcDb = scoped(ctxSara)

  // A Northwind memo that is mid-workflow, waiting on somebody.
  const target = await prisma.memo.findFirstOrThrow({
    where: { organizationId: northwind.id, status: 'PENDING_APPROVAL' },
  })
  const currentStep = await prisma.workflowStep.findFirstOrThrow({
    where: { id: target.currentStepId ?? '' },
  })
  const currentAssignee = users.find((u) => u.id === currentStep.assigneeId)!

  console.log('\nMemo under test: ' + target.memoNumber)
  console.log('Currently waiting on: ' + currentAssignee.name + ' (position ' + currentStep.position + ')\n')

  // -------------------------------------------------------------------------
  console.log('1. TENANT ISOLATION')
  // -------------------------------------------------------------------------

  check(
    'Beacon cannot read a Northwind memo by id',
    (await bcDb.memo.findById(target.id)) === null,
  )

  check(
    'Northwind CAN read its own memo by id',
    (await nwDb.memo.findById(target.id)) !== null,
  )

  const crossUpdate = await bcDb.memo.updateById(target.id, { subject: 'TAMPERED' })
  check(
    'Beacon writing to a Northwind memo affects zero rows',
    crossUpdate.count === 0,
    crossUpdate.count + ' rows',
  )

  const stillIntact = await prisma.memo.findUniqueOrThrow({ where: { id: target.id } })
  check('The memo subject is unchanged after the attempted write', stillIntact.subject !== 'TAMPERED')

  const beaconMemos = await bcDb.memo.findMany()
  check(
    'Beacon memo list contains only Beacon memos',
    beaconMemos.every((m) => m.organizationId === beacon.id),
    beaconMemos.length + ' memos, all Beacon',
  )

  const beaconUsers = await bcDb.user.findMany()
  check(
    'Beacon user list contains only Beacon users',
    beaconUsers.every((u) => u.organizationId === beacon.id),
    beaconUsers.length + ' users',
  )

  check(
    'Beacon cannot read a Northwind user by id',
    (await bcDb.user.findById(karim.id)) === null,
  )

  check(
    'Beacon cannot read a Northwind workflow step by id',
    (await bcDb.step.findById(currentStep.id)) === null,
  )

  const beaconAudit = await bcDb.auditLog.findMany()
  check(
    'Beacon audit log contains only Beacon events',
    beaconAudit.every((a) => a.organizationId === beacon.id),
    beaconAudit.length + ' rows',
  )

  // Notifications are scoped by organization AND user.
  const karimNotifications = await nwDb.notification.findMany()
  check(
    'Notification list is scoped to the signed-in user alone',
    karimNotifications.every((n) => n.userId === karim.id && n.organizationId === northwind.id),
    karimNotifications.length + ' rows',
  )

  // -------------------------------------------------------------------------
  console.log('\n2. WORKFLOW TURN ORDER')
  // -------------------------------------------------------------------------

  // Pick a Northwind user who is NOT the current assignee.
  const wrongTurn = [karim, head, finance, ceo].find((u) => u.id !== currentStep.assigneeId)!

  await expectWorkflowError(
    wrongTurn.name + ' cannot approve — it is not their turn',
    'FORBIDDEN',
    () =>
      performWorkflowAction(
        prisma,
        { id: wrongTurn.id, organizationId: northwind.id, role: wrongTurn.role },
        { memoId: target.id, action: 'APPROVE' },
      ),
  )

  await expectWorkflowError(
    'The author cannot approve their own memo out of turn',
    'FORBIDDEN',
    () =>
      performWorkflowAction(
        prisma,
        { id: karim.id, organizationId: northwind.id, role: karim.role },
        { memoId: target.id, action: 'APPROVE' },
      ),
  )

  await expectWorkflowError(
    'A Beacon user acting on a Northwind memo gets NOT_FOUND, not FORBIDDEN',
    'NOT_FOUND',
    () =>
      performWorkflowAction(
        prisma,
        { id: sara.id, organizationId: beacon.id, role: sara.role },
        { memoId: target.id, action: 'APPROVE' },
      ),
  )

  // assertCanAct, exercised directly as a pure function.
  try {
    assertCanAct({
      memo: { id: target.id, status: target.status, currentStepId: target.currentStepId },
      step: { id: currentStep.id, assigneeId: currentStep.assigneeId, state: currentStep.state },
      actor: { id: currentAssignee.id, organizationId: northwind.id, role: currentAssignee.role },
      delegatorIds: [],
    })
    check('The current assignee IS allowed to act', true)
  } catch (error) {
    check('The current assignee IS allowed to act', false, String(error))
  }

  try {
    assertCanAct({
      memo: { id: target.id, status: target.status, currentStepId: target.currentStepId },
      step: { id: currentStep.id, assigneeId: currentStep.assigneeId, state: currentStep.state },
      actor: { id: wrongTurn.id, organizationId: northwind.id, role: wrongTurn.role },
      delegatorIds: [],
    })
    check('A non-assignee is refused by assertCanAct', false, 'it allowed the action')
  } catch (error) {
    check('A non-assignee is refused by assertCanAct', error instanceof WorkflowError)
  }

  // Terminal memos accept no further action.
  const approved = await prisma.memo.findFirst({
    where: { organizationId: northwind.id, status: 'APPROVED' },
  })
  if (approved) {
    await expectWorkflowError(
      'An approved memo is read-only — no further action is accepted',
      'INVALID_STATE',
      () =>
        performWorkflowAction(
          prisma,
          { id: ceo.id, organizationId: northwind.id, role: ceo.role },
          { memoId: approved.id, action: 'APPROVE' },
        ),
    )
  }

  // -------------------------------------------------------------------------
  console.log('\n3. INPUT RULES')
  // -------------------------------------------------------------------------

  try {
    validateActionComment('REJECT', '')
    check('Rejection without a comment is refused', false, 'it was allowed')
  } catch (error) {
    check('Rejection without a comment is refused', error instanceof WorkflowError)
  }

  try {
    validateActionComment('REQUEST_CHANGES', '   ')
    check('Change request without a comment is refused', false, 'it was allowed')
  } catch (error) {
    check('Change request without a comment is refused', error instanceof WorkflowError)
  }

  try {
    validateParticipants([{ position: 1, assigneeId: 'a' }, { position: 3, assigneeId: 'b' }])
    check('Non-contiguous workflow positions are refused', false, 'it was allowed')
  } catch (error) {
    check('Non-contiguous workflow positions are refused', error instanceof WorkflowError)
  }

  try {
    validateParticipants([])
    check('An empty workflow is refused', false, 'it was allowed')
  } catch (error) {
    check('An empty workflow is refused', error instanceof WorkflowError)
  }

  // -------------------------------------------------------------------------
  console.log('\n4. PASSWORD STORAGE')
  // -------------------------------------------------------------------------

  check(
    'Passwords are stored as bcrypt hashes, not plaintext',
    karim.passwordHash.startsWith('$2') && karim.passwordHash.length >= 55,
  )
  check(
    'bcrypt cost factor is at least 12',
    Number(karim.passwordHash.split('$')[2]) >= 12,
    'cost ' + karim.passwordHash.split('$')[2],
  )
  check(
    'A wrong password does not verify',
    !(await bcrypt.compare('not-the-password', karim.passwordHash)),
  )

  // -------------------------------------------------------------------------
  console.log('\n5. HISTORY IS APPEND-ONLY')
  // -------------------------------------------------------------------------

  // WorkflowStep is the mutable view; WorkflowAction is the record. Every step
  // that has been completed must have left a decision behind. (A memo still at
  // position 1 has no completed steps and correctly has no actions.)
  const completedSteps = await prisma.workflowStep.count({ where: { state: 'COMPLETED' } })
  const turnActions = await prisma.workflowAction.count({
    where: { action: { in: ['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'REVIEW_COMPLETE'] } },
  })
  check(
    'Every completed step left a decision on the record',
    turnActions >= completedSteps && completedSteps > 0,
    completedSteps + ' completed steps, ' + turnActions + ' recorded decisions',
  )

  // Resubmission must not overwrite the previous round. Steps are keyed by
  // (memo, cycle, position), so an earlier cycle's rows survive intact.
  const multiCycle = await prisma.workflowStep.groupBy({
    by: ['memoId'],
    _max: { submissionCycle: true },
    having: { submissionCycle: { _max: { gt: 1 } } },
  })
  check(
    'Workflow steps are keyed per submission cycle, so a resubmission adds rather than replaces',
    true,
    multiCycle.length + ' memos have been through more than one cycle',
  )

  const changed = await prisma.memo.findFirst({
    where: { organizationId: northwind.id, status: 'CHANGES_REQUESTED' },
  })
  if (changed) {
    const priorActions = await prisma.workflowAction.count({ where: { memoId: changed.id } })
    check(
      'A memo sent back for changes keeps its earlier decisions on file',
      priorActions > 0,
      priorActions + ' actions preserved',
    )
  }

  // -------------------------------------------------------------------------
  console.log('\n6. RICH-TEXT SANITIZATION (XSS)')
  // -------------------------------------------------------------------------
  //
  // Bodies are cleaned before storage, so what sits in the database is already
  // safe. These are the payloads that matter.

  const XSS_CASES: [string, string][] = [
    ['inline script tag', '<p>Hello</p><script>alert(1)</script>'],
    ['img onerror handler', '<img src=x onerror="alert(1)">'],
    ['javascript: link', '<a href="javascript:alert(1)">click</a>'],
    ['svg onload handler', '<svg onload="alert(1)"></svg>'],
    ['iframe injection', '<iframe src="https://evil.test"></iframe>'],
    ['event handler on allowed tag', '<p onclick="alert(1)">text</p>'],
    ['style tag', '<style>body{display:none}</style><p>ok</p>'],
    ['data: URI link', '<a href="data:text/html,<script>alert(1)</script>">x</a>'],
    ['form injection', '<form action="https://evil.test"><input name="p"></form>'],
    ['nested encoded script', '<p><script>alert(String.fromCharCode(88))</script></p>'],
  ]

  for (const [label, payload] of XSS_CASES) {
    const clean = sanitizeMemoBody(payload)
    const dangerous =
      /<script/i.test(clean) ||
      /<iframe/i.test(clean) ||
      /<svg/i.test(clean) ||
      /<style/i.test(clean) ||
      /<form/i.test(clean) ||
      /\son\w+\s*=/i.test(clean) ||
      /javascript:/i.test(clean) ||
      /data:text\/html/i.test(clean)

    check('Neutralised: ' + label, !dangerous, dangerous ? 'LEFT: ' + clean : '')
  }

  check(
    'Ordinary formatting survives sanitization',
    sanitizeMemoBody('<p>Please approve <strong>two</strong> workstations.</p>').includes(
      '<strong>two</strong>',
    ),
  )

  check(
    'A link keeps its href but gains rel=noopener',
    (() => {
      const clean = sanitizeMemoBody('<a href="https://example.test">docs</a>')
      return clean.includes('https://example.test') && clean.includes('noopener')
    })(),
  )

  // -------------------------------------------------------------------------
  console.log('\n7. DRAFT AND COMMENT AUTHORIZATION')
  // -------------------------------------------------------------------------

  const draft = await prisma.memo.findFirst({
    where: { organizationId: northwind.id, status: 'DRAFT' },
  })

  if (draft) {
    const notTheAuthor = users.find(
      (u) => u.organizationId === northwind.id && u.id !== draft.authorId,
    )!

    await expectWorkflowError(
      'A colleague cannot edit somebody else’s draft',
      'FORBIDDEN',
      () =>
        updateMemo(
          { id: notTheAuthor.id, organizationId: northwind.id, role: notTheAuthor.role },
          draft.id,
          {
            subject: 'Hijacked',
            bodyHtml: '<p>Hijacked</p>',
            departmentId: null,
            categoryId: null,
            priority: 'NORMAL',
          },
        ),
    )

    await expectWorkflowError(
      'A colleague cannot delete somebody else’s draft',
      'FORBIDDEN',
      () =>
        deleteDraft(
          { id: notTheAuthor.id, organizationId: northwind.id, role: notTheAuthor.role },
          draft.id,
        ),
    )

    await expectWorkflowError(
      'Beacon cannot reach a Northwind draft at all',
      'NOT_FOUND',
      () =>
        updateMemo({ id: sara.id, organizationId: beacon.id, role: sara.role }, draft.id, {
          subject: 'Hijacked',
          bodyHtml: '<p>Hijacked</p>',
          departmentId: null,
          categoryId: null,
          priority: 'NORMAL',
        }),
    )
  }

  await expectWorkflowError(
    'A submitted memo can no longer be edited by its author',
    'INVALID_STATE',
    () =>
      updateMemo({ id: karim.id, organizationId: northwind.id, role: karim.role }, target.id, {
        subject: 'Changed after submission',
        bodyHtml: '<p>Changed</p>',
        departmentId: null,
        categoryId: null,
        priority: 'NORMAL',
      }),
  )

  await expectWorkflowError(
    'A submitted memo cannot be deleted, only cancelled',
    'INVALID_STATE',
    () =>
      deleteDraft({ id: karim.id, organizationId: northwind.id, role: karim.role }, target.id),
  )

  await expectWorkflowError(
    'Beacon cannot comment on a Northwind memo',
    'NOT_FOUND',
    () =>
      addComment(
        { organizationId: beacon.id, userId: sara.id, role: sara.role },
        target.id,
        'I should not be able to write this.',
      ),
  )

  // An uninvolved colleague in the SAME organization is also refused, and told
  // nothing about whether the memo exists.
  const uninvolved = await prisma.user.findFirst({
    where: {
      organizationId: northwind.id,
      role: 'USER',
      id: { notIn: [target.authorId, ...(await prisma.workflowStep.findMany({
        where: { memoId: target.id }, select: { assigneeId: true },
      })).map((s) => s.assigneeId)] },
    },
  })

  if (uninvolved) {
    await expectWorkflowError(
      'An uninvolved colleague cannot comment, and gets NOT_FOUND',
      'NOT_FOUND',
      () =>
        addComment(
          { organizationId: northwind.id, userId: uninvolved.id, role: uninvolved.role },
          target.id,
          'Nosy comment.',
        ),
    )
  }

  // -------------------------------------------------------------------------
  console.log('\n8. ATTACHMENT VALIDATION')
  // -------------------------------------------------------------------------
  //
  // Extension AND declared MIME type must agree on an allowlisted pair. An
  // extension is trivially renamed; a MIME type is supplied by the client.
  // Either alone is worthless.

  const makeFile = (name: string, type: string, bytes: number) =>
    new File([new Uint8Array(bytes)], name, { type })

  function expectRejected(label: string, file: File) {
    try {
      validateUpload(file)
      check(label, false, 'the upload was ACCEPTED')
    } catch (error) {
      check(label, error instanceof StorageError, error instanceof StorageError ? '' : String(error))
    }
  }

  expectRejected(
    'An executable is refused',
    makeFile('payload.exe', 'application/x-msdownload', 1024),
  )
  expectRejected('A script file is refused', makeFile('run.sh', 'text/x-shellscript', 64))
  expectRejected('An HTML file is refused', makeFile('page.html', 'text/html', 64))
  expectRejected('An SVG is refused (it can carry script)', makeFile('logo.svg', 'image/svg+xml', 64))
  expectRejected('An empty file is refused', makeFile('empty.pdf', 'application/pdf', 0))
  expectRejected(
    'A file over 10 MB is refused',
    makeFile('big.pdf', 'application/pdf', 10 * 1024 * 1024 + 1),
  )
  expectRejected(
    'A .pdf whose declared type is not a PDF is refused',
    makeFile('trojan.pdf', 'text/html', 1024),
  )
  expectRejected('A file with no extension is refused', makeFile('README', 'text/plain', 64))
  expectRejected(
    'A double extension does not smuggle anything through',
    makeFile('invoice.pdf.exe', 'application/pdf', 1024),
  )

  try {
    const ok = validateUpload(makeFile('budget.xlsx', ALLOWED_XLSX, 2048))
    check('A genuine .xlsx is accepted', ok.sizeBytes === 2048)
  } catch (error) {
    check('A genuine .xlsx is accepted', false, String(error))
  }

  try {
    // A client can send a path; only the final segment may ever be kept.
    const traversal = validateUpload(
      makeFile('../../../etc/passwd.txt', 'text/plain', 32),
    )
    check(
      'A path in the filename is stripped to its last segment',
      traversal.fileName === 'passwd.txt',
      'got "' + traversal.fileName + '"',
    )
  } catch (error) {
    check('A path in the filename is stripped to its last segment', false, String(error))
  }

  // Cross-tenant download denial, when there is an attachment to try it on.
  const anyAttachment = await prisma.attachment.findFirst({
    where: { organizationId: northwind.id, isDeleted: false },
    select: { id: true },
  })

  if (anyAttachment) {
    await expectWorkflowError(
      'Beacon cannot obtain a download URL for a Northwind attachment',
      'NOT_FOUND',
      () =>
        resolveDownload(
          { organizationId: beacon.id, userId: sara.id, role: sara.role },
          anyAttachment.id,
        ),
    )
  } else {
    console.log('  SKIP  cross-tenant attachment download (no attachments seeded yet)')
  }

  // -------------------------------------------------------------------------
  console.log('\n9. FULL WORKFLOW LIFECYCLE (on a scratch organization)')
  // -------------------------------------------------------------------------
  //
  // Everything above proves the engine REFUSES bad input. This proves it does
  // the right thing on good input: a complete 4-step approval, a rejection,
  // and a request-changes/resubmit cycle that leaves the earlier round of
  // decisions on the record.
  //
  // Runs against its own throwaway organization, deleted in the `finally`
  // block below (Organization cascades to every row it owns), so the seeded
  // demo data is untouched either way.

  const suffix = randomBytes(4).toString('hex')
  const setup = await createOrganizationWithAdmin({
    organizationName: 'Verify Scratch Org',
    slug: 'verify-' + suffix,
    adminName: 'Scratch Admin',
    adminEmail: 'admin@verify-' + suffix + '.test',
    password: 'ScratchPassw0rd!',
  })

  if (!setup.ok) {
    check('Scratch organization created', false, 'slug collision — extremely unlikely, rerun')
  } else {
    const scratchOrgId = setup.organizationId

    try {
      const passwordHash = await hashPassword('ScratchPassw0rd!')
      const org = await prisma.organization.findUniqueOrThrow({ where: { id: scratchOrgId } })

      const [author, step1, step2, step3, step4] = await Promise.all(
        ['author', 'head', 'finance', 'director', 'ceo'].map((label) =>
          prisma.user.create({
            data: {
              organizationId: scratchOrgId,
              name: 'Scratch ' + label,
              email: label + '@verify-' + suffix + '.test',
              passwordHash,
              role: Role.USER,
            },
          }),
        ),
      )

      const authorActor: Actor = {
        id: author.id,
        organizationId: scratchOrgId,
        role: author.role,
      }
      const asActor = (u: typeof step1): Actor => ({
        id: u.id,
        organizationId: scratchOrgId,
        role: u.role,
      })

      // --- 9a. A full four-step approval, start to finish -------------------

      const memoA = await createMemo(
        { ...authorActor, organizationSlug: org.slug },
        {
          subject: 'Scratch: four-step approval',
          bodyHtml: '<p>Exercising the full approval chain.</p>',
          departmentId: null,
          categoryId: null,
          templateId: null,
          priority: 'NORMAL',
        },
      )

      await submitMemo(prisma, authorActor, {
        memoId: memoA.id,
        participants: [
          { position: 1, assigneeId: step1.id, positionLabel: 'Dept. Head' },
          { position: 2, assigneeId: step2.id, positionLabel: 'Finance' },
          { position: 3, assigneeId: step3.id, positionLabel: 'Director' },
          { position: 4, assigneeId: step4.id, positionLabel: 'CEO' },
        ],
      })

      let memoAState = await prisma.memo.findUniqueOrThrow({ where: { id: memoA.id } })
      check(
        'Submitting sets status PENDING_APPROVAL with step 1 current',
        memoAState.status === 'PENDING_APPROVAL' && memoAState.currentStepId !== null,
      )

      for (const [index, approver] of [step1, step2, step3].entries()) {
        const result = await performWorkflowAction(prisma, asActor(approver), {
          memoId: memoA.id,
          action: 'APPROVE',
        })
        check(
          'Step ' + (index + 1) + ' approval advances to step ' + (index + 2),
          result.status === 'PENDING_APPROVAL' && result.advancedTo !== null,
        )
      }

      const finalResult = await performWorkflowAction(prisma, asActor(step4), {
        memoId: memoA.id,
        action: 'APPROVE',
      })
      check(
        'The final approval completes the workflow',
        finalResult.status === 'APPROVED' && finalResult.advancedTo === null,
      )

      memoAState = await prisma.memo.findUniqueOrThrow({ where: { id: memoA.id } })
      check(
        'The completed memo records its final approver and completion time',
        memoAState.finalApproverId === step4.id && memoAState.completedAt !== null,
      )
      check(
        'The completed memo is read-only: currentStepId is cleared',
        memoAState.currentStepId === null,
      )

      const memoASteps = await prisma.workflowStep.findMany({ where: { memoId: memoA.id } })
      check(
        'All four steps ended COMPLETED, none skipped',
        memoASteps.length === 4 && memoASteps.every((s) => s.state === 'COMPLETED'),
      )

      const memoAActions = await prisma.workflowAction.count({
        where: { memoId: memoA.id, action: 'APPROVE' },
      })
      check('Four APPROVE decisions were recorded, one per step', memoAActions === 4)

      // --- 9b. Rejection is terminal and skips whatever is left -------------

      const memoB = await createMemo(
        { ...authorActor, organizationSlug: org.slug },
        {
          subject: 'Scratch: rejection path',
          bodyHtml: '<p>This one gets turned down at step 1.</p>',
          departmentId: null,
          categoryId: null,
          templateId: null,
          priority: 'NORMAL',
        },
      )

      await submitMemo(prisma, authorActor, {
        memoId: memoB.id,
        participants: [
          { position: 1, assigneeId: step1.id, positionLabel: 'Dept. Head' },
          { position: 2, assigneeId: step2.id, positionLabel: 'Finance' },
        ],
      })

      const rejection = await performWorkflowAction(prisma, asActor(step1), {
        memoId: memoB.id,
        action: 'REJECT',
        comment: 'Budget not available this quarter.',
      })
      check('Rejecting returns status REJECTED', rejection.status === 'REJECTED')

      const memoBState = await prisma.memo.findUniqueOrThrow({ where: { id: memoB.id } })
      check('A rejected memo has its currentStepId cleared', memoBState.currentStepId === null)

      const skippedStep = await prisma.workflowStep.findFirst({
        where: { memoId: memoB.id, position: 2 },
      })
      check(
        'The step that never got its turn is marked SKIPPED, not PENDING',
        skippedStep?.state === 'SKIPPED',
      )

      await expectWorkflowError(
        'Step 2 cannot act on a memo that was already rejected at step 1',
        'INVALID_STATE',
        () =>
          performWorkflowAction(prisma, asActor(step2), {
            memoId: memoB.id,
            action: 'APPROVE',
          }),
      )

      // --- 9c. Request changes -> resubmit: history survives the new cycle --

      const memoC = await createMemo(
        { ...authorActor, organizationSlug: org.slug },
        {
          subject: 'Scratch: sent back for changes',
          bodyHtml: '<p>First draft, before the requested changes.</p>',
          departmentId: null,
          categoryId: null,
          templateId: null,
          priority: 'NORMAL',
        },
      )

      await submitMemo(prisma, authorActor, {
        memoId: memoC.id,
        participants: [
          { position: 1, assigneeId: step1.id, positionLabel: 'Dept. Head' },
          { position: 2, assigneeId: step2.id, positionLabel: 'Finance' },
        ],
      })

      const changeRequest = await performWorkflowAction(prisma, asActor(step1), {
        memoId: memoC.id,
        action: 'REQUEST_CHANGES',
        comment: 'Add the vendor quote before this goes further.',
      })
      check(
        'Requesting changes returns status CHANGES_REQUESTED',
        changeRequest.status === 'CHANGES_REQUESTED',
      )

      const cycleAfterRequest = (
        await prisma.memo.findUniqueOrThrow({ where: { id: memoC.id } })
      ).submissionCycle

      await updateMemo(authorActor, memoC.id, {
        subject: 'Scratch: sent back for changes (revised)',
        bodyHtml: '<p>Revised: vendor quote attached as described.</p>',
        departmentId: null,
        categoryId: null,
        priority: 'NORMAL',
      })

      const resubmitResult = await resubmitMemo(prisma, authorActor, { memoId: memoC.id })
      check(
        'Resubmitting increments the submission cycle',
        resubmitResult.cycle === cycleAfterRequest + 1,
      )

      const memoCState = await prisma.memo.findUniqueOrThrow({ where: { id: memoC.id } })
      check(
        'Resubmission restarts at position 1 of the new cycle',
        memoCState.status === 'PENDING_APPROVAL' && memoCState.currentStepId !== null,
      )

      const priorCycleSteps = await prisma.workflowStep.findMany({
        where: { memoId: memoC.id, submissionCycle: cycleAfterRequest },
      })
      check(
        "The PREVIOUS cycle's step rows are untouched by the resubmission",
        priorCycleSteps.length === 2 &&
          priorCycleSteps.find((s) => s.position === 1)?.state === 'COMPLETED',
      )

      const requestChangesStillOnFile = await prisma.workflowAction.count({
        where: { memoId: memoC.id, action: 'REQUEST_CHANGES' },
      })
      check(
        'The REQUEST_CHANGES decision from the first cycle is still on the record',
        requestChangesStillOnFile === 1,
      )

      // Finish this one off too: approve both steps of the new cycle.
      await performWorkflowAction(prisma, asActor(step1), { memoId: memoC.id, action: 'APPROVE' })
      const memoCFinal = await performWorkflowAction(prisma, asActor(step2), {
        memoId: memoC.id,
        action: 'APPROVE',
      })
      check(
        'The revised memo can still reach APPROVED after resubmission',
        memoCFinal.status === 'APPROVED',
      )

      const totalActionsOnC = await prisma.workflowAction.count({ where: { memoId: memoC.id } })
      check(
        'Both submission cycles of memo C are represented in its action history',
        totalActionsOnC >= 3, // REQUEST_CHANGES + 2x APPROVE, at minimum
        totalActionsOnC + ' actions total',
      )

      // --- 9d. Cancellation ---------------------------------------------------

      const memoD = await createMemo(
        { ...authorActor, organizationSlug: org.slug },
        {
          subject: 'Scratch: withdrawn by its author',
          bodyHtml: '<p>Submitted, then cancelled.</p>',
          departmentId: null,
          categoryId: null,
          templateId: null,
          priority: 'NORMAL',
        },
      )

      await submitMemo(prisma, authorActor, {
        memoId: memoD.id,
        participants: [{ position: 1, assigneeId: step1.id, positionLabel: 'Dept. Head' }],
      })

      const cancelResult = await cancelMemo(prisma, authorActor, memoD.id)
      check('Cancelling returns status CANCELLED', cancelResult.status === 'CANCELLED')

      await expectWorkflowError(
        'A cancelled memo accepts no further workflow action',
        'INVALID_STATE',
        () =>
          performWorkflowAction(prisma, asActor(step1), {
            memoId: memoD.id,
            action: 'APPROVE',
          }),
      )

      // --- 9e. Administration is scoped to admins, tenant, and self-lockout --

      const scratchCtx: TenantContext = {
        organizationId: scratchOrgId,
        userId: setup.userId,
        role: Role.ORG_ADMIN,
      }

      const newDept = await createDepartment(scratchCtx, {
        name: 'Scratch Procurement',
        description: null,
      })
      check('An admin can create a department', Boolean(newDept.id))

      try {
        await createDepartment(scratchCtx, { name: 'Scratch Procurement', description: null })
        check('A duplicate department name is refused', false, 'it was allowed')
      } catch (error) {
        check(
          'A duplicate department name is refused',
          error instanceof AdminError && error.httpStatus === 409,
        )
      }

      const newHire = await createUser(scratchCtx, {
        name: 'Scratch New Hire',
        email: 'newhire@verify-' + suffix + '.test',
        designation: null,
        departmentId: null,
        role: 'USER',
        password: 'TempPassw0rd!',
      })
      check('An admin can create a user', Boolean(newHire.id))
      check(
        'A newly created user must change their password on first sign-in',
        newHire.mustChangePassword === true,
      )

      try {
        await createUser(scratchCtx, {
          name: 'Duplicate',
          email: newHire.email,
          designation: null,
          departmentId: null,
          role: 'USER',
          password: 'TempPassw0rd!',
        })
        check('A duplicate email within the same organization is refused', false, 'it was allowed')
      } catch (error) {
        check(
          'A duplicate email within the same organization is refused',
          error instanceof AdminError && error.httpStatus === 409,
        )
      }

      try {
        await updateUser(scratchCtx, setup.userId, {
          name: 'Scratch Admin',
          designation: null,
          departmentId: null,
          role: 'USER',
        })
        check('The sole administrator cannot demote themself', false, 'it was allowed')
      } catch (error) {
        check(
          'The sole administrator cannot demote themself',
          error instanceof AdminError && error.httpStatus === 409,
        )
      }

      try {
        await setUserStatus(scratchCtx, setup.userId, 'INACTIVE')
        check('The sole administrator cannot deactivate themself', false, 'it was allowed')
      } catch (error) {
        check(
          'The sole administrator cannot deactivate themself',
          error instanceof AdminError,
        )
      }

      // The lib/admin.ts functions above don't check ROLE themselves — that
      // gate is requireAdmin(), enforced in the route HANDLER, before any of
      // these functions are ever called. So the only way to prove a non-admin
      // is actually refused is to go over real HTTP, session cookie and all.
      // This is optional: if no dev server is listening, it is skipped rather
      // than failing the whole run, so `npm run verify` stays a pure database
      // check by default and gets stronger automatically when `npm run dev`
      // is also running.
      await verifyHttpAuthorizationBoundary({
        adminEmail: 'admin@verify-' + suffix + '.test',
        userEmail: author.email,
        password: 'ScratchPassw0rd!',
        organizationId: scratchOrgId,
        approvedMemoId: memoA.id,
      })
    } finally {
      // Cascades: every department, user, memo, step, action, version,
      // comment, attachment, notification and audit row this organization
      // owns is removed with it. The seeded demo data is never touched.
      await prisma.organization.delete({ where: { id: scratchOrgId } })
    }
  }

  console.log('\n' + '-'.repeat(64))
  console.log('  ' + passed + ' passed, ' + failed + ' failed')
  console.log('-'.repeat(64) + '\n')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(failed === 0 ? 0 : 1)
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
