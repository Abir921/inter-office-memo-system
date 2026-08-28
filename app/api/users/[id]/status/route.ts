// PATCH /api/users/:id/status — activate or deactivate. An administrator
// cannot deactivate themself, and cannot deactivate the organization's last
// active administrator (see lib/admin.ts setUserStatus).

import { NextResponse } from 'next/server'
import { handler, readJson } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { setUserStatus } from '@/lib/admin'
import { tenantContext } from '@/lib/tenant'
import { updateUserStatusSchema } from '@/lib/validation/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PATCH = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const user = await requireAdmin()
    const body = updateUserStatusSchema.parse(await readJson(request))

    const updated = await setUserStatus(tenantContext(user), id, body.status)

    return NextResponse.json({ id: updated.id, status: updated.status })
  },
)
