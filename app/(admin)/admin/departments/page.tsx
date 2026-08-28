import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { NamedListManager } from '@/components/app/named-list-manager'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { scoped, tenantContext } from '@/lib/tenant'

export const metadata: Metadata = { title: 'Departments · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

export default async function DepartmentsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!isAdmin(user)) redirect('/dashboard')

  const db = scoped(tenantContext(user))
  const departments = await db.department.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, description: true, isActive: true },
  })

  return (
    <div className="space-y-6">
      <header>
        <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          {departments.length} total
        </p>
        <h1 className="mt-2 text-2xl">Departments</h1>
      </header>

      <NamedListManager
        items={departments}
        apiBasePath="/api/departments"
        singular="department"
        emptyMessage="No active departments yet."
        inactiveHint="Deactivating preserves the memos and users already linked to a department."
      />
    </div>
  )
}
