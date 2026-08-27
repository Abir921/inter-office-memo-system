'use server'

import { redirect } from 'next/navigation'
import { AuditEventType } from '@prisma/client'
import { writeAudit } from '@/lib/audit'
import { getSessionUser, signOut } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function signOutAction() {
  const user = await getSessionUser()

  if (user) {
    await writeAudit(prisma, {
      organizationId: user.organizationId,
      userId: user.id,
      eventType: AuditEventType.USER_LOGOUT,
      entityType: 'User',
      entityId: user.id,
      description: user.name + ' signed out.',
    })
  }

  // Clears the session cookie server-side.
  await signOut({ redirect: false })
  redirect('/login')
}
