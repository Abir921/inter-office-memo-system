// GET /api/health — deployment diagnostic.
//
// Reports whether each piece of configuration is PRESENT and whether the
// database answers. It never returns a value, a connection string, a key, or
// any part of one: only booleans, lengths, and Prisma's error code.
//
// Public on purpose. Sign-in is the first thing that touches the database, so
// when sign-in is what is broken, a diagnostic behind sign-in is useless.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Describes a URL without disclosing it: host shape only, never credentials. */
function describeDatabaseUrl(raw: string | undefined) {
  if (!raw) return { present: false as const }

  try {
    const url = new URL(raw)
    return {
      present: true as const,
      protocol: url.protocol.replace(':', ''),
      // The host is not a secret; the username and password in the URL are, so
      // they are never read out here.
      host: url.hostname,
      database: url.pathname.replace('/', '') || null,
      pooled: url.hostname.includes('-pooler'),
      sslmode: url.searchParams.get('sslmode'),
      pgbouncer: url.searchParams.get('pgbouncer'),
    }
  } catch {
    return { present: true as const, parseable: false as const }
  }
}

function describeSupabaseUrl(raw: string | undefined) {
  if (!raw) return { present: false as const }

  const trimmed = raw.trim()
  return {
    present: true as const,
    // The single most common mistake: pasting the REST endpoint rather than
    // the bare project URL.
    hasTrailingPath: !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(trimmed),
    endsWithSlash: trimmed.endsWith('/'),
  }
}

export async function GET() {
  const env = process.env

  const config = {
    DATABASE_URL: describeDatabaseUrl(env.DATABASE_URL),
    AUTH_SECRET: {
      present: Boolean(env.AUTH_SECRET),
      length: env.AUTH_SECRET?.length ?? 0,
    },
    AUTH_URL: {
      present: Boolean(env.AUTH_URL),
      // On Vercel this should be the deployed origin, never localhost.
      pointsAtLocalhost: Boolean(env.AUTH_URL?.includes('localhost')),
    },
    AUTH_TRUST_HOST: { present: Boolean(env.AUTH_TRUST_HOST) },
    NEXTAUTH_URL: {
      present: Boolean(env.NEXTAUTH_URL),
      pointsAtLocalhost: Boolean(env.NEXTAUTH_URL?.includes('localhost')),
    },
    SUPABASE_URL: {
      ...describeSupabaseUrl(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL),
      // Which name it was found under, so a half-finished rename is visible.
      readFrom: env.SUPABASE_URL
        ? 'SUPABASE_URL'
        : env.NEXT_PUBLIC_SUPABASE_URL
          ? 'NEXT_PUBLIC_SUPABASE_URL'
          : null,
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      present: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      length: env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0,
    },
    SUPABASE_STORAGE_BUCKET: { present: Boolean(env.SUPABASE_STORAGE_BUCKET) },
  }

  // Does the database actually answer? This is the question the login failure
  // is really asking.
  let database: Record<string, unknown>
  const startedAt = Date.now()

  try {
    const [{ count }] = await prisma.$queryRaw<
      { count: bigint }[]
    >`SELECT COUNT(*)::bigint AS count FROM "Organization"`

    database = {
      reachable: true,
      organizations: Number(count),
      milliseconds: Date.now() - startedAt,
    }
  } catch (error) {
    // Prisma's error CODE is safe to publish and is what identifies the fault
    // (P1001 unreachable, P1000 bad credentials, P2021 table missing). The
    // message can contain the connection string, so it is logged, not returned.
    console.error('[health] database check failed', error)

    database = {
      reachable: false,
      code: (error as { code?: string })?.code ?? 'UNKNOWN',
      milliseconds: Date.now() - startedAt,
    }
  }

  return NextResponse.json(
    {
      ok: database.reachable === true,
      environment: env.VERCEL_ENV ?? env.NODE_ENV ?? 'unknown',
      region: env.VERCEL_REGION ?? null,
      commit: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      node: process.version,
      database,
      config,
    },
    { status: database.reachable === true ? 200 : 503 },
  )
}
