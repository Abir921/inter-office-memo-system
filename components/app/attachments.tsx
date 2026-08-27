'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { fileSize, stamp } from '@/lib/format'

export interface AttachmentRow {
  id: string
  fileName: string
  sizeBytes: number
  uploadedAt: Date
  uploadedBy: { name: string }
}

const ACCEPT = '.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.txt,.csv'
const MAX_BYTES = 10 * 1024 * 1024

export function Attachments({
  memoId,
  attachments,
  canEdit,
}: {
  memoId: string
  attachments: AttachmentRow[]
  /** True while the memo is still with its author. */
  canEdit: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function upload(file: File) {
    setError(null)

    // Checked again on the server; this is only to save the user a round trip.
    if (file.size > MAX_BYTES) {
      setError('Files must be 10 MB or smaller. "' + file.name + '" is ' + fileSize(file.size) + '.')
      return
    }

    setBusy(true)
    const body = new FormData()
    body.append('file', file)

    try {
      const response = await fetch('/api/memos/' + memoId + '/attachments', {
        method: 'POST',
        body,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload.error ?? 'The file was not attached. Try again.')
        return
      }

      if (inputRef.current) inputRef.current.value = ''
      router.refresh()
    } catch {
      setError('The file was not attached. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string, fileName: string) {
    setError(null)
    setBusy(true)

    try {
      const response = await fetch('/api/attachments/' + id, { method: 'DELETE' })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload.error ?? 'Could not remove ' + fileName + '.')
        return
      }

      router.refresh()
    } catch {
      setError('Could not remove ' + fileName + '. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (attachments.length === 0 && !canEdit) return null

  return (
    <section>
      <h2 className="text-sm font-semibold">Attachments</h2>

      {error ? (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      ) : null}

      {attachments.length > 0 ? (
        <ul className="mt-3 divide-y divide-rule overflow-hidden rounded-sm border border-rule bg-card">
          {attachments.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted" />

              <a
                href={'/api/attachments/' + file.id + '/download'}
                className="min-w-0 flex-1 truncate text-sm text-ink underline-offset-4 hover:underline"
              >
                {file.fileName}
              </a>

              <span className="font-data text-[11px] text-muted">
                {fileSize(file.sizeBytes)} · {file.uploadedBy.name} · {stamp(file.uploadedAt)}
              </span>

              {canEdit ? (
                <button
                  type="button"
                  onClick={() => remove(file.id, file.fileName)}
                  disabled={busy}
                  aria-label={'Remove ' + file.fileName}
                  className="rounded-sm p-1.5 text-muted hover:bg-wash hover:text-stamp disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-sm border border-dashed border-rule bg-card p-6 text-center text-sm text-muted">
          No files are attached to this memo.
        </p>
      )}

      {canEdit ? (
        <div className="mt-3">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            id="attachment-input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) upload(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Paperclip className="h-3.5 w-3.5" />
            {busy ? 'Working…' : 'Attach a file'}
          </Button>
          <p className="mt-2 text-xs text-muted">
            PDF, Word, Excel, PNG, JPG, TXT or CSV. Up to 10 MB each, 10 files per memo.
            Files can only be added while the memo is still with you.
          </p>
        </div>
      ) : null}
    </section>
  )
}
