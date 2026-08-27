// lib/prisma.ts
//
// Single shared PrismaClient. In development Next.js reloads modules on every
// save; without this cache each reload would open a new connection pool and
// exhaust the database's connection limit within a few minutes.
//
// Direct `prisma.*` access is permitted ONLY inside lib/. Feature code goes
// through lib/tenant.ts so that organizationId is always applied.

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
