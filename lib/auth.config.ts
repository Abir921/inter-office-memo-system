// lib/auth.config.ts
//
// The half of the Auth.js configuration that is safe on the Edge runtime:
// no Prisma, no bcrypt. Middleware imports this file so it can check a session
// cookie without dragging the database client into the Edge bundle.
//
// The Credentials provider — which does need Prisma and bcrypt — is added in
// lib/auth.ts, which runs on Node.

import type { NextAuthConfig } from 'next-auth'

/** Path prefixes that require a signed-in user. */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/inbox',
  '/memos',
  '/completed',
  '/search',
  '/notifications',
  '/profile',
  '/admin',
]

/** Pages a signed-in user has no reason to see again. */
const AUTH_PAGES = ['/login', '/register-org', '/forgot-password', '/reset-password']

export const authConfig = {
  trustHost: true,

  pages: {
    signIn: '/login',
    error: '/login',
  },

  // JWT rather than database sessions: the session travels in an httpOnly
  // cookie, so a page render costs no extra database round trip.
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 8, // an eight-hour working day
  },

  // Filled in by lib/auth.ts. Middleware needs none.
  providers: [],

  callbacks: {
    /**
     * Runs in middleware, before any page renders. This is a fast redirect,
     * NOT the authorization boundary — every page and route handler re-checks
     * the session itself. Hiding a page is not authorization.
     */
    authorized({ auth, request }) {
      const signedIn = Boolean(auth?.user)
      const { pathname } = request.nextUrl

      if (signedIn && AUTH_PAGES.some((p) => pathname.startsWith(p))) {
        return Response.redirect(new URL('/dashboard', request.nextUrl))
      }

      if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
        return signedIn
      }

      return true
    },

    /** Copies the tenant onto the token at sign-in; later calls just pass it on. */
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string
        token.organizationId = user.organizationId
        token.organizationSlug = user.organizationSlug
        token.organizationName = user.organizationName
        token.role = user.role
        token.departmentId = user.departmentId
        token.designation = user.designation
        token.mustChangePassword = user.mustChangePassword
      }

      // Lets a profile or password update refresh the token without re-login.
      if (trigger === 'update' && session) {
        if (typeof session.name === 'string') token.name = session.name
        if (typeof session.designation === 'string') token.designation = session.designation
        if (typeof session.mustChangePassword === 'boolean') {
          token.mustChangePassword = session.mustChangePassword
        }
      }

      return token
    },

    session({ session, token }) {
      session.user.id = token.id
      session.user.organizationId = token.organizationId
      session.user.organizationSlug = token.organizationSlug
      session.user.organizationName = token.organizationName
      session.user.role = token.role
      session.user.departmentId = token.departmentId
      session.user.designation = token.designation
      session.user.mustChangePassword = token.mustChangePassword
      return session
    },
  },
} satisfies NextAuthConfig
