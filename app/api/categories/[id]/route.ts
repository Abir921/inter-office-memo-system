// PATCH /api/categories/:id — rename, edit description, or deactivate.
// Deactivation, never a hard delete — memos already filed under a category
// keep it.

import { NextResponse } from 'next/server'
import { handler, readJson } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { updateCategory } from '@/lib/admin'
import { tenantContext } from '@/lib/tenant'
import { updateCategorySchema } from '@/lib/validation/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PATCH = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const user = await requireAdmin()
    const body = updateCategorySchema.parse(await readJson(request))

    const category = await updateCategory(tenantContext(user), id, {
      name: body.name,
      description: body.description || null,
      isActive: body.isActive,
    })

    return NextResponse.json({ id: category.id, name: category.name, isActive: category.isActive })
  },
)
