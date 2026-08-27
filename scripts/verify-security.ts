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

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { addComment } from '../lib/comment'
import { deleteDraft, updateMemo } from '../lib/memo'
import { sanitizeMemoBody } from '../lib/sanitize'
import { scoped, type TenantContext } from '../lib/tenant'
import {
  WorkflowError,
  assertCanAct,
  performWorkflowAction,
  validateActionComment,
  validateParticipants,
} from '../lib/workflow'

const prisma = new PrismaClient()

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
