import { useEffect, useId } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo2,
  Redo2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { sanitizeHtml } from '@/lib/sanitize-html'

/**
 * RichTextEditor — Tiptap 기반 WYSIWYG.
 * 마스터: docs/architecture/v1/features/registration.md §3.6 (PRD §3.6.1 / §3.6.2)
 *
 * - onChange: sanitize 적용된 HTML 문자열 (XSS 차단)
 * - 빈 본문일 때 빈 문자열 반환 (RHF 의 null 처리는 호출부에서)
 * - 외부 value 변경 시 editor 내용 동기화 (setContent without history pollution)
 */
export interface RichTextEditorProps {
  id?: string
  value: string
  onChange: (html: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

const TOOLBAR_BTN =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-subtle hover:text-text disabled:cursor-not-allowed disabled:opacity-50 data-[active=true]:bg-surface-subtle data-[active=true]:text-text'

export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder = '상품 상세 설명을 입력하세요',
  disabled = false,
  className,
  ariaLabel = '상품 상세 설명 에디터',
}: RichTextEditorProps): JSX.Element {
  const fallbackId = useId()
  const editorId = id ?? fallbackId

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editable: !disabled,
    editorProps: {
      attributes: {
        id: editorId,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': ariaLabel,
        class:
          'prose prose-sm max-w-none min-h-[200px] px-3 py-2 focus:outline-none [&_p.is-editor-empty:first-child]:before:text-text-tertiary [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:pointer-events-none',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const raw = ed.getHTML()
      const clean = ed.isEmpty ? '' : sanitizeHtml(raw)
      onChange(clean)
    },
  })

  // 외부 value 변경 시 동기화 (e.g. RHF reset, 템플릿 적용)
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value !== current && !(editor.isEmpty && value === '')) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [editor, value])

  // disabled 동적 반영
  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  if (!editor) {
    return (
      <div
        className={cn(
          'rounded-md border border-border-strong bg-surface min-h-[240px]',
          className,
        )}
        aria-busy
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-md border border-border-strong bg-surface focus-within:ring-2 focus-within:ring-ring',
        disabled && 'opacity-60',
        className,
      )}
    >
      <Toolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} />
    </div>
  )
}

interface ToolbarProps {
  editor: Editor
  disabled: boolean
}

function Toolbar({ editor, disabled }: ToolbarProps): JSX.Element {
  const insertLink = (): void => {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('링크 URL을 입력하세요', previous ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    // javascript: 스킴 차단 (DOMPurify 도 막지만 사전 차단)
    if (/^\s*javascript:/i.test(url)) {
      window.alert('허용되지 않는 링크입니다.')
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const insertImage = (): void => {
    const url = window.prompt('이미지 URL을 입력하세요', 'https://')
    if (!url) return
    if (!/^https?:\/\//i.test(url)) {
      window.alert('http(s) URL 만 허용됩니다.')
      return
    }
    editor.chain().focus().setImage({ src: url }).run()
  }

  return (
    <div
      role="toolbar"
      aria-label="텍스트 서식"
      className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface-subtle/40 px-2 py-1"
    >
      <ToolbarButton
        label="굵게"
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        disabled={disabled}
      >
        <Bold className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="기울임"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        disabled={disabled}
      >
        <Italic className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="취소선"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        disabled={disabled}
      >
        <Strikethrough className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        label="제목2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        disabled={disabled}
      >
        <Heading2 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="제목3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        disabled={disabled}
      >
        <Heading3 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        label="순서 없는 목록"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        disabled={disabled}
      >
        <List className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="순서 있는 목록"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        disabled={disabled}
      >
        <ListOrdered className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="인용"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        disabled={disabled}
      >
        <Quote className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="코드"
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        disabled={disabled}
      >
        <Code className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        label="링크"
        onClick={insertLink}
        active={editor.isActive('link')}
        disabled={disabled}
      >
        <LinkIcon className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton label="이미지" onClick={insertImage} disabled={disabled}>
        <ImageIcon className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        label="실행 취소"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={disabled || !editor.can().undo()}
      >
        <Undo2 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="다시 실행"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={disabled || !editor.can().redo()}
      >
        <Redo2 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
    </div>
  )
}

interface ToolbarButtonProps {
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
}

function ToolbarButton({
  label,
  onClick,
  active = false,
  disabled = false,
  children,
}: ToolbarButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-active={active}
      onClick={onClick}
      disabled={disabled}
      className={TOOLBAR_BTN}
    >
      {children}
    </button>
  )
}

function Divider(): JSX.Element {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />
}
