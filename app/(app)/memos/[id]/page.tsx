import type { Metadata } from 'next'
import { Placeholder } from '@/components/app/placeholder'

export const metadata: Metadata = { title: 'Memo · Inter-Office Memo' }

export default function Page() {
  return (
    <Placeholder
      title="Memo"
      phase="Phase 2"
      description="The memo itself, its routing rail, the chronological timeline, comments and attachments."
    />
  )
}
