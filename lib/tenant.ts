// lib/tenant.ts
//
// THE TENANT GUARD. Multi-tenancy here is shared-database, shared-schema, with
// an organizationId discriminator column on every tenant-scoped table.
//
// Feature code (pages, route handlers, components) must never call
// prisma.<tenantModel> directly. It goes through scoped(ctx), which merges
// organizationId into the WHERE clause of every read and into the data of
// every write. The id comes from the session — never from a request body,
// query string or route param.
//
// Two consequences worth stating plainly:
//
//   * findById is a findFirst on (id AND organizationId), not a findUnique on
//     id alone. Another tenant's row therefore returns null, and the caller
//     turns null into a 404 — never a 403, which would confirm it exists.
//
//   * updateById and deleteById compile to updateMany/deleteMany with the
//     organization in the filter, so a cross-tenant write affects zero rows
//     instead of the wrong tenant's row.
//
// On the generics: each read is generic over its args so that `include` and
// `select` still narrow the return type, exactly as the bare Prisma client
// would. The internal casts are the price of injecting the tenant filter; the
// call site keeps full inference.

import { Prisma, Role } from '@prisma/client'
import { prisma } from './prisma'
import type { SessionUser } from './auth'

export interface TenantContext {
  organizationId: string
  userId: string
  role: Role
}

/** Builds the tenant context from a verified session. The only valid source. */
export function tenantContext(user: SessionUser): TenantContext {
  return {
    organizationId: user.organizationId,
    userId: user.id,
    role: user.role,
  }
}

export function isAdminContext(ctx: TenantContext): boolean {
  return ctx.role === Role.ORG_ADMIN || ctx.role === Role.SUPER_ADMIN
}

/**
 * Defence in depth (PRD 5.2, layer 3). Even when a row arrived through a
 * scoped query, re-verify before writing to it. Returns false rather than
 * throwing so the caller can answer 404.
 */
export function belongsToTenant(
  record: { organizationId: string } | null | undefined,
  ctx: TenantContext,
): boolean {
  return Boolean(record) && record?.organizationId === ctx.organizationId
}

/** Thrown when a scoped lookup finds nothing. Handlers answer 404. */
export class NotFoundError extends Error {
  httpStatus = 404
  constructor(message = 'Not found.') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export function orFail<T>(record: T | null | undefined, message?: string): T {
  if (record === null || record === undefined) throw new NotFoundError(message)
  return record
}

// ---------------------------------------------------------------------------
// The scoped client
// ---------------------------------------------------------------------------

export function scoped(ctx: TenantContext) {
  const org = ctx.organizationId
  /** Spread into any WHERE clause to pin it to this tenant. */
  const where = { organizationId: org }

  return {
    ctx,
    organizationId: org,
    where,

    department: {
      findMany: <
        T extends Omit<Prisma.DepartmentFindManyArgs, 'where'> & {
          where?: Prisma.DepartmentWhereInput
        },
      >(
        args?: T,
      ): Promise<Array<Prisma.DepartmentGetPayload<T>>> =>
        prisma.department.findMany({
          ...args,
          where: { ...args?.where, ...where },
        } as Prisma.DepartmentFindManyArgs) as Promise<Array<Prisma.DepartmentGetPayload<T>>>,

      findById: <T extends Prisma.DepartmentFindFirstArgs>(
        id: string,
        args?: T,
      ): Promise<Prisma.DepartmentGetPayload<T> | null> =>
        prisma.department.findFirst({
          ...args,
          where: { ...args?.where, id, ...where },
        } as Prisma.DepartmentFindFirstArgs) as Promise<Prisma.DepartmentGetPayload<T> | null>,

      count: (w?: Prisma.DepartmentWhereInput) =>
        prisma.department.count({ where: { ...w, ...where } }),
      create: (data: Omit<Prisma.DepartmentUncheckedCreateInput, 'organizationId'>) =>
        prisma.department.create({ data: { ...data, ...where } }),
      updateById: (id: string, data: Prisma.DepartmentUpdateInput) =>
        prisma.department.updateMany({ where: { id, ...where }, data }),
    },

    user: {
      findMany: <
        T extends Omit<Prisma.UserFindManyArgs, 'where'> & { where?: Prisma.UserWhereInput },
      >(
        args?: T,
      ): Promise<Array<Prisma.UserGetPayload<T>>> =>
        prisma.user.findMany({
          ...args,
          where: { ...args?.where, ...where },
        } as Prisma.UserFindManyArgs) as Promise<Array<Prisma.UserGetPayload<T>>>,

      findById: <T extends Prisma.UserFindFirstArgs>(
        id: string,
        args?: T,
      ): Promise<Prisma.UserGetPayload<T> | null> =>
        prisma.user.findFirst({
          ...args,
          where: { ...args?.where, id, ...where },
        } as Prisma.UserFindFirstArgs) as Promise<Prisma.UserGetPayload<T> | null>,

      findByEmail: (email: string) =>
        prisma.user.findFirst({ where: { email: email.trim().toLowerCase(), ...where } }),
      count: (w?: Prisma.UserWhereInput) => prisma.user.count({ where: { ...w, ...where } }),
      create: (data: Omit<Prisma.UserUncheckedCreateInput, 'organizationId'>) =>
        prisma.user.create({ data: { ...data, ...where } }),
      updateById: (id: string, data: Prisma.UserUpdateInput) =>
        prisma.user.updateMany({ where: { id, ...where }, data }),
      /** Workflow assignee candidates: active users in this organization only. */
      activeIdsAmong: async (ids: string[]) => {
        const rows = await prisma.user.findMany({
          where: { id: { in: ids }, status: 'ACTIVE', ...where },
          select: { id: true },
        })
        return new Set(rows.map((r) => r.id))
      },
    },

    category: {
      findMany: <
        T extends Omit<Prisma.MemoCategoryFindManyArgs, 'where'> & {
          where?: Prisma.MemoCategoryWhereInput
        },
      >(
        args?: T,
      ): Promise<Array<Prisma.MemoCategoryGetPayload<T>>> =>
        prisma.memoCategory.findMany({
          ...args,
          where: { ...args?.where, ...where },
        } as Prisma.MemoCategoryFindManyArgs) as Promise<Array<Prisma.MemoCategoryGetPayload<T>>>,

      findById: (id: string) => prisma.memoCategory.findFirst({ where: { id, ...where } }),
      count: (w?: Prisma.MemoCategoryWhereInput) =>
        prisma.memoCategory.count({ where: { ...w, ...where } }),
      create: (data: Omit<Prisma.MemoCategoryUncheckedCreateInput, 'organizationId'>) =>
        prisma.memoCategory.create({ data: { ...data, ...where } }),
      updateById: (id: string, data: Prisma.MemoCategoryUpdateInput) =>
        prisma.memoCategory.updateMany({ where: { id, ...where }, data }),
    },

    template: {
      findMany: <
        T extends Omit<Prisma.WorkflowTemplateFindManyArgs, 'where'> & {
          where?: Prisma.WorkflowTemplateWhereInput
        },
      >(
        args?: T,
      ): Promise<Array<Prisma.WorkflowTemplateGetPayload<T>>> =>
        prisma.workflowTemplate.findMany({
          ...args,
          where: { ...args?.where, ...where },
        } as Prisma.WorkflowTemplateFindManyArgs) as Promise<
          Array<Prisma.WorkflowTemplateGetPayload<T>>
        >,

      findById: <T extends Prisma.WorkflowTemplateFindFirstArgs>(
        id: string,
        args?: T,
      ): Promise<Prisma.WorkflowTemplateGetPayload<T> | null> =>
        prisma.workflowTemplate.findFirst({
          ...args,
          where: { ...args?.where, id, ...where },
        } as Prisma.WorkflowTemplateFindFirstArgs) as Promise<
          Prisma.WorkflowTemplateGetPayload<T> | null
        >,

      count: (w?: Prisma.WorkflowTemplateWhereInput) =>
        prisma.workflowTemplate.count({ where: { ...w, ...where } }),
      updateById: (id: string, data: Prisma.WorkflowTemplateUpdateInput) =>
        prisma.workflowTemplate.updateMany({ where: { id, ...where }, data }),
    },

    memo: {
      findMany: <
        T extends Omit<Prisma.MemoFindManyArgs, 'where'> & { where?: Prisma.MemoWhereInput },
      >(
        args?: T,
      ): Promise<Array<Prisma.MemoGetPayload<T>>> =>
        prisma.memo.findMany({
          ...args,
          where: { ...args?.where, ...where },
        } as Prisma.MemoFindManyArgs) as Promise<Array<Prisma.MemoGetPayload<T>>>,

      findById: <T extends Prisma.MemoFindFirstArgs>(
        id: string,
        args?: T,
      ): Promise<Prisma.MemoGetPayload<T> | null> =>
        prisma.memo.findFirst({
          ...args,
          where: { ...args?.where, id, ...where },
        } as Prisma.MemoFindFirstArgs) as Promise<Prisma.MemoGetPayload<T> | null>,

      count: (w?: Prisma.MemoWhereInput) => prisma.memo.count({ where: { ...w, ...where } }),
      updateById: (id: string, data: Prisma.MemoUpdateInput) =>
        prisma.memo.updateMany({ where: { id, ...where }, data }),
      deleteById: (id: string) => prisma.memo.deleteMany({ where: { id, ...where } }),
    },

    step: {
      findMany: <
        T extends Omit<Prisma.WorkflowStepFindManyArgs, 'where'> & {
          where?: Prisma.WorkflowStepWhereInput
        },
      >(
        args?: T,
      ): Promise<Array<Prisma.WorkflowStepGetPayload<T>>> =>
        prisma.workflowStep.findMany({
          ...args,
          where: { ...args?.where, ...where },
        } as Prisma.WorkflowStepFindManyArgs) as Promise<Array<Prisma.WorkflowStepGetPayload<T>>>,

      findById: <T extends Prisma.WorkflowStepFindFirstArgs>(
        id: string,
        args?: T,
      ): Promise<Prisma.WorkflowStepGetPayload<T> | null> =>
        prisma.workflowStep.findFirst({
          ...args,
          where: { ...args?.where, id, ...where },
        } as Prisma.WorkflowStepFindFirstArgs) as Promise<
          Prisma.WorkflowStepGetPayload<T> | null
        >,

      count: (w?: Prisma.WorkflowStepWhereInput) =>
        prisma.workflowStep.count({ where: { ...w, ...where } }),
    },

    // Append-only: read helpers only, deliberately no update or delete.
    action: {
      findMany: <
        T extends Omit<Prisma.WorkflowActionFindManyArgs, 'where'> & {
          where?: Prisma.WorkflowActionWhereInput
        },
      >(
        args?: T,
      ): Promise<Array<Prisma.WorkflowActionGetPayload<T>>> =>
        prisma.workflowAction.findMany({
          ...args,
          where: { ...args?.where, ...where },
        } as Prisma.WorkflowActionFindManyArgs) as Promise<
          Array<Prisma.WorkflowActionGetPayload<T>>
        >,

      count: (w?: Prisma.WorkflowActionWhereInput) =>
        prisma.workflowAction.count({ where: { ...w, ...where } }),
    },

    version: {
      findMany: <
        T extends Omit<Prisma.MemoVersionFindManyArgs, 'where'> & {
          where?: Prisma.MemoVersionWhereInput
        },
      >(
        args?: T,
      ): Promise<Array<Prisma.MemoVersionGetPayload<T>>> =>
        prisma.memoVersion.findMany({
          ...args,
          where: { ...args?.where, ...where },
        } as Prisma.MemoVersionFindManyArgs) as Promise<Array<Prisma.MemoVersionGetPayload<T>>>,

      findById: (id: string) => prisma.memoVersion.findFirst({ where: { id, ...where } }),
    },

    comment: {
      findMany: <
        T extends Omit<Prisma.CommentFindManyArgs, 'where'> & {
          where?: Prisma.CommentWhereInput
        },
      >(
        args?: T,
      ): Promise<Array<Prisma.CommentGetPayload<T>>> =>
        prisma.comment.findMany({
          ...args,
          where: { ...args?.where, ...where },
        } as Prisma.CommentFindManyArgs) as Promise<Array<Prisma.CommentGetPayload<T>>>,

      create: (data: Omit<Prisma.CommentUncheckedCreateInput, 'organizationId'>) =>
        prisma.comment.create({ data: { ...data, ...where } }),
    },

    attachment: {
      findMany: <
        T extends Omit<Prisma.AttachmentFindManyArgs, 'where'> & {
          where?: Prisma.AttachmentWhereInput
        },
      >(
        args?: T,
      ): Promise<Array<Prisma.AttachmentGetPayload<T>>> =>
        prisma.attachment.findMany({
          ...args,
          where: { ...args?.where, ...where },
        } as Prisma.AttachmentFindManyArgs) as Promise<Array<Prisma.AttachmentGetPayload<T>>>,

      findById: <T extends Prisma.AttachmentFindFirstArgs>(
        id: string,
        args?: T,
      ): Promise<Prisma.AttachmentGetPayload<T> | null> =>
        prisma.attachment.findFirst({
          ...args,
          where: { ...args?.where, id, ...where },
        } as Prisma.AttachmentFindFirstArgs) as Promise<Prisma.AttachmentGetPayload<T> | null>,

      create: (data: Omit<Prisma.AttachmentUncheckedCreateInput, 'organizationId'>) =>
        prisma.attachment.create({ data: { ...data, ...where } }),
      updateById: (id: string, data: Prisma.AttachmentUpdateInput) =>
        prisma.attachment.updateMany({ where: { id, ...where }, data }),
    },

    // Scoped by organization AND user: a notification id belonging to another
    // tenant, or to a colleague, matches nothing.
    notification: {
      findMany: <
        T extends Omit<Prisma.NotificationFindManyArgs, 'where'> & {
          where?: Prisma.NotificationWhereInput
        },
      >(
        args?: T,
      ): Promise<Array<Prisma.NotificationGetPayload<T>>> =>
        prisma.notification.findMany({
          ...args,
          where: { ...args?.where, userId: ctx.userId, ...where },
        } as Prisma.NotificationFindManyArgs) as Promise<
          Array<Prisma.NotificationGetPayload<T>>
        >,

      countUnread: () =>
        prisma.notification.count({ where: { userId: ctx.userId, isRead: false, ...where } }),
      markRead: (id?: string) =>
        prisma.notification.updateMany({
          where: { userId: ctx.userId, isRead: false, ...(id ? { id } : {}), ...where },
          data: { isRead: true, readAt: new Date() },
        }),
    },

    // Append-only, admin-readable. Writes go through lib/audit.ts, inside the
    // transaction that caused them.
    auditLog: {
      findMany: <
        T extends Omit<Prisma.AuditLogFindManyArgs, 'where'> & {
          where?: Prisma.AuditLogWhereInput
        },
      >(
        args?: T,
      ): Promise<Array<Prisma.AuditLogGetPayload<T>>> =>
        prisma.auditLog.findMany({
          ...args,
          where: { ...args?.where, ...where },
        } as Prisma.AuditLogFindManyArgs) as Promise<Array<Prisma.AuditLogGetPayload<T>>>,

      count: (w?: Prisma.AuditLogWhereInput) =>
        prisma.auditLog.count({ where: { ...w, ...where } }),
    },

    delegation: {
      findMany: <
        T extends Omit<Prisma.DelegationFindManyArgs, 'where'> & {
          where?: Prisma.DelegationWhereInput
        },
      >(
        args?: T,
      ): Promise<Array<Prisma.DelegationGetPayload<T>>> =>
        prisma.delegation.findMany({
          ...args,
          where: { ...args?.where, ...where },
        } as Prisma.DelegationFindManyArgs) as Promise<Array<Prisma.DelegationGetPayload<T>>>,

      findById: (id: string) => prisma.delegation.findFirst({ where: { id, ...where } }),
      create: (data: Omit<Prisma.DelegationUncheckedCreateInput, 'organizationId'>) =>
        prisma.delegation.create({ data: { ...data, ...where } }),
      updateById: (id: string, data: Prisma.DelegationUpdateInput) =>
        prisma.delegation.updateMany({ where: { id, ...where }, data }),
    },

    // The organization row is the tenant itself; its id is the scope.
    organization: {
      get: () => prisma.organization.findUnique({ where: { id: org } }),
      update: (data: Prisma.OrganizationUpdateInput) =>
        prisma.organization.update({ where: { id: org }, data }),
    },
  }
}

export type ScopedDb = ReturnType<typeof scoped>
