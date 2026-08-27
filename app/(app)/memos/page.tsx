import type { Metadata } from 'next'
import { Placeholder } from '@/components/app/placeholder'

export const metadata: Metadata = { title: 'My memos · Inter-Office Memo' }

export default function Page() {
  return (
    <Placeholder
      title="My memos"
      phase="Phase 2"
      description="Every memo you have written, with its status, current participant and last activity."
    />
  )
}
