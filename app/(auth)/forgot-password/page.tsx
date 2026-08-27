import type { Metadata } from 'next'
import { ForgotForm } from './forgot-form'

export const metadata: Metadata = { title: 'Forgot your password · Inter-Office Memo' }

export default function ForgotPasswordPage() {
  return (
    <section>
      <h1 className="text-2xl">Forgot your password</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Enter your email address and we will send a link to set a new password.
      </p>
      <div className="mt-8">
        <ForgotForm />
      </div>
    </section>
  )
}
