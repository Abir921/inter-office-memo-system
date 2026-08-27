// POST /api/memos/:id/cancel — author or administrator withdraws a memo.

import { NextResponse } from 'next/server'
import { handler } from '@/lib/api'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cancelMemo } from '@/lib/workflow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = handler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const user = await requireSession()

    const result = await cancelMemo(prisma, user, id)

    return NextResponse.json(result)
  },
)
