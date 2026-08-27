'use server'

import { redirect } from 'next/navigation'
import { resolveLoginOrganization, signIn } from '@/lib/auth'
import { loginSchema } from '@/lib/validation/auth'

/**
 * One message for every failure mode. A distinct "no such account" would tell
 * an attacker which email addresses are registered here.
 */
const GENERIC_FAILURE = 'That email and password do not match an active account.'

/**
 * redirect() and notFound() signal themselves by throwing. Those must be
 * re-thrown, never swallowed into an error message. Checking the digest avoids
 * importing from next/dist, whose paths move between patch releases.
 */
function isControlFlowError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND')
  )
}

export interface LoginState {
  error?: string
  fieldErrors?: Partial<Record<'email' | 'password', string>>
  /** Set when one email belongs to several organizations. */
  organizations?: { id: string; name: string }[]
  values?: { email: string }
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const raw = {
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    organizationId: String(formData.get('organizationId') ?? '') || undefined,
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors
    return {
      fieldErrors: {
        email: flat.email?.[0],
        password: flat.password?.[0],
      },
      values: { email: raw.email },
    }
  }

  const { email, password } = parsed.data
  let organizationId = parsed.data.organizationId

  // Work out which tenant this sign-in belongs to before handing over to
  // Auth.js, so the provider never has to guess between two organizations.
  if (!organizationId) {
    const resolution = await resolveLoginOrganization(email, password)

    if (resolution.kind === 'no-match') {
      return { error: GENERIC_FAILURE, values: { email } }
    }

    if (resolution.kind === 'choose') {
      return {
        organizations: resolution.organizations,
        values: { email },
      }
    }

    organizationId = resolution.organizationId
  }

  try {
    await signIn('credentials', {
      email,
      password,
      organizationId,
      redirect: false,
    })
  } catch (error) {
    if (isControlFlowError(error)) throw error
    return { error: GENERIC_FAILURE, values: { email } }
  }

  redirect('/dashboard')
}
