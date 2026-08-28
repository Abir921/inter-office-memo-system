// PATCH /api/profile
//
// A user edits their own name and designation. Email and role are
// administrator-only fields (PRD 7.1) and are not accepted here — there is no
// path in this handler that can change them, not even a silently ignored one.

import { NextResponse } from 'next/server'
import { AuditEventType } from '@prisma/client'
import { handler, readJson } from '@/lib/api'
import { writeAudit } from '@/lib/audit'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateProfileSchema } from '@/lib/validation/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PATCH = handler(async (request: Request) => {
  const user = await requireSession()
  const body = updateProfileSchema.parse(await readJson(request))

  await prisma.$transaction(async (tx) => {
    // updateMany, scoped to (this user's id AND their organization), rather
    // than update-by-id: the same defence-in-depth pattern as lib/tenant.ts,
    // even though the session already guarantees the id is this user's own.
    await tx.user.updateMany({
      where: { id: user.id, organizationId: user.organizationId },
      data: {
        name: body.name,
        designation: body.designation || null,
      },
    })

    await writeAudit(tx, {
      organizationId: user.organizationId,
      userId: user.id,
      eventType: AuditEventType.USER_UPDATED,
      entityType: 'User',
      entityId: user.id,
      description: user.name + ' updated their profile.',
    })
  })

  return NextResponse.json({ ok: true })
})
