// Auth.js request handler. Runs on Node because the Credentials provider needs
// Prisma and bcrypt.
import { handlers } from '@/lib/auth'

export const runtime = 'nodejs'

export const { GET, POST } = handlers
