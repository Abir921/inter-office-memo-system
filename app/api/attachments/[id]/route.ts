// DELETE /api/attachments/:id — soft delete, while the memo is still editable.

import { NextResponse } from 'next/server'
import { handler } from '@/lib/api'
import { softDeleteAttachment } from '@/lib/attachment'
import { requireSession } from '@/lib/auth'
import { tenantContext } from '@/lib/tenant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const DELETE = handler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const user = await requireSession()

    const result = await softDeleteAttachment(tenantContext(user), id)

    return NextResponse.json({ deleted: true, id: result.id })
  },
)
