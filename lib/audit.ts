// lib/audit.ts
//
// Append-only audit trail. There is deliberately no update or delete helper,
// and no API route may expose one.

import { AuditEventType, Prisma, PrismaClient } from '@prisma/client'

type Db = Prisma.TransactionClient | PrismaClient

export interface AuditInput {
  organizationId: string
  userId?: string | null
  eventType: AuditEventType
  entityType?: string | null
  entityId?: string | null
  description: string
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Prisma.InputJsonValue
}

/**
 * Call inside the same transaction as the mutation being recorded, so a failed
 * write never leaves an audit row claiming it succeeded.
 */
export async function writeAudit(db: Db, input: AuditInput): Promise<void> {
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      eventType: input.eventType,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      description: input.description,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata,
    },
  })
}

/** Convenience for request handlers: pulls client metadata off the request. */
export function auditContextFromRequest(request: Request) {
  return {
    ipAddress:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  }
}
