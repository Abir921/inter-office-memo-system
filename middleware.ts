// middleware.ts
//
// A fast redirect for signed-out visitors, running on the Edge before any page
// renders. It is NOT the authorization boundary: every page and every route
// handler re-checks the session with requireSession()/requireAdmin(). This
// only saves a signed-out user from watching a protected page load first.

import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

export const { auth: middleware } = NextAuth(authConfig)

export default middleware

export const config = {
  // Everything except Next.js internals, the auth endpoints themselves, and
  // static files.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
