'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2,
  ClipboardList,
  FileText,
  FolderTree,
  Inbox,
  LayoutDashboard,
  Menu,
  Search,
  ScrollText,
  Settings,
  ShieldCheck,
  Tags,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NavCounts {
  inbox: number
  notifications: number
}

const MAIN = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox', icon: Inbox, count: 'inbox' as const },
  { href: '/memos', label: 'My memos', icon: FileText },
  { href: '/completed', label: 'Completed', icon: ClipboardList },
  { href: '/search', label: 'Search', icon: Search },
]

const ADMIN = [
  { href: '/admin/organization', label: 'Organization', icon: Building2 },
  { href: '/admin/departments', label: 'Departments', icon: FolderTree },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/categories', label: 'Categories', icon: Tags },
  { href: '/admin/templates', label: 'Templates', icon: Settings },
  { href: '/admin/reports', label: 'Reports', icon: ScrollText },
  { href: '/admin/audit', label: 'Audit log', icon: ShieldCheck },
]

function NavLink({
  href,
  label,
  icon: Icon,
  count,
  onNavigate,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors',
        active ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-wash hover:text-ink',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {count && count > 0 ? (
        <span
          className={cn(
            'font-data rounded-sm px-1.5 py-0.5 text-[11px]',
            active ? 'bg-paper/20 text-paper' : 'bg-pending/15 text-pending',
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  )
}

export function Nav({
  isAdmin,
  counts,
}: {
  isAdmin: boolean
  counts: NavCounts
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  const links = (
    <nav className="space-y-1">
      {MAIN.map((item) => (
        <NavLink
          key={item.href}
          {...item}
          count={item.count ? counts[item.count] : undefined}
          onNavigate={close}
        />
      ))}

      {isAdmin ? (
        <>
          <p className="font-data px-3 pt-6 pb-2 text-[10px] uppercase tracking-[0.18em] text-muted">
            Administration
          </p>
          {ADMIN.map((item) => (
            <NavLink key={item.href} {...item} onNavigate={close} />
          ))}
        </>
      ) : null}
    </nav>
  )

  return (
    <>
      {/* Mobile: a hamburger in the header, opening a full-height drawer. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="app-nav"
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="rounded-sm border border-rule bg-card p-2 text-ink lg:hidden"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open ? (
        <div
          id="app-nav"
          className="fixed inset-x-0 bottom-0 top-14 z-40 overflow-y-auto border-t border-rule bg-paper p-4 lg:hidden"
        >
          {links}
        </div>
      ) : null}

      {/* Desktop: a persistent rail, fixed beneath the header. */}
      <aside className="fixed bottom-0 left-0 top-14 hidden w-56 overflow-y-auto border-r border-rule p-4 lg:block">
        {links}
      </aside>
    </>
  )
}
