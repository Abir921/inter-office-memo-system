// lib/admin.ts
//
// Organization, department and user administration. Every export here is
// called only from a route the caller has already passed requireAdmin() to
// reach — this module does not re-check the ROLE, only tenant scope and the
// business rules specific to each operation (uniqueness, self-lockout).

import { AuditEventType, Prisma, Role, UserStatus } from '@prisma/client'
import { writeAudit } from './audit'
import { hashPassword } from './auth'
import { prisma } from './prisma'
import type { TenantContext } from './tenant'

export class AdminError extends Error {
  httpStatus: number
  fields?: Record<string, string>
  constructor(httpStatus: number, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'AdminError'
    this.httpStatus = httpStatus
    this.fields = fields
  }
}

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

export interface UpdateOrganizationInput {
  name: string
  logoUrl: string | null
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
}

export async function updateOrganization(ctx: TenantContext, input: UpdateOrganizationInput) {
  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.update({
      where: { id: ctx.organizationId },
      data: input,
    })

    await writeAudit(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      eventType: AuditEventType.ORGANIZATION_UPDATED,
      entityType: 'Organization',
      entityId: org.id,
      description: 'Organization details updated.',
    })

    return org
  })
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export interface DepartmentInput {
  name: string
  description: string | null
}

export async function createDepartment(ctx: TenantContext, input: DepartmentInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const dept = await tx.department.create({
        data: { organizationId: ctx.organizationId, ...input },
      })

      await writeAudit(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        eventType: AuditEventType.DEPARTMENT_CREATED,
        entityType: 'Department',
        entityId: dept.id,
        description: 'Department "' + dept.name + '" created.',
      })

      return dept
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AdminError(409, 'A department with that name already exists.', {
        name: 'A department with that name already exists.',
      })
    }
    throw error
  }
}

export async function updateDepartment(
  ctx: TenantContext,
  id: string,
  input: DepartmentInput & { isActive: boolean },
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.department.findFirst({
        where: { id, organizationId: ctx.organizationId },
      })
      if (!existing) throw new AdminError(404, 'Department not found.')

      const dept = await tx.department.update({ where: { id }, data: input })

      await writeAudit(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        eventType: input.isActive
          ? AuditEventType.DEPARTMENT_UPDATED
          : AuditEventType.DEPARTMENT_DEACTIVATED,
        entityType: 'Department',
        entityId: dept.id,
        description:
          existing.isActive && !input.isActive
            ? 'Department "' + dept.name + '" deactivated.'
            : 'Department "' + dept.name + '" updated.',
      })

      return dept
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AdminError(409, 'A department with that name already exists.', {
        name: 'A department with that name already exists.',
      })
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface CreateUserInput {
  name: string
  email: string
  designation: string | null
  departmentId: string | null
  role: 'ORG_ADMIN' | 'USER'
  password: string
}

async function assertDepartmentInTenant(organizationId: string, departmentId: string | null) {
  if (!departmentId) return
  const found = await prisma.department.findFirst({
    where: { id: departmentId, organizationId },
    select: { id: true },
  })
  if (!found) throw new AdminError(400, 'That department is not available.', {
    departmentId: 'That department is not available.',
  })
}

export async function createUser(ctx: TenantContext, input: CreateUserInput) {
  await assertDepartmentInTenant(ctx.organizationId, input.departmentId)

  const passwordHash = await hashPassword(input.password)

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: ctx.organizationId,
          name: input.name,
          email: input.email,
          passwordHash,
          designation: input.designation,
          departmentId: input.departmentId,
          role: input.role as Role,
          // The administrator chose this password and will hand it to the
          // new user out of band; they are required to set their own on
          // first sign-in.
          mustChangePassword: true,
        },
      })

      await writeAudit(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        eventType: AuditEventType.USER_CREATED,
        entityType: 'User',
        entityId: user.id,
        description: user.name + ' (' + user.email + ') added as ' + input.role + '.',
      })

      return user
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AdminError(409, 'A user with that email already exists in this organization.', {
        email: 'A user with that email already exists in this organization.',
      })
    }
    throw error
  }
}

export interface UpdateUserInput {
  name: string
  designation: string | null
  departmentId: string | null
  role: 'ORG_ADMIN' | 'USER'
}

export async function updateUser(ctx: TenantContext, id: string, input: UpdateUserInput) {
  await assertDepartmentInTenant(ctx.organizationId, input.departmentId)

  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({
      where: { id, organizationId: ctx.organizationId },
    })
    if (!existing) throw new AdminError(404, 'User not found.')

    // An administrator can step down, but not if they are the last one: that
    // would leave the organization with no one who can administer it.
    if (existing.id === ctx.userId && existing.role === Role.ORG_ADMIN && input.role !== 'ORG_ADMIN') {
      const otherAdmins = await tx.user.count({
        where: {
          organizationId: ctx.organizationId,
          role: Role.ORG_ADMIN,
          status: UserStatus.ACTIVE,
          id: { not: ctx.userId },
        },
      })
      if (otherAdmins === 0) {
        throw new AdminError(
          409,
          'You are the only administrator. Promote someone else first.',
        )
      }
    }

    const user = await tx.user.update({
      where: { id },
      data: {
        name: input.name,
        designation: input.designation,
        departmentId: input.departmentId,
        role: input.role as Role,
      },
    })

    await writeAudit(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      eventType: AuditEventType.USER_UPDATED,
      entityType: 'User',
      entityId: user.id,
      description: user.name + ' updated by an administrator.',
    })

    return user
  })
}

export async function setUserStatus(
  ctx: TenantContext,
  id: string,
  status: 'ACTIVE' | 'INACTIVE',
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({
      where: { id, organizationId: ctx.organizationId },
    })
    if (!existing) throw new AdminError(404, 'User not found.')

    if (existing.id === ctx.userId && status === 'INACTIVE') {
      throw new AdminError(400, 'You cannot deactivate your own account.')
    }

    if (status === 'INACTIVE' && existing.role === Role.ORG_ADMIN) {
      const otherActiveAdmins = await tx.user.count({
        where: {
          organizationId: ctx.organizationId,
          role: Role.ORG_ADMIN,
          status: UserStatus.ACTIVE,
          id: { not: existing.id },
        },
      })
      if (otherActiveAdmins === 0) {
        throw new AdminError(409, 'This is the only active administrator and cannot be deactivated.')
      }
    }

    const user = await tx.user.update({
      where: { id },
      data: { status: status as UserStatus },
    })

    await writeAudit(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      eventType:
        status === 'ACTIVE' ? AuditEventType.USER_ACTIVATED : AuditEventType.USER_DEACTIVATED,
      entityType: 'User',
      entityId: user.id,
      description: user.name + ' ' + (status === 'ACTIVE' ? 'activated' : 'deactivated') + '.',
    })

    return user
  })
}
