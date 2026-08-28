// POST /api/notifications/read-all — marks every unread notification for the
// signed-in user as read. Scoped the same way as the single-item route.

import { NextResponse } from 'next/server'
import { handler } from '@/lib/api'
import { requireSession } from '@/lib/auth'
import { markRead } from '@/lib/notify'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = handler(async () => {
  const user = await requireSession()

  const count = await markRead(prisma, user.organizationId, user.id)

  return NextResponse.json({ updated: count })
})
