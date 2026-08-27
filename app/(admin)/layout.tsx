import { AppShell } from '@/components/app/shell'

export const dynamic = 'force-dynamic'

/**
 * Administration screens. The role check runs in AppShell, on the server,
 * before any child renders — an ordinary user who types /admin/users into the
 * address bar is redirected, not merely shown an empty page.
 *
 * Each admin route handler repeats the check with requireAdmin(); a layout
 * guard alone would not protect the API.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell requireAdminRole>{children}</AppShell>
}
