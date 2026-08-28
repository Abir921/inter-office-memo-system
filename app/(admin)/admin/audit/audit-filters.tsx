'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'

export interface UserOption {
  id: string
  name: string
}

function labelize(eventType: string): string {
  return eventType
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export function AuditFilters({
  eventTypes,
  users,
}: {
  eventTypes: string[]
  users: UserOption[]
}) {
  const router = useRouter()
  const params = useSearchParams()

  function apply(patch: Record<string, string>) {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    next.delete('page')
    router.push('/admin/audit?' + next.toString())
  }

  const hasFilters = ['eventType', 'userId', 'from', 'to'].some((k) => params.get(k))

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-56">
        <label className="text-xs text-muted" htmlFor="af-type">
          Event type
        </label>
        <Select
          id="af-type"
          className="mt-1"
          value={params.get('eventType') ?? ''}
          onChange={(e) => apply({ eventType: e.target.value })}
        >
          <option value="">Any</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>
              {labelize(t)}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-44">
        <label className="text-xs text-muted" htmlFor="af-user">
          User
        </label>
        <Select
          id="af-user"
          className="mt-1"
          value={params.get('userId') ?? ''}
          onChange={(e) => apply({ userId: e.target.value })}
        >
          <option value="">Any</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-36">
        <label className="text-xs text-muted" htmlFor="af-from">
          From
        </label>
        <Input
          id="af-from"
          type="date"
          className="mt-1"
          value={params.get('from')?.slice(0, 10) ?? ''}
          onChange={(e) => apply({ from: e.target.value ? e.target.value + 'T00:00:00.000Z' : '' })}
        />
      </div>

      <div className="w-36">
        <label className="text-xs text-muted" htmlFor="af-to">
          To
        </label>
        <Input
          id="af-to"
          type="date"
          className="mt-1"
          value={params.get('to')?.slice(0, 10) ?? ''}
          onChange={(e) => apply({ to: e.target.value ? e.target.value + 'T23:59:59.999Z' : '' })}
        />
      </div>

      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => apply({ eventType: '', userId: '', from: '', to: '' })}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      ) : null}
    </div>
  )
}
