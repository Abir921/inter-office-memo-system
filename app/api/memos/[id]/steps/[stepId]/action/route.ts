// POST /api/memos/:id/steps/:stepId/action    { action, comment }
//
// The turn check — "is it really this step's turn, and is this really the
// person sitting at it" — happens inside lib/workflow.ts, not here. This
// handler's own job is smaller: confirm the step in the URL is the step the
// memo is actually waiting on, so a stale action panel produces a clear error
// instead of silently acting on the wrong step.
//
// Handler order per CLAUDE.md section 5 rule 3:
//   session (401) -> tenant-scoped fetch (404) -> business rule (403/409)
//   -> Zod (400) -> transactional write (the service) -> response.

import { NextResponse } from 'next/server'
import { handler, jsonError, readJson } from '@/lib/api'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { workflowActionSchema } from '@/lib/validation/memo'
import { performWorkflowAction } from '@/lib/workflow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = handler(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string; stepId: string }> },
  ) => {
    const { id, stepId } = await params
    const user = await requireSession()
    const body = workflowActionSchema.parse(await readJson(request))

    // Tenant-scoped read, ahead of the service, purely to give a step-mismatch
    // its own message. performWorkflowAction re-derives the current step from
    // memo.currentStepId itself and does not trust this value.
    const memo = await prisma.memo.findFirst({
      where: { id, organizationId: user.organizationId },
      select: { currentStepId: true },
    })

    if (!memo) return jsonError(404, 'Memo not found.')

    if (memo.currentStepId !== stepId) {
      return jsonError(
        409,
        'This memo has moved on since the page was loaded. Refresh to see its current step.',
      )
    }

    const result = await performWorkflowAction(prisma, user, {
      memoId: id,
      action: body.action,
      comment: body.comment,
    })

    return NextResponse.json(result)
  },
)
