import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { MemoComposer } from '@/components/app/memo-composer'
import { getSessionUser } from '@/lib/auth'
import { scoped, tenantContext } from '@/lib/tenant'

export const metadata: Metadata = { title: 'Write a memo · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

export default async function NewMemoPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const db = scoped(tenantContext(user))

  // Every one of these is tenant-scoped, so the pickers can only ever offer
  // this organization's departments, categories and colleagues.
  const [people, departments, categories, templates] = await Promise.all([
    db.user.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        designation: true,
        department: { select: { name: true } },
      },
    }),
    db.department.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.template.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        steps: {
          orderBy: { position: 'asc' },
          select: { position: true, positionLabel: true },
        },
      },
    }),
  ])

  return (
    <div className="space-y-8">
      <header>
        <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          New memo
        </p>
        <h1 className="mt-2 text-2xl">Write a memo</h1>
        <p className="mt-1.5 max-w-prose text-sm text-ink-soft">
          The memo number is assigned when you save. You can keep it as a draft and
          route it later.
        </p>
      </header>

      <MemoComposer
        people={people.map((p) => ({
          id: p.id,
          name: p.name,
          designation: p.designation,
          departmentName: p.department?.name ?? null,
        }))}
        departments={departments}
        categories={categories}
        templates={templates}
        defaultDepartmentId={user.departmentId}
      />
    </div>
  )
}
