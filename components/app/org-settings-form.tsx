'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'

export interface OrgSettings {
  name: string
  logoUrl: string | null
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
}

export function OrgSettingsForm({ initial }: { initial: OrgSettings }) {
  const router = useRouter()
  const [values, setValues] = useState({
    name: initial.name,
    logoUrl: initial.logoUrl ?? '',
    contactEmail: initial.contactEmail ?? '',
    contactPhone: initial.contactPhone ?? '',
    address: initial.address ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)

  function set<K extends keyof typeof values>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
    setSaved(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setPending(true)

    try {
      const response = await fetch('/api/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(body.error ?? 'The organization was not updated. Try again.')
        if (body.fields) setFieldErrors(body.fields)
        return
      }

      setSaved(true)
      router.refresh()
    } catch {
      setError('The organization was not updated. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {saved ? <Alert variant="success">Organization updated.</Alert> : null}

      <Field label="Organization name" htmlFor="org-name" error={fieldErrors.name} required>
        <Input
          id="org-name"
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          maxLength={120}
          required
        />
      </Field>

      <Field
        label="Logo URL"
        htmlFor="org-logo"
        error={fieldErrors.logoUrl}
        hint="A direct link to an image. Leave blank for none."
      >
        <Input
          id="org-logo"
          value={values.logoUrl}
          onChange={(e) => set('logoUrl', e.target.value)}
          placeholder="https://…"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact email" htmlFor="org-email" error={fieldErrors.contactEmail}>
          <Input
            id="org-email"
            type="email"
            value={values.contactEmail}
            onChange={(e) => set('contactEmail', e.target.value)}
          />
        </Field>
        <Field label="Contact phone" htmlFor="org-phone" error={fieldErrors.contactPhone}>
          <Input
            id="org-phone"
            value={values.contactPhone}
            onChange={(e) => set('contactPhone', e.target.value)}
          />
        </Field>
      </div>

      <Field label="Address" htmlFor="org-address" error={fieldErrors.address}>
        <Textarea
          id="org-address"
          rows={2}
          value={values.address}
          onChange={(e) => set('address', e.target.value)}
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save organization'}
      </Button>
    </form>
  )
}
