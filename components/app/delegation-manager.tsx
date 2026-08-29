'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { stampDate } from '@/lib/format'

export interface ColleagueOption {
  id: string
  name: string
  designation: string | null
}

export interface DelegationRow {
  id: string
  startDate: string
  endDate: string
  reason: string | null
  displayStatus: 'ACTIVE' | 'UPCOMING' | 'EXPIRED' | 'CANCELLED'
  delegator: { id: string; name: string }
  delegate: { id: string; name: string }
}

const STATUS_TONE: Record<DelegationRow['displayStatus'], string> = {
  ACTIVE: 'border-seal/40 bg-seal/10 text-seal',
  UPCOMING: 'border-ink/25 bg-ink/5 text-ink',
  EXPIRED: 'border-rule bg-wash text-muted',
  CANCELLED: 'border-rule bg-wash text-muted',
}

const STATUS_LABEL: Record<DelegationRow['displayStatus'], string> = {
  ACTIVE: 'Active',
  UPCOMING: 'Starts later',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
}

function StatusChip({ status }: { status: DelegationRow['displayStatus'] }) {
  return (
    <span
      className={
        'inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium ' +
        STATUS_TONE[status]
      }
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function DelegationRowView({
  d,
  isMine,
  onChanged,
}: {
  d: DelegationRow
  /** True when the current user is the delegator (can cancel). */
  isMine: boolean
  onChanged: () => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancellable = isMine && (d.displayStatus === 'ACTIVE' || d.displayStatus === 'UPCOMING')

  async function cancel() {
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/delegations/' + d.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError(body.error ?? 'That could not be cancelled.')
        return
      }
      onChanged()
    } catch {
      setError('That could not be cancelled. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <li className="p-4">
      {error ? (
        <Alert variant="error" className="mb-2">
          {error}
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink">
          {isMine ? (
            <>
              To <span className="font-medium">{d.delegate.name}</span>
            </>
          ) : (
            <>
              From <span className="font-medium">{d.delegator.name}</span>
            </>
          )}
        </span>
        <StatusChip status={d.displayStatus} />
        <span className="font-data ml-auto text-xs text-muted">
          {stampDate(d.startDate, { utc: true })} – {stampDate(d.endDate, { utc: true })}
        </span>
      </div>
      {d.reason ? <p className="mt-1 text-sm text-ink-soft">{d.reason}</p> : null}
      {cancellable ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={pending}
          onClick={cancel}
        >
          {pending ? 'Cancelling…' : 'Cancel'}
        </Button>
      ) : null}
    </li>
  )
}

function CreateDelegationForm({
  colleagues,
  onCreated,
}: {
  colleagues: ColleagueOption[]
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [delegateId, setDelegateId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setPending(true)

    try {
      const response = await fetch('/api/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delegateId,
          startDate: new Date(startDate + 'T00:00:00.000Z').toISOString(),
          endDate: new Date(endDate + 'T23:59:59.999Z').toISOString(),
          reason,
        }),
      })

      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.error ?? 'The delegation was not created.')
        if (body.fields) setFieldErrors(body.fields)
        return
      }

      setOpen(false)
      setDelegateId('')
      setStartDate('')
      setEndDate('')
      setReason('')
      onCreated()
    } catch {
      setError('The delegation was not created. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Delegate my authority
      </Button>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-sm border border-rule bg-card p-4">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <Field label="Delegate to" htmlFor="deleg-to" error={fieldErrors.delegateId} required>
        <Select
          id="deleg-to"
          value={delegateId}
          onChange={(e) => setDelegateId(e.target.value)}
          required
        >
          <option value="">Choose a colleague</option>
          {colleagues.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.designation ? ' — ' + c.designation : ''}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From" htmlFor="deleg-start" error={fieldErrors.startDate} required>
          <Input
            id="deleg-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </Field>
        <Field label="Until" htmlFor="deleg-end" error={fieldErrors.endDate} required>
          <Input
            id="deleg-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </Field>
      </div>

      <Field label="Reason (optional)" htmlFor="deleg-reason" error={fieldErrors.reason}>
        <Textarea
          id="deleg-reason"
          rows={2}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Annual leave, 2–13 September"
        />
      </Field>

      <p className="text-xs text-muted">
        While this is active, {colleagues.find((c) => c.id === delegateId)?.name || 'they'} will
        see your pending items in their Inbox and may act on them. Actions they take are recorded
        as acting on your behalf — the record always shows who actually decided.
      </p>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Creating…' : 'Create delegation'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export function DelegationManager({
  delegations,
  colleagues,
  currentUserId,
}: {
  delegations: DelegationRow[]
  colleagues: ColleagueOption[]
  currentUserId: string
}) {
  const router = useRouter()

  // The sidebar links straight to #delegation. The browser's own anchor
  // jump fires before webfonts finish loading, and the resulting swap
  // reflows the page and leaves the scroll short — so this scrolls once on
  // mount and again once fonts have actually settled.
  useEffect(() => {
    if (window.location.hash !== '#delegation') return
    const scrollToDelegation = () =>
      document.getElementById('delegation')?.scrollIntoView({ block: 'start' })
    scrollToDelegation()
    document.fonts?.ready.then(scrollToDelegation)
  }, [])

  const given = delegations.filter((d) => d.delegator.id === currentUserId)
  const received = delegations.filter((d) => d.delegate.id === currentUserId)

  function refresh() {
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <CreateDelegationForm colleagues={colleagues} onCreated={refresh} />

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Delegated by you
        </h3>
        {given.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            You have not delegated your authority to anyone.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-rule overflow-hidden rounded-sm border border-rule bg-card">
            {given.map((d) => (
              <DelegationRowView key={d.id} d={d} isMine onChanged={refresh} />
            ))}
          </ul>
        )}
      </div>

      {received.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Delegated to you
          </h3>
          <ul className="mt-2 divide-y divide-rule overflow-hidden rounded-sm border border-rule bg-card">
            {received.map((d) => (
              <DelegationRowView key={d.id} d={d} isMine={false} onChanged={refresh} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
