// POST /api/memos/:id/resubmit
//
// The author revises a memo that was sent back and puts it into the workflow
// again. lib/workflow.ts snapshots a new MemoVersion, increments the
// submission cycle, and writes a FRESH set of WorkflowStep rows. The previous
// cycle's steps and every WorkflowAction are left exactly as they were, which
// is what keeps the earlier round of decisions on the record.
//
// Participants are optional: omitting them reuses the previous routing.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handler, readJson } from '@/lib/api'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { participantsSchema } from '@/lib/validation/memo'
import { resubmitMemo } from '@/lib/workflow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({ participants: participantsSchema.optional() })

export const POST = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const user = await requireSession()
    const body = bodySchema.parse(await readJson(request))

    const result = await resubmitMemo(prisma, user, {
      memoId: id,
      participants: body.participants,
    })

    return NextResponse.json(result)
  },
)
