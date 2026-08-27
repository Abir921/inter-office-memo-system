import type { Metadata } from 'next'
import { RegisterForm } from './register-form'

export const metadata: Metadata = { title: 'Register an organization · Inter-Office Memo' }

export default function RegisterOrgPage() {
  return (
    <section>
      <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
        New file
      </p>
      <h1 className="mt-3 text-2xl">Register an organization</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        This creates your organization and your administrator account. You can
        add departments, colleagues and memo categories straight afterwards.
      </p>

      <div className="mt-8">
        <RegisterForm />
      </div>
    </section>
  )
}
