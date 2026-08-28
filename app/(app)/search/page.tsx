import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MemoTable } from '@/components/app/memo-table'
import { getSessionUser } from '@/lib/auth'
import { MEMO_LIST_SELECT, memoScopeWhere, type MemoFilters } from '@/lib/memo-queries'
import { scoped, tenantContext } from '@/lib/tenant'
import { SearchForm } from './search-form'

export const metadata: Metadata = { title: 'Search · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

const PER_PAGE = 25

type Search = Record<string, string | string[] | undefined>

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const ctx = tenantContext(user)
  const db = scoped(ctx)

  const filters: MemoFilters = {
    q: str(sp.q),
    status: str(sp.status) as MemoFilters['status'],
    priority: str(sp.priority) as MemoFilters['priority'],
    departmentId: str(sp.departmentId),
    categoryId: str(sp.categoryId),
    from: str(sp.from),
    to: str(sp.to),
  }

  const page = Math.max(1, Number(str(sp.page)) || 1)

  // Every result respects both boundaries at once: tenant scoping (this
  // organization only) AND authorization scoping (memoScopeWhere excludes
  // other people's drafts and, for ordinary users, memos they have no part
  // in). A search box is not an exception to either rule.
  const where = memoScopeWhere(ctx, 'all', filters)

  const [memos, total, departments, categories] = await Promise.all([
    db.memo.findMany({
      where,
      select: MEMO_LIST_SELECT,
      orderBy: { lastActivityAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    db.memo.count(where),
    db.department.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const hasQuery = Boolean(filters.q || filters.status || filters.priority || filters.departmentId || filters.categoryId || filters.from || filters.to)

  const pageHref = (p: number) => {
    const next = new URLSearchParams(
      Object.entries(sp).flatMap(([k, v]) => (typeof v === 'string' && v ? [[k, v]] : [])),
    )
    next.set('page', String(p))
    return '/search?' + next.toString()
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          Across every memo you can see
        </p>
        <h1 className="mt-2 text-2xl">Search</h1>
      </header>

      <SearchForm departments={departments} categories={categories} />

      {hasQuery ? (
        <p className="text-sm text-ink-soft">
          {total === 0
            ? 'No memos match.'
            : total === 1
              ? '1 memo matches.'
              : total + ' memos match.'}
        </p>
      ) : null}

      <MemoTable
        memos={memos}
        emptyMessage={
          hasQuery
            ? 'No memos match those filters. Try widening the search.'
            : 'Search across memo number, subject, body, author, department, category, status, priority and date.'
        }
      />

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between text-sm">
          <Link
            href={pageHref(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={
              page <= 1
                ? 'pointer-events-none text-muted'
                : 'text-ink underline-offset-4 hover:underline'
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
