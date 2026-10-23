import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '../lib/cx'

export function Brand() {
  return (
    <a className="brand" href="#/">
      <span className="brand-mark" aria-hidden="true" />
      html-maker
    </a>
  )
}

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={cx('icon', className)} viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export const ChevronIcon = () => <Icon className="icon-chevron" d="M9 6l6 6-6 6" />
export const BackIcon = () => <Icon d="M15 6l-6 6 6 6" />
export const PlusIcon = () => <Icon d="M12 5v14M5 12h14" />
export const PlayIcon = () => <Icon className="icon-fill" d="M8 5.5v13l10-6.5z" />
export const UndoIcon = () => <Icon d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />
export const RedoIcon = () => <Icon d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" />
export const CopyIcon = () => <Icon d="M9 9h10v10H9zM5 15V5h10" />
export const TrashIcon = () => <Icon d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
export const EyeOffIcon = () => <Icon d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c5 0 9 6 9 6a17 17 0 01-3.2 3.7M6.2 7.6A17 17 0 003 12s4 6 9 6a9 9 0 004.1-1M9.9 9.9a3 3 0 004.2 4.2" />
export const EyeIcon = () => <Icon d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6zM12 15a3 3 0 100-6 3 3 0 000 6z" />
export const MoreIcon = () => <Icon className="icon-fill" d="M5 10.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm7 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm7 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
export const DownloadIcon = () => <Icon d="M12 4v11M7 10l5 5 5-5M5 20h14" />
export const UploadIcon = () => <Icon d="M12 20V9M7 14l5-5 5 5M5 4h14" />
export const CheckIcon = () => <Icon d="M5 12.5l4.5 4.5L19 7.5" />

/** 버튼 아래에 붙는 작은 창. 바깥을 누르거나 Esc로 닫힌다. */
export function Popover({
  button,
  children,
  align = 'right',
  className,
}: {
  button: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="pop-wrap" ref={ref}>
      {button({ open, toggle: () => setOpen((o) => !o) })}
      {open && <div className={cx('pop', `pop-${align}`, className)}>{children(() => setOpen(false))}</div>}
    </div>
  )
}

export function Modal({
  title,
  children,
  actions,
  onClose,
}: {
  title: string
  children?: ReactNode
  actions: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2 className="modal-title">{title}</h2>
        {children && <div className="modal-body">{children}</div>}
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  )
}

/** 화면 아래에 잠깐 떴다 사라지는 알림 */
export function useToast() {
  const [toast, setToast] = useState<{ text: string; action?: { label: string; run: () => void } } | null>(null)
  const timer = useRef<number>(0)
  const show = (text: string, action?: { label: string; run: () => void }, ms = 4000) => {
    setToast({ text, action })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), ms)
  }
  const node = toast ? (
    <div className="toast" role="status">
      {toast.text}
      {toast.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.action!.run()
            setToast(null)
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  ) : null
  return { show, node }
}
