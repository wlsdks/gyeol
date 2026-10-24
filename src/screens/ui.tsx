import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { cx } from '../lib/cx'

export function Brand() {
  return (
    <a className="brand" href="#/">
      <span className="brand-mark" aria-hidden="true" />
      html-maker
    </a>
  )
}

export function Icon({ d, className }: { d: string; className?: string }) {
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
export const ShapesIcon = () => <Icon d="M4 4h7v7H4zM13 13h7v7h-7zM16.5 4a3.5 3.5 0 110 7 3.5 3.5 0 010-7zM4 20l3.5-6 3.5 6z" />
export const TrashIcon = () => <Icon d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
export const EyeOffIcon = () => <Icon d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c5 0 9 6 9 6a17 17 0 01-3.2 3.7M6.2 7.6A17 17 0 003 12s4 6 9 6a9 9 0 004.1-1M9.9 9.9a3 3 0 004.2 4.2" />
export const ScreenIcon = () => <Icon d="M3.5 5h17v11.5h-17zM8.5 20h7M12 16.5V20" />
export const EyeIcon = () => <Icon d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6zM12 15a3 3 0 100-6 3 3 0 000 6z" />
export const MoreIcon = () => <Icon className="icon-fill" d="M5 10.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm7 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm7 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
export const DownloadIcon = () => <Icon d="M12 4v11M7 10l5 5 5-5M5 20h14" />
export const UploadIcon = () => <Icon d="M12 20V9M7 14l5-5 5 5M5 4h14" />
export const CheckIcon = () => <Icon d="M5 12.5l4.5 4.5L19 7.5" />
export const HistoryIcon = () => <Icon d="M4 12a8 8 0 102.3-5.6L4 8.7M4 4v4.7h4.7M12 8v4.5l3 2" />
export const FolderIcon = () => <Icon d="M3 7.5A1.5 1.5 0 014.5 6H9l2 2.2h8.5A1.5 1.5 0 0121 9.7v8.8a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5z" />
export const AlertIcon = () => <Icon d="M12 4l9 16H3zM12 10v4.5M12 17.2v.3" />
export const CloseIcon = () => <Icon d="M6 6l12 12M18 6L6 18" />
export const BlocksIcon = () => <Icon d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM16.5 13v7M13 16.5h7" />
export const GripIcon = () => <Icon className="icon-fill" d="M9 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm6 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-6 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm6 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-6 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm6 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
export const MotionIcon = () => <Icon d="M3.5 8h6M2.5 12h8M3.5 16h6M14 6.5l5.5 5.5-5.5 5.5" />
export const InfoIcon = () => <Icon d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5.5M12 7.6v.4" />
export const SlidersIcon = () => <Icon d="M4 7h16M4 17h16M9 4.5v5M15 14.5v5" />
export const SparkIcon =() => <Icon d="M12 3.5l1.9 5.2 5.1 1.8-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />

/**
 * (i) 단추: 늘 펼쳐 둘 필요 없는 안내를 접어 둔다. 마우스를 올리거나 눌러서(키보드로 옮겨 와도) 보인다.
 * 말풍선은 단추 밑에 붙는다. align: 단추의 어느 쪽 끝에 말풍선 끝을 맞출지 (칸 오른쪽 끝의 단추는 end)
 */
export function Info({ label, children, align = 'end' }: { label: string; children: ReactNode; align?: 'start' | 'end' }) {
  const id = useId()
  return (
    <span className={cx('info', `info-${align}`)}>
      <button type="button" className="info-btn" aria-label={label} aria-describedby={id}>
        <InfoIcon />
      </button>
      <span role="tooltip" id={id} className="info-tip">
        {children}
      </span>
    </span>
  )
}

export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  )
}

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

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'

/** 대화 창(aria-modal)이 떠 있는지. 떠 있으면 뒤쪽 화면의 단축키(지우기, Esc로 닫기)는 쉰다 */
export function dialogOpen(): boolean {
  return !!document.querySelector('[aria-modal="true"]')
}

/**
 * 대화 창의 초점: 열 때 안으로 옮기고([data-autofocus]가 있으면 그것), Tab은 창 안에서만 돌고,
 * 닫으면 창을 연 단추로 돌려준다. Esc는 맨 위의 창 하나만 닫는다.
 * Esc는 다른 단축키보다 먼저(잡는 단계에서) 받아 preventDefault로 표시한다. 그래야 뒤쪽 화면이 같은 Esc로
 * 컴포넌트 고르기를 닫거나 고른 컴포넌트를 놓지 않는다 (창은 그 사이에 이미 닫혀 있을 수 있어서 dialogOpen만으로는 모른다).
 * onClose는 그릴 때마다 새로 만들어져도 된다: 한 번만 걸어 두고 늘 최근 것을 부른다
 * (예전에는 다시 그릴 때마다 초점을 돌려줬다가 다시 옮겨서, Tab으로 옮겨 둔 초점이 첫 단추로 튀었다).
 */
export function useDialog(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const prev = document.activeElement as HTMLElement | null
    const start = el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>(FOCUSABLE) ?? el
    start.focus({ preventScroll: true })
    // 창 위에 또 창이 뜨면(버전 미리 보기 위의 '되돌릴까요?') 맨 위 창만 키를 받는다
    const isTop = () => {
      const all = document.querySelectorAll('[aria-modal="true"]')
      return all[all.length - 1] === el
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || !isTop()) return
      if (e.key === 'Escape') {
        e.preventDefault()
        close.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.getClientRects().length > 0)
      const active = document.activeElement
      if (!items.length) {
        e.preventDefault()
        el.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (!el.contains(active)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && (active === first || active === el)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      // 연 단추가 아직 화면에 있으면 그리로 (메뉴 안의 단추였으면 메뉴와 함께 사라졌을 수 있다)
      if (prev?.isConnected) prev.focus({ preventScroll: true })
    }
  }, [ref])
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
  useDialog(ref, onClose)
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <h2 className="modal-title">{title}</h2>
        {children && <div className="modal-body">{children}</div>}
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  )
}

/** 이 브라우저에 저장하지 못했을 때 덧붙이는 말. IndexedDB가 거절하는 것은 거의 저장 공간이 모자랄 때다 */
export const SAVE_HELP = '브라우저 저장 공간이 모자라면 저장되지 않아요. 쓰지 않는 발표를 지우거나 큰 이미지를 줄인 뒤 다시 해 주세요.'

// 화면을 옮긴 뒤에 보일 알림 (내 발표에서 파일을 열고 편집기로 갈 때처럼, 보낸 화면은 그 사이에 사라진다)
let pendingNotice: string | null = null
export function noticeAfterGo(text: string) {
  pendingNotice = text
}
export function takeNotice(): string | null {
  const text = pendingNotice
  pendingNotice = null
  return text
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
