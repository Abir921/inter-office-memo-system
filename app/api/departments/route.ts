// GET  /api/departments   — any signed-in user (used by the memo composer)
// POST /api/departments   — administrators only

import { NextResponse } from 'next/server'
import { handler, readJson } from '@/lib/api'
import { requireAdmin, requireSession } from '@/lib/auth'
import { createDepartment } from '@/lib/admin'
import { scoped, tenantContext } from '@/lib/tenant'
import { createDepartmentSchema } from '@/lib/validation/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(async () => {
  const user = await requireSession()
  const db = scoped(tenantContext(user))

  const departments = await db.department.findMany({
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ departments })
})

export const POST = handler(async (request: Request) => {
  const user = await requireAdmin()
  const body = createDepartmentSchema.parse(await readJson(request))

  const dept = await createDepartment(tenantContext(user), {
    name: body.name,
    description: body.description || null,
  })

  return NextResponse.json({ id: dept.id, name: dept.name }, { status: 201 })
})
