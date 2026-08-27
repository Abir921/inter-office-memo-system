import Link from 'next/link'
import type { MemoListRow } from '@/lib/memo-queries'
import { agePending, stampDate } from '@/lib/format'
import { PriorityChip, StatusBadge } from './status-badge'

/**
 * The memo lists. A table on wide screens, stacked cards below 640px — the
 * same rows either way, never a horizontally scrolling table on a phone.
 */
export function MemoTable({
  memos,
  emptyMessage,
  showAge = false,
  showAuthor = true,
}: {
  memos: MemoListRow[]
  emptyMessage: string
  /** Inbox shows how long a memo has been sitting; other lists do not. */
  showAge?: boolean
  showAuthor?: boolean
}) {
  if (memos.length === 0) {
    return (
      <p className="rounded-sm border border-dashed border-rule bg-card p-8 text-center text-sm text-muted">
        {emptyMessage}
      </p>
    )
  }

  return (
    <>
      {/* Wide: a proper table. */}
      <div className="hidden overflow-x-auto rounded-sm border border-rule bg-card sm:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-rule bg-wash">
            <tr className="font-data text-[11px] uppercase tracking-[0.1em] text-muted">
              <th className="px-4 py-2.5 font-medium">Number</th>
              <th className="px-4 py-2.5 font-medium">Subject</th>
              {showAuthor ? <th className="px-4 py-2.5 font-medium">From</th> : null}
              <th className="px-4 py-2.5 font-medium">With</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">{showAge ? 'Waiting' : 'Activity'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {memos.map((memo) => {
              const current = memo.steps[0]
              return (
                <tr key={memo.id} className="transition-colors hover:bg-wash">
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={'/memos/' + memo.id}
                      className="font-data text-xs text-ink-soft underline-offset-4 hover:underline"
                    >
                      {memo.memoNumber}
                    </Link>
                  </td>
                  <td className="max-w-sm px-4 py-3 align-top">
                    <Link href={'/memos/' + memo.id} className="block">
                      <span className="font-medium text-ink">{memo.subject}</span>
                      <PriorityChip priority={memo.priority} className="ml-2 align-middle" />
                    </Link>
                  </td>
                  {showAuthor ? (
                    <td className="px-4 py-3 align-top text-ink-soft">{memo.author.name}</td>
                  ) : null}
                  <td className="px-4 py-3 align-top text-ink-soft">
                    {current ? (
                      <>
                        <span className="font-data text-xs text-muted">
                          {String(current.position).padStart(2, '0')}
                        </span>{' '}
                        {current.assignee.name}
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge status={memo.status} />
                  </td>
                  <td className="font-data px-4 py-3 align-top text-xs text-muted">
                    {showAge && current
                      ? agePending(memo.submittedAt ?? current.createdAt)
                      : stampDate(memo.lastActivityAt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Narrow: cards, so nothing is cut off at 375px. */}
      <ul className="divide-y divide-rule overflow-hidden rounded-sm border border-rule bg-card sm:hidden">
        {memos.map((memo) => {
          const current = memo.steps[0]
          return (
            <li key={memo.id}>
              <Link href={'/memos/' + memo.id} className="block p-4 transition-colors hover:bg-wash">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-data text-[11px] text-muted">{memo.memoNumber}</span>
                  <StatusBadge status={memo.status} />
                  <PriorityChip priority={memo.priority} />
                </div>
                <p className="mt-1.5 text-sm font-medium text-ink">{memo.subject}</p>
                <p className="font-data mt-1.5 text-[11px] text-muted">
                  {showAuthor ? memo.author.name + ' · ' : ''}
                  {current ? 'with ' + current.assignee.name : 'no current step'}
                  {' · '}
                  {showAge && current
                    ? 'waiting ' + agePending(memo.submittedAt ?? current.createdAt)
                    : stampDate(memo.lastActivityAt)}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
