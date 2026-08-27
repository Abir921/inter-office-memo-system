'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { forgotPasswordAction, type ForgotPasswordState } from './actions'

const EMPTY: ForgotPasswordState = {}

export function ForgotForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, EMPTY)

  if (state.sent) {
    return (
      <div className="space-y-5">
        <Alert variant="info" title="Check your email">
          If that address belongs to an active account, a reset link is on its way.
          The link is good for one hour and can be used once.
        </Alert>

        {state.devLink ? (
          <Alert variant="pending" title="Development only">
            <p>Email delivery is not configured, so the link is shown here instead.</p>
            <Link href={state.devLink} className="mt-2 block break-all font-data text-xs underline">
              {state.devLink}
            </Link>
          </Alert>
        ) : null}

        <Link
          href="/login"
          className="block text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          aria-invalid={Boolean(state.fieldErrors?.email)}
          required
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Sending…' : 'Send a reset link'}
      </Button>

      <Link
        href="/login"
        className="block text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
      >
        Back to sign in
      </Link>
    </form>
  )
}
