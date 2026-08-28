// lib/sanitize.ts
//
// Rich-text bodies are sanitized BEFORE they are stored, not on the way out.
//
// Sanitizing only at render time means the database holds hostile markup, and
// every future consumer — a PDF export, an email, a report, a colleague's
// script — has to remember to sanitize too. One of them will not. Cleaning on
// the way in means the stored value is the safe value.
//
// The allowlist matches what the Tiptap editor can actually produce. Anything
// else is dropped rather than escaped, so a pasted <script> leaves no trace.

import sanitizeHtml from 'sanitize-html'

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'h1',
    'h2',
    'h3',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'pre',
    'hr',
    'a',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],

  allowedAttributes: {
    // rel and target must be listed here as well as set in transformTags
    // below: sanitize-html runs the transform first and THEN filters against
    // this allowlist, so anything missing here is stripped straight back off.
    a: ['href', 'title', 'rel', 'target'],
    // Tiptap marks the alignment of a paragraph with a style attribute; the
    // allowedStyles block below restricts it to the four safe values.
    p: ['style'],
    h1: ['style'],
    h2: ['style'],
    h3: ['style'],
  },

  allowedStyles: {
    '*': {
      'text-align': [/^(left|right|center|justify)$/],
    },
  },

  // No javascript:, no data: — those are the two that turn a link into an XSS.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,

  // Strip the tag AND its contents, so a pasted script leaves no text behind.
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'iframe'],

  transformTags: {
    // Any link we keep opens in a new tab and cannot reach back into this page.
    a: sanitizeHtml.simpleTransform('a', {
      rel: 'noopener noreferrer nofollow',
      target: '_blank',
    }),
  },
}

/** Cleans a rich-text body for storage. Always call before writing. */
export function sanitizeMemoBody(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim()
}

/**
 * Plain text of a memo body — used for search matching and for the PDF export.
 * Entities are decoded so a search for "R&D" matches a body holding "R&amp;D".
 */
export function toPlainText(html: string): string {
  const stripped = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
  return stripped
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** True when a body carries no actual words, only empty markup. */
export function isEffectivelyEmpty(html: string): boolean {
  return toPlainText(html).length === 0
}

/**
 * Plain-text paragraphs, block boundaries preserved as breaks between array
 * entries. Used by the PDF export, which has no HTML renderer of its own and
 * needs to lay text out as paragraphs rather than one unbroken line.
 */
export function toParagraphs(html: string): string[] {
  const withBreaks = html
    .replace(/<\/(p|h1|h2|h3|li|blockquote|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
  const plain = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  return plain
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0)
}
