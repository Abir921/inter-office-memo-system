// lib/attachment.ts
//
// Attachments, in the order that matters: validate, then store the bytes, then
// record the row. If the bucket write fails there is no database row pointing
// at a file that does not exist; if the database write fails the orphaned
// object is removed again.

import { AuditEventType } from '@prisma/client'
import { writeAudit } from './audit'
import { prisma } from './prisma'
import { visibleMemoWhere } from './memo-queries'
import {
  putObject,
  removeObject,
  signedUrlFor,
  StorageError,
  validateUpload,
} from './storage'
import { isAdminContext, type TenantContext } from './tenant'
import { WorkflowError } from './workflow'

/** Attachments may be added while the author still controls the memo. */
const ATTACHABLE_STATUSES = ['DRAFT', 'CHANGES_REQUESTED'] as const

export async function addAttachment(ctx: TenantContext, memoId: string, file: File) {
  // Validate before touching the network. A 30 MB executable should never
  // reach the bucket, not even briefly.
  const validated = validateUpload(file)

  const memo = await prisma.memo.findFirst({
    where: { id: memoId, organizationId: ctx.organizationId },
    select: { id: true, memoNumber: true, authorId: true, status: true },
  })

  if (!memo) throw new WorkflowError('NOT_FOUND', 'Memo not found.')

  if (memo.authorId !== ctx.userId) {
    throw new WorkflowError('FORBIDDEN', 'Only the author can attach files to this memo.')
  }

  if (!ATTACHABLE_STATUSES.includes(memo.status as (typeof ATTACHABLE_STATUSES)[number])) {
    throw new WorkflowError(
      'INVALID_STATE',
      'This memo has been submitted. Files can only be attached while it is with you.',
    )
  }

  const existing = await prisma.attachment.count({
    where: { memoId: memo.id, isDeleted: false },
  })
  if (existing >= 10) {
    throw new StorageError(400, 'A memo can carry at most 10 attachments.')
  }

  const storageKey = await putObject(ctx.organizationId, file, validated.mimeType)

  try {
    return await prisma.$transaction(async (tx) => {
      const attachment = await tx.attachment.create({
        data: {
          organizationId: ctx.organizationId,
          memoId: memo.id,
          fileName: validated.fileName,
          storageKey,
          mimeType: validated.mimeType,
          sizeBytes: validated.sizeBytes,
          uploadedById: ctx.userId,
        },
      })

      await tx.memo.update({
        where: { id: memo.id },
        data: { lastActivityAt: new Date() },
      })

      await writeAudit(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        eventType: AuditEventType.ATTACHMENT_UPLOADED,
        entityType: 'Attachment',
        entityId: attachment.id,
        description:
          'Attached ' + validated.fileName + ' to memo ' + memo.memoNumber + '.',
      })

      return attachment
    })
  } catch (error) {
    // The bytes are already in the bucket but the row was not written. Remove
    // them rather than leave an object nothing references.
    await removeObject(storageKey)
    throw error
  }
}

/**
 * Resolves an attachment to a short-lived signed URL.
 *
 * The authorization decision happens HERE, against the memo, before any URL is
 * minted. The bucket is private, so possession of an attachment id is not
 * itself permission to read the file.
 */
export async function resolveDownload(ctx: TenantContext, attachmentId: string) {
  const attachment = await prisma.attachment.findFirst({
    where: {
      id: attachmentId,
      organizationId: ctx.organizationId,
      isDeleted: false,
      // The same visibility rule the memo list uses. An attachment on a memo
      // this user may not read is not found.
      memo: visibleMemoWhere(ctx),
    },
    select: {
      id: true,
      fileName: true,
      storageKey: true,
      mimeType: true,
      memo: { select: { id: true, memoNumber: true } },
    },
  })

  if (!attachment) throw new WorkflowError('NOT_FOUND', 'File not found.')

  const url = await signedUrlFor(attachment.storageKey, attachment.fileName)

  return { url, fileName: attachment.fileName, memoNumber: attachment.memo.memoNumber }
}

/**
 * Marks an attachment removed. The row and the object both stay: an attachment
 * that was on a memo when somebody approved it is part of what they approved,
 * and deleting it would rewrite that record.
 */
export async function softDeleteAttachment(ctx: TenantContext, attachmentId: string) {
  return prisma.$transaction(async (tx) => {
    const attachment = await tx.attachment.findFirst({
      where: { id: attachmentId, organizationId: ctx.organizationId, isDeleted: false },
      select: {
        id: true,
        fileName: true,
        uploadedById: true,
        memo: { select: { id: true, memoNumber: true, authorId: true, status: true } },
      },
    })

    if (!attachment) throw new WorkflowError('NOT_FOUND', 'File not found.')

    const mayRemove =
      attachment.uploadedById === ctx.userId ||
      attachment.memo.authorId === ctx.userId ||
      isAdminContext(ctx)

    if (!mayRemove) throw new WorkflowError('FORBIDDEN', 'You cannot remove this file.')

    if (!ATTACHABLE_STATUSES.includes(
      attachment.memo.status as (typeof ATTACHABLE_STATUSES)[number],
    )) {
      throw new WorkflowError(
        'INVALID_STATE',
        'This memo has been submitted. Its attachments are part of the record.',
      )
    }

    await tx.attachment.update({
      where: { id: attachment.id },
      data: { isDeleted: true },
    })

    await writeAudit(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      eventType: AuditEventType.ATTACHMENT_DELETED,
      entityType: 'Attachment',
      entityId: attachment.id,
      description:
        'Removed ' + attachment.fileName + ' from memo ' + attachment.memo.memoNumber + '.',
    })

    return { id: attachment.id }
  })
}
