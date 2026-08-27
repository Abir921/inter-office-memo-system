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

export interface ExistingMemo {
  id: string
  memoNumber: string
  subject: string
  bodyHtml: string
  departmentId: string | null
  categoryId: string | null
  priority: string
  status: string
}

export function MemoComposer({
  people,
  departments,
  categories,
  templates,
  defaultDepartmentId,
  existing,
}: {
  people: PersonOption[]
  departments: Option[]
  categories: Option[]
  templates: TemplateOption[]
  defaultDepartmentId: string | null
  /** Present when editing a draft or revising a memo sent back for changes. */
  existing?: ExistingMemo
}) {
  const router = useRouter()

  const isEditing = Boolean(existing)
  // A memo handed back for changes is revised and RESUBMITTED, not submitted
  // fresh; a draft can still be saved without routing it anywhere.
  const isRevision = existing?.status === 'CHANGES_REQUESTED'

  const [bodyHtml, setBodyHtml] = useState(existing?.bodyHtml ?? '')
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

    if (mode === 'submit' && !isRevision && filled.length === 0) {
      setError('Add at least one approver before submitting, or save this as a draft.')
      setPending(null)
      return
    }

    const fields = {
      subject: String(data.get('subject') ?? ''),
      bodyHtml,
      departmentId: String(data.get('departmentId') ?? ''),
      categoryId: String(data.get('categoryId') ?? ''),
      priority: String(data.get('priority') ?? 'NORMAL'),
    }

    const routing = filled.map((p, index) => ({
      position: index + 1,
      assigneeId: p.assigneeId,
      positionLabel: p.positionLabel,
    }))

    function fail(body: { error?: string; fields?: Record<string, string> }) {
      setError(body.error ?? 'The memo was not saved. Check the form and try again.')
      if (body.fields) setFieldErrors(body.fields)
      setPending(null)
    }

    try {
      if (existing) {
        // Save the edits first. Both the draft path and the revision path need
        // the new text stored before anything is routed.
        const patch = await fetch('/api/memos/' + existing.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fields),
        })

        if (!patch.ok) return fail(await patch.json().catch(() => ({})))

        if (mode === 'submit') {
          const endpoint = isRevision ? '/resubmit' : '/submit'
          const send = await fetch('/api/memos/' + existing.id + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              isRevision
                // Omitting participants reuses the previous routing, which is
                // what an author almost always wants after a revision.
                ? (routing.length > 0 ? { participants: routing } : {})
                : { participants: routing, templateId },
            ),
          })

          if (!send.ok) return fail(await send.json().catch(() => ({})))
        }

        router.push('/memos/' + existing.id)
        router.refresh()
        return
      }

      const response = await fetch('/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          templateId: mode === 'submit' ? templateId : '',
          ...(mode === 'submit' ? { participants: routing } : {}),
        }),
      })

      const body = await response.json().catch(() => ({}))
      if (!response.ok) return fail(body)

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
            defaultValue={existing?.subject}
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
            <MemoEditor
              name="bodyHtml"
              defaultValue={existing?.bodyHtml ?? ''}
              onChange={setBodyHtml}
            />
          </div>
          {fieldErrors.bodyHtml ? (
            <p className="mt-1.5 text-xs text-stamp">{fieldErrors.bodyHtml}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Department" htmlFor="departmentId" error={fieldErrors.departmentId}>
            <Select
              id="departmentId"
              name="departmentId"
              defaultValue={existing?.departmentId ?? defaultDepartmentId ?? ''}
            >
              <option value="">Not specified</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Category" htmlFor="categoryId" error={fieldErrors.categoryId}>
            <Select id="categoryId" name="categoryId" defaultValue={existing?.categoryId ?? ''}>
              <option value="">Not specified</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Priority" htmlFor="priority" error={fieldErrors.priority}>
            <Select id="priority" name="priority" defaultValue={existing?.priority ?? 'NORMAL'}>
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
              {isRevision
                ? 'Leave this alone to send the memo back along the same route. Naming people here replaces the routing instead.'
                : 'The desks this memo must cross, in order. Each person may act only when the memo reaches them.'}
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
          {pending === 'submit'
            ? isRevision
              ? 'Resubmitting…'
              : 'Submitting…'
            : isRevision
              ? 'Resubmit memo'
              : 'Submit memo'}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={pending !== null}
          onClick={(e) => save('draft', e.currentTarget.form as HTMLFormElement)}
        >
          {pending === 'draft' ? 'Saving…' : isEditing ? 'Save changes' : 'Save as draft'}
        </Button>
      </div>

      <p className="text-xs text-muted">
        {isRevision
          ? 'Resubmitting records a new version and starts the routing again at the first desk. The earlier round of decisions stays on the record.'
          : 'A draft stays private to you. Submitting sends it to the first desk on the list and locks the memo against further editing.'}
      </p>
    </form>
  )
}
