'use client'

import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setSaved(false)

    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'The two passwords do not match.' })
      return
    }

    setPending(true)

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(body.error ?? 'Your password was not changed. Try again.')
        if (body.fields) setFieldErrors(body.fields)
        return
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSaved(true)
    } catch {
      setError('Your password was not changed. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {saved ? <Alert variant="success">Password changed.</Alert> : null}

      <Field
        label="Current password"
        htmlFor="current-password"
        error={fieldErrors.currentPassword}
        required
      >
        <Input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="New password"
          htmlFor="new-password"
          error={fieldErrors.newPassword}
          hint="At least 8 characters."
          required
        >
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>

        <Field
          label="Confirm new password"
          htmlFor="confirm-password"
          error={fieldErrors.confirmPassword}
          required
        >
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Changing…' : 'Change password'}
      </Button>
    </form>
  )
}
