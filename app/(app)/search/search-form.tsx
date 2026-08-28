'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Search as SearchIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'

export interface FilterOption {
  id: string
  name: string
}

const STATUSES = [
  ['DRAFT', 'Draft'],
  ['SUBMITTED', 'Submitted'],
  ['PENDING_REVIEW', 'Pending review'],
  ['PENDING_APPROVAL', 'Pending approval'],
  ['CHANGES_REQUESTED', 'Changes requested'],
  ['APPROVED', 'Approved'],
  ['REJECTED', 'Rejected'],
  ['CANCELLED', 'Cancelled'],
] as const

export function SearchForm({
  departments,
  categories,
}: {
  departments: FilterOption[]
  categories: FilterOption[]
}) {
  const router = useRouter()
  const params = useSearchParams()

  const [q, setQ] = useState(params.get('q') ?? '')

  function apply(patch: Record<string, string>) {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    next.delete('page') // any filter change starts back at page 1
    router.push('/search?' + next.toString())
  }

  const hasFilters = ['status', 'priority', 'departmentId', 'categoryId', 'from', 'to'].some(
    (key) => params.get(key),
  )

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          apply({ q })
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Memo number, subject, body, author, department, category…"
            className="pl-9"
            aria-label="Search memos"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <label className="text-xs text-muted" htmlFor="f-status">
            Status
          </label>
          <Select
            id="f-status"
            className="mt-1"
            value={params.get('status') ?? ''}
            onChange={(e) => apply({ status: e.target.value })}
          >
            <option value="">Any</option>
            {STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-32">
          <label className="text-xs text-muted" htmlFor="f-priority">
            Priority
          </label>
          <Select
            id="f-priority"
            className="mt-1"
            value={params.get('priority') ?? ''}
            onChange={(e) => apply({ priority: e.target.value })}
          >
            <option value="">Any</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </Select>
        </div>

        <div className="w-44">
          <label className="text-xs text-muted" htmlFor="f-dept">
            Department
          </label>
          <Select
            id="f-dept"
            className="mt-1"
            value={params.get('departmentId') ?? ''}
            onChange={(e) => apply({ departmentId: e.target.value })}
          >
            <option value="">Any</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-44">
          <label className="text-xs text-muted" htmlFor="f-cat">
            Category
          </label>
          <Select
            id="f-cat"
            className="mt-1"
            value={params.get('categoryId') ?? ''}
            onChange={(e) => apply({ categoryId: e.target.value })}
          >
            <option value="">Any</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-36">
          <label className="text-xs text-muted" htmlFor="f-from">
            From
          </label>
          <Input
            id="f-from"
            type="date"
            className="mt-1"
            value={params.get('from')?.slice(0, 10) ?? ''}
            onChange={(e) =>
              apply({ from: e.target.value ? e.target.value + 'T00:00:00.000Z' : '' })
            }
          />
        </div>

        <div className="w-36">
          <label className="text-xs text-muted" htmlFor="f-to">
            To
          </label>
          <Input
            id="f-to"
            type="date"
            className="mt-1"
            value={params.get('to')?.slice(0, 10) ?? ''}
            onChange={(e) =>
              apply({ to: e.target.value ? e.target.value + 'T23:59:59.999Z' : '' })
            }
          />
        </div>

        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              apply({
                status: '',
                priority: '',
                departmentId: '',
                categoryId: '',
                from: '',
                to: '',
              })
            }
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  )
}
