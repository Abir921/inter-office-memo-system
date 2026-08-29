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
  // GET /api/memos/:id/export-pdf 500s on Vercel while working in every local
  // test — including a real `next build && next start`, checked with a
  // negative-control rebuild (same build, config reverted) that also
  // succeeded locally. That rules out a webpack module-resolution bug
  // (the first suspect, since @react-pdf/renderer ships a `browser` field
  // that bundlers can mis-resolve even for a Node-runtime route) as something
  // reproducible outside Vercel itself — it may still be a contributing
  // factor there, since local `next start` runs against the full local
  // node_modules and can't observe how the package resolves once bundled.
  // Kept as a low-risk, standard mitigation: forces Next to require() the
  // package directly from node_modules rather than running it through
  // webpack at all, which removes that resolution step from the picture
  // regardless of whether it was the actual cause here.
  serverExternalPackages: ['@react-pdf/renderer', 'fontkit', 'yoga-layout'],

  // Belt and braces on top of serverExternalPackages: Vercel's own file-trace
  // step (@vercel/nft) decides which files actually ship in the deployed
  // function bundle, and only runs on Vercel — never in a local `next build`.
  // A local production build succeeding proves nothing about whether nft's
  // static analysis correctly followed every file @react-pdf/renderer's
  // dependency chain touches at runtime (fontkit and yoga-layout both do
  // dynamic, not statically-analysable, requires internally). This forces
  // the whole package directories into the bundle regardless of what the
  // tracer's static analysis catches on its own.
  outputFileTracingIncludes: {
    '/api/memos/[id]/export-pdf': [
      './node_modules/@react-pdf/**/*',
      './node_modules/fontkit/**/*',
      './node_modules/yoga-layout/**/*',
    ],
  },

  async headers() {
    return [{ source: '/(.*)', headers: SECURITY_HEADERS }]
  },
}

export default nextConfig
