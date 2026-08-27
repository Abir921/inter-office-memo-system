import type { Metadata } from 'next'
import { Placeholder } from '@/components/app/placeholder'

export const metadata: Metadata = { title: 'Search · Inter-Office Memo' }

export default function Page() {
  return (
    <Placeholder
      title="Search"
      phase="Phase 4"
      description="Search across memo number, subject, body, author, department, category, status, priority and date range."
    />
  )
}
