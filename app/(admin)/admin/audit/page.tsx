import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuditEventType, type Prisma } from '@prisma/client'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { stamp } from '@/lib/format'
import { scoped, tenantContext } from '@/lib/tenant'
import { AuditFilters } from './audit-filters'

export const metadata: Metadata = { title: 'Audit log · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

const PER_PAGE = 50

type Search = Record<string, string | string[] | undefined>
const str = (v: string | string[] | undefined) => (typeof v === 'string' && v ? v : undefined)

function labelize(eventType: string): string {
  return eventType
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!isAdmin(user)) redirect('/dashboard')

  const sp = await searchParams
  const db = scoped(tenantContext(user))

  const page = Math.max(1, Number(str(sp.page)) || 1)
  const eventType = str(sp.eventType) as AuditEventType | undefined
  const userId = str(sp.userId)
  const from = str(sp.from)
  const to = str(sp.to)

  const where: Prisma.AuditLogWhereInput = {
    ...(eventType ? { eventType } : {}),
    ...(userId ? { userId } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  }

  const [logs, total, users] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { user: { select: { id: true, name: true } } },
    }),
    db.auditLog.count(where),
    db.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  const pageHref = (p: number) => {
    const next = new URLSearchParams(
      Object.entries(sp).flatMap(([k, v]) => (typeof v === 'string' && v ? [[k, v]] : [])),
    )
    next.set('page', String(p))
    return '/admin/audit?' + next.toString()
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          {total} {total === 1 ? 'event' : 'events'} recorded
        </p>
        <h1 className="mt-2 text-2xl">Audit log</h1>
        <p className="mt-1.5 max-w-prose text-sm text-ink-soft">
          Every recorded event in your organization. Written once, never edited or removed.
        </p>
      </header>

      <AuditFilters eventTypes={Object.values(AuditEventType)} users={users} />

      {logs.length === 0 ? (
        <p className="rounded-sm border border-dashed border-rule bg-card p-8 text-center text-sm text-muted">
          No events match those filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-rule bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-rule bg-wash">
              <tr className="font-data text-[11px] uppercase tracking-[0.1em] text-muted">
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Event</th>
                <th className="px-4 py-2.5 font-medium">Who</th>
                <th className="px-4 py-2.5 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="font-data whitespace-nowrap px-4 py-3 align-top text-xs text-muted">
                    {stamp(log.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <span className="font-data rounded-sm border border-rule bg-wash px-1.5 py-0.5 text-[11px]">
                      {labelize(log.eventType)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top text-ink-soft">
                    {log.user?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 align-top text-ink-soft">{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between text-sm">
          <Link
            href={pageHref(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={
              page <= 1 ? 'pointer-events-none text-muted' : 'text-ink underline-offset-4 hover:underline'
            }
          >
            Previous
          </Link>
          <span className="font-data text-xs text-muted">
            Page {page} of {totalPages}
          </span>
          <Link
            href={pageHref(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={
              page >= totalPages
                ? 'pointer-events-none text-muted'
                : 'text-ink underline-offset-4 hover:underline'
            }
          >
            Next
          </Link>
        </nav>
      ) : null}
    </div>
  )
}
