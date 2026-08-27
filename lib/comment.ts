// lib/comment.ts
//
// Plain comments, separate from workflow decisions.
//
// lib/workflow.ts records a COMMENT action too, but only from whoever's turn
// it is — that path is "I am the current approver and I want to say something
// without deciding yet". This one is for everybody else involved in the memo,
// at any point, which is what PRD 7.9 describes.
//
// Comments are append-only. There is deliberately no update or delete here,
// and no route that offers one.

import { AuditEventType, CommentType, NotificationType } from '@prisma/client'
import { writeAudit } from './audit'
import { prisma } from './prisma'
import { isAdminContext, type TenantContext } from './tenant'
import { WorkflowError } from './workflow'

/**
 * Who may speak on a memo: its author, anyone in its routing (in any
 * submission cycle), and organization administrators. Everybody else gets
 * NOT_FOUND rather than FORBIDDEN — they were not supposed to know it exists.
 */
export async function addComment(ctx: TenantContext, memoId: string, text: string) {
  return prisma.$transaction(async (tx) => {
    const memo = await tx.memo.findFirst({
      where: { id: memoId, organizationId: ctx.organizationId },
      select: {
        id: true,
        memoNumber: true,
        subject: true,
        authorId: true,
        status: true,
        currentStepId: true,
        steps: { select: { assigneeId: true } },
      },
    })

    if (!memo) throw new WorkflowError('NOT_FOUND', 'Memo not found.')

    // A draft is nobody's business but its author's, not even an admin's.
    if (memo.status === 'DRAFT') {
      if (memo.authorId !== ctx.userId) throw new WorkflowError('NOT_FOUND', 'Memo not found.')
      throw new WorkflowError('INVALID_STATE', 'A draft has no one to comment to yet.')
    }

    const participantIds = new Set(memo.steps.map((s) => s.assigneeId))
    const mayComment =
      memo.authorId === ctx.userId || participantIds.has(ctx.userId) || isAdminContext(ctx)

    if (!mayComment) throw new WorkflowError('NOT_FOUND', 'Memo not found.')

    const comment = await tx.comment.create({
      data: {
        organizationId: ctx.organizationId,
        memoId: memo.id,
        authorId: ctx.userId,
        text,
        type: CommentType.GENERAL,
      },
    })

    await tx.memo.update({
      where: { id: memo.id },
      data: { lastActivityAt: new Date() },
    })

    // Tell everyone involved except the person who just spoke.
    const audience = new Set<string>([memo.authorId, ...participantIds])
    audience.delete(ctx.userId)

    if (audience.size > 0) {
      const commenter = await tx.user.findUnique({
        where: { id: ctx.userId },
        select: { name: true },
      })

      await tx.notification.createMany({
        data: [...audience].map((userId) => ({
          organizationId: ctx.organizationId,
          userId,
          memoId: memo.id,
          type: NotificationType.COMMENT_ADDED,
          title: 'New comment on ' + memo.memoNumber,
          message: (commenter?.name ?? 'Someone') + ' commented on "' + memo.subject + '".',
        })),
      })
    }

    await writeAudit(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      eventType: AuditEventType.WORKFLOW_COMMENT,
      entityType: 'Memo',
      entityId: memo.id,
      description: 'Comment added to ' + memo.memoNumber + '.',
    })

    return comment
  })
}
