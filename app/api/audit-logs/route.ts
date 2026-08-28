// GET /api/audit-logs?eventType=&userId=&from=&to=&page=
//
// Administrators only. AuditLog is append-only — this route is read-only by
// design; there is no PATCH or DELETE for this model anywhere in the app.

import { NextResponse } from 'next/server'
import { AuditEventType } from '@prisma/client'
import { z } from 'zod'
import { handler } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { scoped, tenantContext } from '@/lib/tenant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PER_PAGE = 50

const querySchema = z.object({
  eventType: z.nativeEnum(AuditEventType).optional(),
  userId: z.string().cuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
})

export const GET = handler(async (request: Request) => {
  const user = await requireAdmin()
  const db = scoped(tenantContext(user))

  const url = new URL(request.url)
  const query = querySchema.parse(Object.fromEntries(url.searchParams))

  const where = {
    ...(query.eventType ? { eventType: query.eventType } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { user: { select: { id: true, name: true } } },
    }),
    db.auditLog.count(where),
  ])

  return NextResponse.json({
    logs,
    page: query.page,
    perPage: PER_PAGE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PER_PAGE)),
  })
})
