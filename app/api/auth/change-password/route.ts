// POST /api/auth/change-password    { currentPassword, newPassword, confirmPassword }
//
// Requires the current password (PRD 7.1). A generic failure message either
// way: a wrong current password and a validation failure look identical to
// the client, so the endpoint cannot be used to test guesses against the
// account's real password without also getting the rest of the form right.

import { NextResponse } from 'next/server'
import { AuditEventType } from '@prisma/client'
import { handler, jsonError, readJson } from '@/lib/api'
import { writeAudit } from '@/lib/audit'
import { hashPassword, requireSession, verifyPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { changePasswordSchema } from '@/lib/validation/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = handler(async (request: Request) => {
  const user = await requireSession()
  const body = changePasswordSchema.parse(await readJson(request))

  const record = await prisma.user.findFirstOrThrow({
    where: { id: user.id, organizationId: user.organizationId },
    select: { id: true, passwordHash: true, name: true },
  })

  const currentIsCorrect = await verifyPassword(body.currentPassword, record.passwordHash)
  if (!currentIsCorrect) {
    return jsonError(400, 'That is not your current password.', {
      currentPassword: 'That is not your current password.',
    })
  }

  const newHash = await hashPassword(body.newPassword)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.id },
      data: { passwordHash: newHash, mustChangePassword: false },
    })

    await writeAudit(tx, {
      organizationId: user.organizationId,
      userId: user.id,
      eventType: AuditEventType.PASSWORD_CHANGED,
      entityType: 'User',
      entityId: user.id,
      description: record.name + ' changed their password.',
    })
  })

  return NextResponse.json({ ok: true })
})
