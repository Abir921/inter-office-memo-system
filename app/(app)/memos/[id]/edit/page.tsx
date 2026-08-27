import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { Alert } from '@/components/ui/alert'
import { MemoComposer } from '@/components/app/memo-composer'
import { getSessionUser } from '@/lib/auth'
import { scoped, tenantContext } from '@/lib/tenant'

export const metadata: Metadata = { title: 'Edit memo · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

export default async function EditMemoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const user = await getSessionUser()
  if (!user) redirect('/login')

  const db = scoped(tenantContext(user))

  // Scoped to the tenant, then narrowed to this author. Another organization's
  // memo and a colleague's memo look identical from here: not found.
  const memo = await db.memo.findById(id, { where: { authorId: user.id } })
  if (!memo) notFound()

  // A memo that has moved on is part of the record. The route back is the
  // workflow (request changes), not the edit form.
  if (memo.status !== 'DRAFT' && memo.status !== 'CHANGES_REQUESTED') {
    redirect('/memos/' + memo.id)
  }

  const [people, departments, categories, templates] = await Promise.all([
    db.user.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, designation: true, department: { select: { name: true } } },
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
        steps: { orderBy: { position: 'asc' }, select: { position: true, positionLabel: true } },
      },
    }),
  ])

  const isRevision = memo.status === 'CHANGES_REQUESTED'

  return (
    <div className="space-y-8">
      <header>
        <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          {memo.memoNumber}
        </p>
        <h1 className="mt-2 text-2xl">{isRevision ? 'Revise and resubmit' : 'Edit draft'}</h1>
      </header>

      {isRevision ? (
        <Alert variant="pending" title="This memo was sent back for changes">
          Make the changes that were asked for, then resubmit. A new version is recorded
          and the routing starts again at the first desk. Nothing already decided is
          erased.
        </Alert>
      ) : null}

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
        existing={{
          id: memo.id,
          memoNumber: memo.memoNumber,
          subject: memo.subject,
          bodyHtml: memo.bodyHtml,
          departmentId: memo.departmentId,
          categoryId: memo.categoryId,
          priority: memo.priority,
          status: memo.status,
        }}
      />
    </div>
  )
}
