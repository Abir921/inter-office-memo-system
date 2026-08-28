// PATCH /api/departments/:id — rename, edit description, or deactivate.
// Deactivation preserves historical memos and user links (PRD 7.3): this is
// a status flip, never a delete.

import { NextResponse } from 'next/server'
import { handler, readJson } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { updateDepartment } from '@/lib/admin'
import { tenantContext } from '@/lib/tenant'
import { updateDepartmentSchema } from '@/lib/validation/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PATCH = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const user = await requireAdmin()
    const body = updateDepartmentSchema.parse(await readJson(request))

    const dept = await updateDepartment(tenantContext(user), id, {
      name: body.name,
      description: body.description || null,
      isActive: body.isActive,
    })

    return NextResponse.json({ id: dept.id, name: dept.name, isActive: dept.isActive })
  },
)
