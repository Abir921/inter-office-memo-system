'use client'

import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The memo body editor.
 *
 * Whatever this produces is sanitized server-side before it is stored
 * (lib/sanitize.ts). The toolbar is limited to the marks the sanitizer keeps,
 * so what the author sees is what survives.
 */
export function MemoEditor({
  name,
  defaultValue = '',
  onChange,
}: {
  name: string
  defaultValue?: string
  onChange?: (html: string) => void
}) {
  const editor = useEditor({
    // Tiptap renders differently on the server; letting it render only on the
    // client avoids a hydration mismatch.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
    ],
    content: defaultValue,
    editorProps: {
      attributes: {
        class:
          'memo-body min-h-56 w-full rounded-b-sm border border-t-0 border-rule bg-card px-4 py-3 text-[15px] leading-[1.7] text-ink-soft focus:outline-none',
        'aria-label': 'Memo body',
      },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
  })

  if (!editor) {
    return (
      <div className="min-h-[17.5rem] animate-pulse rounded-sm border border-rule bg-wash" />
    )
  }

  const tools = [
    { icon: Bold, label: 'Bold', run: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
    { icon: Italic, label: 'Italic', run: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
    { icon: Strikethrough, label: 'Strikethrough', run: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike') },
    { icon: Heading2, label: 'Heading', run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
    { icon: Heading3, label: 'Subheading', run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
    { icon: List, label: 'Bulleted list', run: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
    { icon: ListOrdered, label: 'Numbered list', run: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
    { icon: Quote, label: 'Quote', run: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
    { icon: Code, label: 'Code', run: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code') },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-sm border border-rule bg-wash px-2 py-1.5">
        {tools.map(({ icon: Icon, label, run, active }) => (
          <button
            key={label}
            type="button"
            onClick={run}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={cn(
              'rounded-sm p-1.5 transition-colors',
              active ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-rule/50 hover:text-ink',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-rule" />

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
          aria-label="Undo"
          className="rounded-sm p-1.5 text-ink-soft hover:bg-rule/50 hover:text-ink disabled:opacity-40"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
          aria-label="Redo"
          className="rounded-sm p-1.5 text-ink-soft hover:bg-rule/50 hover:text-ink disabled:opacity-40"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <EditorContent editor={editor} />

      {/* Carries the HTML in a plain form field, so the form works the same
          whether it is submitted by script or by the browser. */}
      <input type="hidden" name={name} value={editor.getHTML()} readOnly />
    </div>
  )
}
