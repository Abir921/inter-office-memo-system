// lib/memo.ts
//
// Draft lifecycle: create, edit, delete. Everything from submission onward
// belongs to lib/workflow.ts and is not duplicated here.
//
// The memo number is generated inside the same transaction that creates the
// memo, using a per-organization, per-year counter. A global counter would let
// one tenant infer another's memo volume from the gaps in its own sequence.

import { AuditEventType, MemoStatus, Prisma } from '@prisma/client'
import { writeAudit } from './audit'
import { prisma } from './prisma'
import { isEffectivelyEmpty, sanitizeMemoBody } from './sanitize'
import { generateMemoNumber, WorkflowError, type Actor } from './workflow'

export interface MemoAuthor extends Actor {
  organizationSlug: string
}

export interface CreateMemoData {
  subject: string
  bodyHtml: string
  departmentId: string | null
  categoryId: string | null
  templateId: string | null
  priority: 'NORMAL' | 'HIGH' | 'URGENT'
}

/**
 * Confirms that every relation the author picked belongs to this organization.
 *
 * Without this a caller could post another tenant's departmentId and file a
 * memo against a department they cannot see. The ids arrive from the client,
 * so they are checked; only organizationId comes from the session.
 */
async function assertRelationsAreInTenant(
  tx: Prisma.TransactionClient,
  organizationId: string,
  data: Pick<CreateMemoData, 'departmentId' | 'categoryId' | 'templateId'>,
) {
  if (data.departmentId) {
    const found = await tx.department.findFirst({
      where: { id: data.departmentId, organizationId, isActive: true },
      select: { id: true },
    })
    if (!found) throw new WorkflowError('INVALID_INPUT', 'That department is not available.')
  }

  if (data.categoryId) {
    const found = await tx.memoCategory.findFirst({
      where: { id: data.categoryId, organizationId, isActive: true },
      select: { id: true },
    })
    if (!found) throw new WorkflowError('INVALID_INPUT', 'That category is not available.')
  }

  if (data.templateId) {
    const found = await tx.workflowTemplate.findFirst({
      where: { id: data.templateId, organizationId, isActive: true },
      select: { id: true },
    })
    if (!found) throw new WorkflowError('INVALID_INPUT', 'That workflow template is not available.')
  }
}

export async function createMemo(actor: MemoAuthor, input: CreateMemoData) {
  const bodyHtml = sanitizeMemoBody(input.bodyHtml)
  if (isEffectivelyEmpty(bodyHtml)) {
    throw new WorkflowError('INVALID_INPUT', 'Write the body of the memo.')
  }

  return prisma.$transaction(async (tx) => {
    await assertRelationsAreInTenant(tx, actor.organizationId, input)

    const memoNumber = await generateMemoNumber(tx, actor.organizationId, actor.organizationSlug)

    const memo = await tx.memo.create({
      data: {
        organizationId: actor.organizationId,
        memoNumber,
        subject: input.subject,
        bodyHtml,
        authorId: actor.id,
        departmentId: input.departmentId,
        categoryId: input.categoryId,
        templateId: input.templateId,
        priority: input.priority,
        status: MemoStatus.DRAFT,
        lastActivityAt: new Date(),
      },
    })

    await writeAudit(tx, {
      organizationId: actor.organizationId,
      userId: actor.id,
      eventType: AuditEventType.MEMO_CREATED,
      entityType: 'Memo',
      entityId: memo.id,
      description: 'Memo ' + memoNumber + ' created: ' + memo.subject,
    })

    return memo
  })
}

/**
 * Edits a memo the author still controls.
 *
 * DRAFT is freely editable. CHANGES_REQUESTED is editable because the memo has
 * been handed back for exactly that purpose; resubmission then snapshots the
 * result as a new version. Every other status is read-only to the author.
 */
export async function updateMemo(
  actor: Actor,
  memoId: string,
  input: Omit<CreateMemoData, 'templateId'>,
) {
  const bodyHtml = sanitizeMemoBody(input.bodyHtml)
  if (isEffectivelyEmpty(bodyHtml)) {
    throw new WorkflowError('INVALID_INPUT', 'Write the body of the memo.')
  }

  return prisma.$transaction(async (tx) => {
    const memo = await tx.memo.findFirst({
      where: { id: memoId, organizationId: actor.organizationId },
    })

    if (!memo) throw new WorkflowError('NOT_FOUND', 'Memo not found.')
    if (memo.authorId !== actor.id) {
      throw new WorkflowError('FORBIDDEN', 'Only the author can edit this memo.')
    }
    if (memo.status !== MemoStatus.DRAFT && memo.status !== MemoStatus.CHANGES_REQUESTED) {
      throw new WorkflowError(
        'INVALID_STATE',
        'This memo has been submitted and can no longer be edited.',
      )
    }

    await assertRelationsAreInTenant(tx, actor.organizationId, {
      ...input,
      templateId: null,
    })

    const updated = await tx.memo.update({
      where: { id: memo.id },
      data: {
        subject: input.subject,
        bodyHtml,
        departmentId: input.departmentId,
        categoryId: input.categoryId,
        priority: input.priority,
        lastActivityAt: new Date(),
      },
    })

    await writeAudit(tx, {
      organizationId: actor.organizationId,
      userId: actor.id,
      eventType: AuditEventType.MEMO_MODIFIED,
      entityType: 'Memo',
      entityId: memo.id,
      description: 'Memo ' + memo.memoNumber + ' edited.',
    })

    return updated
  })
}

/**
 * Deletes a draft. Only a draft: once a memo has entered a workflow it is part
 * of the record, and the way to stop it is to cancel it, not to erase it.
 */
export async function deleteDraft(actor: Actor, memoId: string) {
  return prisma.$transaction(async (tx) => {
    const memo = await tx.memo.findFirst({
      where: { id: memoId, organizationId: actor.organizationId },
    })

    if (!memo) throw new WorkflowError('NOT_FOUND', 'Memo not found.')
    if (memo.authorId !== actor.id) {
      throw new WorkflowError('FORBIDDEN', 'Only the author can delete this draft.')
    }
    if (memo.status !== MemoStatus.DRAFT) {
      throw new WorkflowError('INVALID_STATE', 'Only a draft can be deleted. Cancel it instead.')
    }

    // Written before the delete so the audit row survives it: AuditLog has no
    // foreign key to Memo, only a loose entityId, exactly so that the record of
    // a deletion outlives the thing deleted.
    await writeAudit(tx, {
      organizationId: actor.organizationId,
      userId: actor.id,
      eventType: AuditEventType.MEMO_MODIFIED,
      entityType: 'Memo',
      entityId: memo.id,
      description: 'Draft ' + memo.memoNumber + ' deleted before submission.',
    })

    await tx.memo.delete({ where: { id: memo.id } })

    return { memoNumber: memo.memoNumber }
  })
}

/** Everything the detail page needs, in one tenant-scoped read. */
export const MEMO_DETAIL_INCLUDE = {
  author: { select: { id: true, name: true, designation: true, email: true } },
  department: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  finalApprover: { select: { id: true, name: true, designation: true } },
} satisfies Prisma.MemoInclude
