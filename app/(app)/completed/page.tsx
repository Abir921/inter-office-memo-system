import type { Metadata } from 'next'
import { Placeholder } from '@/components/app/placeholder'

export const metadata: Metadata = { title: 'Completed · Inter-Office Memo' }

export default function Page() {
  return (
    <Placeholder
      title="Completed"
      phase="Phase 4"
      description="Approved and rejected memos you are authorised to see."
    />
  )
}
