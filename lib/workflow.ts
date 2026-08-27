// lib/workflow.ts
//
// The sequential memo workflow state machine. ALL workflow transitions live
// here. Route handlers resolve the session, then call one of the service
// functions below — they never mutate memo/step state themselves.
//
// Invariants this module is responsible for:
//   1. Exactly one WorkflowStep is CURRENT while a memo is active, and
//      memo.currentStepId points at it.
//   2. Only the current step's assignee (or an active delegate of theirs) can
//      act, and only on the current step.
//   3. WorkflowAction rows are append-only. Nothing here updates or deletes
//      them. Resubmission creates a NEW cycle of steps; the old cycle survives.
//   4. Every transition writes an audit record and its notifications inside the
//      same transaction as the state change.

import {
  AuditEventType,
  CommentType,
  MemoStatus,
  NotificationType,
  Prisma,
  PrismaClient,
  Role,
  StepActionType,
  StepState,
} from '@prisma/client'
import { writeAudit } from './audit'
import { pushNotifications } from './notify'

type Tx = Prisma.TransactionClient

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type WorkflowErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INVALID_STATE'
  | 'INVALID_INPUT'

const STATUS_BY_CODE: Record<WorkflowErrorCode, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_STATE: 409,
  INVALID_INPUT: 400,
}

export class WorkflowError extends Error {
  code: WorkflowErrorCode
  httpStatus: number

  constructor(code: WorkflowErrorCode, message: string) {
    super(message)
    this.name = 'WorkflowError'
    this.code = code
    this.httpStatus = STATUS_BY_CODE[code]
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Actor {
  id: string
  organizationId: string
  role: Role
}

export interface ParticipantInput {
  position: number // 1-based, contiguous
  assigneeId: string
  positionLabel?: string | null
}

export interface ActionInput {
  memoId: string
  action: StepActionType
  comment?: string | null
}

const ACTIVE_STATUSES: MemoStatus[] = [
  MemoStatus.SUBMITTED,
  MemoStatus.PENDING_REVIEW,
  MemoStatus.PENDING_APPROVAL,
]

const TERMINAL_STATUSES: MemoStatus[] = [
  MemoStatus.APPROVED,
  MemoStatus.REJECTED,
  MemoStatus.CANCELLED,
]

const COMMENT_REQUIRED: StepActionType[] = [
  StepActionType.REJECT,
  StepActionType.REQUEST_CHANGES,
]

// ---------------------------------------------------------------------------
// Pure helpers — no database access, unit-testable
// ---------------------------------------------------------------------------

/** A memo is read-only to ordinary users once its workflow has finished. */
export function isMemoReadOnly(status: MemoStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

/**
 * Validates the ordered participant list supplied by the author.
 * Positions must start at 1, be contiguous, and contain no immediate repeats
 * (a user approving their own step twice in a row is always a mistake).
 */
export function validateParticipants(participants: ParticipantInput[]): ParticipantInput[] {
  if (!participants || participants.length === 0) {
    throw new WorkflowError('INVALID_INPUT', 'A workflow needs at least one participant.')
  }

  const ordered = [...participants].sort((a, b) => a.position - b.position)

  ordered.forEach((p, index) => {
    if (p.position !== index + 1) {
      throw new WorkflowError(
        'INVALID_INPUT',
        'Workflow positions must start at 1 and run in order with no gaps.',
      )
    }
    if (!p.assigneeId) {
      throw new WorkflowError('INVALID_INPUT', `Position ${p.position} has no assigned user.`)
    }
    if (index > 0 && ordered[index - 1].assigneeId === p.assigneeId) {
      throw new WorkflowError(
        'INVALID_INPUT',
        `The same user cannot hold positions ${index} and ${index + 1}.`,
      )
    }
  })

  return ordered
}

/** Comment text is mandatory for rejections and change requests. */
export function validateActionComment(action: StepActionType, comment?: string | null): string | null {
  const trimmed = comment?.trim() ?? ''

  if (COMMENT_REQUIRED.includes(action) && trimmed.length === 0) {
    throw new WorkflowError(
      'INVALID_INPUT',
      action === StepActionType.REJECT
        ? 'A rejection needs a reason.'
        : 'A change request needs a comment explaining what to change.',
    )
  }

  return trimmed.length > 0 ? trimmed : null
}

function commentTypeFor(action: StepActionType): CommentType {
  switch (action) {
    case StepActionType.APPROVE:
    case StepActionType.REVIEW_COMPLETE:
      return CommentType.APPROVAL
    case StepActionType.REJECT:
      return CommentType.REJECTION
    case StepActionType.REQUEST_CHANGES:
      return CommentType.CHANGE_REQUEST
    default:
      return CommentType.GENERAL
  }
}

// ---------------------------------------------------------------------------
// Memo numbering
// ---------------------------------------------------------------------------

/**
 * Per-organization, per-year memo number. Must be called inside the same
 * transaction that creates the memo so two concurrent authors cannot collide.
 */
export async function generateMemoNumber(
  tx: Tx,
  organizationId: string,
  orgSlug: string,
): Promise<string> {
  const year = new Date().getFullYear()

  const sequence = await tx.memoSequence.upsert({
    where: { organizationId_year: { organizationId, year } },
    create: { organizationId, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  })

  const serial = String(sequence.lastNumber).padStart(4, '0')
  return `${orgSlug.toUpperCase()}-${year}-${serial}`
}

// ---------------------------------------------------------------------------
// Delegation
// ---------------------------------------------------------------------------

/**
 * Returns the ids of users who have delegated their workflow authority to
 * `actorId` right now. Used both for turn checking and for the inbox query.
 */
export async function getActiveDelegatorIds(
  db: Tx | PrismaClient,
  actor: Actor,
): Promise<string[]> {
  const now = new Date()

  const delegations = await db.delegation.findMany({
    where: {
      organizationId: actor.organizationId,
      delegateId: actor.id,
      status: 'ACTIVE',
      startDate: { lte: now },
      endDate: { gte: now },
    },
    select: { delegatorId: true },
  })

  return delegations.map((d) => d.delegatorId)
}

// ---------------------------------------------------------------------------
// Turn enforcement — the single most important check in the system
// ---------------------------------------------------------------------------

interface TurnCheckArgs {
  memo: { id: string; status: MemoStatus; currentStepId: string | null }
  step: { id: string; assigneeId: string; state: StepState } | null | undefined
  actor: Actor
  delegatorIds: string[]
}

/**
 * Throws unless the actor may act on the memo's current step right now.
 * Returns the id of the user being acted for, when a delegate is acting.
 */
export function assertCanAct({ memo, step, actor, delegatorIds }: TurnCheckArgs): string | null {
  if (!ACTIVE_STATUSES.includes(memo.status)) {
    throw new WorkflowError('INVALID_STATE', 'This memo is not awaiting a workflow action.')
  }

  if (!memo.currentStepId || !step) {
    throw new WorkflowError('INVALID_STATE', 'This memo has no active workflow step.')
  }

  // The step being acted on must be THE current step. This is what stops user C
  // acting while the memo still sits with user B.
  if (step.id !== memo.currentStepId || step.state !== StepState.CURRENT) {
    throw new WorkflowError('FORBIDDEN', 'It is not this step\'s turn yet.')
  }

  if (step.assigneeId === actor.id) return null

  if (delegatorIds.includes(step.assigneeId)) return step.assigneeId

  throw new WorkflowError('FORBIDDEN', 'This memo is waiting on another user.')
}

// ---------------------------------------------------------------------------
// Service: submit a draft
// ---------------------------------------------------------------------------

export async function submitMemo(
  prisma: PrismaClient,
  actor: Actor,
  input: { memoId: string; participants: ParticipantInput[]; templateId?: string | null },
) {
  const participants = validateParticipants(input.participants)

  return prisma.$transaction(async (tx) => {
    const memo = await tx.memo.findFirst({
      where: { id: input.memoId, organizationId: actor.organizationId },
    })

    if (!memo) throw new WorkflowError('NOT_FOUND', 'Memo not found.')
    if (memo.authorId !== actor.id) {
      throw new WorkflowError('FORBIDDEN', 'Only the author can submit this memo.')
    }
    if (memo.status !== MemoStatus.DRAFT) {
      throw new WorkflowError('INVALID_STATE', 'Only a draft can be submitted.')
    }

    await assertAssigneesAreValid(tx, actor.organizationId, participants)

    const cycle = memo.submissionCycle + 1
    const now = new Date()

    await tx.memoVersion.create({
      data: {
        organizationId: actor.organizationId,
        memoId: memo.id,
        versionNumber: memo.currentVersion,
        submissionCycle: cycle,
        subject: memo.subject,
        bodyHtml: memo.bodyHtml,
        priority: memo.priority,
        editedById: actor.id,
      },
    })

    const steps = await createCycleSteps(tx, {
      organizationId: actor.organizationId,
      memoId: memo.id,
      cycle,
      participants,
    })

    const firstStep = steps[0]

    await tx.memo.update({
      where: { id: memo.id },
      data: {
        status: MemoStatus.PENDING_APPROVAL,
        submissionCycle: cycle,
        currentStepId: firstStep.id,
        templateId: input.templateId ?? memo.templateId,
        submittedAt: memo.submittedAt ?? now,
        lastActivityAt: now,
      },
    })

    await writeAudit(tx, {
      organizationId: actor.organizationId,
      userId: actor.id,
      eventType: AuditEventType.MEMO_SUBMITTED,
      entityType: 'Memo',
      entityId: memo.id,
      description: `Memo ${memo.memoNumber} submitted into a ${participants.length}-step workflow.`,
    })

    await notifyAssignmentAndTurn(tx, {
      organizationId: actor.organizationId,
      memo,
      steps,
      firstStep,
    })

    return { memoId: memo.id, cycle, firstStepId: firstStep.id }
  })
}

// ---------------------------------------------------------------------------
// Service: perform a workflow action
// ---------------------------------------------------------------------------

export async function performWorkflowAction(
  prisma: PrismaClient,
  actor: Actor,
  input: ActionInput,
) {
  const comment = validateActionComment(input.action, input.comment)

  return prisma.$transaction(async (tx) => {
    const memo = await tx.memo.findFirst({
      where: { id: input.memoId, organizationId: actor.organizationId },
      include: { author: { select: { id: true } } },
    })

    if (!memo) throw new WorkflowError('NOT_FOUND', 'Memo not found.')

    const steps = await tx.workflowStep.findMany({
      where: { memoId: memo.id, submissionCycle: memo.submissionCycle },
      orderBy: { position: 'asc' },
    })

    const currentStep = steps.find((s) => s.id === memo.currentStepId)
    const delegatorIds = await getActiveDelegatorIds(tx, actor)
    const onBehalfOfId = assertCanAct({ memo, step: currentStep, actor, delegatorIds })

    // currentStep is non-null past assertCanAct.
    const step = currentStep!
    const now = new Date()

    // A plain comment is not a turn-consuming action: record it and stop.
    if (input.action === StepActionType.COMMENT) {
      if (!comment) {
        throw new WorkflowError('INVALID_INPUT', 'A comment needs text.')
      }
      await recordAction(tx, { actor, memo, step, action: input.action, comment, onBehalfOfId })
      await tx.memo.update({ where: { id: memo.id }, data: { lastActivityAt: now } })
      return { status: memo.status, advancedTo: null as string | null }
    }

    await recordAction(tx, { actor, memo, step, action: input.action, comment, onBehalfOfId })

    await tx.workflowStep.update({
      where: { id: step.id },
      data: { state: StepState.COMPLETED },
    })

    switch (input.action) {
      case StepActionType.APPROVE:
      case StepActionType.REVIEW_COMPLETE: {
        const nextStep = steps.find((s) => s.position === step.position + 1)

        if (nextStep) {
          await tx.workflowStep.update({
            where: { id: nextStep.id },
            data: { state: StepState.CURRENT },
          })
          await tx.memo.update({
            where: { id: memo.id },
            data: {
              status: MemoStatus.PENDING_APPROVAL,
              currentStepId: nextStep.id,
              lastActivityAt: now,
            },
          })
          await writeAudit(tx, {
            organizationId: actor.organizationId,
            userId: actor.id,
            eventType: AuditEventType.WORKFLOW_APPROVAL,
            entityType: 'Memo',
            entityId: memo.id,
            description: `Step ${step.position} approved; memo ${memo.memoNumber} moved to step ${nextStep.position}.`,
          })
          await pushNotifications(tx, [
            {
              organizationId: actor.organizationId,
              userId: nextStep.assigneeId,
              memoId: memo.id,
              type: NotificationType.ACTION_REQUIRED,
              title: 'A memo needs your action',
              message: `${memo.memoNumber} — ${memo.subject}`,
            },
          ])
          return { status: MemoStatus.PENDING_APPROVAL, advancedTo: nextStep.id }
        }

        // Final approver.
        await tx.memo.update({
          where: { id: memo.id },
          data: {
            status: MemoStatus.APPROVED,
            currentStepId: null,
            completedAt: now,
            finalApproverId: step.assigneeId,
            lastActivityAt: now,
          },
        })
        await writeAudit(tx, {
          organizationId: actor.organizationId,
          userId: actor.id,
          eventType: AuditEventType.WORKFLOW_COMPLETED,
          entityType: 'Memo',
          entityId: memo.id,
          description: `Memo ${memo.memoNumber} approved at the final step.`,
        })
        await pushNotifications(
          tx,
          participantAudience(memo, steps).map((userId) => ({
            organizationId: actor.organizationId,
            userId,
            memoId: memo.id,
            type: NotificationType.WORKFLOW_COMPLETED,
            title: 'Memo approved',
            message: `${memo.memoNumber} — ${memo.subject}`,
          })),
        )
        return { status: MemoStatus.APPROVED, advancedTo: null }
      }

      case StepActionType.REJECT: {
        await skipRemainingSteps(tx, steps, step.position)
        await tx.memo.update({
          where: { id: memo.id },
          data: {
            status: MemoStatus.REJECTED,
            currentStepId: null,
            completedAt: now,
            lastActivityAt: now,
          },
        })
        await writeAudit(tx, {
          organizationId: actor.organizationId,
          userId: actor.id,
          eventType: AuditEventType.WORKFLOW_REJECTION,
          entityType: 'Memo',
          entityId: memo.id,
          description: `Memo ${memo.memoNumber} rejected at step ${step.position}.`,
        })
        await pushNotifications(
          tx,
          participantAudience(memo, steps).map((userId) => ({
            organizationId: actor.organizationId,
            userId,
            memoId: memo.id,
            type: NotificationType.MEMO_REJECTED,
            title: 'Memo rejected',
            message: `${memo.memoNumber} — ${memo.subject}`,
          })),
        )
        return { status: MemoStatus.REJECTED, advancedTo: null }
      }

      case StepActionType.REQUEST_CHANGES: {
        await skipRemainingSteps(tx, steps, step.position)
        await tx.memo.update({
          where: { id: memo.id },
          data: {
            status: MemoStatus.CHANGES_REQUESTED,
            currentStepId: null,
            lastActivityAt: now,
          },
        })
        await writeAudit(tx, {
          organizationId: actor.organizationId,
          userId: actor.id,
          eventType: AuditEventType.WORKFLOW_CHANGE_REQUEST,
          entityType: 'Memo',
          entityId: memo.id,
          description: `Changes requested on memo ${memo.memoNumber} at step ${step.position}.`,
        })
        await pushNotifications(tx, [
          {
            organizationId: actor.organizationId,
            userId: memo.authorId,
            memoId: memo.id,
            type: NotificationType.CHANGES_REQUESTED,
            title: 'Changes requested',
            message: `${memo.memoNumber} — ${memo.subject}`,
          },
        ])
        return { status: MemoStatus.CHANGES_REQUESTED, advancedTo: null }
      }

      default:
        throw new WorkflowError('INVALID_INPUT', 'Unsupported workflow action.')
    }
  })
}

// ---------------------------------------------------------------------------
// Service: resubmit after changes were requested
// ---------------------------------------------------------------------------

export async function resubmitMemo(
  prisma: PrismaClient,
  actor: Actor,
  input: { memoId: string; participants?: ParticipantInput[] },
) {
  return prisma.$transaction(async (tx) => {
    const memo = await tx.memo.findFirst({
      where: { id: input.memoId, organizationId: actor.organizationId },
    })

    if (!memo) throw new WorkflowError('NOT_FOUND', 'Memo not found.')
    if (memo.authorId !== actor.id) {
      throw new WorkflowError('FORBIDDEN', 'Only the author can resubmit this memo.')
    }
    if (memo.status !== MemoStatus.CHANGES_REQUESTED) {
      throw new WorkflowError('INVALID_STATE', 'Only a memo with changes requested can be resubmitted.')
    }

    // Reuse the previous cycle's participants unless the author supplied a new
    // sequence. The old cycle's rows stay exactly as they were.
    let participants: ParticipantInput[]
    if (input.participants?.length) {
      participants = validateParticipants(input.participants)
      await assertAssigneesAreValid(tx, actor.organizationId, participants)
    } else {
      const previous = await tx.workflowStep.findMany({
        where: { memoId: memo.id, submissionCycle: memo.submissionCycle },
        orderBy: { position: 'asc' },
      })
      participants = previous.map((s) => ({
        position: s.position,
        assigneeId: s.assigneeId,
        positionLabel: s.positionLabel,
      }))
    }

    const cycle = memo.submissionCycle + 1
    const versionNumber = memo.currentVersion + 1
    const now = new Date()

    await tx.memoVersion.create({
      data: {
        organizationId: actor.organizationId,
        memoId: memo.id,
        versionNumber,
        submissionCycle: cycle,
        subject: memo.subject,
        bodyHtml: memo.bodyHtml,
        priority: memo.priority,
        editedById: actor.id,
      },
    })

    const steps = await createCycleSteps(tx, {
      organizationId: actor.organizationId,
      memoId: memo.id,
      cycle,
      participants,
    })

    const firstStep = steps[0]

    await tx.memo.update({
      where: { id: memo.id },
      data: {
        status: MemoStatus.PENDING_APPROVAL,
        submissionCycle: cycle,
        currentVersion: versionNumber,
        currentStepId: firstStep.id,
        lastActivityAt: now,
      },
    })

    await tx.workflowAction.create({
      data: {
        organizationId: actor.organizationId,
        memoId: memo.id,
        submissionCycle: cycle,
        action: StepActionType.COMMENT,
        actorId: actor.id,
        comment: `Resubmitted as version ${versionNumber}.`,
      },
    })

    await writeAudit(tx, {
      organizationId: actor.organizationId,
      userId: actor.id,
      eventType: AuditEventType.MEMO_RESUBMITTED,
      entityType: 'Memo',
      entityId: memo.id,
      description: `Memo ${memo.memoNumber} resubmitted as version ${versionNumber}.`,
    })

    await notifyAssignmentAndTurn(tx, {
      organizationId: actor.organizationId,
      memo,
      steps,
      firstStep,
      resubmission: true,
    })

    return { memoId: memo.id, cycle, versionNumber, firstStepId: firstStep.id }
  })
}

// ---------------------------------------------------------------------------
// Service: cancel
// ---------------------------------------------------------------------------

export async function cancelMemo(prisma: PrismaClient, actor: Actor, memoId: string) {
  return prisma.$transaction(async (tx) => {
    const memo = await tx.memo.findFirst({
      where: { id: memoId, organizationId: actor.organizationId },
    })

    if (!memo) throw new WorkflowError('NOT_FOUND', 'Memo not found.')

    const isAuthor = memo.authorId === actor.id
    const isAdmin = actor.role === Role.ORG_ADMIN || actor.role === Role.SUPER_ADMIN
    if (!isAuthor && !isAdmin) {
      throw new WorkflowError('FORBIDDEN', 'You cannot cancel this memo.')
    }
    if (isMemoReadOnly(memo.status)) {
      throw new WorkflowError('INVALID_STATE', 'This memo has already finished its workflow.')
    }

    const steps = await tx.workflowStep.findMany({
      where: { memoId: memo.id, submissionCycle: memo.submissionCycle },
    })

    await skipRemainingSteps(tx, steps, 0)

    await tx.memo.update({
      where: { id: memo.id },
      data: {
        status: MemoStatus.CANCELLED,
        currentStepId: null,
        lastActivityAt: new Date(),
      },
    })

    await writeAudit(tx, {
      organizationId: actor.organizationId,
      userId: actor.id,
      eventType: AuditEventType.MEMO_CANCELLED,
      entityType: 'Memo',
      entityId: memo.id,
      description: `Memo ${memo.memoNumber} cancelled.`,
    })

    return { status: MemoStatus.CANCELLED }
  })
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function assertAssigneesAreValid(
  tx: Tx,
  organizationId: string,
  participants: ParticipantInput[],
) {
  const ids = Array.from(new Set(participants.map((p) => p.assigneeId)))

  const users = await tx.user.findMany({
    where: { id: { in: ids }, organizationId, status: 'ACTIVE' },
    select: { id: true },
  })

  if (users.length !== ids.length) {
    // Do not reveal which id failed, or whether it exists in another tenant.
    throw new WorkflowError('INVALID_INPUT', 'One or more workflow participants are not available.')
  }
}

async function createCycleSteps(
  tx: Tx,
  args: {
    organizationId: string
    memoId: string
    cycle: number
    participants: ParticipantInput[]
  },
) {
  await tx.workflowStep.createMany({
    data: args.participants.map((p) => ({
      organizationId: args.organizationId,
      memoId: args.memoId,
      submissionCycle: args.cycle,
      position: p.position,
      positionLabel: p.positionLabel ?? null,
      assigneeId: p.assigneeId,
      state: p.position === 1 ? StepState.CURRENT : StepState.PENDING,
    })),
  })

  return tx.workflowStep.findMany({
    where: { memoId: args.memoId, submissionCycle: args.cycle },
    orderBy: { position: 'asc' },
  })
}

async function skipRemainingSteps(
  tx: Tx,
  steps: { id: string; position: number; state: StepState }[],
  afterPosition: number,
) {
  const remaining = steps
    .filter((s) => s.position > afterPosition && s.state !== StepState.COMPLETED)
    .map((s) => s.id)

  if (remaining.length === 0) return

  await tx.workflowStep.updateMany({
    where: { id: { in: remaining } },
    data: { state: StepState.SKIPPED },
  })
}

async function recordAction(
  tx: Tx,
  args: {
    actor: Actor
    memo: { id: string; submissionCycle: number }
    step: { id: string; position: number }
    action: StepActionType
    comment: string | null
    onBehalfOfId: string | null
  },
) {
  await tx.workflowAction.create({
    data: {
      organizationId: args.actor.organizationId,
      memoId: args.memo.id,
      stepId: args.step.id,
      submissionCycle: args.memo.submissionCycle,
      position: args.step.position,
      action: args.action,
      actorId: args.actor.id,
      actedOnBehalfOfId: args.onBehalfOfId,
      comment: args.comment,
    },
  })

  if (args.comment) {
    await tx.comment.create({
      data: {
        organizationId: args.actor.organizationId,
        memoId: args.memo.id,
        authorId: args.actor.id,
        text: args.comment,
        type: commentTypeFor(args.action),
        workflowStepId: args.step.id,
      },
    })
  }
}

/** Author plus everyone assigned a step in the current cycle, deduplicated. */
function participantAudience(
  memo: { authorId: string },
  steps: { assigneeId: string }[],
): string[] {
  return Array.from(new Set([memo.authorId, ...steps.map((s) => s.assigneeId)]))
}

async function notifyAssignmentAndTurn(
  tx: Tx,
  args: {
    organizationId: string
    memo: { id: string; memoNumber: string; subject: string; authorId: string }
    steps: { id: string; assigneeId: string }[]
    firstStep: { id: string; assigneeId: string }
    resubmission?: boolean
  },
) {
  const label = `${args.memo.memoNumber} — ${args.memo.subject}`

  const assignments = args.steps
    .filter((s) => s.assigneeId !== args.firstStep.assigneeId)
    .map((s) => ({
      organizationId: args.organizationId,
      userId: s.assigneeId,
      memoId: args.memo.id,
      type: NotificationType.WORKFLOW_ASSIGNED,
      title: 'You are in a memo workflow',
      message: label,
    }))

  await pushNotifications(tx, [
    ...assignments,
    {
      organizationId: args.organizationId,
      userId: args.firstStep.assigneeId,
      memoId: args.memo.id,
      type: args.resubmission
        ? NotificationType.MEMO_RESUBMITTED
        : NotificationType.ACTION_REQUIRED,
      title: args.resubmission ? 'A memo was resubmitted' : 'A memo needs your action',
      message: label,
    },
  ])
}
