// GET /api/memos/:id/versions
//
// A snapshot is written on every submission and resubmission (lib/workflow.ts
// submitMemo/resubmitMemo). Historical versions are immutable — there is no
// PATCH or DELETE here, and none is planned.

import { NextResponse } from 'next/server'
import { handler, jsonError } from '@/lib/api'
import { requireSession } from '@/lib/auth'
import { visibleMemoWhere } from '@/lib/memo-queries'
import { scoped, tenantContext } from '@/lib/tenant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const user = await requireSession()
    const ctx = tenantContext(user)
    const db = scoped(ctx)

    // Same visibility rule as the memo itself: if you may not see the memo,
    // its version history does not exist for you either.
    const memo = await db.memo.findById(id, { where: visibleMemoWhere(ctx) })
    if (!memo) return jsonError(404, 'Not found.')

    const versions = await db.version.findMany({
      where: { memoId: id },
      orderBy: { versionNumber: 'asc' },
      include: { editedBy: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ versions })
  },
)
