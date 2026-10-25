import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { BLOCK_LINKS, fitsHeight, linkAt, linkTargets, sameLinkTarget, withLink, type LinkTarget } from '../../deck/blocks'
import type { BlockLink, BlockRow, Slide } from '../../deck/types'
import { cx } from '../../lib/cx'
import { LinkGlyph } from '../../slides/blocks'
import { useDeck } from '../../store/deckStore'
import { dialogOpen, TrashIcon, undoAction } from '../ui'

// 이음표(화살표, 더하기, 결과, 견주기)를 컴포넌트 사이에 끼우는 일.
//
// 이음표는 칸을 차지하지 않고 칸 사이에 선다(deck/blocks.ts의 이음표). 끌면 손에 든 이음표가 가장 가까운 칸 사이에 붙고,
// 그 자리의 양쪽 칸이 비켜 나는 모습을 미리 보여 준다. 놓을 때 한 번만 저장해서 되돌리기 한 번으로 돌아온다.

type Toast = { show(text: string, action?: { label: string; run: () => void }, ms?: number): void }

/** 이음표를 놓을 수 있는 자리의 화면 좌표. 칸 사이는 두 칸의 가운데, 줄 사이는 두 줄의 가운데 */
interface Spot {
  t: LinkTarget
  x: number
  y: number
  /** 칸 사이는 그 줄의 위아래 끝, 줄 사이는 본문의 왼쪽 오른쪽 끝 (이 안이면 가깝다고 본다) */
  lo: number
  hi: number
}

interface LinkDrag {
  link: BlockLink
  /** 장에 있던 이음표를 옮길 때 원래 자리 */
  from: LinkTarget | null
  /** 옮기는 이음표를 뺀 줄들. 놓을 자리는 늘 이것을 기준으로 */
  base: BlockRow[]
  spots: Spot[]
  target: LinkTarget | null
  /** 손 아래 자리에 놓을 수 없는 까닭 */
  blocked: string | null
}

const NO_HEIGHT = '줄 사이를 넓힐 높이가 모자라요. 컴포넌트를 빼거나 줄을 줄여 주세요.'
const NO_PAIR = '컴포넌트가 둘 이상 있어야 그 사이에 이음표를 끼울 수 있어요.'

/** 지금 그려진 칸들로 놓을 자리를 잰다. 양쪽 칸이 똑같이 비켜 나서, 미리 보기로 칸이 움직여도 가운데는 그대로다 */
function measureSpots(area: HTMLElement, rows: BlockRow[]): Spot[] {
  const cells = new Map<string, DOMRect>()
  for (const el of area.querySelectorAll<HTMLElement>(':scope > .bk')) cells.set(el.dataset.block!, el.getBoundingClientRect())
  const a = area.getBoundingClientRect()
  const out: Spot[] = []
  for (const t of linkTargets(rows)) {
    const row = rows[t.row]
    if (t.dir === 'h') {
      const l = cells.get(row.blocks[t.col].id)
      const r = cells.get(row.blocks[t.col + 1].id)
      if (!l || !r) continue
      const lo = Math.min(l.top, r.top)
      const hi = Math.max(l.bottom, r.bottom)
      out.push({ t, x: (l.right + r.left) / 2, y: (lo + hi) / 2, lo, hi })
    } else {
      const up = row.blocks.map((b) => cells.get(b.id)).filter((r) => !!r)
      const down = rows[t.row + 1].blocks.map((b) => cells.get(b.id)).filter((r) => !!r)
      if (!up.length || !down.length) continue
      const y = (Math.max(...up.map((r) => r.bottom)) + Math.min(...down.map((r) => r.top))) / 2
      out.push({ t, x: a.left + a.width / 2, y, lo: a.left, hi: a.right })
    }
  }
  return out
}

/** 손 아래에서 가장 가까운 자리. 칸 사이는 옆으로 떨어진 만큼, 줄 사이는 위아래로 떨어진 만큼 (그 줄이나 본문 밖이면 그만큼 더) */
function nearest(spots: Spot[], x: number, y: number): Spot | null {
  let best: Spot | null = null
  let score = Infinity
  for (const s of spots) {
    const out = (v: number) => Math.max(0, s.lo - v, v - s.hi)
    const d = s.t.dir === 'h' ? Math.abs(x - s.x) + out(y) : Math.abs(y - s.y) + out(x)
    if (d < score) {
      score = d
      best = s
    }
  }
  return best
}

export function useLinkEditing({
  slideRef,
  areaEl,
  toast,
  deselectBlock,
  selectedBlock,
}: {
  slideRef: RefObject<Slide>
  areaEl: RefObject<HTMLDivElement | null>
  toast: Toast
  deselectBlock(): void
  /** 고른 부품이 있으면 눌러 넣는 이음표를 그 부품의 오른쪽이나 아래에 */
  selectedBlock: string | null
}) {
  const store = useDeck.getState()
  const [selected, setSelected] = useState<LinkTarget | null>(null)
  const [drag, setDrag] = useState<LinkDrag | null>(null)
  const dragRef = useRef<LinkDrag | null>(null)
  dragRef.current = drag
  const ghostEl = useRef<HTMLDivElement | null>(null)

  useEffect(() => setSelected(null), [slideRef.current.id])

  /** 이 자리에 이음표를 둘 수 없는 까닭. 줄 사이는 위아래 줄이 비켜 나는 만큼 높이가 더 든다 */
  const why = (rows: BlockRow[], t: LinkTarget, link: BlockLink): string | null => {
    if (t.dir === 'h') return null
    const h = areaEl.current?.offsetHeight
    return h && !fitsHeight(withLink(rows, t, link), h) ? NO_HEIGHT : null
  }

  /** 놓은 이음표가 제자리에서 살짝 튀며 나타난다 */
  const pop = (t: LinkTarget) =>
    requestAnimationFrame(() => {
      const key = t.dir === 'h' ? `h${t.row}-${t.col}` : `v${t.row}`
      const el = areaEl.current?.querySelector<HTMLElement>(`:scope > .bk-link[data-link="${key}"] > .bk-link-g`)
      if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
      el.animate([{ scale: '0.4', opacity: 0 }, { scale: '1.12', opacity: 1, offset: 0.6 }, { scale: '1' }], { duration: 380, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' })
    })

  const place = (rows: BlockRow[], t: LinkTarget, link: BlockLink) => {
    const s = slideRef.current
    store.setRows(s.id, withLink(rows, t, link))
    setSelected(t)
    deselectBlock()
    pop(t)
  }

  // ---------- 끌기 ----------

  const moveGhost = (x: number, y: number) => {
    const g = ghostEl.current
    if (g) g.style.translate = `${x}px ${y}px`
  }

  const track = useCallback((x: number, y: number) => {
    const d = dragRef.current
    if (!d) return
    const frame = document.querySelector<HTMLElement>('.ed-canvas .slide-frame')?.getBoundingClientRect()
    const over = !!frame && x >= frame.left - 24 && x <= frame.right + 24 && y >= frame.top - 24 && y <= frame.bottom + 24
    let target: LinkTarget | null = null
    let blocked: string | null = null
    if (over) {
      const s = nearest(d.spots, x, y)
      // 경계에서 떨리지 않게: 지금 자리가 새 자리보다 조금만 멀면 그대로 둔다
      const cur = d.target && d.spots.find((p) => sameLinkTarget(p.t, d.target))
      const k = frame ? frame.width / 1920 : 1
      const dist = (p: Spot) => (p.t.dir === 'h' ? Math.abs(x - p.x) : Math.abs(y - p.y))
      const pick = cur && s && !sameLinkTarget(cur.t, s.t) && dist(cur) - dist(s) < 30 * k ? cur : s
      if (pick) {
        blocked = why(d.base, pick.t, d.link)
        target = blocked ? null : pick.t
      } else blocked = NO_PAIR
    }
    if (!sameLinkTarget(target, d.target) || !!target !== !!d.target || blocked !== d.blocked) {
      const next = { ...d, target, blocked }
      dragRef.current = next
      setDrag(next)
    }
  }, [])

  const begin = (link: BlockLink, from: LinkTarget | null, x: number, y: number) => {
    const s = slideRef.current
    const rows = s.layout === 'compose' ? (s.rows ?? []) : []
    const base = from ? withLink(rows, from, null) : rows
    const spots = areaEl.current && s.layout === 'compose' ? measureSpots(areaEl.current, rows) : []
    const d: LinkDrag = { link, from, base, spots, target: from, blocked: null }
    dragRef.current = d
    setDrag(d)
    setSelected(null)
    deselectBlock()
    document.body.classList.add('is-block-dragging')
    requestAnimationFrame(() => {
      moveGhost(x, y)
      ghostEl.current?.animate([{ scale: '0.6', opacity: 0 }, { scale: '1', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' })
    })
    let raf = 0
    const onMove = (e: PointerEvent) => {
      moveGhost(e.clientX, e.clientY)
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => track(e.clientX, e.clientY))
    }
    const end = (cancel: boolean) => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('is-block-dragging')
      const cur = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (!cur) return
      if (!cancel && cur.target) {
        if (!cur.from || !sameLinkTarget(cur.from, cur.target)) place(cur.base, cur.target, cur.link)
        else setSelected(cur.from)
        return
      }
      // 놓을 자리가 없는 곳에 놓으면: 옮기던 이음표는 제자리로, 새 이음표는 넣지 않는다
      if (cur.from) setSelected(cur.from)
      else if (!cancel) toast.show(cur.blocked ?? (cur.spots.length ? '컴포넌트 사이에 놓아 주세요.' : NO_PAIR), undefined, 5000)
    }
    const onUp = (e: PointerEvent) => {
      track(e.clientX, e.clientY)
      end(false)
    }
    const onCancel = () => end(true)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      end(true)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)
  }

  /** 눌렀다가 조금 움직이면 끌기 시작. 그냥 떼면 onTap */
  const press = (e: ReactPointerEvent<HTMLElement>, start: (x: number, y: number) => void, onTap: () => void) => {
    if (e.button !== 0) return
    e.preventDefault()
    const sx = e.clientX
    const sy = e.clientY
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return
      cleanup()
      start(ev.clientX, ev.clientY)
    }
    const up = () => {
      cleanup()
      onTap()
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // ---------- 눌러서 넣기 ----------

  /** 알아서 고른 자리: 고른 부품의 오른쪽, 그 줄 아래, 위. 고른 부품이 없으면 처음 빈 칸 사이, 그다음 줄 사이 */
  function autoSpot(rows: BlockRow[], link: BlockLink): LinkTarget | null {
    const free = (t: LinkTarget) => !linkAt(rows, t) && !why(rows, t, link)
    const all = linkTargets(rows)
    if (selectedBlock) {
      const row = rows.findIndex((r) => r.blocks.some((b) => b.id === selectedBlock))
      if (row >= 0) {
        const col = rows[row].blocks.findIndex((b) => b.id === selectedBlock)
        const near: LinkTarget[] = [{ dir: 'h', row, col }, { dir: 'h', row, col: col - 1 }, { dir: 'v', row }, { dir: 'v', row: row - 1 }]
        const t = near.find((n) => all.some((a) => sameLinkTarget(a, n)) && free(n))
        if (t) return t
      }
    }
    return all.find((t) => t.dir === 'h' && free(t)) ?? all.find(free) ?? null
  }

  function insert(link: BlockLink) {
    const s = slideRef.current
    const rows = s.layout === 'compose' ? (s.rows ?? []) : []
    const all = linkTargets(rows)
    if (!all.length) {
      toast.show(NO_PAIR, undefined, 5000)
      return
    }
    const t = autoSpot(rows, link)
    if (!t) {
      toast.show(all.every((a) => linkAt(rows, a)) ? '모든 컴포넌트 사이에 이미 이음표가 있어요. 이음표를 눌러 모양을 바꿀 수 있어요.' : NO_HEIGHT, undefined, 6000)
      return
    }
    place(rows, t, link)
  }

  const pressCard = (e: ReactPointerEvent<HTMLElement>, link: BlockLink) => press(e, (x, y) => begin(link, null, x, y), () => insert(link))

  // ---------- 장에 있는 이음표 ----------

  const onLinkPointerDown = (e: ReactPointerEvent<HTMLElement>, t: LinkTarget) => {
    if (e.button !== 0) return
    // 장 바탕을 누른 것으로 보고 고르기를 끝내지 않게
    e.stopPropagation()
    const link = linkAt(slideRef.current.rows ?? [], t)
    if (!link) return
    setSelected(t)
    deselectBlock()
    press(e, (x, y) => begin(link, t, x, y), () => {})
  }

  const selectedLink = selected && linkAt(slideRef.current.rows ?? [], selected) ? selected : null

  const change = (link: BlockLink | null) => {
    const s = slideRef.current
    if (!selectedLink) return
    const t = selectedLink
    if (link && t.dir === 'v' && why(withLink(s.rows ?? [], t, null), t, link)) return
    store.setRows(s.id, withLink(s.rows ?? [], t, link))
    if (!link) {
      setSelected(null)
      toast.show('이음표를 뺐어요', undoAction(toast))
    }
  }

  // 고른 이음표: 지우기 키로 빼고, Esc로 고르기를 끝낸다
  useEffect(() => {
    if (!selectedLink) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea, [contenteditable]')) return
      // 대화 창이 떠 있으면 그 창의 키다: 창을 닫는 Esc로 고르기를 끝내거나, 창 뒤의 이음표를 빼지 않는다
      if (e.defaultPrevented || dialogOpen()) return
      if (e.key === 'Escape') setSelected(null)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        change(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const current = selectedLink ? linkAt(slideRef.current.rows ?? [], selectedLink) : null
  const toolbar =
    selectedLink && current && !drag ? (
      <div className="bk-tools" onPointerDown={(e) => e.stopPropagation()}>
        <span className="bk-tool is-label">
          <span className="lk-tool-g" aria-hidden="true">
            <LinkGlyph link={current} />
          </span>
          이음표
        </span>
        <span className="bk-tool-sep" />
        <div className="lk-tool-set" role="radiogroup" aria-label="이음표 모양">
          {BLOCK_LINKS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={current === l.id}
              className={cx('bk-tool', current === l.id && 'is-on')}
              title={l.description}
              onClick={() => change(l.id)}
            >
              <span className="lk-tool-g" aria-hidden="true">
                <LinkGlyph link={l.id} />
              </span>
              <span>{l.name}</span>
            </button>
          ))}
        </div>
        <span className="bk-tool-sep" />
        <button type="button" className="bk-tool is-icon" title="빼기 (Delete)" aria-label="이음표 빼기" onClick={() => change(null)}>
          <TrashIcon />
        </button>
      </div>
    ) : null

  const ghost = drag
    ? createPortal(
        <div ref={ghostEl} className={cx('lk-ghost', drag.target && 'is-placed')} aria-hidden="true">
          <span className="lk-ghost-g">
            <LinkGlyph link={drag.link} />
          </span>
        </div>,
        document.body,
      )
    : null

  // 놓을 수 없는 까닭도 무대 위쪽의 한 줄 안내로 (손 아래에 붙여 두면 놓일 자리와 이웃 컴포넌트를 가렸다)
  const hint = drag ? (drag.blocked ?? (drag.spots.length ? '컴포넌트 사이에 놓으면 그 둘을 이어요' : NO_PAIR)) : null

  return {
    selectedLink,
    selectLink: setSelected,
    /** 끄는 동안 장에 보여 줄 줄들(옮기는 이음표를 뺀)과 놓일 자리 */
    previewRows: drag ? drag.base : null,
    preview: drag?.target ? { target: drag.target, link: drag.link } : null,
    dragging: !!drag,
    onLinkPointerDown,
    pressCard,
    insert,
    toolbar,
    ghost,
    hint,
  }
}
