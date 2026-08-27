// types/next-auth.d.ts
//
// Widens the Auth.js session and JWT to carry the tenant. `organizationId`
// lives here and ONLY here — it is read from the session in every handler and
// never accepted from a request body, query string or route param.

import type { Role } from '@prisma/client'
import type { DefaultSession } from 'next-auth'
// The import is what makes the module augmentation below attach to the real
// 'next-auth/jwt' module rather than declaring a new empty one.
import type { JWT as DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      organizationId: string
      organizationSlug: string
      organizationName: string
      role: Role
      departmentId: string | null
      designation: string | null
      mustChangePassword: boolean
    } & DefaultSession['user']
  }

  interface User {
    id?: string
    organizationId: string
    organizationSlug: string
    organizationName: string
    role: Role
    departmentId: string | null
    designation: string | null
    mustChangePassword: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string
    organizationId: string
    organizationSlug: string
    organizationName: string
    role: Role
    departmentId: string | null
    designation: string | null
    mustChangePassword: boolean
  }
}
