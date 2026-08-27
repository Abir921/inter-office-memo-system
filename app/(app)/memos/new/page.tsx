import type { Metadata } from 'next'
import { Placeholder } from '@/components/app/placeholder'

export const metadata: Metadata = { title: 'Write a memo · Inter-Office Memo' }

export default function Page() {
  return (
    <Placeholder
      title="Write a memo"
      phase="Phase 2"
      description="Subject, body, department, category, priority, attachments, and the ordered list of people it must pass through."
    />
  )
}
