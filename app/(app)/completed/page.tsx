import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { MemoTable } from '@/components/app/memo-table'
import { getSessionUser } from '@/lib/auth'
import { MEMO_LIST_SELECT, memoScopeWhere } from '@/lib/memo-queries'
import { scoped, tenantContext } from '@/lib/tenant'

export const metadata: Metadata = { title: 'Completed · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

export default async function CompletedPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const ctx = tenantContext(user)
  const db = scoped(ctx)

  // Approved, rejected and cancelled memos this user is authorised to see —
  // authored, participated in, or (for admins) anywhere in the organization.
  // Other people's drafts never qualify: memoScopeWhere excludes them always.
  const memos = await db.memo.findMany({
    where: memoScopeWhere(ctx, 'completed'),
    select: MEMO_LIST_SELECT,
    orderBy: { completedAt: 'desc' },
    take: 100,
  })

  return (
    <div className="space-y-6">
      <header>
        <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          Closed workflows
        </p>
        <h1 className="mt-2 text-2xl">Completed</h1>
      </header>

      <MemoTable
        memos={memos}
        emptyMessage="Nothing has finished its workflow yet."
      />
    </div>
  )
}
