// GET /api/attachments/:id/download
//
// Authorization runs against the MEMO before any URL is issued. The bucket is
// private, so holding an attachment id is not permission to read the file, and
// the signed URL that is finally handed out expires in sixty seconds.

import { NextResponse } from 'next/server'
import { handler } from '@/lib/api'
import { resolveDownload } from '@/lib/attachment'
import { requireSession } from '@/lib/auth'
import { tenantContext } from '@/lib/tenant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const user = await requireSession()

    const { url } = await resolveDownload(tenantContext(user), id)

    // 302 to the signed URL rather than proxying the bytes: the file never
    // passes through the serverless function, and the link dies in a minute.
    return NextResponse.redirect(url, 302)
  },
)
