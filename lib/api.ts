// lib/api.ts
//
// One place where errors become responses, so no handler ever leaks a stack
// trace, an ORM message, or the difference between "no such user" and "wrong
// password".
//
// Known error types carry a status and a message that was written to be read
// by a person. Everything else becomes a flat 500 with a generic message, and
// the real error goes to the server log where only we can see it.

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AdminError } from './admin'
import { AuthError } from './auth'
import { NotFoundError } from './tenant'
import { WorkflowError } from './workflow'

export interface ApiErrorBody {
  error: string
  /** Field-level messages, when the failure was a validation failure. */
  fields?: Record<string, string>
}

export function jsonError(
  status: number,
  error: string,
  fields?: Record<string, string>,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(fields ? { error, fields } : { error }, { status })
}

function fieldsFromZod(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    if (!fields[key]) fields[key] = issue.message
  }
  return fields
}

/**
 * Converts a thrown error into a response.
 *
 * Order matters: the specific types first, the catch-all last. An unknown
 * error must never reach the client with its message intact — that is how
 * database schemas and file paths escape.
 */
export function toErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof ZodError) {
    return jsonError(400, 'Some of what you entered needs fixing.', fieldsFromZod(error))
  }

  if (error instanceof AuthError) {
    return jsonError(error.httpStatus, error.message)
  }

  if (error instanceof NotFoundError) {
    return jsonError(404, 'Not found.')
  }

  if (error instanceof WorkflowError) {
    return jsonError(error.httpStatus, error.message)
  }

  if (error instanceof AdminError) {
    return jsonError(error.httpStatus, error.message, error.fields)
  }

  // Anything unrecognised: log it where we can see it, tell the client nothing.
  console.error('[api] unhandled error', error)
  return jsonError(500, 'Something went wrong. Try again.')
}

/**
 * Wraps a route handler so every throw becomes a clean response.
 *
 * The handlers themselves then read as the sequence CLAUDE.md prescribes:
 * session, role, tenant-scoped fetch, business rule, validation, transaction.
 */
export function handler<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<NextResponse>,
) {
  return async (...args: TArgs): Promise<NextResponse> => {
    try {
      return await fn(...args)
    } catch (error) {
      return toErrorResponse(error)
    }
  }
}

/** Parses a JSON body without letting a malformed one throw a 500. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new AuthError(400, 'The request body was not valid JSON.')
  }
}
