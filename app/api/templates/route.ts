// GET  /api/templates   — any signed-in user (the memo composer reads these)
// POST /api/templates   — administrators only

import { NextResponse } from 'next/server'
import { handler, readJson } from '@/lib/api'
import { requireAdmin, requireSession } from '@/lib/auth'
import { createTemplate } from '@/lib/template'
import { scoped, tenantContext } from '@/lib/tenant'
import { createTemplateSchema } from '@/lib/validation/template'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(async () => {
  const user = await requireSession()
  const db = scoped(tenantContext(user))

  const templates = await db.template.findMany({
    orderBy: { name: 'asc' },
    include: { steps: { orderBy: { position: 'asc' } } },
  })

  return NextResponse.json({ templates })
})

export const POST = handler(async (request: Request) => {
  const user = await requireAdmin()
  const body = createTemplateSchema.parse(await readJson(request))

  const template = await createTemplate(tenantContext(user), {
    name: body.name,
    description: body.description || null,
    steps: body.steps,
  })

  return NextResponse.json({ id: template.id, name: template.name }, { status: 201 })
})
