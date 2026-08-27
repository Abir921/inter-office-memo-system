// POST /api/memos/:id/comments — append-only. No PATCH, no DELETE, by design.

import { NextResponse } from 'next/server'
import { handler, readJson } from '@/lib/api'
import { requireSession } from '@/lib/auth'
import { addComment } from '@/lib/comment'
import { tenantContext } from '@/lib/tenant'
import { commentSchema } from '@/lib/validation/memo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const user = await requireSession()
    const body = commentSchema.parse(await readJson(request))

    const comment = await addComment(tenantContext(user), id, body.text)

    return NextResponse.json({ id: comment.id, createdAt: comment.createdAt }, { status: 201 })
  },
)
