import type { Metadata } from 'next'
import { Placeholder } from '@/components/app/placeholder'

export const metadata: Metadata = { title: 'Inbox · Inter-Office Memo' }

export default function Page() {
  return (
    <Placeholder
      title="Inbox"
      phase="Phase 4"
      description="Memos whose current step is assigned to you, with the action each one needs and how long it has been waiting."
    />
  )
}
