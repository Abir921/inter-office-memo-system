import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { NamedListManager } from '@/components/app/named-list-manager'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { scoped, tenantContext } from '@/lib/tenant'

export const metadata: Metadata = { title: 'Memo categories · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!isAdmin(user)) redirect('/dashboard')

  const db = scoped(tenantContext(user))
  const categories = await db.category.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, description: true, isActive: true },
  })

  return (
    <div className="space-y-6">
      <header>
        <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          {categories.length} total
        </p>
        <h1 className="mt-2 text-2xl">Memo categories</h1>
        <p className="mt-1.5 max-w-prose text-sm text-ink-soft">
          Used as a memo field and a filter across Search and Reports.
        </p>
      </header>

      <NamedListManager
        items={categories}
        apiBasePath="/api/categories"
        singular="category"
        emptyMessage="No active categories yet."
        inactiveHint="Deactivating preserves the memos already filed under a category."
      />
    </div>
  )
}
