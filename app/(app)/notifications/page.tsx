import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { NotificationList } from '@/components/app/notification-list'
import { getSessionUser } from '@/lib/auth'
import { scoped, tenantContext } from '@/lib/tenant'

export const metadata: Metadata = { title: 'Notifications · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const db = scoped(tenantContext(user))

  // notification.findMany is scoped by organization AND user (lib/tenant.ts):
  // there is no id or filter that reaches into anyone else's notifications.
  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        isRead: true,
        createdAt: true,
        memoId: true,
      },
    }),
    db.notification.countUnread(),
  ])

  return (
    <div className="space-y-6">
      <header>
        <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          {unreadCount > 0 ? unreadCount + ' unread' : 'All caught up'}
        </p>
        <h1 className="mt-2 text-2xl">Notifications</h1>
      </header>

      <NotificationList notifications={notifications} unreadCount={unreadCount} />
    </div>
  )
}
