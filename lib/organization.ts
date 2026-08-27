// lib/organization.ts
//
// Creating a tenant is the one write that cannot be tenant-scoped: the tenant
// does not exist yet. It therefore lives in lib/ rather than in feature code,
// alongside the other bootstrap query in lib/auth.ts.

import { AuditEventType, Prisma, Role } from '@prisma/client'
import { writeAudit } from './audit'
import { hashPassword } from './auth'
import { prisma } from './prisma'

/** Seeded into every new organization so a memo can be filed on day one. */
const DEFAULT_CATEGORIES = [
  { name: 'Administrative', description: 'General office administration.' },
  { name: 'Financial', description: 'Budgets, payments and reimbursements.' },
  { name: 'Procurement', description: 'Purchasing and vendor arrangements.' },
  { name: 'HR', description: 'Recruitment, leave and personnel matters.' },
  { name: 'Academic', description: 'Teaching, curriculum and research.' },
  { name: 'Technical', description: 'Systems, equipment and infrastructure.' },
  { name: 'General', description: 'Anything that does not fit elsewhere.' },
]

const DEFAULT_DEPARTMENT = {
  name: 'Administration',
  description: 'Created automatically when the organization was registered.',
}

export type CreateOrganizationResult =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; reason: 'slug-taken' }

export interface CreateOrganizationInput {
  organizationName: string
  slug: string
  adminName: string
  adminEmail: string
  password: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Creates the organization, its first administrator, a default department and
 * the standard memo categories — all inside one transaction, so a half-built
 * organization can never exist.
 */
export async function createOrganizationWithAdmin(
  input: CreateOrganizationInput,
): Promise<CreateOrganizationResult> {
  // Hash outside the transaction: bcrypt at cost 12 takes ~250ms and there is
  // no reason to hold a database transaction open for it.
  const passwordHash = await hashPassword(input.password)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug: input.slug,
          contactEmail: input.contactEmail || null,
          contactPhone: input.contactPhone || null,
          address: input.address || null,
        },
      })

      const department = await tx.department.create({
        data: { organizationId: organization.id, ...DEFAULT_DEPARTMENT },
      })

      await tx.memoCategory.createMany({
        data: DEFAULT_CATEGORIES.map((c) => ({ ...c, organizationId: organization.id })),
      })

      const admin = await tx.user.create({
        data: {
          organizationId: organization.id,
          name: input.adminName,
          email: input.adminEmail,
          passwordHash,
          role: Role.ORG_ADMIN,
          designation: 'Administrator',
          departmentId: department.id,
        },
      })

      await writeAudit(tx, {
        organizationId: organization.id,
        userId: admin.id,
        eventType: AuditEventType.USER_CREATED,
        entityType: 'Organization',
        entityId: organization.id,
        description:
          input.organizationName + ' was registered, with ' + input.adminName + ' as administrator.',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      })

      return { organizationId: organization.id, userId: admin.id }
    })

    return { ok: true, ...result }
  } catch (error) {
    // P2002 is the unique-constraint violation: the slug is already taken.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return { ok: false, reason: 'slug-taken' }
    }
    throw error
  }
}

/** True when the identifier is still free. Used for inline form feedback. */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  const existing = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true },
  })
  return existing === null
}
