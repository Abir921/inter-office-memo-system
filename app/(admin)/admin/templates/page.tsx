import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { TemplateManager } from '@/components/app/template-manager'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { scoped, tenantContext } from '@/lib/tenant'

export const metadata: Metadata = { title: 'Workflow templates · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!isAdmin(user)) redirect('/dashboard')

  const db = scoped(tenantContext(user))

  const [templates, departments] = await Promise.all([
    db.template.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { steps: { orderBy: { position: 'asc' } } },
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
          {templates.length} total
        </p>
        <h1 className="mt-2 text-2xl">Workflow templates</h1>
        <p className="mt-1.5 max-w-prose text-sm text-ink-soft">
          Named routing slips an author can start from instead of building a workflow by
          hand. Editing a template does not change memos that already used it.
        </p>
      </header>

      <TemplateManager templates={templates} departments={departments} />
    </div>
  )
}
