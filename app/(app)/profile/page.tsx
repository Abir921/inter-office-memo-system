import type { Metadata } from 'next'
import { Placeholder } from '@/components/app/placeholder'

export const metadata: Metadata = { title: 'Your profile · Inter-Office Memo' }

export default function Page() {
  return (
    <Placeholder
      title="Your profile"
      phase="Phase 4"
      description="Your name, designation and password. Your email address and role are set by an administrator."
    />
  )
}
