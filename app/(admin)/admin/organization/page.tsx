import type { Metadata } from 'next'
import { Placeholder } from '@/components/app/placeholder'

export const metadata: Metadata = { title: 'Organization · Inter-Office Memo' }

export default function Page() {
  return (
    <Placeholder
      title="Organization"
      phase="Phase 4"
      description="Name, logo and contact details for your organization."
    />
  )
}
