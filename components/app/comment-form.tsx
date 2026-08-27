'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'

export function CommentForm({ memoId }: { memoId: string }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)

    try {
      const response = await fetch('/api/memos/' + memoId + '/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError(body.error ?? 'Your comment was not saved. Try again.')
        return
      }

      setText('')
      router.refresh()
    } catch {
      setError('Your comment was not saved. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder="Add a note for the others on this memo."
        aria-label="Comment"
        required
      />

      <Button type="submit" disabled={pending || text.trim().length === 0}>
        {pending ? 'Posting…' : 'Post comment'}
      </Button>
    </form>
  )
}
