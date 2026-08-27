import type { Metadata } from 'next'
import { Placeholder } from '@/components/app/placeholder'

export const metadata: Metadata = { title: 'Workflow templates · Inter-Office Memo' }

export default function Page() {
  return (
    <Placeholder
      title="Workflow templates"
      phase="Phase 5"
      description="Named routing slips — Purchase Request, Leave Request — that an author can pick instead of building a workflow by hand."
    />
  )
}
