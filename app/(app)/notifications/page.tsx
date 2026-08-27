import type { Metadata } from 'next'
import { Placeholder } from '@/components/app/placeholder'

export const metadata: Metadata = { title: 'Notifications · Inter-Office Memo' }

export default function Page() {
  return (
    <Placeholder
      title="Notifications"
      phase="Phase 4"
      description="Everything that has happened on memos you are involved in, newest first."
    />
  )
}
