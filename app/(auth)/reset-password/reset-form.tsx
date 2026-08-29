'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/input'
import { resetPasswordAction, type ResetPasswordState } from './actions'

const EMPTY: ResetPasswordState = {}

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, EMPTY)

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />

      {state.error ? (
        <Alert variant="error">
          {state.error}{' '}
          <Link href="/forgot-password" className="underline underline-offset-4">
            Request a new link
          </Link>
          .
        </Alert>
      ) : null}

      <Field
        label="New password"
        htmlFor="newPassword"
        error={state.fieldErrors?.newPassword}
        hint="At least 8 characters."
        required
      >
        <PasswordInput
          id="newPassword"
          name="newPassword"
          autoComplete="new-password"
          aria-invalid={Boolean(state.fieldErrors?.newPassword)}
          required
        />
      </Field>

      <Field
        label="Confirm new password"
        htmlFor="confirmPassword"
        error={state.fieldErrors?.confirmPassword}
        required
      >
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
          required
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  )
}
