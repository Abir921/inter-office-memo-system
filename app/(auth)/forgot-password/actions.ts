'use server'

import { issuePasswordResetToken } from '@/lib/password-reset'
import { forgotPasswordSchema } from '@/lib/validation/auth'

export interface ForgotPasswordState {
  sent?: boolean
  fieldErrors?: { email?: string }
  /** Populated outside production only, so the flow can be demonstrated. */
  devLink?: string
}

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: String(formData.get('email') ?? ''),
  })

  if (!parsed.success) {
    return { fieldErrors: { email: parsed.error.flatten().fieldErrors.email?.[0] } }
  }

  const { token } = await issuePasswordResetToken(parsed.data.email)

  // The same answer either way. A different message for an unknown address
  // would turn this form into a way of discovering who works here.
  return {
    sent: true,
    devLink: token ? '/reset-password?token=' + token : undefined,
  }
}
