'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import type { NotificationType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { stamp } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface NotificationRow {
  id: string
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  createdAt: Date
  memoId: string | null
}

const TONE: Record<NotificationType, string> = {
  ACTION_REQUIRED: 'border-l-ink',
  MEMO_APPROVED: 'border-l-seal',
  MEMO_REJECTED: 'border-l-stamp',
  CHANGES_REQUESTED: 'border-l-pending',
  COMMENT_ADDED: 'border-l-rule',
  MEMO_RESUBMITTED: 'border-l-ink',
  WORKFLOW_COMPLETED: 'border-l-seal',
  WORKFLOW_ASSIGNED: 'border-l-ink',
}

export function NotificationList({
  notifications,
  unreadCount,
}: {
  notifications: NotificationRow[]
  unreadCount: number
}) {
  const router = useRouter()
  const [pendingAll, setPendingAll] = useState(false)

  async function markOne(id: string) {
    try {
      await fetch('/api/notifications/' + id + '/read', { method: 'POST' })
      router.refresh()
    } catch {
      // A failed mark-as-read is not worth surfacing an error for; the user
      // can simply try again, or it clears next time they open the list.
    }
  }

  async function markAll() {
    setPendingAll(true)
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' })
      router.refresh()
    } finally {
      setPendingAll(false)
    }
  }

  if (notifications.length === 0) {
    return (
      <p className="rounded-sm border border-dashed border-rule bg-card p-8 text-center text-sm text-muted">
        Nothing here yet. You will see updates on memos you are involved in.
      </p>
    )
  }

  return (
    <div>
      {unreadCount > 0 ? (
        <div className="mb-4 flex justify-end">
          <Button type="button" variant="outline" size="sm" disabled={pendingAll} onClick={markAll}>
            {pendingAll ? 'Marking…' : 'Mark all as read'}
          </Button>
        </div>
      ) : null}

      <ul className="divide-y divide-rule overflow-hidden rounded-sm border border-rule bg-card">
        {notifications.map((n) => {
          const body = (
            <div
              className={cn(
                'flex items-start gap-3 border-l-2 p-4 transition-colors',
                TONE[n.type],
                n.isRead ? 'bg-card' : 'bg-wash',
              )}
            >
              {!n.isRead ? (
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" aria-hidden />
              ) : (
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm', n.isRead ? 'text-ink-soft' : 'font-medium text-ink')}>
                  {n.title}
                </p>
                <p className="mt-0.5 text-sm text-muted">{n.message}</p>
                <p className="font-data mt-1.5 text-[11px] text-muted">{stamp(n.createdAt)}</p>
              </div>
              {!n.isRead ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    markOne(n.id)
                  }}
                  className="font-data shrink-0 rounded-sm px-2 py-1 text-[11px] text-muted hover:bg-rule/40 hover:text-ink"
                >
                  Mark read
                </button>
              ) : null}
            </div>
          )

          return (
            <li key={n.id}>
              {n.memoId ? (
                <Link
                  href={'/memos/' + n.memoId}
                  onClick={() => !n.isRead && markOne(n.id)}
                  className="block"
                >
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
