// GET  /api/users   — administrators only, list with search + filter (PRD 7.4)
// POST /api/users   — administrators only, create with a temporary password

import { NextResponse } from 'next/server'
import { handler, readJson } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { createUser } from '@/lib/admin'
import { scoped, tenantContext } from '@/lib/tenant'
import { createUserSchema, userListQuerySchema } from '@/lib/validation/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(async (request: Request) => {
  const user = await requireAdmin()
  const db = scoped(tenantContext(user))

  const url = new URL(request.url)
  const query = userListQuerySchema.parse(Object.fromEntries(url.searchParams))

  const users = await db.user.findMany({
    where: {
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      designation: true,
      role: true,
      status: true,
      lastLoginAt: true,
      department: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ users })
})

export const POST = handler(async (request: Request) => {
  const user = await requireAdmin()
  const body = createUserSchema.parse(await readJson(request))

  const created = await createUser(tenantContext(user), {
    name: body.name,
    email: body.email,
    designation: body.designation || null,
    departmentId: body.departmentId ?? null,
    role: body.role,
    password: body.password,
  })

  return NextResponse.json({ id: created.id, email: created.email }, { status: 201 })
})
