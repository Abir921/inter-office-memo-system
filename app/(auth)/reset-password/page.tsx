import type { Metadata } from 'next'
import Link from 'next/link'
import { Alert } from '@/components/ui/alert'
import { isResetTokenUsable } from '@/lib/password-reset'
import { ResetForm } from './reset-form'

export const metadata: Metadata = { title: 'Set a new password · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const usable = token ? await isResetTokenUsable(token) : false

  if (!usable) {
    return (
      <section>
        <h1 className="text-2xl">Set a new password</h1>
        <div className="mt-6 space-y-5">
          <Alert variant="error" title="This link is not valid">
            It may have expired, or it may already have been used. Reset links
            last one hour and work once.
          </Alert>
          <Link
            href="/forgot-password"
            className="block text-sm text-ink underline underline-offset-4"
          >
            Request a new link
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h1 className="text-2xl">Set a new password</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Choose a new password for your account.
      </p>
      <div className="mt-8">
        <ResetForm token={token as string} />
      </div>
    </section>
  )
}
