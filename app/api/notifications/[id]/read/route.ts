// POST /api/notifications/:id/read
//
// markRead scopes by organizationId AND userId, so an id belonging to another
// tenant, or to a colleague, matches zero rows rather than someone else's row.

import { NextResponse } from 'next/server'
import { handler } from '@/lib/api'
import { requireSession } from '@/lib/auth'
import { markRead } from '@/lib/notify'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = handler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const user = await requireSession()

    const count = await markRead(prisma, user.organizationId, user.id, id)

    return NextResponse.json({ updated: count })
  },
)
