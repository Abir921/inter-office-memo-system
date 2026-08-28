import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { OrgSettingsForm } from '@/components/app/org-settings-form'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { scoped, tenantContext } from '@/lib/tenant'

export const metadata: Metadata = { title: 'Organization · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

export default async function OrganizationSettingsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  // The (admin) layout already redirects non-admins; this is the second,
  // independent check the page itself performs before rendering anything.
  if (!isAdmin(user)) redirect('/dashboard')

  const db = scoped(tenantContext(user))
  const [org, departmentCount, activeUserCount, memoCount] = await Promise.all([
    db.organization.get(),
    db.department.count({ isActive: true }),
    db.user.count({ status: 'ACTIVE' }),
    db.memo.count(),
  ])

  if (!org) redirect('/dashboard')

  return (
    <div className="space-y-10">
      <header>
        <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          {org.slug}
        </p>
        <h1 className="mt-2 text-2xl">Organization</h1>
      </header>

      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-rule bg-rule sm:max-w-md">
        <div className="bg-card p-4">
          <dt className="text-xs text-muted">Departments</dt>
          <dd className="font-data mt-1 text-xl text-ink">{departmentCount}</dd>
        </div>
        <div className="bg-card p-4">
          <dt className="text-xs text-muted">Active users</dt>
          <dd className="font-data mt-1 text-xl text-ink">{activeUserCount}</dd>
        </div>
        <div className="bg-card p-4">
          <dt className="text-xs text-muted">Memos, all time</dt>
          <dd className="font-data mt-1 text-xl text-ink">{memoCount}</dd>
        </div>
      </dl>

      <OrgSettingsForm
        initial={{
          name: org.name,
          logoUrl: org.logoUrl,
          contactEmail: org.contactEmail,
          contactPhone: org.contactPhone,
          address: org.address,
        }}
      />
    </div>
  )
}
