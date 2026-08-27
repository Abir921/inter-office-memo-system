// GET    /api/memos/:id
// PATCH  /api/memos/:id     (author, while DRAFT or CHANGES_REQUESTED)
// DELETE /api/memos/:id     (author, DRAFT only)

import { NextResponse } from 'next/server'
import { handler, jsonError, readJson } from '@/lib/api'
import { requireSession } from '@/lib/auth'
import { deleteDraft, MEMO_DETAIL_INCLUDE, updateMemo } from '@/lib/memo'
import { visibleMemoWhere } from '@/lib/memo-queries'
import { scoped, tenantContext } from '@/lib/tenant'
import { updateMemoSchema } from '@/lib/validation/memo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export const GET = handler(async (_request: Request, { params }: Params) => {
  const { id } = await params
  const user = await requireSession()
  const ctx = tenantContext(user)
  const db = scoped(ctx)

  // Tenant-scoped AND authorization-scoped. A memo belonging to another
  // organization, or to a colleague this user has no part in, is simply not
  // found — never a 403, which would confirm that it exists.
  const memo = await db.memo.findById(id, {
    where: visibleMemoWhere(ctx),
    include: MEMO_DETAIL_INCLUDE,
  })

  if (!memo) return jsonError(404, 'Not found.')

  return NextResponse.json({ memo })
})

export const PATCH = handler(async (request: Request, { params }: Params) => {
  const { id } = await params
  const user = await requireSession()
  const body = updateMemoSchema.parse(await readJson(request))

  // updateMemo re-fetches under the tenant filter and enforces authorship and
  // status itself, so there is no window between the check and the write.
  const memo = await updateMemo(user, id, {
    subject: body.subject,
    bodyHtml: body.bodyHtml,
    departmentId: body.departmentId,
    categoryId: body.categoryId,
    priority: body.priority,
  })

  return NextResponse.json({ id: memo.id, memoNumber: memo.memoNumber })
})

export const DELETE = handler(async (_request: Request, { params }: Params) => {
  const { id } = await params
  const user = await requireSession()

  const result = await deleteDraft(user, id)

  return NextResponse.json({ deleted: true, memoNumber: result.memoNumber })
})
