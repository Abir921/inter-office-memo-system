'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, Label } from '@/components/ui/field'
import { Input, Select } from '@/components/ui/input'

export interface DepartmentOption {
  id: string
  name: string
}

export interface TemplateStepRow {
  position: number
  positionLabel: string
  defaultDepartmentId: string | null
}

export interface TemplateRow {
  id: string
  name: string
  description: string | null
  isActive: boolean
  steps: TemplateStepRow[]
}

interface EditableStep {
  key: string
  positionLabel: string
  defaultDepartmentId: string
}

let rowCounter = 0
const newStep = (positionLabel = ''): EditableStep => ({
  key: 'step-' + rowCounter++,
  positionLabel,
  defaultDepartmentId: '',
})

function StepEditor({
  steps,
  setSteps,
  departments,
}: {
  steps: EditableStep[]
  setSteps: (fn: (rows: EditableStep[]) => EditableStep[]) => void
  departments: DepartmentOption[]
}) {
  function update(key: string, patch: Partial<EditableStep>) {
    setSteps((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function move(index: number, delta: number) {
    setSteps((rows) => {
      const next = [...rows]
      const target = index + delta
      if (target < 0 || target >= next.length) return rows
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div key={step.key} className="flex flex-wrap items-end gap-2 rounded-sm border border-rule bg-paper p-3">
          <span className="font-data w-7 shrink-0 pb-2.5 text-xs text-muted">
            {String(index + 1).padStart(2, '0')}
          </span>

          <div className="min-w-40 flex-1">
            <Label htmlFor={'label-' + step.key} className="text-xs text-muted">
              Position label
            </Label>
            <Input
              id={'label-' + step.key}
              value={step.positionLabel}
              onChange={(e) => update(step.key, { positionLabel: e.target.value })}
              placeholder="Dept. Head"
              maxLength={80}
              className="mt-1"
            />
          </div>

          <div className="min-w-40 flex-1">
            <Label htmlFor={'dept-' + step.key} className="text-xs text-muted">
              Default department <span className="normal-case">(optional)</span>
            </Label>
            <Select
              id={'dept-' + step.key}
              value={step.defaultDepartmentId}
              onChange={(e) => update(step.key, { defaultDepartmentId: e.target.value })}
              className="mt-1"
            >
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
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
              disabled={index === steps.length - 1}
              aria-label={'Move step ' + (index + 1) + ' later'}
              className="rounded-sm border border-rule p-2 text-ink-soft hover:bg-wash disabled:opacity-30"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSteps((rows) => (rows.length === 1 ? rows : rows.filter((r) => r.key !== step.key)))}
              disabled={steps.length === 1}
              aria-label={'Remove step ' + (index + 1)}
              className="rounded-sm border border-rule p-2 text-ink-soft hover:bg-wash hover:text-stamp disabled:opacity-30"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={() => setSteps((rows) => [...rows, newStep()])}>
        <Plus className="h-3.5 w-3.5" />
        Add a step
      </Button>
    </div>
  )
}

function payloadSteps(steps: EditableStep[]) {
  return steps
    .filter((s) => s.positionLabel.trim())
    .map((s, index) => ({
      position: index + 1,
      positionLabel: s.positionLabel.trim(),
      defaultDepartmentId: s.defaultDepartmentId || '',
    }))
}

function TemplateEditor({
  template,
  departments,
  onSaved,
  onCancel,
}: {
  template: TemplateRow
  departments: DepartmentOption[]
  onSaved: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description ?? '')
  const [steps, setSteps] = useState<EditableStep[]>(
    template.steps.length > 0
      ? template.steps.map((s) => ({
          key: 'step-' + rowCounter++,
          positionLabel: s.positionLabel,
          defaultDepartmentId: s.defaultDepartmentId ?? '',
        }))
      : [newStep()],
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function save(isActive: boolean) {
    setError(null)
    setPending(true)

    try {
      const response = await fetch('/api/templates/' + template.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, steps: payloadSteps(steps), isActive }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError(body.error ?? 'That change was not saved.')
        return
      }

      onSaved()
    } catch {
      setError('That change was not saved. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <li className="space-y-4 p-4">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Template name" htmlFor={'tname-' + template.id}>
          <Input id={'tname-' + template.id} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Description (optional)" htmlFor={'tdesc-' + template.id}>
          <Input
            id={'tdesc-' + template.id}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
          />
        </Field>
      </div>

      <StepEditor steps={steps} setSteps={setSteps} departments={departments} />

      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={() => save(template.isActive)}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => save(!template.isActive)}>
          {template.isActive ? 'Save and deactivate' : 'Save and activate'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </li>
  )
}

function TemplateSummary({
  template,
  onEdit,
}: {
  template: TemplateRow
  onEdit: () => void
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{template.name}</p>
        {template.description ? <p className="mt-0.5 text-xs text-muted">{template.description}</p> : null}
        <p className="font-data mt-1 text-[11px] text-muted">
          {template.steps.map((s) => s.positionLabel).join(' → ')}
        </p>
      </div>
      {!template.isActive ? (
        <span className="font-data rounded-sm border border-rule bg-wash px-1.5 py-0.5 text-[11px] uppercase tracking-[0.08em] text-muted">
          Inactive
        </span>
      ) : null}
      <Button type="button" variant="outline" size="sm" onClick={onEdit}>
        Edit
      </Button>
    </li>
  )
}

function CreateTemplateForm({
  departments,
  onCreated,
}: {
  departments: DepartmentOption[]
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<EditableStep[]>([newStep()])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)

    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, steps: payloadSteps(steps) }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError(body.error ?? 'The template was not created.')
        return
      }

      setOpen(false)
      setName('')
      setDescription('')
      setSteps([newStep()])
      onCreated()
    } catch {
      setError('The template was not created. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        New template
      </Button>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-sm border border-rule bg-card p-4">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Template name" htmlFor="new-template-name" required>
          <Input
            id="new-template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Purchase Request"
            maxLength={120}
            required
          />
        </Field>
        <Field label="Description (optional)" htmlFor="new-template-desc">
          <Input
            id="new-template-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
          />
        </Field>
      </div>

      <StepEditor steps={steps} setSteps={setSteps} departments={departments} />

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Creating…' : 'Create template'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export function TemplateManager({
  templates,
  departments,
}: {
  templates: TemplateRow[]
  departments: DepartmentOption[]
}) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)

  const active = templates.filter((t) => t.isActive)
  const inactive = templates.filter((t) => !t.isActive)

  function refresh() {
    setEditingId(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <CreateTemplateForm departments={departments} onCreated={refresh} />

      <div>
        <h2 className="text-sm font-semibold">Active</h2>
        <ul className="mt-3 divide-y divide-rule overflow-hidden rounded-sm border border-rule bg-card">
          {active.length === 0 ? (
            <li className="p-6 text-center text-sm text-muted">No active templates yet.</li>
          ) : (
            active.map((t) =>
              editingId === t.id ? (
                <TemplateEditor
                  key={t.id}
                  template={t}
                  departments={departments}
                  onSaved={refresh}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <TemplateSummary key={t.id} template={t} onEdit={() => setEditingId(t.id)} />
              ),
            )
          )}
        </ul>
      </div>

      {inactive.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold">Inactive</h2>
          <ul className="mt-3 divide-y divide-rule overflow-hidden rounded-sm border border-rule bg-card opacity-70">
            {inactive.map((t) =>
              editingId === t.id ? (
                <TemplateEditor
                  key={t.id}
                  template={t}
                  departments={departments}
                  onSaved={refresh}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <TemplateSummary key={t.id} template={t} onEdit={() => setEditingId(t.id)} />
              ),
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
