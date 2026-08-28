import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { DepartmentManager } from '@/components/app/department-manager'
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

      <DepartmentManager departments={departments} />
    </div>
  )
}
