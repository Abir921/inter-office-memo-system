import type { Metadata } from 'next'
import { Placeholder } from '@/components/app/placeholder'

export const metadata: Metadata = { title: 'Reports · Inter-Office Memo' }

export default function Page() {
  return (
    <Placeholder
      title="Reports"
      phase="Phase 5"
      description="Counts by status, department and category, and the average time a memo takes to clear its workflow."
    />
  )
}
