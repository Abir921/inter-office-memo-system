// PATCH /api/delegations/:id   { status: "CANCELLED" }
//
// The only client-initiated transition. EXPIRED is derived at display time
// (lib/delegation.ts displayStatus), never written by any route.

import { NextResponse } from 'next/server'
import { handler, readJson } from '@/lib/api'
import { cancelDelegation } from '@/lib/delegation'
import { requireSession } from '@/lib/auth'
import { tenantContext } from '@/lib/tenant'
import { updateDelegationStatusSchema } from '@/lib/validation/delegation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PATCH = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const user = await requireSession()
    updateDelegationStatusSchema.parse(await readJson(request))

    const delegation = await cancelDelegation(tenantContext(user), id)

    return NextResponse.json({ id: delegation.id, status: delegation.status })
  },
)
