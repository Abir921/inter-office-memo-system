// GET  /api/delegations — every delegation the caller is party to, either
//      side (given or received). Any signed-in user; this is a self-service
//      feature, not an admin one.
// POST /api/delegations — create one. delegatorId is always the session
//      user, never a request field.

import { NextResponse } from 'next/server'
import { handler, readJson } from '@/lib/api'
import { requireSession } from '@/lib/auth'
import { createDelegation, DELEGATION_LIST_INCLUDE } from '@/lib/delegation'
import { scoped, tenantContext } from '@/lib/tenant'
import { createDelegationSchema } from '@/lib/validation/delegation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(async () => {
  const user = await requireSession()
  const db = scoped(tenantContext(user))

  const delegations = await db.delegation.findMany({
    where: { OR: [{ delegatorId: user.id }, { delegateId: user.id }] },
    orderBy: { createdAt: 'desc' },
    include: DELEGATION_LIST_INCLUDE,
  })

  return NextResponse.json({ delegations })
})

export const POST = handler(async (request: Request) => {
  const user = await requireSession()
  const body = createDelegationSchema.parse(await readJson(request))

  const delegation = await createDelegation(tenantContext(user), {
    delegateId: body.delegateId,
    startDate: body.startDate,
    endDate: body.endDate,
    reason: body.reason || null,
  })

  return NextResponse.json({ id: delegation.id }, { status: 201 })
})
