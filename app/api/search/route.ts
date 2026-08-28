// GET /api/search?q=...&status=...&priority=...&departmentId=...&categoryId=...&from=...&to=...
//
// The JSON counterpart to the /search page — same query builder, same two
// layers of scoping (tenant, then authorization), so a script hitting this
// endpoint directly gets exactly what the page shows and nothing more.

import { NextResponse } from 'next/server'
import { handler } from '@/lib/api'
import { requireSession } from '@/lib/auth'
import { MEMO_LIST_SELECT, memoScopeWhere } from '@/lib/memo-queries'
import { scoped, tenantContext } from '@/lib/tenant'
import { memoListQuerySchema } from '@/lib/validation/memo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(async (request: Request) => {
  const user = await requireSession()
  const ctx = tenantContext(user)
  const db = scoped(ctx)

  const url = new URL(request.url)
  const query = memoListQuerySchema.parse({ ...Object.fromEntries(url.searchParams), scope: 'all' })

  const where = memoScopeWhere(ctx, 'all', query)

  const [memos, total] = await Promise.all([
    db.memo.findMany({
      where,
      select: MEMO_LIST_SELECT,
      orderBy: { lastActivityAt: 'desc' },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
    }),
    db.memo.count(where),
  ])

  return NextResponse.json({
    memos,
    page: query.page,
    perPage: query.perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.perPage)),
  })
})
