'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { loginAction, type LoginState } from './actions'

const EMPTY: LoginState = {}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, EMPTY)
  const [organizationId, setOrganizationId] = useState('')

  // Shown only when one email address belongs to more than one organization,
  // and only after the password has already been verified.
  const mustChoose = Boolean(state.organizations?.length)

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      {mustChoose ? (
        <Alert variant="info" title="Choose your organization">
          This email address is registered with more than one organization.
        </Alert>
      ) : null}

      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={state.values?.email}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          required
        />
      </Field>

      <Field label="Password" htmlFor="password" error={state.fieldErrors?.password} required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(state.fieldErrors?.password)}
          required
        />
      </Field>

      {mustChoose ? (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-ink">Organization</legend>
          {state.organizations?.map((org) => (
            <label
              key={org.id}
              className="flex cursor-pointer items-center gap-3 rounded-sm border border-rule bg-card px-3 py-2.5 text-sm has-checked:border-ink"
            >
              <input
                type="radio"
                name="organizationId"
                value={org.id}
                checked={organizationId === org.id}
                onChange={(e) => setOrganizationId(e.target.value)}
                required
              />
              {org.name}
            </label>
          ))}
        </fieldset>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <Link
          href="/forgot-password"
          className="text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          Forgot your password?
        </Link>
        <Link
          href="/register-org"
          className="text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          Register an organization
        </Link>
      </div>
    </form>
  )
}
