// lib/validation/template.ts — Zod schemas for workflow templates.

import { z } from 'zod'

export const templateStepSchema = z.object({
  position: z.number().int().min(1).max(20),
  positionLabel: z.string().trim().min(1, 'Name this step.').max(80),
  defaultDepartmentId: z
    .union([z.string().cuid(), z.literal('')])
    .optional()
    .transform((v) => (v ? v : null)),
})

export const templateStepsSchema = z
  .array(templateStepSchema)
  .min(1, 'A template needs at least one step.')
  .max(20, 'A template cannot have more than 20 steps.')
  .superRefine((steps, ctx) => {
    const sorted = [...steps].sort((a, b) => a.position - b.position)
    sorted.forEach((s, index) => {
      if (s.position !== index + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Positions must start at 1 and run consecutively.',
        })
      }
    })
  })

export const createTemplateSchema = z.object({
  name: z.string().trim().min(2, 'Name the template.').max(120),
  description: z.string().trim().max(300).optional().or(z.literal('')),
  steps: templateStepsSchema,
})

export const updateTemplateSchema = createTemplateSchema.extend({
  isActive: z.boolean(),
})

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>
