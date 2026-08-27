'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { registerOrgAction, type RegisterOrgState } from './actions'

const EMPTY: RegisterOrgState = {}

/** "Northwind Corp" -> "northwind-corp" */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerOrgAction, EMPTY)
  const [name, setName] = useState(state.values?.organizationName ?? '')
  const [slug, setSlug] = useState(state.values?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(false)

  const effectiveSlug = slugTouched ? slug : slugify(name)
  const year = new Date().getFullYear()

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      <fieldset className="space-y-4">
        <legend className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          The organization
        </legend>

        <Field
          label="Organization name"
          htmlFor="organizationName"
          error={state.fieldErrors?.organizationName}
          required
        >
          <Input
            id="organizationName"
            name="organizationName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Northwind Corp"
            aria-invalid={Boolean(state.fieldErrors?.organizationName)}
            required
          />
        </Field>

        <Field
          label="Short identifier"
          htmlFor="slug"
          error={state.fieldErrors?.slug}
          hint={
            effectiveSlug
              ? 'Memo numbers will read ' + effectiveSlug.toUpperCase() + '-' + year + '-0001.'
              : 'Lowercase letters, numbers and hyphens. Used in every memo number.'
          }
          required
        >
          <Input
            id="slug"
            name="slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value)
            }}
            placeholder="northwind"
            className="font-data"
            aria-invalid={Boolean(state.fieldErrors?.slug)}
            required
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          Your administrator account
        </legend>

        <Field
          label="Your full name"
          htmlFor="adminName"
          error={state.fieldErrors?.adminName}
          required
        >
          <Input
            id="adminName"
            name="adminName"
            defaultValue={state.values?.adminName}
            autoComplete="name"
            aria-invalid={Boolean(state.fieldErrors?.adminName)}
            required
          />
        </Field>

        <Field
          label="Your email"
          htmlFor="adminEmail"
          error={state.fieldErrors?.adminEmail}
          required
        >
          <Input
            id="adminEmail"
            name="adminEmail"
            type="email"
            defaultValue={state.values?.adminEmail}
            autoComplete="username"
            aria-invalid={Boolean(state.fieldErrors?.adminEmail)}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Password"
            htmlFor="password"
            error={state.fieldErrors?.password}
            hint="At least 8 characters."
            required
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(state.fieldErrors?.password)}
              required
            />
          </Field>

          <Field
            label="Confirm password"
            htmlFor="confirmPassword"
            error={state.fieldErrors?.confirmPassword}
            required
          >
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
              required
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          Contact details <span className="normal-case tracking-normal">(optional)</span>
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact email" htmlFor="contactEmail" error={state.fieldErrors?.contactEmail}>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={state.values?.contactEmail}
            />
          </Field>

          <Field label="Contact phone" htmlFor="contactPhone" error={state.fieldErrors?.contactPhone}>
            <Input id="contactPhone" name="contactPhone" defaultValue={state.values?.contactPhone} />
          </Field>
        </div>

        <Field label="Address" htmlFor="address" error={state.fieldErrors?.address}>
          <Textarea id="address" name="address" rows={2} defaultValue={state.values?.address} />
        </Field>
      </fieldset>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Registering…' : 'Register organization'}
      </Button>

      <p className="text-center text-sm text-ink-soft">
        Already registered?{' '}
        <Link href="/login" className="text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
