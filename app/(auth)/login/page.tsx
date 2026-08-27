import type { Metadata } from 'next'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in · Inter-Office Memo' }

export default function LoginPage() {
  return (
    <section>
      <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
        Authorised personnel
      </p>
      <h1 className="mt-3 text-2xl">Sign in</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Use the email address your organization registered for you.
      </p>

      <div className="mt-8">
        <LoginForm />
      </div>
    </section>
  )
}
