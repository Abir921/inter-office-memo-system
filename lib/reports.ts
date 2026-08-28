// lib/reports.ts
//
// Aggregate statistics for the admin reports screen (PRD 7.18). Every query
// is tenant-scoped through the caller's ScopedDb; this module adds only the
// aggregation logic, none of its own data access rules.

import type { MemoStatus, Prisma } from '@prisma/client'
import type { ScopedDb } from './tenant'

export interface ReportFilters {
  departmentId?: string
  categoryId?: string
  status?: MemoStatus
  from?: string
  to?: string
}

function dateFilter(filters: ReportFilters): Prisma.MemoWhereInput {
  if (!filters.from && !filters.to) return {}
  return {
    createdAt: {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    },
  }
}

function baseWhere(filters: ReportFilters): Prisma.MemoWhereInput {
  return {
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...dateFilter(filters),
  }
}

export interface ReportData {
  totalMemos: number
  byStatus: { status: MemoStatus; count: number }[]
  byDepartment: { name: string; count: number }[]
  byCategory: { name: string; count: number }[]
  urgentCount: number
  pendingApprovals: number
  rejectedCount: number
  changeRequestCount: number
  averageCompletionHours: number | null
  completedSampleSize: number
}

export async function buildReport(db: ScopedDb, filters: ReportFilters): Promise<ReportData> {
  const where = baseWhere(filters)

  const [
    totalMemos,
    statusGroups,
    departmentGroups,
    categoryGroups,
    urgentCount,
    pendingApprovals,
    rejectedCount,
    changeRequestCount,
    completedMemos,
  ] = await Promise.all([
    db.memo.count(where),

    db.memo
      .findMany({ where, select: { status: true } })
      .then((rows: { status: MemoStatus }[]) => {
        const counts = new Map<MemoStatus, number>()
        for (const row of rows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1)
        return [...counts.entries()].map(([status, count]) => ({ status, count }))
      }),

    db.memo
      .findMany({ where, select: { department: { select: { name: true } } } })
      .then((rows: { department: { name: string } | null }[]) => {
        const counts = new Map<string, number>()
        for (const row of rows) {
          const name = row.department?.name ?? 'Unassigned'
          counts.set(name, (counts.get(name) ?? 0) + 1)
        }
        return [...counts.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
      }),

    db.memo
      .findMany({ where, select: { category: { select: { name: true } } } })
      .then((rows: { category: { name: string } | null }[]) => {
        const counts = new Map<string, number>()
        for (const row of rows) {
          const name = row.category?.name ?? 'Uncategorised'
          counts.set(name, (counts.get(name) ?? 0) + 1)
        }
        return [...counts.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
      }),

    db.memo.count({ ...where, priority: 'URGENT' }),
    db.memo.count({ ...where, status: { in: ['SUBMITTED', 'PENDING_REVIEW', 'PENDING_APPROVAL'] } }),
    db.memo.count({ ...where, status: 'REJECTED' }),
    db.memo.count({ ...where, status: 'CHANGES_REQUESTED' }),

    // Average workflow completion time: mean of completedAt - submittedAt,
    // for memos that reached APPROVED (PRD 7.18 defines it against approved
    // memos specifically, not rejections or cancellations).
    db.memo.findMany({
      where: { ...where, status: 'APPROVED', submittedAt: { not: null }, completedAt: { not: null } },
      select: { submittedAt: true, completedAt: true },
    }),
  ])

  let averageCompletionHours: number | null = null
  if (completedMemos.length > 0) {
    const totalHours = completedMemos.reduce((sum: number, m: { submittedAt: Date | null; completedAt: Date | null }) => {
      const hours = (m.completedAt!.getTime() - m.submittedAt!.getTime()) / (1000 * 60 * 60)
      return sum + hours
    }, 0)
    averageCompletionHours = totalHours / completedMemos.length
  }

  return {
    totalMemos,
    byStatus: statusGroups,
    byDepartment: departmentGroups,
    byCategory: categoryGroups,
    urgentCount,
    pendingApprovals,
    rejectedCount,
    changeRequestCount,
    averageCompletionHours,
    completedSampleSize: completedMemos.length,
  }
}
