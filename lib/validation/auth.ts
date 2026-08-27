// lib/validation/auth.ts — Zod schemas for every authentication input.
// Every route handler validates with these before touching the database.

import { z } from 'zod'

/** Lowercased, trimmed email. Length capped so a huge body can't reach bcrypt. */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Enter your email address.')
  .max(254, 'That email address is too long.')
  .email('Enter a valid email address.')

/**
 * Password rules are deliberately modest: long enough to matter, not so fussy
 * that a demo account becomes unusable. bcrypt truncates past 72 bytes, so the
 * cap is a real limit rather than a stylistic one.
 */
const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use at most 72 characters.')

/** Organization identifier used in memo numbers, e.g. "northwind". */
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'Use at least 2 characters.')
  .max(40, 'Use at most 40 characters.')
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    'Use lowercase letters, numbers and hyphens only.',
  )

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.').max(72),
  // Only sent on the second attempt, when one email exists in several
  // organizations and the user has picked one.
  organizationId: z.string().cuid().optional(),
})

export const registerOrgSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, 'Enter the organization name.')
    .max(120, 'That name is too long.'),
  slug,
  adminName: z
    .string()
    .trim()
    .min(2, 'Enter your full name.')
    .max(120, 'That name is too long.'),
  adminEmail: email,
  password,
  confirmPassword: z.string(),
  contactEmail: z.string().trim().toLowerCase().email().max(254).optional().or(z.literal('')),
  contactPhone: z.string().trim().max(40).optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
}).refine((v) => v.password === v.confirmPassword, {
  message: 'The two passwords do not match.',
  path: ['confirmPassword'],
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.').max(72),
  newPassword: password,
  confirmPassword: z.string(),
}).refine((v) => v.newPassword === v.confirmPassword, {
  message: 'The two passwords do not match.',
  path: ['confirmPassword'],
}).refine((v) => v.newPassword !== v.currentPassword, {
  message: 'Choose a password you have not used here before.',
  path: ['newPassword'],
})

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'This reset link is not valid.').max(200),
  newPassword: password,
  confirmPassword: z.string(),
}).refine((v) => v.newPassword === v.confirmPassword, {
  message: 'The two passwords do not match.',
  path: ['confirmPassword'],
})

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(120),
  designation: z.string().trim().max(120).optional().or(z.literal('')),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterOrgInput = z.infer<typeof registerOrgSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
