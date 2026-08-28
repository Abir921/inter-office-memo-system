import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { MemoStatus } from '@prisma/client'
import { BarList } from '@/components/app/bar-list'
import { STATUS_LABEL } from '@/components/app/status-badge'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { buildReport } from '@/lib/reports'
import { scoped, tenantContext } from '@/lib/tenant'
import { ReportFilters } from './report-filters'

export const metadata: Metadata = { title: 'Reports · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

type Search = Record<string, string | string[] | undefined>
const str = (v: string | string[] | undefined) => (typeof v === 'string' && v ? v : undefined)

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'stamp' | 'pending' }) {
  return (
    <div className="bg-card p-4">
      <p
        className={
          'font-data text-2xl ' +
          (tone === 'stamp' ? 'text-stamp' : tone === 'pending' ? 'text-pending' : 'text-ink')
        }
      >
        {value}
      </p>
      <p className="mt-1 text-xs leading-snug text-ink-soft">{label}</p>
    </div>
  )
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!isAdmin(user)) redirect('/dashboard')

  const sp = await searchParams
  const db = scoped(tenantContext(user))

  const [report, departments, categories] = await Promise.all([
    buildReport(db, {
      departmentId: str(sp.departmentId),
      categoryId: str(sp.categoryId),
      status: str(sp.status) as MemoStatus | undefined,
      from: str(sp.from),
      to: str(sp.to),
    }),
    db.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  const completionLabel =
    report.averageCompletionHours === null
      ? '—'
      : report.averageCompletionHours < 24
        ? report.averageCompletionHours.toFixed(1) + 'h'
        : (report.averageCompletionHours / 24).toFixed(1) + 'd'

  return (
    <div className="space-y-8">
      <header>
        <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          {report.totalMemos} memos match the current filter
        </p>
        <h1 className="mt-2 text-2xl">Reports</h1>
      </header>

      <ReportFilters departments={departments} categories={categories} />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-rule bg-rule sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Total memos" value={String(report.totalMemos)} />
        <Stat label="Urgent" value={String(report.urgentCount)} tone={report.urgentCount > 0 ? 'stamp' : undefined} />
        <Stat label="Pending approval" value={String(report.pendingApprovals)} tone={report.pendingApprovals > 0 ? 'pending' : undefined} />
        <Stat label="Rejected" value={String(report.rejectedCount)} tone={report.rejectedCount > 0 ? 'stamp' : undefined} />
        <Stat label="Changes requested" value={String(report.changeRequestCount)} tone={report.changeRequestCount > 0 ? 'pending' : undefined} />
      </div>

      <section>
        <h2 className="text-sm font-semibold">Average time to approval</h2>
        <p className="mt-1 text-xs text-muted">
          Mean of completion time minus submission time, across{' '}
          {report.completedSampleSize} approved {report.completedSampleSize === 1 ? 'memo' : 'memos'} matching this
          filter.
        </p>
        <p className="font-data mt-3 text-3xl text-ink">{completionLabel}</p>
      </section>

      <section>
        <h2 className="text-sm font-semibold">By status</h2>
        <div className="mt-3">
          <BarList
            rows={report.byStatus
              .sort((a, b) => b.count - a.count)
              .map((s) => ({ label: STATUS_LABEL[s.status], count: s.count }))}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">By department</h2>
        <div className="mt-3">
          <BarList rows={report.byDepartment.map((d) => ({ label: d.name, count: d.count }))} tone="seal" />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">By category</h2>
        <div className="mt-3">
          <BarList rows={report.byCategory.map((c) => ({ label: c.name, count: c.count }))} tone="pending" />
        </div>
      </section>
    </div>
  )
}
