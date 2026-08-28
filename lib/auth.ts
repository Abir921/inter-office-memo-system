// lib/auth.ts
//
// Session handling and the authorization helpers used by every page and route
// handler. Runs on Node (it needs Prisma and bcrypt).
//
// Rule: `organizationId` originates HERE, from the session, and nowhere else.
// If a request body or query string contains one, it is ignored.

import { AuditEventType, Role, UserStatus, type User } from '@prisma/client'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { writeAudit } from './audit'
import { authConfig } from './auth.config'
import { LOGIN_LIMIT, rateLimit } from './rate-limit'
import { prisma } from './prisma'
import type { Actor } from './workflow'

/**
 * A bcrypt hash of a value nobody knows, compared against when no user matches
 * so that a wrong email and a wrong password take the same amount of time.
 * Without it, response timing tells an attacker which emails are registered.
 */
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO3Zx8bDlKQqvUL0zvJt1TzE9RCFhVQFy'

export const BCRYPT_COST = 12

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        organizationId: { label: 'Organization', type: 'text' },
      },

      async authorize(credentials) {
        const email = String(credentials?.email ?? '').trim().toLowerCase()
        const password = String(credentials?.password ?? '')
        const organizationId = credentials?.organizationId
          ? String(credentials.organizationId)
          : undefined

        if (!email || !password) return null

        // Defence in depth: the login action (app/(auth)/login/actions.ts)
        // checks this same limit before ever reaching signIn(), and shows the
        // caller a friendly "try again in N minutes" message. This check
        // exists for whoever calls the NextAuth credentials endpoint directly,
        // bypassing the action entirely — it fails the same generic way as a
        // wrong password, since a direct API caller gets no custom messaging
        // either way.
        if (!rateLimit('login:' + email, LOGIN_LIMIT.max, LOGIN_LIMIT.windowMs).allowed) {
          return null
        }

        // Email is unique per organization, not globally, so this can match
        // more than one row. The login server action resolves which one before
        // calling signIn; by the time we get here it is unambiguous.
        const candidates = await prisma.user.findMany({
          where: {
            email,
            status: UserStatus.ACTIVE, // inactive users cannot sign in
            ...(organizationId ? { organizationId } : {}),
            organization: { isActive: true },
          },
          include: {
            organization: { select: { id: true, name: true, slug: true } },
          },
          take: 5,
        })

        if (candidates.length === 0) {
          await bcrypt.compare(password, DUMMY_HASH) // equalise timing
          return null
        }

        let matched: (typeof candidates)[number] | null = null
        for (const candidate of candidates) {
          if (await bcrypt.compare(password, candidate.passwordHash)) {
            // Two organizations, same email, same password: refuse rather than
            // guess which desk this person is sitting at.
            if (matched) return null
            matched = candidate
          }
        }

        if (!matched) return null
        // Bind to a const so the type stays narrowed inside the closure below.
        const user = matched

        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
          await writeAudit(tx, {
            organizationId: user.organizationId,
            userId: user.id,
            eventType: AuditEventType.USER_LOGIN,
            entityType: 'User',
            entityId: user.id,
            description: `${user.name} signed in.`,
          })
        })

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatarUrl,
          organizationId: user.organizationId,
          organizationSlug: user.organization.slug,
          organizationName: user.organization.name,
          role: user.role,
          departmentId: user.departmentId,
          designation: user.designation,
          mustChangePassword: user.mustChangePassword,
        }
      },
    }),
  ],
})

// ---------------------------------------------------------------------------
// Authorization helpers
// ---------------------------------------------------------------------------

/** Thrown by the require* helpers; route handlers turn it into a response. */
export class AuthError extends Error {
  httpStatus: number
  constructor(httpStatus: number, message: string) {
    super(message)
    this.name = 'AuthError'
    this.httpStatus = httpStatus
  }
}

export interface SessionUser extends Actor {
  name: string
  email: string
  organizationSlug: string
  organizationName: string
  departmentId: string | null
  designation: string | null
  mustChangePassword: boolean
}

/**
 * The session for the current request, or null.
 *
 * Re-checks the user against the database rather than trusting the token
 * alone. A JWT is valid until it expires, so without this an administrator
 * could deactivate someone and they would keep working for the rest of the
 * day. One indexed primary-key lookup is worth that.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  const user = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      organizationId: session.user.organizationId,
      status: UserStatus.ACTIVE,
      organization: { isActive: true },
    },
    include: { organization: { select: { name: true, slug: true } } },
  })

  if (!user) return null

  return {
    id: user.id,
    organizationId: user.organizationId,
    role: user.role,
    name: user.name,
    email: user.email,
    organizationSlug: user.organization.slug,
    organizationName: user.organization.name,
    departmentId: user.departmentId,
    designation: user.designation,
    mustChangePassword: user.mustChangePassword,
  }
}

/** Route-handler guard. Throws a 401 when there is no valid session. */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new AuthError(401, 'Sign in to continue.')
  return user
}

/** Route-handler guard for administrator-only endpoints. Throws 401 then 403. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireSession()
  if (user.role !== Role.ORG_ADMIN && user.role !== Role.SUPER_ADMIN) {
    throw new AuthError(403, 'You do not have permission to do that.')
  }
  return user
}

export function isAdmin(user: Pick<User, 'role'> | SessionUser): boolean {
  return user.role === Role.ORG_ADMIN || user.role === Role.SUPER_ADMIN
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

// ---------------------------------------------------------------------------
// Login organization resolution
// ---------------------------------------------------------------------------
//
// Email is unique per organization, not globally, so one address can belong to
// two tenants. This resolves which one BEFORE signIn is called, so that the
// Credentials provider never has to guess.
//
// It lives in lib/ because it is the one query that legitimately cannot be
// tenant-scoped: at this point there is no session, and therefore no tenant.

export type LoginResolution =
  | { kind: 'no-match' }
  | { kind: 'single'; organizationId: string }
  | { kind: 'choose'; organizations: { id: string; name: string }[] }

export async function resolveLoginOrganization(
  email: string,
  password: string,
): Promise<LoginResolution> {
  const candidates = await prisma.user.findMany({
    where: {
      email: email.trim().toLowerCase(),
      status: UserStatus.ACTIVE,
      organization: { isActive: true },
    },
    select: {
      organizationId: true,
      passwordHash: true,
      organization: { select: { id: true, name: true } },
    },
    take: 5,
  })

  if (candidates.length === 0) {
    // Compare against a dummy hash so a non-existent address takes as long as
    // a real one. Otherwise response time reveals which emails are registered.
    await bcrypt.compare(password, DUMMY_HASH)
    return { kind: 'no-match' }
  }

  // The common case: one organization, so the password check belongs to
  // authorize() and we do not spend a second bcrypt round here.
  if (candidates.length === 1) {
    return { kind: 'single', organizationId: candidates[0].organizationId }
  }

  // Several tenants share this address. Verify the password against each so we
  // only ever reveal the organizations the caller can actually sign in to.
  const matches: { id: string; name: string }[] = []
  for (const candidate of candidates) {
    if (await bcrypt.compare(password, candidate.passwordHash)) {
      matches.push({ id: candidate.organization.id, name: candidate.organization.name })
    }
  }

  if (matches.length === 0) return { kind: 'no-match' }
  if (matches.length === 1) return { kind: 'single', organizationId: matches[0].id }
  return { kind: 'choose', organizations: matches }
}
