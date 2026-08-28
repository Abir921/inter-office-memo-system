// GET  /api/org    — any signed-in user (used to render org name in the shell)
// PATCH /api/org    — administrators only

import { NextResponse } from 'next/server'
import { handler, readJson } from '@/lib/api'
import { requireAdmin, requireSession } from '@/lib/auth'
import { updateOrganization } from '@/lib/admin'
import { tenantContext } from '@/lib/tenant'
import { updateOrganizationSchema } from '@/lib/validation/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(async () => {
  const user = await requireSession()
  return NextResponse.json({
    id: user.organizationId,
    name: user.organizationName,
    slug: user.organizationSlug,
  })
})

export const PATCH = handler(async (request: Request) => {
  const user = await requireAdmin()
  const body = updateOrganizationSchema.parse(await readJson(request))

  const org = await updateOrganization(tenantContext(user), {
    name: body.name,
    logoUrl: body.logoUrl || null,
    contactEmail: body.contactEmail || null,
    contactPhone: body.contactPhone || null,
    address: body.address || null,
  })

  return NextResponse.json({ id: org.id, name: org.name })
})
