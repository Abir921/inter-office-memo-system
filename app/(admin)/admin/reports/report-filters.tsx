'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Select, Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

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

export function ReportFilters({
  departments,
  categories,
}: {
  departments: FilterOption[]
  categories: FilterOption[]
}) {
  const router = useRouter()
  const params = useSearchParams()

  function apply(patch: Record<string, string>) {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    router.push('/admin/reports?' + next.toString())
  }

  const hasFilters = ['departmentId', 'categoryId', 'status', 'from', 'to'].some((k) => params.get(k))

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-44">
        <label className="text-xs text-muted" htmlFor="rf-dept">
          Department
        </label>
        <Select
          id="rf-dept"
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
        <label className="text-xs text-muted" htmlFor="rf-cat">
          Category
        </label>
        <Select
          id="rf-cat"
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

      <div className="w-40">
        <label className="text-xs text-muted" htmlFor="rf-status">
          Status
        </label>
        <Select
          id="rf-status"
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

      <div className="w-36">
        <label className="text-xs text-muted" htmlFor="rf-from">
          From
        </label>
        <Input
          id="rf-from"
          type="date"
          className="mt-1"
          value={params.get('from')?.slice(0, 10) ?? ''}
          onChange={(e) => apply({ from: e.target.value ? e.target.value + 'T00:00:00.000Z' : '' })}
        />
      </div>

      <div className="w-36">
        <label className="text-xs text-muted" htmlFor="rf-to">
          To
        </label>
        <Input
          id="rf-to"
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
          onClick={() => apply({ departmentId: '', categoryId: '', status: '', from: '', to: '' })}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      ) : null}
    </div>
  )
}
