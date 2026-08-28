'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/**
 * Withdraws a memo that is still moving. This ends the workflow (status ->
 * CANCELLED) the same way a rejection does, but by the author's or an
 * administrator's own choice rather than a reviewer's decision — it is a
 * distinct WorkflowError-checked path in lib/workflow.ts, not a REJECT action.
 */
export function CancelMemoButton({ memoId }: { memoId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function cancel() {
    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/memos/' + memoId + '/cancel', { method: 'POST' })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError(body.error ?? 'The memo was not cancelled. Try again.')
        setPending(false)
        return
      }

      router.refresh()
    } catch {
      setError('The memo was not cancelled. Check your connection and try again.')
      setPending(false)
    }
  }

  if (!confirming) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
        Cancel memo
      </Button>
    )
  }

  return (
    <div className="space-y-2 rounded-sm border border-rule bg-card p-3">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <p className="text-sm text-ink-soft">
        Withdraw this memo? Its workflow ends immediately and this cannot be undone.
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="reject" size="sm" disabled={pending} onClick={cancel}>
          {pending ? 'Cancelling…' : 'Yes, cancel this memo'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Never mind
        </Button>
      </div>
    </div>
  )
}
