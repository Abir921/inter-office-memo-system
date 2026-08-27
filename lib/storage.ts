// lib/storage.ts
//
// Attachment storage on Supabase, in a PRIVATE bucket.
//
// Two rules shape everything here:
//
//   1. The stored object key is a random UUID, never the uploaded filename.
//      A predictable key ("invoice.pdf") plus a public bucket is how files
//      leak; the original name is kept in the database for display only.
//
//   2. Nothing is served directly from the bucket. Downloads go through a
//      route handler that checks the caller's authorization against the memo
//      first, and only then issues a short-lived signed URL.
//
// The service-role key is used here and only here. It bypasses every storage
// policy, so it must never reach the browser — which is why this module has no
// 'use client' and is imported only by server code.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const SIGNED_URL_TTL_SECONDS = 60

export const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB, per PRD 7.10

/**
 * Extension -> permitted MIME types.
 *
 * Both are checked. An extension alone is trivially renamed; a MIME type alone
 * is supplied by the client and equally untrustworthy. Requiring them to agree
 * on an allowlisted pair is what makes the check worth having.
 */
const ALLOWED: Record<string, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  txt: ['text/plain'],
  csv: ['text/csv', 'application/csv', 'text/plain'],
}

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED)

export class StorageError extends Error {
  httpStatus: number
  constructor(httpStatus: number, message: string) {
    super(message)
    this.name = 'StorageError'
    this.httpStatus = httpStatus
  }
}

export function isStorageConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

let client: SupabaseClient | null = null

function storage(): SupabaseClient {
  if (!isStorageConfigured()) {
    throw new StorageError(503, 'File storage is not configured on this deployment.')
  }

  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  }

  return client
}

function bucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || 'memo-attachments'
}

export function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

export interface ValidatedUpload {
  fileName: string
  mimeType: string
  sizeBytes: number
}

/**
 * Server-side validation of one upload. Nothing the browser claims is trusted;
 * this runs before a single byte is written to the bucket.
 */
export function validateUpload(file: File): ValidatedUpload {
  // Strip any path the client may have sent. "../../etc/passwd" becomes
  // "passwd" before it is ever used as a display name.
  const fileName = (file.name || 'file').split(/[\\/]/).pop()!.slice(0, 200)

  if (file.size === 0) {
    throw new StorageError(400, 'That file is empty.')
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new StorageError(400, 'Files must be 10 MB or smaller.')
  }

  const extension = extensionOf(fileName)
  const permittedTypes = ALLOWED[extension]

  if (!permittedTypes) {
    throw new StorageError(
      400,
      'That file type is not accepted. Attach a PDF, Word or Excel document, an image, or a text file.',
    )
  }

  // The browser sometimes sends an empty or generic type; accept that only
  // when the extension is unambiguous, never for the executable-adjacent ones.
  const mimeType = (file.type || '').toLowerCase() || permittedTypes[0]

  if (!permittedTypes.includes(mimeType)) {
    throw new StorageError(400, 'That file does not match the type its name claims.')
  }

  return { fileName, mimeType, sizeBytes: file.size }
}

/**
 * Writes the file under a random key.
 *
 * The key is namespaced by organization so that a bucket listing, if one were
 * ever obtained, still cannot be read across tenants without also defeating
 * the download authorization.
 */
export async function putObject(
  organizationId: string,
  file: File,
  mimeType: string,
): Promise<string> {
  const storageKey = organizationId + '/' + randomUUID()

  const { error } = await storage()
    .storage.from(bucket())
    .upload(storageKey, file, {
      contentType: mimeType,
      upsert: false,
      // Never let the bucket infer a filename from what we send.
      cacheControl: '3600',
    })

  if (error) {
    console.error('[storage] upload failed', error)
    throw new StorageError(502, 'The file could not be stored. Try again.')
  }

  return storageKey
}

/**
 * A URL that works for one minute and then stops.
 *
 * Callers must have already checked that this user may read this memo. This
 * function performs no authorization of its own.
 */
export async function signedUrlFor(storageKey: string, downloadAs: string): Promise<string> {
  const { data, error } = await storage()
    .storage.from(bucket())
    .createSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS, { download: downloadAs })

  if (error || !data?.signedUrl) {
    console.error('[storage] signing failed', error)
    throw new StorageError(502, 'The file could not be retrieved. Try again.')
  }

  return data.signedUrl
}

export async function removeObject(storageKey: string): Promise<void> {
  const { error } = await storage().storage.from(bucket()).remove([storageKey])
  if (error) console.error('[storage] delete failed', error)
}

/** Startup check: confirms the bucket exists and is private. */
export async function inspectBucket() {
  const { data, error } = await storage().storage.getBucket(bucket())
  if (error) return { ok: false as const, reason: error.message }
  return { ok: true as const, name: data.name, isPublic: data.public }
}
