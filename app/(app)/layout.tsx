import { AppShell } from '@/components/app/shell'

// The session is read per request; nothing here may be cached across users.
export const dynamic = 'force-dynamic'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
