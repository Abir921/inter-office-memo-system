'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { MemoEditor } from '@/components/app/editor'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, Label } from '@/components/ui/field'
import { Input, Select } from '@/components/ui/input'

export interface Option {
  id: string
  name: string
}

export interface PersonOption extends Option {
  designation: string | null
  departmentName: string | null
}

export interface TemplateOption extends Option {
  steps: { position: number; positionLabel: string }[]
}

interface Participant {
  /** Local row key; not sent to the server. */
  key: string
  assigneeId: string
  positionLabel: string
}

let rowCounter = 0
const newRow = (): Participant => ({
  key: 'row-' + rowCounter++,
  assigneeId: '',
  positionLabel: '',
})

export function MemoComposer({
  people,
  departments,
  categories,
  templates,
  defaultDepartmentId,
}: {
  people: PersonOption[]
  departments: Option[]
  categories: Option[]
  templates: TemplateOption[]
  defaultDepartmentId: string | null
}) {
  const router = useRouter()

  const [bodyHtml, setBodyHtml] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([newRow()])
  const [templateId, setTemplateId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<'draft' | 'submit' | null>(null)

  /** Picking a template lays out the desks; the author still names who sits at each. */
  function applyTemplate(id: string) {
    setTemplateId(id)
    const template = templates.find((t) => t.id === id)
    if (!template) return

    setParticipants(
      [...template.steps]
        .sort((a, b) => a.position - b.position)
        .map((step) => ({ ...newRow(), positionLabel: step.positionLabel })),
    )
  }

  function updateRow(key: string, patch: Partial<Participant>) {
    setParticipants((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function move(index: number, delta: number) {
    setParticipants((rows) => {
      const next = [...rows]
      const target = index + delta
      if (target < 0 || target >= next.length) return rows
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function save(mode: 'draft' | 'submit', form: HTMLFormElement) {
    setError(null)
    setFieldErrors({})
    setPending(mode)

    const data = new FormData(form)

    const filled = participants.filter((p) => p.assigneeId)

    if (mode === 'submit' && filled.length === 0) {
      setError('Add at least one approver before submitting, or save this as a draft.')
      setPending(null)
      return
    }

    const payload = {
      subject: String(data.get('subject') ?? ''),
      bodyHtml,
      departmentId: String(data.get('departmentId') ?? ''),
      categoryId: String(data.get('categoryId') ?? ''),
      templateId: mode === 'submit' ? templateId : '',
      priority: String(data.get('priority') ?? 'NORMAL'),
      ...(mode === 'submit'
        ? {
            participants: filled.map((p, index) => ({
              position: index + 1,
              assigneeId: p.assigneeId,
              positionLabel: p.positionLabel,
            })),
          }
        : {}),
    }

    try {
      const response = await fetch('/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(body.error ?? 'The memo was not saved. Check the form and try again.')
        if (body.fields) setFieldErrors(body.fields)
        setPending(null)
        return
      }

      router.push('/memos/' + body.id)
      router.refresh()
    } catch {
      setError('The memo was not saved. Check your connection and try again.')
      setPending(null)
    }
  }

  const duplicateAdjacent = participants.some(
    (p, i) => i > 0 && p.assigneeId && p.assigneeId === participants[i - 1].assigneeId,
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save('submit', e.currentTarget)
      }}
      className="space-y-8"
      noValidate
    >
      {error ? <Alert variant="error">{error}</Alert> : null}

      <section className="space-y-4">
        <Field label="Subject" htmlFor="subject" error={fieldErrors.subject} required>
          <Input
            id="subject"
            name="subject"
            maxLength={200}
            placeholder="Request for two additional development workstations"
            aria-invalid={Boolean(fieldErrors.subject)}
            required
          />
        </Field>

        <div>
          <Label htmlFor="body-editor">
            Body<span className="ml-0.5 text-stamp">*</span>
          </Label>
          <div className="mt-1.5" id="body-editor">
            <MemoEditor name="bodyHtml" onChange={setBodyHtml} />
          </div>
          {fieldErrors.bodyHtml ? (
            <p className="mt-1.5 text-xs text-stamp">{fieldErrors.bodyHtml}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Department" htmlFor="departmentId" error={fieldErrors.departmentId}>
            <Select id="departmentId" name="departmentId" defaultValue={defaultDepartmentId ?? ''}>
              <option value="">Not specified</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Category" htmlFor="categoryId" error={fieldErrors.categoryId}>
            <Select id="categoryId" name="categoryId" defaultValue="">
              <option value="">Not specified</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Priority" htmlFor="priority" error={fieldErrors.priority}>
            <Select id="priority" name="priority" defaultValue="NORMAL">
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </Field>
        </div>
      </section>

      {/* ---- The routing slip ---- */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Routing</h2>
            <p className="mt-1 text-xs text-muted">
              The desks this memo must cross, in order. Each person may act only when the
              memo reaches them.
            </p>
          </div>

          {templates.length > 0 ? (
            <div className="w-full sm:w-56">
              <Label htmlFor="templateId" className="text-xs">
                Start from a template
              </Label>
              <Select
                id="templateId"
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value)}
                className="mt-1"
              >
                <option value="">Build it by hand</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>

        {fieldErrors.participants ? (
          <Alert variant="error" className="mt-3">
            {fieldErrors.participants}
          </Alert>
        ) : null}

        {duplicateAdjacent ? (
          <Alert variant="pending" className="mt-3">
            The same person appears at two consecutive steps. They would be approving
            their own approval.
          </Alert>
        ) : null}

        <ol className="mt-3 space-y-2">
          {participants.map((row, index) => (
            <li
              key={row.key}
              className="flex flex-wrap items-end gap-2 rounded-sm border border-rule bg-card p-3"
            >
              <span className="font-data w-7 shrink-0 pb-2.5 text-xs text-muted">
                {String(index + 1).padStart(2, '0')}
              </span>

              <div className="min-w-48 flex-1">
                <Label htmlFor={'assignee-' + row.key} className="text-xs text-muted">
                  Who
                </Label>
                <Select
                  id={'assignee-' + row.key}
                  value={row.assigneeId}
                  onChange={(e) => updateRow(row.key, { assigneeId: e.target.value })}
                  className="mt-1"
                >
                  <option value="">Choose a colleague</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.designation ? ' — ' + p.designation : ''}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="min-w-40 flex-1">
                <Label htmlFor={'label-' + row.key} className="text-xs text-muted">
                  Acting as <span className="normal-case">(optional)</span>
                </Label>
                <Input
                  id={'label-' + row.key}
                  value={row.positionLabel}
                  onChange={(e) => updateRow(row.key, { positionLabel: e.target.value })}
                  placeholder="Finance Manager"
                  maxLength={80}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-1 pb-0.5">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={'Move step ' + (index + 1) + ' earlier'}
                  className="rounded-sm border border-rule p-2 text-ink-soft hover:bg-wash disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === participants.length - 1}
                  aria-label={'Move step ' + (index + 1) + ' later'}
                  className="rounded-sm border border-rule p-2 text-ink-soft hover:bg-wash disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setParticipants((rows) =>
                      rows.length === 1 ? rows : rows.filter((r) => r.key !== row.key),
                    )
                  }
                  disabled={participants.length === 1}
                  aria-label={'Remove step ' + (index + 1)}
                  className="rounded-sm border border-rule p-2 text-ink-soft hover:bg-wash hover:text-stamp disabled:opacity-30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ol>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setParticipants((rows) => [...rows, newRow()])}
        >
          <Plus className="h-3.5 w-3.5" />
          Add a step
        </Button>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-rule pt-6">
        <Button type="submit" size="lg" disabled={pending !== null}>
          {pending === 'submit' ? 'Submitting…' : 'Submit memo'}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={pending !== null}
          onClick={(e) => save('draft', e.currentTarget.form as HTMLFormElement)}
        >
          {pending === 'draft' ? 'Saving…' : 'Save as draft'}
        </Button>
      </div>

      <p className="text-xs text-muted">
        A draft stays private to you. Submitting sends it to the first desk on the list
        and locks the memo against further editing.
      </p>
    </form>
  )
}
