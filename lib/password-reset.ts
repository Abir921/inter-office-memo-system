// lib/password-reset.ts
//
// Single-use, 60-minute password reset tokens.
//
// The database stores a SHA-256 hash of the token, never the token itself, so
// a leaked database dump cannot be used to reset anybody's password. SHA-256
// rather than bcrypt here because the token is 256 bits of randomness — there
// is nothing to brute-force — and because a hash lookup must be indexed.
//
// Delivery: email is a P2 item and is not wired up. Outside production the
// link is returned to the caller so the flow can be demonstrated. In
// production it never is; an administrator resets the password instead.

import { createHash, randomBytes } from 'node:crypto'
import { AuditEventType, UserStatus } from '@prisma/client'
import { writeAudit } from './audit'
import { hashPassword } from './auth'
import { prisma } from './prisma'
import { PASSWORD_RESET_LIMIT, rateLimit } from './rate-limit'

const TOKEN_TTL_MINUTES = 60

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function canRevealResetLink(): boolean {
  return process.env.NODE_ENV !== 'production'
}

/**
 * Issues a reset token when the address belongs to an active user.
 *
 * Returns the raw token ONLY outside production. The caller must respond
 * identically whether or not a user was found — otherwise the endpoint becomes
 * a way to enumerate registered addresses.
 */
export async function issuePasswordResetToken(
  email: string,
): Promise<{ token: string | null }> {
  const normalizedEmail = email.trim().toLowerCase()

  // Checked before the user lookup, and fails the exact same way a "no such
  // account" does: the caller (app/(auth)/forgot-password/actions.ts) shows
  // the identical "if that address exists…" message either way, so being
  // over the limit is not observable from the response.
  if (!rateLimit('reset:' + normalizedEmail, PASSWORD_RESET_LIMIT.max, PASSWORD_RESET_LIMIT.windowMs).allowed) {
    return { token: null }
  }

  const user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      status: UserStatus.ACTIVE,
      organization: { isActive: true },
    },
    select: { id: true, organizationId: true, name: true },
  })

  if (!user) return { token: null }

  const token = randomBytes(32).toString('hex')

  await prisma.$transaction(async (tx) => {
    // Any outstanding token for this user is spent, so a second request
    // invalidates the first link rather than leaving two live.
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    })

    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
      },
    })

    await writeAudit(tx, {
      organizationId: user.organizationId,
      userId: user.id,
      eventType: AuditEventType.PASSWORD_RESET,
      entityType: 'User',
      entityId: user.id,
      description: 'A password reset link was requested for ' + user.name + '.',
    })
  })

  return { token: canRevealResetLink() ? token : null }
}

export type ResetOutcome =
  | { ok: true }
  | { ok: false; reason: 'invalid-or-expired' }

/** Consumes the token and sets the new password, in one transaction. */
export async function consumePasswordResetToken(
  token: string,
  newPassword: string,
): Promise<ResetOutcome> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { select: { id: true, name: true, organizationId: true, status: true } },
    },
  })

  const stillValid =
    record &&
    record.usedAt === null &&
    record.expiresAt > new Date() &&
    record.user.status === UserStatus.ACTIVE

  if (!stillValid) return { ok: false, reason: 'invalid-or-expired' }

  const passwordHash = await hashPassword(newPassword)

  await prisma.$transaction(async (tx) => {
    // Marking the token used is conditional on it still being unused, so two
    // simultaneous submissions cannot both succeed.
    const spent = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    if (spent.count === 0) throw new Error('token-already-used')

    await tx.user.update({
      where: { id: record.user.id },
      data: { passwordHash, mustChangePassword: false },
    })

    await writeAudit(tx, {
      organizationId: record.user.organizationId,
      userId: record.user.id,
      eventType: AuditEventType.PASSWORD_CHANGED,
      entityType: 'User',
      entityId: record.user.id,
      description: record.user.name + ' set a new password using a reset link.',
    })
  })

  return { ok: true }
}

/** Cheap pre-check so the reset form can refuse a dead link before asking. */
export async function isResetTokenUsable(token: string): Promise<boolean> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { usedAt: true, expiresAt: true },
  })
  return Boolean(record && record.usedAt === null && record.expiresAt > new Date())
}
