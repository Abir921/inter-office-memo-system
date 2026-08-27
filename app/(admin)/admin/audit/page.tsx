import type { Metadata } from 'next'
import { Placeholder } from '@/components/app/placeholder'

export const metadata: Metadata = { title: 'Audit log · Inter-Office Memo' }

export default function Page() {
  return (
    <Placeholder
      title="Audit log"
      phase="Phase 5"
      description="Every recorded event in your organization, filterable by type, user and date."
    />
  )
}
