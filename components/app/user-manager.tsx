'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { Role, UserStatus } from '@prisma/client'
import { Plus } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input, Select } from '@/components/ui/input'

export interface DepartmentOption {
  id: string
  name: string
}

export interface UserRow {
  id: string
  name: string
  email: string
  designation: string | null
  role: Role
  status: UserStatus
  lastLoginAt: Date | null
  department: { id: string; name: string } | null
}

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Platform admin',
  ORG_ADMIN: 'Administrator',
  USER: 'Employee',
}

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 12) + '!1'
}

function CreateUserForm({
  departments,
  onCreated,
}: {
  departments: DepartmentOption[]
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [designation, setDesignation] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [role, setRole] = useState<'USER' | 'ORG_ADMIN'>('USER')
  const [password, setPassword] = useState(randomPassword())
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setPending(true)

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, designation, departmentId, role, password }),
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(body.error ?? 'The user was not created.')
        if (body.fields) setFieldErrors(body.fields)
        return
      }

      setCreated({ email, password })
      onCreated()
    } catch {
      setError('The user was not created. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  function reset() {
    setOpen(false)
    setName('')
    setEmail('')
    setDesignation('')
    setDepartmentId('')
    setRole('USER')
    setPassword(randomPassword())
    setError(null)
    setFieldErrors({})
    setCreated(null)
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Add a user
      </Button>
    )
  }

  if (created) {
    return (
      <div className="max-w-lg space-y-3 rounded-sm border border-seal/40 bg-seal/5 p-4">
        <p className="text-sm font-medium text-ink">User created.</p>
        <p className="text-sm text-ink-soft">
          Share these with them directly. They will not be shown again.
        </p>
        <dl className="space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="w-24 text-muted">Email</dt>
            <dd className="font-data text-ink">{created.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 text-muted">Password</dt>
            <dd className="font-data text-ink">{created.password}</dd>
          </div>
        </dl>
        <Button type="button" size="sm" onClick={reset}>
          Done
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4 rounded-sm border border-rule bg-card p-4">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <Field label="Full name" htmlFor="new-user-name" error={fieldErrors.name} required>
        <Input id="new-user-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>

      <Field label="Email" htmlFor="new-user-email" error={fieldErrors.email} required>
        <Input
          id="new-user-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Designation" htmlFor="new-user-designation">
          <Input
            id="new-user-designation"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="Finance Manager"
          />
        </Field>

        <Field label="Department" htmlFor="new-user-dept">
          <Select id="new-user-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">Not specified</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Role" htmlFor="new-user-role">
        <Select id="new-user-role" value={role} onChange={(e) => setRole(e.target.value as 'USER' | 'ORG_ADMIN')}>
          <option value="USER">Employee</option>
          <option value="ORG_ADMIN">Administrator</option>
        </Select>
      </Field>

      <Field
        label="Temporary password"
        htmlFor="new-user-password"
        error={fieldErrors.password}
        hint="Generated for you. Change it, or leave it and share it with them."
        required
      >
        <Input
          id="new-user-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create user'}
        </Button>
        <Button type="button" variant="ghost" onClick={reset} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function EditUserRow({
  u,
  departments,
  currentUserId,
  onChanged,
}: {
  u: UserRow
  departments: DepartmentOption[]
  currentUserId: string
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(u.name)
  const [designation, setDesignation] = useState(u.designation ?? '')
  const [departmentId, setDepartmentId] = useState(u.department?.id ?? '')
  const [role, setRole] = useState<'USER' | 'ORG_ADMIN'>(
    u.role === 'ORG_ADMIN' ? 'ORG_ADMIN' : 'USER',
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function saveEdit() {
    setError(null)
    setPending(true)
    try {
      const response = await fetch('/api/users/' + u.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, designation, departmentId, role }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.error ?? 'That change was not saved.')
        return
      }
      setEditing(false)
      onChanged()
    } catch {
      setError('That change was not saved. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  async function toggleStatus() {
    setError(null)
    setPending(true)
    try {
      const response = await fetch('/api/users/' + u.id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.error ?? 'That change was not saved.')
        return
      }
      onChanged()
    } catch {
      setError('That change was not saved. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  if (editing) {
    return (
      <tr className="border-b border-rule bg-wash">
        <td colSpan={6} className="p-4">
          {error ? (
            <Alert variant="error" className="mb-3">
              {error}
            </Alert>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            <Input
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="Designation"
            />
            <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Select value={role} onChange={(e) => setRole(e.target.value as 'USER' | 'ORG_ADMIN')}>
              <option value="USER">Employee</option>
              <option value="ORG_ADMIN">Administrator</option>
            </Select>
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={saveEdit}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-rule last:border-0 hover:bg-wash">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-ink">{u.name}</p>
        <p className="font-data text-xs text-muted">{u.email}</p>
        {error ? <p className="mt-1 text-xs text-stamp">{error}</p> : null}
      </td>
      <td className="px-4 py-3 text-sm text-ink-soft">{u.designation ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-ink-soft">{u.department?.name ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-ink-soft">{ROLE_LABEL[u.role]}</td>
      <td className="px-4 py-3">
        <span
          className={
            u.status === 'ACTIVE'
              ? 'inline-flex items-center rounded-sm border border-seal/40 bg-seal/10 px-2 py-0.5 text-xs text-seal'
              : 'inline-flex items-center rounded-sm border border-rule bg-wash px-2 py-0.5 text-xs text-muted'
          }
        >
          {u.status === 'ACTIVE' ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          {u.id !== currentUserId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={toggleStatus}
            >
              {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

export function UserManager({
  users,
  departments,
  currentUserId,
}: {
  users: UserRow[]
  departments: DepartmentOption[]
  currentUserId: string
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return users.filter((u) => {
      if (query && !(u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))) {
        return false
      }
      if (departmentFilter && u.department?.id !== departmentFilter) return false
      if (roleFilter && u.role !== roleFilter) return false
      if (statusFilter && u.status !== statusFilter) return false
      return true
    })
  }, [users, q, departmentFilter, roleFilter, statusFilter])

  return (
    <div className="space-y-6">
      <CreateUserForm departments={departments} onCreated={() => router.refresh()} />

      <div className="flex flex-wrap gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or email"
          className="w-56"
          aria-label="Search users"
        />
        <Select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="w-44"
          aria-label="Filter by department"
        >
          <option value="">Any department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="w-40"
          aria-label="Filter by role"
        >
          <option value="">Any role</option>
          <option value="ORG_ADMIN">Administrator</option>
          <option value="USER">Employee</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-36"
          aria-label="Filter by status"
        >
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-sm border border-rule bg-card">
        <table className="w-full text-left">
          <thead className="border-b border-rule bg-wash">
            <tr className="font-data text-[11px] uppercase tracking-[0.1em] text-muted">
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Designation</th>
              <th className="px-4 py-2.5 font-medium">Department</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-muted">
                  No users match those filters.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <EditUserRow
                  key={u.id}
                  u={u}
                  departments={departments}
                  currentUserId={currentUserId}
                  onChanged={() => router.refresh()}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
