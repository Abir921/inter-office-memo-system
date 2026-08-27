// lib/memo-queries.ts
//
// Two filters apply to every memo list, and they are different things:
//
//   * TENANT scoping   — handled by lib/tenant.ts, applied to every query.
//   * AUTHORIZATION scoping — handled here. Being in the right organization
//     does not entitle you to read a colleague's memo.
//
// A search that respected only the first would let any employee read every
// memo in the company. PRD 7.12 requires both.

import { MemoStatus, Prisma } from '@prisma/client'
import { isAdminContext, type TenantContext } from './tenant'

export const ACTIVE_STATUSES: MemoStatus[] = [
  MemoStatus.SUBMITTED,
  MemoStatus.PENDING_REVIEW,
  MemoStatus.PENDING_APPROVAL,
]

export const CLOSED_STATUSES: MemoStatus[] = [
  MemoStatus.APPROVED,
  MemoStatus.REJECTED,
  MemoStatus.CANCELLED,
]

/**
 * Which memos this user may see at all.
 *
 * An ordinary user sees a memo if they wrote it, if they appear anywhere in its
 * routing (in any submission cycle), or if they have commented on it.
 *
 * An administrator sees every memo in the organization — except other people's
 * drafts. A draft is not yet a document; PRD 7.6 makes it author-only, and that
 * applies to administrators too.
 */
export function visibleMemoWhere(ctx: TenantContext): Prisma.MemoWhereInput {
  const draftsAreMine: Prisma.MemoWhereInput = {
    OR: [{ status: { not: MemoStatus.DRAFT } }, { authorId: ctx.userId }],
  }

  if (isAdminContext(ctx)) return draftsAreMine

  return {
    AND: [
      draftsAreMine,
      {
        OR: [
          { authorId: ctx.userId },
          { steps: { some: { assigneeId: ctx.userId } } },
          { comments: { some: { authorId: ctx.userId } } },
        ],
      },
    ],
  }
}

export type MemoScope = 'inbox' | 'sent' | 'completed' | 'all'

export interface MemoFilters {
  status?: MemoStatus
  priority?: 'NORMAL' | 'HIGH' | 'URGENT'
  departmentId?: string | null
  categoryId?: string | null
  q?: string
  from?: string
  to?: string
}

/**
 * Builds the WHERE clause for one of the memo lists.
 *
 * `delegatorIds` widens the inbox to include memos waiting on somebody who has
 * delegated their authority to this user.
 */
export function memoScopeWhere(
  ctx: TenantContext,
  scope: MemoScope,
  filters: MemoFilters = {},
  delegatorIds: string[] = [],
): Prisma.MemoWhereInput {
  const clauses: Prisma.MemoWhereInput[] = [visibleMemoWhere(ctx)]

  switch (scope) {
    case 'inbox':
      // The memo's CURRENT step is assigned to me. Matching on the step's
      // state alone would also return steps from earlier submission cycles.
      clauses.push({
        status: { in: ACTIVE_STATUSES },
        steps: {
          some: {
            state: 'CURRENT',
            assigneeId: { in: [ctx.userId, ...delegatorIds] },
          },
        },
      })
      break

    case 'sent':
      clauses.push({ authorId: ctx.userId })
      break

    case 'completed':
      clauses.push({ status: { in: CLOSED_STATUSES } })
      break

    case 'all':
      break
  }

  if (filters.status) clauses.push({ status: filters.status })
  if (filters.priority) clauses.push({ priority: filters.priority })
  if (filters.departmentId) clauses.push({ departmentId: filters.departmentId })
  if (filters.categoryId) clauses.push({ categoryId: filters.categoryId })

  if (filters.from || filters.to) {
    clauses.push({
      createdAt: {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      },
    })
  }

  if (filters.q) {
    const q = filters.q.trim()
    if (q) {
      // Prisma builds a parameterised query; the term is never concatenated
      // into SQL. Body search runs against the sanitized HTML, which is
      // adequate at this data volume.
      clauses.push({
        OR: [
          { memoNumber: { contains: q, mode: 'insensitive' } },
          { subject: { contains: q, mode: 'insensitive' } },
          { bodyHtml: { contains: q, mode: 'insensitive' } },
          { author: { name: { contains: q, mode: 'insensitive' } } },
          { department: { name: { contains: q, mode: 'insensitive' } } },
          { category: { name: { contains: q, mode: 'insensitive' } } },
        ],
      })
    }
  }

  return { AND: clauses }
}

/** Columns every memo list renders. Keeps the lists consistent. */
export const MEMO_LIST_SELECT = {
  id: true,
  memoNumber: true,
  subject: true,
  status: true,
  priority: true,
  submittedAt: true,
  completedAt: true,
  lastActivityAt: true,
  createdAt: true,
  currentStepId: true,
  author: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  steps: {
    where: { state: 'CURRENT' as const },
    select: {
      id: true,
      position: true,
      positionLabel: true,
      createdAt: true,
      assignee: { select: { id: true, name: true, designation: true } },
    },
  },
} satisfies Prisma.MemoSelect

export type MemoListRow = Prisma.MemoGetPayload<{ select: typeof MEMO_LIST_SELECT }>
