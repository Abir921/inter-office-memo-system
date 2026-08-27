// POST /api/memos/:id/attachments — multipart upload.
//
// Validation is server-side and covers extension AND declared MIME type; the
// file is stored under a random UUID key in a private bucket.

import { NextResponse } from 'next/server'
import { handler, jsonError } from '@/lib/api'
import { addAttachment } from '@/lib/attachment'
import { requireSession } from '@/lib/auth'
import { isStorageConfigured } from '@/lib/storage'
import { tenantContext } from '@/lib/tenant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const user = await requireSession()

    if (!isStorageConfigured()) {
      return jsonError(503, 'File storage is not configured on this deployment.')
    }

    const form = await request.formData().catch(() => null)
    const file = form?.get('file')

    if (!(file instanceof File)) {
      return jsonError(400, 'Choose a file to attach.')
    }

    const attachment = await addAttachment(tenantContext(user), id, file)

    return NextResponse.json(
      {
        id: attachment.id,
        fileName: attachment.fileName,
        sizeBytes: attachment.sizeBytes,
      },
      { status: 201 },
    )
  },
)
