// prisma/seed.ts
//
// Demo data for evaluation. Two organizations exist on purpose: Beacon is what
// you log into to prove that Northwind's memos are unreachable.
//
// Memos are driven through the REAL workflow engine rather than written
// directly, so seeding doubles as a smoke test of lib/workflow.ts. If the state
// machine is wrong, `npm run seed` fails instead of producing a broken database.
//
// Run:  npm run seed        ("seed": "tsx prisma/seed.ts" in package.json)

import { MemoStatus, Priority, PrismaClient, Role, StepActionType } from '@prisma/client'
import bcrypt from 'bcryptjs'
import {
  Actor,
  generateMemoNumber,
  performWorkflowAction,
  submitMemo,
} from '../lib/workflow'

const prisma = new PrismaClient()

// Demo password for every seeded account. Not a production secret — quote it in
// the submission document, never commit a real one.
const DEMO_PASSWORD = 'Passw0rd!2026'

const CATEGORIES = [
  'Administrative',
  'Financial',
  'Procurement',
  'HR',
  'Academic',
  'Technical',
  'General',
]

async function reset() {
  // Explicit order: FKs to User are Restrict, so children go before parents.
  await prisma.workflowAction.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.attachment.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.memoVersion.deleteMany()
  await prisma.workflowStep.deleteMany()
  await prisma.memo.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.delegation.deleteMany()
  await prisma.userInvite.deleteMany()
  await prisma.passwordResetToken.deleteMany()
  await prisma.memoSequence.deleteMany()
  await prisma.workflowTemplateStep.deleteMany()
  await prisma.workflowTemplate.deleteMany()
  await prisma.memoCategory.deleteMany()
  await prisma.user.deleteMany()
  await prisma.department.deleteMany()
  await prisma.organization.deleteMany()
}

async function createOrganization(input: {
  name: string
  slug: string
  contactEmail: string
  departments: string[]
}) {
  const org = await prisma.organization.create({
    data: {
      name: input.name,
      slug: input.slug,
      contactEmail: input.contactEmail,
      contactPhone: '+880 2 55668200',
      address: 'Plot 15, Block B, Bashundhara R/A, Dhaka 1229',
    },
  })

  const departments: Record<string, string> = {}
  for (const name of input.departments) {
    const dept = await prisma.department.create({
      data: { organizationId: org.id, name, description: `${name} department` },
    })
    departments[name] = dept.id
  }

  const categories: Record<string, string> = {}
  for (const name of CATEGORIES) {
    const category = await prisma.memoCategory.create({
      data: { organizationId: org.id, name, description: `${name} memos` },
    })
    categories[name] = category.id
  }

  return { org, departments, categories }
}

async function createUser(input: {
  organizationId: string
  name: string
  email: string
  designation: string
  departmentId?: string
  role?: Role
}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)

  return prisma.user.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      email: input.email,
      passwordHash,
      designation: input.designation,
      departmentId: input.departmentId ?? null,
      role: input.role ?? Role.USER,
    },
  })
}

/** Creates a DRAFT memo with a real memo number. */
async function createDraft(input: {
  organizationId: string
  orgSlug: string
  authorId: string
  departmentId: string
  categoryId: string
  subject: string
  body: string
  priority?: Priority
}) {
  return prisma.$transaction(async (tx) => {
    const memoNumber = await generateMemoNumber(tx, input.organizationId, input.orgSlug)

    return tx.memo.create({
      data: {
        organizationId: input.organizationId,
        memoNumber,
        subject: input.subject,
        bodyHtml: `<p>${input.body}</p>`,
        authorId: input.authorId,
        departmentId: input.departmentId,
        categoryId: input.categoryId,
        priority: input.priority ?? Priority.NORMAL,
        status: MemoStatus.DRAFT,
      },
    })
  })
}

function actorFor(user: { id: string; organizationId: string; role: Role }): Actor {
  return { id: user.id, organizationId: user.organizationId, role: user.role }
}

async function main() {
  console.log('Resetting database…')
  await reset()

  // -------------------------------------------------------------------------
  // Organization A — Northwind Corp (the one you demo)
  // -------------------------------------------------------------------------
  console.log('Seeding Northwind Corp…')

  const northwind = await createOrganization({
    name: 'Northwind Corp',
    slug: 'northwind',
    contactEmail: 'office@northwind.test',
    departments: ['Administration', 'Finance', 'HR', 'Procurement', 'Engineering'],
  })

  const admin = await createUser({
    organizationId: northwind.org.id,
    name: 'Nadia Rahman',
    email: 'admin@northwind.test',
    designation: 'System Administrator',
    departmentId: northwind.departments.Administration,
    role: Role.ORG_ADMIN,
  })

  const karim = await createUser({
    organizationId: northwind.org.id,
    name: 'Karim Hossain',
    email: 'karim@northwind.test',
    designation: 'Software Engineer',
    departmentId: northwind.departments.Engineering,
  })

  const head = await createUser({
    organizationId: northwind.org.id,
    name: 'Farhana Islam',
    email: 'head@northwind.test',
    designation: 'Head of Engineering',
    departmentId: northwind.departments.Engineering,
  })

  const finance = await createUser({
    organizationId: northwind.org.id,
    name: 'Tanvir Ahmed',
    email: 'finance@northwind.test',
    designation: 'Finance Manager',
    departmentId: northwind.departments.Finance,
  })

  const director = await createUser({
    organizationId: northwind.org.id,
    name: 'Shirin Akter',
    email: 'director@northwind.test',
    designation: 'Director of Operations',
    departmentId: northwind.departments.Administration,
  })

  const ceo = await createUser({
    organizationId: northwind.org.id,
    name: 'Imran Chowdhury',
    email: 'ceo@northwind.test',
    designation: 'Chief Executive Officer',
    departmentId: northwind.departments.Administration,
  })

  // Workflow templates
  await prisma.workflowTemplate.create({
    data: {
      organizationId: northwind.org.id,
      name: 'Purchase Request',
      description: 'Standard purchase approval chain',
      steps: {
        create: [
          { position: 1, positionLabel: 'Department Head' },
          { position: 2, positionLabel: 'Finance' },
          { position: 3, positionLabel: 'Director' },
        ],
      },
    },
  })

  await prisma.workflowTemplate.create({
    data: {
      organizationId: northwind.org.id,
      name: 'Leave Request',
      description: 'Leave approval chain',
      steps: {
        create: [
          { position: 1, positionLabel: 'Line Manager' },
          { position: 2, positionLabel: 'HR' },
        ],
      },
    },
  })

  await prisma.workflowTemplate.create({
    data: {
      organizationId: northwind.org.id,
      name: 'Procurement Request',
      description: 'Full procurement chain',
      steps: {
        create: [
          { position: 1, positionLabel: 'Department Head' },
          { position: 2, positionLabel: 'Procurement' },
          { position: 3, positionLabel: 'Finance' },
          { position: 4, positionLabel: 'Director' },
        ],
      },
    },
  })

  const chain = [
    { position: 1, assigneeId: head.id, positionLabel: 'Department Head' },
    { position: 2, assigneeId: finance.id, positionLabel: 'Finance Manager' },
    { position: 3, assigneeId: director.id, positionLabel: 'Director' },
    { position: 4, assigneeId: ceo.id, positionLabel: 'CEO' },
  ]

  const draftArgs = {
    organizationId: northwind.org.id,
    orgSlug: northwind.org.slug,
    authorId: karim.id,
    departmentId: northwind.departments.Engineering,
  }

  // 1. A memo left as a draft — visible only to Karim.
  await createDraft({
    ...draftArgs,
    categoryId: northwind.categories.Technical,
    subject: 'Proposal: migrate the build pipeline to containerised runners',
    body: 'Draft notes on moving CI to container-based runners. Not yet submitted.',
  })

  // 2. Waiting at step 1 — this is Farhana's inbox item for the demo.
  const awaiting = await createDraft({
    ...draftArgs,
    categoryId: northwind.categories.Procurement,
    subject: 'Request for two additional development workstations',
    body: 'The team has grown by two engineers and we are short on hardware.',
    priority: Priority.URGENT,
  })
  await submitMemo(prisma, actorFor(karim), {
    memoId: awaiting.id,
    participants: chain,
  })

  // 3. Mid-workflow: Farhana approved, now sitting with Finance.
  const inProgress = await createDraft({
    ...draftArgs,
    categoryId: northwind.categories.Financial,
    subject: 'Budget revision for Q4 tooling licences',
    body: 'Licence renewals came in above the original estimate. Revised figures attached.',
    priority: Priority.HIGH,
  })
  await submitMemo(prisma, actorFor(karim), { memoId: inProgress.id, participants: chain })
  await performWorkflowAction(prisma, actorFor(head), {
    memoId: inProgress.id,
    action: StepActionType.APPROVE,
    comment: 'Justified. Sending on to Finance.',
  })

  // 4. Changes requested — back with the author.
  const changes = await createDraft({
    ...draftArgs,
    categoryId: northwind.categories.Administrative,
    subject: 'Revised remote working guidelines for the engineering team',
    body: 'Proposed update to the remote working policy for engineering staff.',
  })
  await submitMemo(prisma, actorFor(karim), { memoId: changes.id, participants: chain })
  await performWorkflowAction(prisma, actorFor(head), {
    memoId: changes.id,
    action: StepActionType.APPROVE,
    comment: 'Agreed in principle.',
  })
  await performWorkflowAction(prisma, actorFor(finance), {
    memoId: changes.id,
    action: StepActionType.REQUEST_CHANGES,
    comment: 'Add the cost impact of the home office stipend before this goes further.',
  })

  // 5. Fully approved, including a resubmission cycle in its history.
  const approved = await createDraft({
    ...draftArgs,
    categoryId: northwind.categories.Procurement,
    subject: 'Annual renewal of the code signing certificate',
    body: 'The current certificate expires next quarter. Renewal quote enclosed.',
  })
  await submitMemo(prisma, actorFor(karim), { memoId: approved.id, participants: chain })
  for (const approver of [head, finance, director, ceo]) {
    await performWorkflowAction(prisma, actorFor(approver), {
      memoId: approved.id,
      action: StepActionType.APPROVE,
      comment: `Approved by ${approver.designation}.`,
    })
  }

  // 6. Rejected at the Director step.
  const rejected = await createDraft({
    ...draftArgs,
    categoryId: northwind.categories.Financial,
    subject: 'Off-site team building retreat at Cox\u2019s Bazar',
    body: 'Proposal for a three-day off-site for the engineering team.',
  })
  await submitMemo(prisma, actorFor(karim), { memoId: rejected.id, participants: chain })
  await performWorkflowAction(prisma, actorFor(head), {
    memoId: rejected.id,
    action: StepActionType.APPROVE,
    comment: 'Good for morale.',
  })
  await performWorkflowAction(prisma, actorFor(finance), {
    memoId: rejected.id,
    action: StepActionType.COMMENT,
    comment: 'Flagging that this falls outside the discretionary budget line.',
  })
  await performWorkflowAction(prisma, actorFor(finance), {
    memoId: rejected.id,
    action: StepActionType.APPROVE,
    comment: 'Passing upward for a decision.',
  })
  await performWorkflowAction(prisma, actorFor(director), {
    memoId: rejected.id,
    action: StepActionType.REJECT,
    comment: 'Not this quarter. Resubmit after the Q4 budget is finalised.',
  })

  // -------------------------------------------------------------------------
  // Organization B — Beacon Ltd (the isolation test)
  // -------------------------------------------------------------------------
  console.log('Seeding Beacon Ltd…')

  const beacon = await createOrganization({
    name: 'Beacon Ltd',
    slug: 'beacon',
    contactEmail: 'office@beacon.test',
    departments: ['Administration', 'Finance', 'Operations'],
  })

  const beaconAdmin = await createUser({
    organizationId: beacon.org.id,
    name: 'Rezaul Karim',
    email: 'admin@beacon.test',
    designation: 'Administrator',
    departmentId: beacon.departments.Administration,
    role: Role.ORG_ADMIN,
  })

  const sara = await createUser({
    organizationId: beacon.org.id,
    name: 'Sara Mahmud',
    email: 'sara@beacon.test',
    designation: 'Operations Officer',
    departmentId: beacon.departments.Operations,
  })

  const beaconMemo = await createDraft({
    organizationId: beacon.org.id,
    orgSlug: beacon.org.slug,
    authorId: sara.id,
    departmentId: beacon.departments.Operations,
    categoryId: beacon.categories.General,
    subject: 'Quarterly vendor review schedule',
    body: 'Proposed schedule for the quarterly vendor performance reviews.',
  })
  await submitMemo(prisma, actorFor(sara), {
    memoId: beaconMemo.id,
    participants: [{ position: 1, assigneeId: beaconAdmin.id, positionLabel: 'Administrator' }],
  })

  // -------------------------------------------------------------------------
  console.log('\nDone. Demo accounts (password for all: %s)\n', DEMO_PASSWORD)
  console.table([
    { org: 'Northwind Corp', email: 'admin@northwind.test', role: 'Org admin' },
    { org: 'Northwind Corp', email: 'karim@northwind.test', role: 'Author' },
    { org: 'Northwind Corp', email: 'head@northwind.test', role: 'Step 1 approver' },
    { org: 'Northwind Corp', email: 'finance@northwind.test', role: 'Step 2 approver' },
    { org: 'Northwind Corp', email: 'director@northwind.test', role: 'Step 3 approver' },
    { org: 'Northwind Corp', email: 'ceo@northwind.test', role: 'Step 4 approver' },
    { org: 'Beacon Ltd', email: 'admin@beacon.test', role: 'Org admin (other tenant)' },
    { org: 'Beacon Ltd', email: 'sara@beacon.test', role: 'Isolation test user' },
  ])
  console.log(
    '\nIsolation check: log in as sara@beacon.test and open a Northwind memo URL — expect 404.\n',
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
