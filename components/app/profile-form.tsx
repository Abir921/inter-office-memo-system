'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function ProfileForm({
  name: initialName,
  designation: initialDesignation,
}: {
  name: string
  designation: string | null
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [designation, setDesignation] = useState(initialDesignation ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setPending(true)

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, designation }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError(body.error ?? 'Your profile was not saved. Try again.')
        return
      }

      setSaved(true)
      router.refresh()
    } catch {
      setError('Your profile was not saved. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {saved ? <Alert variant="success">Profile updated.</Alert> : null}

      <Field label="Full name" htmlFor="profile-name" required>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setSaved(false)
          }}
          maxLength={120}
          required
        />
      </Field>

      <Field label="Designation" htmlFor="profile-designation" hint="Shown next to your name on memos you act on.">
        <Input
          id="profile-designation"
          value={designation}
          onChange={(e) => {
            setDesignation(e.target.value)
            setSaved(false)
          }}
          maxLength={120}
          placeholder="Finance Manager"
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  )
}
