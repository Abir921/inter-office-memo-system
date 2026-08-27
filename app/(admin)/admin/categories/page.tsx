import type { Metadata } from 'next'
import { Placeholder } from '@/components/app/placeholder'

export const metadata: Metadata = { title: 'Memo categories · Inter-Office Memo' }

export default function Page() {
  return (
    <Placeholder
      title="Memo categories"
      phase="Phase 5"
      description="The categories a memo can be filed under."
    />
  )
}
