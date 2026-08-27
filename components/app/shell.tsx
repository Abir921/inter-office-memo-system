import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bell, LogOut, UserRound } from 'lucide-react'
import { signOutAction } from '@/app/(app)/actions'
import { getSessionUser, isAdmin, type SessionUser } from '@/lib/auth'
import { scoped, tenantContext } from '@/lib/tenant'
import { Nav } from './nav'

/**
 * The signed-in chrome, shared by the (app) and (admin) route groups.
 *
 * The session check here is the real guard, not the middleware. Middleware
 * only saves a signed-out visitor from watching a protected page load first.
 *
 * `requireAdminRole` additionally refuses ordinary users. Hiding the admin
 * links in the sidebar is cosmetic; this is the check that matters.
 */
export async function AppShell({
  children,
  requireAdminRole = false,
}: {
  children: React.ReactNode
  requireAdminRole?: boolean
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (requireAdminRole && !isAdmin(user)) redirect('/dashboard')

  const db = scoped(tenantContext(user))

  const [inboxCount, unread] = await Promise.all([
    db.step.count({
      state: 'CURRENT',
      assigneeId: user.id,
      memo: { status: { in: ['SUBMITTED', 'PENDING_REVIEW', 'PENDING_APPROVAL'] } },
    }),
    db.notification.countUnread(),
  ])

  const counts = { inbox: inboxCount, notifications: unread }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-50 h-14 border-b border-rule bg-paper">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <Nav isAdmin={isAdmin(user)} counts={counts} />

          <Link href="/dashboard" className="flex min-w-0 items-baseline gap-2.5">
            <span className="font-data hidden text-[11px] uppercase tracking-[0.18em] text-muted sm:inline">
              Form&nbsp;IOM&#8209;1
            </span>
            <span className="truncate text-sm font-semibold text-ink">
              {user.organizationName}
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/notifications"
              aria-label={unread > 0 ? unread + ' unread notifications' : 'Notifications'}
              className="relative rounded-sm p-2 text-ink-soft hover:bg-wash hover:text-ink"
            >
              <Bell className="h-4 w-4" />
              {unread > 0 ? (
                <span className="font-data absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-stamp px-1 text-center text-[10px] leading-4 text-paper">
                  {unread > 99 ? '99+' : unread}
                </span>
              ) : null}
            </Link>

            <Link
              href="/profile"
              className="flex items-center gap-2 rounded-sm p-2 text-ink-soft hover:bg-wash hover:text-ink"
            >
              <UserRound className="h-4 w-4" />
              <span className="hidden max-w-32 truncate text-sm sm:inline">{user.name}</span>
            </Link>

            <form action={signOutAction}>
              <button
                type="submit"
                title="Sign out"
                className="flex items-center rounded-sm p-2 text-ink-soft hover:bg-wash hover:text-ink"
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="lg:pl-56">
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  )
}

export type { SessionUser }
