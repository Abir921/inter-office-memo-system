// PATCH /api/users/:id — administrators only. Assign department, designation,
// role. Email is never editable here (PRD 7.1: email/role changes only via an
// administrator, and even then email itself is not part of this form —
// changing an email a user signs in with belongs to a dedicated, audited flow
// this project has not built; renaming a login identity is out of scope).

import { NextResponse } from 'next/server'
import { handler, readJson } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { updateUser } from '@/lib/admin'
import { tenantContext } from '@/lib/tenant'
import { updateUserSchema } from '@/lib/validation/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PATCH = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const user = await requireAdmin()
    const body = updateUserSchema.parse(await readJson(request))

    const updated = await updateUser(tenantContext(user), id, {
      name: body.name,
      designation: body.designation || null,
      departmentId: body.departmentId ?? null,
      role: body.role,
    })

    return NextResponse.json({ id: updated.id, name: updated.name, role: updated.role })
  },
)
