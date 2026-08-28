import type { NextConfig } from 'next'

// Security headers (PRD 10 / CLAUDE.md section 5.10). Applied to every route.
//
// CSP note: script-src and style-src include 'unsafe-inline' because Next.js
// App Router injects inline bootstrap scripts and streamed RSC payloads that
// a nonce-based policy would need middleware wiring to cover — a real next
// step, not done here given the timeline. This CSP still blocks loading a
// script or stylesheet from any OTHER origin, which is the main thing that
// matters against a reflected/stored payload: sanitize-html already strips
// <script> tags server-side (lib/sanitize.ts), so this is defence in depth,
// not the only defence.
// Next.js's dev-mode Fast Refresh runtime evaluates code via eval(), which a
// strict script-src blocks outright — harmless in dev, but 'unsafe-eval'
// would be a real weakening in production, so it is scoped to dev only.
const isDev = process.env.NODE_ENV !== 'production'

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (isDev ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: SECURITY_HEADERS }]
  },
}

export default nextConfig
