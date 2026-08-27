// GET  /api/memos?scope=inbox|sent|completed|all&filters...
// POST /api/memos
//
// Handler order, per CLAUDE.md section 5 rule 3:
//   session (401) -> role (403) -> tenant-scoped fetch (404) -> business rule
//   (403) -> Zod (400) -> transactional write + audit -> response.

import { NextResponse } from 'next/server'
import { handler, readJson } from '@/lib/api'
import { requireSession } from '@/lib/auth'
import { createMemo } from '@/lib/memo'
import { MEMO_LIST_SELECT, memoScopeWhere } from '@/lib/memo-queries'
import { scoped, tenantContext } from '@/lib/tenant'
import { createMemoSchema, memoListQuerySchema } from '@/lib/validation/memo'
import { getActiveDelegatorIds, submitMemo } from '@/lib/workflow'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(async (request: Request) => {
  const user = await requireSession()
  const ctx = tenantContext(user)
  const db = scoped(ctx)

  const url = new URL(request.url)
  const query = memoListQuerySchema.parse(Object.fromEntries(url.searchParams))

  // A delegate sees the inbox of whoever delegated to them.
  const delegatorIds =
    query.scope === 'inbox' ? await getActiveDelegatorIds(prisma, user) : []

  const where = memoScopeWhere(ctx, query.scope, query, delegatorIds)

  const [rows, total] = await Promise.all([
    db.memo.findMany({
      where,
      select: MEMO_LIST_SELECT,
      orderBy:
        query.scope === 'inbox'
          ? { submittedAt: 'asc' } // longest-waiting first
          : { lastActivityAt: 'desc' },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
    }),
    db.memo.count(where),
  ])

  return NextResponse.json({
    memos: rows,
    page: query.page,
    perPage: query.perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.perPage)),
  })
})

export const POST = handler(async (request: Request) => {
  const user = await requireSession()
  const body = createMemoSchema.parse(await readJson(request))

  // organizationId comes from the session. If the body carried one, it was
  // discarded by the schema before reaching here.
  const memo = await createMemo(
    {
      id: user.id,
      organizationId: user.organizationId,
      organizationSlug: user.organizationSlug,
      role: user.role,
    },
    {
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      departmentId: body.departmentId ?? user.departmentId,
      categoryId: body.categoryId,
      templateId: body.templateId,
      priority: body.priority,
    },
  )

  // "Save as draft or submit directly" (PRD 7.5). Submitting runs the workflow
  // service, which creates the step rows and notifies the first approver.
  if (body.participants?.length) {
    await submitMemo(prisma, user, {
      memoId: memo.id,
      participants: body.participants,
      templateId: body.templateId,
    })
  }

  return NextResponse.json(
    { id: memo.id, memoNumber: memo.memoNumber, submitted: Boolean(body.participants?.length) },
    { status: 201 },
  )
})
