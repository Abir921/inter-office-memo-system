'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { signIn } from '@/lib/auth'
import { createOrganizationWithAdmin } from '@/lib/organization'
import { registerOrgSchema } from '@/lib/validation/auth'

export interface RegisterOrgState {
  error?: string
  fieldErrors?: Record<string, string>
  values?: Record<string, string>
}

function isControlFlowError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND')
  )
}

const FIELDS = [
  'organizationName',
  'slug',
  'adminName',
  'adminEmail',
  'password',
  'confirmPassword',
  'contactEmail',
  'contactPhone',
  'address',
] as const

export async function registerOrgAction(
  _prev: RegisterOrgState,
  formData: FormData,
): Promise<RegisterOrgState> {
  const raw = Object.fromEntries(
    FIELDS.map((f) => [f, String(formData.get(f) ?? '')]),
  ) as Record<(typeof FIELDS)[number], string>

  // Everything except the two passwords is safe to send back so the form can
  // be redrawn without the user retyping it.
  const echo = Object.fromEntries(
    FIELDS.filter((f) => f !== 'password' && f !== 'confirmPassword').map((f) => [f, raw[f]]),
  )

  const parsed = registerOrgSchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors
    const fieldErrors: Record<string, string> = {}
    for (const [key, messages] of Object.entries(flat)) {
      if (messages?.[0]) fieldErrors[key] = messages[0]
    }
    return { fieldErrors, values: echo }
  }

  const headerList = await headers()

  const result = await createOrganizationWithAdmin({
    ...parsed.data,
    ipAddress:
      headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? headerList.get('x-real-ip'),
    userAgent: headerList.get('user-agent'),
  })

  if (!result.ok) {
    return {
      fieldErrors: {
        slug: 'That identifier is already in use. Choose another.',
      },
      values: echo,
    }
  }

  // Sign the new administrator straight in — they have just proved they know
  // the password by choosing it.
  try {
    await signIn('credentials', {
      email: parsed.data.adminEmail,
      password: parsed.data.password,
      organizationId: result.organizationId,
      redirect: false,
    })
  } catch (error) {
    if (isControlFlowError(error)) throw error
    // The organization exists; only the automatic sign-in failed. Send them to
    // the login page rather than losing the registration.
    redirect('/login')
  }

  redirect('/dashboard')
}
