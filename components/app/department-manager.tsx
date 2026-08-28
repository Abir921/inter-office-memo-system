'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export interface DepartmentRow {
  id: string
  name: string
  description: string | null
  isActive: boolean
}

function DepartmentRow({ dept }: { dept: DepartmentRow }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(dept.name)
  const [description, setDescription] = useState(dept.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function save(patch: Partial<{ name: string; description: string; isActive: boolean }>) {
    setError(null)
    setPending(true)

    try {
      const response = await fetch('/api/departments/' + dept.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: patch.name ?? name,
          description: patch.description ?? description,
          isActive: patch.isActive ?? dept.isActive,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError(body.error ?? 'That change was not saved.')
        return
      }

      setEditing(false)
      router.refresh()
    } catch {
      setError('That change was not saved. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  if (editing) {
    return (
      <li className="space-y-2 p-4">
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            maxLength={300}
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={pending} onClick={() => save({})}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              setEditing(false)
              setName(dept.name)
              setDescription(dept.description ?? '')
              setError(null)
            }}
          >
            Cancel
          </Button>
        </div>
      </li>
    )
  }

  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      {error ? (
        <Alert variant="error" className="w-full">
          {error}
        </Alert>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{dept.name}</p>
        {dept.description ? (
          <p className="mt-0.5 text-xs text-muted">{dept.description}</p>
        ) : null}
      </div>
      {!dept.isActive ? (
        <span className="font-data rounded-sm border border-rule bg-wash px-1.5 py-0.5 text-[11px] uppercase tracking-[0.08em] text-muted">
          Inactive
        </span>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => save({ isActive: !dept.isActive })}
        >
          {dept.isActive ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </li>
  )
}

export function DepartmentManager({ departments }: { departments: DepartmentRow[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)

    try {
      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(body.error ?? 'The department was not created.')
        return
      }

      setName('')
      setDescription('')
      router.refresh()
    } catch {
      setError('The department was not created. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  const active = departments.filter((d) => d.isActive)
  const inactive = departments.filter((d) => !d.isActive)

  return (
    <div className="space-y-8">
      <form onSubmit={create} className="flex flex-wrap items-end gap-3 rounded-sm border border-rule bg-card p-4">
        <Field label="New department" htmlFor="new-dept-name" className="min-w-48 flex-1">
          <Input
            id="new-dept-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="e.g. Procurement"
            required
          />
        </Field>
        <Field label="Description (optional)" htmlFor="new-dept-desc" className="min-w-48 flex-1">
          <Input
            id="new-dept-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
          />
        </Field>
        <Button type="submit" disabled={pending}>
          <Plus className="h-3.5 w-3.5" />
          {pending ? 'Adding…' : 'Add department'}
        </Button>
      </form>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div>
        <h2 className="text-sm font-semibold">Active</h2>
        <ul className="mt-3 divide-y divide-rule overflow-hidden rounded-sm border border-rule bg-card">
          {active.length === 0 ? (
            <li className="p-6 text-center text-sm text-muted">No active departments yet.</li>
          ) : (
            active.map((d) => <DepartmentRow key={d.id} dept={d} />)
          )}
        </ul>
      </div>

      {inactive.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold">Inactive</h2>
          <p className="mt-1 text-xs text-muted">
            Deactivating preserves the memos and users already linked to a department.
          </p>
          <ul className="mt-3 divide-y divide-rule overflow-hidden rounded-sm border border-rule bg-card opacity-70">
            {inactive.map((d) => (
              <DepartmentRow key={d.id} dept={d} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
