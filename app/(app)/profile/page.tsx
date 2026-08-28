import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ChangePasswordForm } from '@/components/app/change-password-form'
import { ProfileForm } from '@/components/app/profile-form'
import { getSessionUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Your profile · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  return (
    <div className="max-w-lg space-y-10">
      <header>
        <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          {user.organizationName}
        </p>
        <h1 className="mt-2 text-2xl">Your profile</h1>
      </header>

      <section>
        <h2 className="text-sm font-semibold">Profile</h2>
        <p className="mt-1 text-xs text-muted">
          Your email and role are set by an administrator.
        </p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Email</dt>
          <dd className="font-data text-ink-soft">{user.email}</dd>
          <dt className="text-muted">Role</dt>
          <dd className="text-ink-soft">
            {user.role === 'ORG_ADMIN'
              ? 'Organization administrator'
              : user.role === 'SUPER_ADMIN'
                ? 'Platform administrator'
                : 'Employee'}
          </dd>
        </dl>
        <div className="mt-4">
          <ProfileForm name={user.name} designation={user.designation} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Password</h2>
        <div className="mt-3">
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  )
}
