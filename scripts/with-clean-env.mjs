#!/usr/bin/env node
// scripts/with-clean-env.mjs
//
// Strips a fixed list of app configuration keys from process.env before
// spawning the real command, so .env is always the source of truth for them
// — never an ambient shell or OS-level environment variable that happens to
// share the same name.
//
// Why this exists: dotenv-style loaders (the one Next.js uses, and the one
// Prisma Client uses internally) only fill in a key when it is genuinely
// unset. If something outside this project has already exported
// DATABASE_URL, AUTH_SECRET, or similar, .env is silently ignored for that
// key — with no error, just a connection that mysteriously doesn't work. On
// Windows in particular, a variable set via System Properties / `setx`
// becomes part of every new process's environment block at the moment that
// process is created, and clearing it afterwards does not retroactively fix
// any process (or process tree) already running.
//
// Usage: node scripts/with-clean-env.mjs <command> [...args]
// e.g.:  node scripts/with-clean-env.mjs next dev

import { spawn } from 'node:child_process'

const MANAGED_KEYS = [
  'DATABASE_URL',
  'AUTH_SECRET',
  'AUTH_URL',
  'AUTH_TRUST_HOST',
  'NEXTAUTH_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_APP_URL',
]

const env = { ...process.env }
for (const key of MANAGED_KEYS) delete env[key]

// Joined into one string (rather than kept as a command + args array) so a
// compound shell command — "prisma generate && next build" — works exactly
// as it would typed directly, && included.
const commandLine = process.argv.slice(2).join(' ')

if (!commandLine) {
  console.error('Usage: node scripts/with-clean-env.mjs <command> [...args]')
  process.exit(1)
}

const child = spawn(commandLine, {
  stdio: 'inherit',
  env,
  // Resolves .cmd shims (next.cmd, tsx.cmd, prisma.cmd) on Windows the same
  // way npm itself would, and understands && the same way a typed command does.
  shell: true,
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error('[with-clean-env] failed to start "' + commandLine + '":', error.message)
  process.exit(1)
})
