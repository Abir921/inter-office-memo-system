import type { Metadata } from 'next'
import { Placeholder } from '@/components/app/placeholder'

export const metadata: Metadata = { title: 'Users · Inter-Office Memo' }

export default function Page() {
  return (
    <Placeholder
      title="Users"
      phase="Phase 4"
      description="Add colleagues, set their department, designation and role, and deactivate those who have left."
    />
  )
}
