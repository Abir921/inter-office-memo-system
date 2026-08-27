// POST /api/memos/:id/submit
//
// Turns a draft into a live memo. All transition logic lives in
// lib/workflow.ts; this handler validates, calls the service, returns.

import { NextResponse } from 'next/server'
import { handler, readJson } from '@/lib/api'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { submitMemoSchema } from '@/lib/validation/memo'
import { submitMemo } from '@/lib/workflow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const user = await requireSession()
    const body = submitMemoSchema.parse(await readJson(request))

    const result = await submitMemo(prisma, user, {
      memoId: id,
      participants: body.participants,
      templateId: body.templateId,
    })

    return NextResponse.json(result)
  },
)
