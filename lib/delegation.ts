// lib/delegation.ts
//
// Delegation (PRD 7.20, P2). The turn-check and inbox scoping have honoured
// an active delegation since the workflow engine was written
// (lib/workflow.ts's getActiveDelegatorIds, assertCanAct's delegatorIds
// parameter) — this module is only the missing other half: letting someone
// actually create and cancel one. "Active" is never written to the row and
// left there; it is always computed at query time from status and the date
// range, so nothing here needs a background job to keep it truthful.

import { AuditEventType, DelegationStatus, Prisma, UserStatus } from '@prisma/client'
import { writeAudit } from './audit'
import { prisma } from './prisma'
import { isAdminContext, type TenantContext } from './tenant'

export class DelegationError extends Error {
  httpStatus: number
  fields?: Record<string, string>
  constructor(httpStatus: number, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'DelegationError'
    this.httpStatus = httpStatus
    this.fields = fields
  }
}

export interface CreateDelegationData {
  delegateId: string
  startDate: string
  endDate: string
  reason: string | null
}

/**
 * A delegation always speaks for the caller — `delegatorId` is the session
 * user, never a client-supplied field. Nobody delegates someone else's
 * authority on their behalf, not even an admin (an admin's own recourse is
 * to reassign or cancel, not to grant, on somebody else's behalf).
 */
export async function createDelegation(ctx: TenantContext, input: CreateDelegationData) {
  if (input.delegateId === ctx.userId) {
    throw new DelegationError(400, 'You cannot delegate to yourself.', {
      delegateId: 'You cannot delegate to yourself.',
    })
  }

  const delegate = await prisma.user.findFirst({
    where: { id: input.delegateId, organizationId: ctx.organizationId, status: UserStatus.ACTIVE },
    select: { id: true, name: true },
  })
  if (!delegate) {
    throw new DelegationError(400, 'That colleague is not available.', {
      delegateId: 'That colleague is not available.',
    })
  }

  return prisma.$transaction(async (tx) => {
    const delegation = await tx.delegation.create({
      data: {
        organizationId: ctx.organizationId,
        delegatorId: ctx.userId,
        delegateId: input.delegateId,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        reason: input.reason || null,
      },
      include: { delegate: { select: { name: true } } },
    })

    await writeAudit(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      eventType: AuditEventType.DELEGATION_CREATED,
      entityType: 'Delegation',
      entityId: delegation.id,
      description: 'Delegated workflow authority to ' + delegate.name + '.',
    })

    return delegation
  })
}

/** The delegator, or an admin standing in for them, may end it early. */
export async function cancelDelegation(ctx: TenantContext, id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.delegation.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: { delegate: { select: { name: true } } },
    })
    if (!existing) throw new DelegationError(404, 'Delegation not found.')

    if (existing.delegatorId !== ctx.userId && !isAdminContext(ctx)) {
      throw new DelegationError(403, 'You cannot cancel this delegation.')
    }
    if (existing.status === DelegationStatus.CANCELLED) {
      throw new DelegationError(409, 'This delegation has already been cancelled.')
    }

    const updated = await tx.delegation.update({
      where: { id },
      data: { status: DelegationStatus.CANCELLED },
    })

    await writeAudit(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      eventType: AuditEventType.DELEGATION_CANCELLED,
      entityType: 'Delegation',
      entityId: id,
      description: 'Delegation to ' + existing.delegate.name + ' cancelled.',
    })

    return updated
  })
}

export type DelegationDisplayStatus = 'ACTIVE' | 'UPCOMING' | 'EXPIRED' | 'CANCELLED'

/**
 * The row's own `status` column only ever holds ACTIVE or CANCELLED —
 * EXPIRED is never written back, only computed here for display, from the
 * same date-range logic lib/workflow.ts's getActiveDelegatorIds already uses
 * to decide whether a delegation actually grants anything right now.
 */
export function displayStatus(d: { status: DelegationStatus; startDate: Date; endDate: Date }): DelegationDisplayStatus {
  if (d.status === DelegationStatus.CANCELLED) return 'CANCELLED'
  const now = Date.now()
  if (d.endDate.getTime() < now) return 'EXPIRED'
  if (d.startDate.getTime() > now) return 'UPCOMING'
  return 'ACTIVE'
}

export const DELEGATION_LIST_INCLUDE = {
  delegator: { select: { id: true, name: true } },
  delegate: { select: { id: true, name: true } },
} satisfies Prisma.DelegationInclude
