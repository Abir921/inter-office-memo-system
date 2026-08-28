// GET  /api/categories   — any signed-in user (the memo composer reads these)
// POST /api/categories   — administrators only

import { NextResponse } from 'next/server'
import { handler, readJson } from '@/lib/api'
import { requireAdmin, requireSession } from '@/lib/auth'
import { createCategory } from '@/lib/admin'
import { scoped, tenantContext } from '@/lib/tenant'
import { createCategorySchema } from '@/lib/validation/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(async () => {
  const user = await requireSession()
  const db = scoped(tenantContext(user))

  const categories = await db.category.findMany({ orderBy: { name: 'asc' } })

  return NextResponse.json({ categories })
})

export const POST = handler(async (request: Request) => {
  const user = await requireAdmin()
  const body = createCategorySchema.parse(await readJson(request))

  const category = await createCategory(tenantContext(user), {
    name: body.name,
    description: body.description || null,
  })

  return NextResponse.json({ id: category.id, name: category.name }, { status: 201 })
})
