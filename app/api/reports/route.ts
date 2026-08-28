// GET /api/reports?departmentId=&categoryId=&status=&from=&to=
//
// Administrators only. Everything here is an aggregate count, never a list of
// individual memos, so it carries no risk of surfacing a memo the caller
// should not see — but it is still tenant-scoped like everything else.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handler } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { buildReport } from '@/lib/reports'
import { scoped, tenantContext } from '@/lib/tenant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z.object({
  departmentId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  status: z
    .enum([
      'DRAFT',
      'SUBMITTED',
      'PENDING_REVIEW',
      'PENDING_APPROVAL',
      'CHANGES_REQUESTED',
      'APPROVED',
      'REJECTED',
      'CANCELLED',
    ])
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export const GET = handler(async (request: Request) => {
  const user = await requireAdmin()
  const db = scoped(tenantContext(user))

  const url = new URL(request.url)
  const filters = querySchema.parse(Object.fromEntries(url.searchParams))

  const report = await buildReport(db, filters)

  return NextResponse.json(report)
})
