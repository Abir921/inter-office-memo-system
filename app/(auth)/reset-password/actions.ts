'use server'

import { redirect } from 'next/navigation'
import { consumePasswordResetToken } from '@/lib/password-reset'
import { resetPasswordSchema } from '@/lib/validation/auth'

export interface ResetPasswordState {
  error?: string
  fieldErrors?: Record<string, string>
}

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    token: String(formData.get('token') ?? ''),
    newPassword: String(formData.get('newPassword') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  })

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors
    const fieldErrors: Record<string, string> = {}
    for (const [key, messages] of Object.entries(flat)) {
      if (messages?.[0]) fieldErrors[key] = messages[0]
    }
    return { fieldErrors }
  }

  const result = await consumePasswordResetToken(parsed.data.token, parsed.data.newPassword)

  if (!result.ok) {
    return {
      error:
        'This reset link is no longer valid. It may have expired or already been used. Request a new one.',
    }
  }

  redirect('/login?reset=1')
}
