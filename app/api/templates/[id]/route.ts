// PATCH /api/templates/:id — administrators only. Rename, edit steps, or
// deactivate. Deactivating removes it from the composer's picker without
// touching memos that already used it.

import { NextResponse } from 'next/server'
import { handler, readJson } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { updateTemplate } from '@/lib/template'
import { tenantContext } from '@/lib/tenant'
import { updateTemplateSchema } from '@/lib/validation/template'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PATCH = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const user = await requireAdmin()
    const body = updateTemplateSchema.parse(await readJson(request))

    const template = await updateTemplate(tenantContext(user), id, {
      name: body.name,
      description: body.description || null,
      steps: body.steps,
      isActive: body.isActive,
    })

    return NextResponse.json({ id: template.id, name: template.name, isActive: template.isActive })
  },
)
