import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MemoTable } from '@/components/app/memo-table'
import { getSessionUser } from '@/lib/auth'
import { MEMO_LIST_SELECT, memoScopeWhere } from '@/lib/memo-queries'
import { scoped, tenantContext } from '@/lib/tenant'

export const metadata: Metadata = { title: 'My memos · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

export default async function MyMemosPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const ctx = tenantContext(user)
  const db = scoped(ctx)

  const memos = await db.memo.findMany({
    where: memoScopeWhere(ctx, 'sent'),
    select: MEMO_LIST_SELECT,
    orderBy: { lastActivityAt: 'desc' },
    take: 100,
  })

  const drafts = memos.filter((m) => m.status === 'DRAFT')
  const live = memos.filter((m) => m.status !== 'DRAFT')

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
            Memos you wrote
          </p>
          <h1 className="mt-2 text-2xl">My memos</h1>
        </div>
        <Link
          href="/memos/new"
          className="inline-flex h-10 items-center rounded-sm bg-ink px-4 text-sm font-medium text-paper hover:bg-ink-soft"
        >
          Write a memo
        </Link>
      </header>

      {drafts.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold">
            Drafts
            <span className="font-data ml-2 text-xs font-normal text-muted">
              {drafts.length} not yet submitted
            </span>
          </h2>
          <p className="mt-1 text-xs text-muted">
            Only you can see these. They appear in nobody&rsquo;s inbox.
          </p>
          <div className="mt-3">
            <MemoTable memos={drafts} emptyMessage="" showAuthor={false} />
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold">In the system</h2>
        <div className="mt-3">
          <MemoTable
            memos={live}
            showAuthor={false}
            emptyMessage="You have not submitted a memo yet. Write one and route it to the desks it needs to cross."
          />
        </div>
      </section>
    </div>
  )
}
