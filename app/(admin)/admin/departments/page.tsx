import type { Metadata } from 'next'
import { Placeholder } from '@/components/app/placeholder'

export const metadata: Metadata = { title: 'Departments · Inter-Office Memo' }

export default function Page() {
  return (
    <Placeholder
      title="Departments"
      phase="Phase 4"
      description="Create and rename departments. Deactivating one preserves the memos already filed against it."
    />
  )
}
