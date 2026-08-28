import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { UserManager } from '@/components/app/user-manager'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { scoped, tenantContext } from '@/lib/tenant'

export const metadata: Metadata = { title: 'Users · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!isAdmin(user)) redirect('/dashboard')

  const db = scoped(tenantContext(user))

  const [users, departments] = await Promise.all([
    db.user.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        designation: true,
        role: true,
        status: true,
        lastLoginAt: true,
        department: { select: { id: true, name: true } },
      },
    }),
    db.department.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  return (
    <div className="space-y-6">
      <header>
        <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          {users.length} total
        </p>
        <h1 className="mt-2 text-2xl">Users</h1>
      </header>

      <UserManager users={users} departments={departments} currentUserId={user.id} />
    </div>
  )
}
