import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { MemoTable } from '@/components/app/memo-table'
import { getSessionUser } from '@/lib/auth'
import { MEMO_LIST_SELECT, memoScopeWhere } from '@/lib/memo-queries'
import { prisma } from '@/lib/prisma'
import { scoped, tenantContext } from '@/lib/tenant'
import { getActiveDelegatorIds } from '@/lib/workflow'

export const metadata: Metadata = { title: 'Inbox · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const ctx = tenantContext(user)
  const db = scoped(ctx)

  // A delegate sees the inbox of whoever delegated their authority to them,
  // in addition to their own.
  const delegatorIds = await getActiveDelegatorIds(prisma, {
    id: user.id,
    organizationId: user.organizationId,
    role: user.role,
  })

  const memos = await db.memo.findMany({
    where: memoScopeWhere(ctx, 'inbox', {}, delegatorIds),
    select: MEMO_LIST_SELECT,
    // Longest-waiting first: the memo aging longest on somebody's desk is the
    // one most likely to be overdue.
    orderBy: { submittedAt: 'asc' },
    take: 100,
  })

  const urgent = memos.filter((m) => m.priority === 'URGENT')

  return (
    <div className="space-y-8">
      <header>
        <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          Waiting on you
        </p>
        <h1 className="mt-2 text-2xl">Inbox</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          {memos.length === 0
            ? 'Nothing is waiting on you right now.'
            : memos.length === 1
              ? 'One memo needs your decision.'
              : memos.length + ' memos need your decision, oldest first.'}
          {urgent.length > 0
            ? ' ' + urgent.length + ' marked urgent.'
            : ''}
        </p>
      </header>

      <MemoTable
        memos={memos}
        showAge
        emptyMessage="No memos are waiting on you."
      />
    </div>
  )
}
