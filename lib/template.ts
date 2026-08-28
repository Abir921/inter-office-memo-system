// lib/template.ts
//
// Workflow templates: named, ordered position labels an author can pick
// instead of building a routing slip by hand (PRD 7.15). A template supplies
// labels only — the author still names a real person for each position when
// they create the memo; lib/workflow.ts never reads a template at submit
// time, only lib/memo.ts's createMemo records which one was used.

import { AuditEventType, Prisma } from '@prisma/client'
import { writeAudit } from './audit'
import { prisma } from './prisma'
import type { TenantContext } from './tenant'

export class TemplateError extends Error {
  httpStatus: number
  fields?: Record<string, string>
  constructor(httpStatus: number, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'TemplateError'
    this.httpStatus = httpStatus
    this.fields = fields
  }
}

export interface TemplateStepInput {
  position: number
  positionLabel: string
  defaultDepartmentId: string | null
}

export interface TemplateInput {
  name: string
  description: string | null
  steps: TemplateStepInput[]
}

async function assertDepartmentsInTenant(organizationId: string, steps: TemplateStepInput[]) {
  const ids = [...new Set(steps.map((s) => s.defaultDepartmentId).filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return

  const found = await prisma.department.count({ where: { id: { in: ids }, organizationId } })
  if (found !== ids.length) {
    throw new TemplateError(400, 'One of the selected departments is not available.')
  }
}

export async function createTemplate(ctx: TenantContext, input: TemplateInput) {
  await assertDepartmentsInTenant(ctx.organizationId, input.steps)

  try {
    return await prisma.$transaction(async (tx) => {
      const template = await tx.workflowTemplate.create({
        data: {
          organizationId: ctx.organizationId,
          name: input.name,
          description: input.description,
          steps: {
            create: input.steps.map((s) => ({
              position: s.position,
              positionLabel: s.positionLabel,
              defaultDepartmentId: s.defaultDepartmentId,
            })),
          },
        },
        include: { steps: { orderBy: { position: 'asc' } } },
      })

      await writeAudit(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        eventType: AuditEventType.TEMPLATE_CREATED,
        entityType: 'WorkflowTemplate',
        entityId: template.id,
        description: 'Workflow template "' + template.name + '" created.',
      })

      return template
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new TemplateError(409, 'A template with that name already exists.', {
        name: 'A template with that name already exists.',
      })
    }
    throw error
  }
}

export async function updateTemplate(
  ctx: TenantContext,
  id: string,
  input: TemplateInput & { isActive: boolean },
) {
  await assertDepartmentsInTenant(ctx.organizationId, input.steps)

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.workflowTemplate.findFirst({
        where: { id, organizationId: ctx.organizationId },
      })
      if (!existing) throw new TemplateError(404, 'Template not found.')

      // Steps have no independent identity worth preserving across an edit —
      // memos that already used this template keep their own copy of the
      // label on each WorkflowStep row, untouched by this. Replacing the set
      // is simpler and exactly as safe as diffing it.
      await tx.workflowTemplateStep.deleteMany({ where: { templateId: id } })

      const template = await tx.workflowTemplate.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description,
          isActive: input.isActive,
          steps: {
            create: input.steps.map((s) => ({
              position: s.position,
              positionLabel: s.positionLabel,
              defaultDepartmentId: s.defaultDepartmentId,
            })),
          },
        },
        include: { steps: { orderBy: { position: 'asc' } } },
      })

      await writeAudit(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        eventType: AuditEventType.TEMPLATE_UPDATED,
        entityType: 'WorkflowTemplate',
        entityId: template.id,
        description: 'Workflow template "' + template.name + '" updated.',
      })

      return template
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new TemplateError(409, 'A template with that name already exists.', {
        name: 'A template with that name already exists.',
      })
    }
    throw error
  }
}
