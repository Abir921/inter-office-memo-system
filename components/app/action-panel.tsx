'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { StepActionType } from '@prisma/client'
import { Check, MessageSquare, RotateCcw, X } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Mode = StepActionType | null

const COMMENT_REQUIRED: StepActionType[] = ['REJECT', 'REQUEST_CHANGES']

const COPY: Record<StepActionType, { verb: string; toast: string; hint: string }> = {
  APPROVE: {
    verb: 'Approve memo',
    toast: 'Memo approved.',
    hint: 'A comment is optional.',
  },
  REJECT: {
    verb: 'Reject memo',
    toast: 'Memo rejected.',
    hint: 'Say why you are rejecting this memo. This is permanent and ends the workflow.',
  },
  REQUEST_CHANGES: {
    verb: 'Request changes',
    toast: 'Changes requested.',
    hint: 'Say what needs to change. The memo returns to its author to revise and resubmit.',
  },
  REVIEW_COMPLETE: {
    verb: 'Complete review',
    toast: 'Review completed.',
    hint: 'A comment is optional.',
  },
  COMMENT: {
    verb: 'Comment',
    toast: 'Comment posted.',
    hint: 'Write your comment.',
  },
}

/**
 * The action panel: visible only to the current step's assignee, because it
 * is rendered only when the server decided to render it (see
 * app/(app)/memos/[id]/page.tsx). This component enforces nothing — hiding a
 * button is not authorization. The real check is server-side, in
 * lib/workflow.ts, and runs again no matter what this panel shows.
 */
export function ActionPanel({
  memoId,
  stepId,
  isLastStep,
}: {
  memoId: string
  stepId: string
  isLastStep: boolean
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function act(action: StepActionType) {
    setError(null)

    if (COMMENT_REQUIRED.includes(action) && !comment.trim()) {
      setError(COPY[action].hint)
      return
    }

    setPending(true)

    try {
      const response = await fetch(
        '/api/memos/' + memoId + '/steps/' + stepId + '/action',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, comment: comment.trim() || undefined }),
        },
      )

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(body.error ?? 'That action was not recorded. Try again.')
        setPending(false)
        return
      }

      setMode(null)
      setComment('')
      router.refresh()
    } catch {
      setError('That action was not recorded. Check your connection and try again.')
      setPending(false)
    }
  }

  const approveLabel = isLastStep ? 'Approve and complete' : 'Approve memo'

  return (
    <section className="rounded-sm border border-ink bg-card p-4">
      <p className="font-data text-[11px] uppercase tracking-[0.14em] text-muted">
        Your action is required
      </p>

      {error ? (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      ) : null}

      {mode ? (
        <div className="mt-3 space-y-3">
          <Textarea
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={COPY[mode].hint}
            aria-label="Comment"
            aria-required={COMMENT_REQUIRED.includes(mode)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={mode === 'REJECT' ? 'reject' : mode === 'REQUEST_CHANGES' ? 'changes' : 'approve'}
              disabled={pending}
              onClick={() => act(mode)}
            >
              {pending ? 'Recording…' : 'Confirm: ' + COPY[mode].verb.toLowerCase()}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setMode(null)
                setComment('')
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="approve"
            disabled={pending}
            onClick={() => act('APPROVE')}
          >
            <Check className="h-3.5 w-3.5" />
            {pending ? 'Recording…' : approveLabel}
          </Button>

          <Button
            type="button"
            variant="changes"
            disabled={pending}
            onClick={() => setMode('REQUEST_CHANGES')}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Request changes
          </Button>

          <Button
            type="button"
            variant="reject"
            disabled={pending}
            onClick={() => setMode('REJECT')}
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setMode('COMMENT')}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Comment only
          </Button>
        </div>
      )}

      <p className={cn('mt-3 text-xs text-muted', mode && 'sr-only')}>
        Approving {isLastStep ? 'completes the workflow' : 'sends this memo to the next desk'}.
        Rejecting ends it. Requesting changes returns it to the author.
      </p>
    </section>
  )
}
