// lib/validation/admin.ts — Zod schemas for organization/department/user
// administration. Every schema here backs a route that requireAdmin() guards.

import { z } from 'zod'

const cuid = z.string().cuid()

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2, 'Enter the organization name.').max(120),
  logoUrl: z.string().trim().url('Enter a valid URL.').max(500).optional().or(z.literal('')),
  contactEmail: z.string().trim().toLowerCase().email().max(254).optional().or(z.literal('')),
  contactPhone: z.string().trim().max(40).optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
})

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2, 'Enter a department name.').max(120),
  description: z.string().trim().max(300).optional().or(z.literal('')),
})

export const updateDepartmentSchema = createDepartmentSchema.extend({
  isActive: z.boolean(),
})

const password = z.string().min(8, 'Use at least 8 characters.').max(72)

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Enter the full name.').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  designation: z.string().trim().max(120).optional().or(z.literal('')),
  departmentId: z.union([cuid, z.literal('')]).optional().transform((v) => (v ? v : null)),
  role: z.enum(['ORG_ADMIN', 'USER']),
  password,
})

export const updateUserSchema = z.object({
  name: z.string().trim().min(2, 'Enter the full name.').max(120),
  designation: z.string().trim().max(120).optional().or(z.literal('')),
  departmentId: z.union([cuid, z.literal('')]).optional().transform((v) => (v ? v : null)),
  role: z.enum(['ORG_ADMIN', 'USER']),
})

export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
})

export const userListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  departmentId: z.union([cuid, z.literal('')]).optional(),
  role: z.enum(['ORG_ADMIN', 'USER', 'SUPER_ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
