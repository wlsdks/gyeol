import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  autoTarget,
  blockItems,
  blockMinH,
  BLOCK_EFFECTS,
  BLOCK_GAP,
  BLOCK_LOOKS,
  BLOCKS,
  canCompose,
  composeFrom,
  copyBlock,
  dropTarget,
  effectOf,
  fitsHeight,
  insertAt,
  lookOf,
  makeBlock,
  removeBlock,
  sameTarget,
  shiftBlock,
  spansAt,
  targetOf,
  variantOfBlock,
  type DropTarget,
} from '../../deck/blocks'
import { emptyItem, uid } from '../../deck/generate'
import { motionOf } from '../../deck/themes'
import type { Block, BlockEffect, BlockRow, BlockType, Deck, Slide } from '../../deck/types'
import { cx } from '../../lib/cx'
import { motionEngine } from '../../motion/engine'
import type { BlockEdit } from '../../slides/blockEdit'
import { SlideCanvas } from '../../slides/SlideCanvas'
import { useDeck } from '../../store/deckStore'
import { BlocksIcon, CopyIcon, GripIcon, MotionIcon, PlusIcon, ShapesIcon, TrashIcon } from '../ui'

// 부품 장 편집: 부품을 고르고, 끌어다 놓고, 칸 너비를 바꾸는 일.
//
// 놓을 자리는 deck/blocks.ts가 정한다(정해진 줄과 칸 비율 가운데 하나). 여기서는 끄는 동안 놓일 자리를
// 미리 보여 주고(그 자리에 빈 칸이 생기고 다른 부품이 비켜 난다), 놓으면 끌던 부품이 그 칸으로 날아가 맞춰진다.
// 끄는 중에는 저장하지 않는다. 놓을 때 한 번만 바꿔서 되돌리기 한 번으로 돌아온다.

type Toast = { show(text: string, action?: { label: string; run: () => void }, ms?: number): void }

interface Drag {
  kind: 'move' | 'new'
  block: Block
  /** 끄는 부품을 뺀 줄들. 놓을 자리는 늘 이것을 기준으로 찾는다 (움직이는 화면을 재지 않아서 자리가 떨리지 않는다) */
  base: BlockRow[]
  /** 부품 장이 아닌 장에 놓을 때: 같은 내용으로 바꾼 부품 장 */
  composed: Slide | null
  target: DropTarget | null
  /** 놓으면 할 일: 이 장에 넣기, 이 장을 부품 장으로 바꿔 넣기, 다음 장에 새로 만들기 */
  plan: 'place' | 'convert' | 'next' | null
  /** 끌고 있는 부품 그림의 크기 (캔버스 px)와 화면 크기 */
  canvas: { w: number; h: number }
  ghost: { w: number; h: number }
  grab: { x: number; y: number }
  source: DOMRect | null
}

const GHOST_MAX = { w: 340, h: 230 }
const SPRING =
  'linear(0, 0.0576, 0.1409, 0.2066, 0.3123, 0.4188, 0.5204, 0.6135, 0.6697, 0.7445, 0.8079, 0.8604, 0.9029, 0.9261, 0.9543, 0.9755, 0.991, 1.0019, 1.007, 1.0122, 1.0151, 1.0162, 1.0161, 1.0156, 1.0143, 1.0127, 1.011, 1.0093, 1.0082, 1.0066, 1.0052, 1.004, 1.003, 1.0025, 1.0017, 1.0011, 1.0007, 1.0004, 1.0002, 1, 1)'
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** 부품 하나만 그린 장 (끌고 있는 부품, 부품 고르기 카드) */
export function soloSlide(block: Block): Slide {
  return { id: `solo-${block.id}`, layout: 'compose', purpose: '', section: '', fields: {}, items: [], hints: {}, guide: '', notes: '', options: {}, rows: [{ id: 'solo', blocks: [block] }] }
}

/** 본문 상자(.bk-area)의 화면 자리와 캔버스 크기 */
function measureArea(el: HTMLElement | null) {
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const k = el.offsetWidth ? rect.width / el.offsetWidth : 1
  return { rect, k, size: { w: el.offsetWidth, h: el.offsetHeight } }
}

/**
 * 부품 장이 아닌 장을 부품 장으로 바꿨을 때의 본문 상자 어림: 장의 위아래 여백(100, 140)과 옆 여백(120),
 * 지금 장의 제목 높이와 제목 아래 간격(64)을 뺀다. 바뀐 모습이 그려지면 그때부터는 실제로 잰다
 */
function guessArea(frame: DOMRect) {
  const head = document.querySelector<HTMLElement>('.ed-canvas .slide .s-head')
  const k = frame.width / 1920
  const top = 100 + (head && head.offsetHeight ? head.offsetHeight + 64 : 0)
  const size = { w: 1680, h: 1080 - top - 140 }
  return { rect: new DOMRect(frame.left + 120 * k, frame.top + top * k, size.w * k, size.h * k), k, size }
}

export interface BlockEditing {
  /** 무대의 부품 장에 넣어 주는 것 */
  edit: BlockEdit
  /** 무대에 그릴 장. 부품을 끌고 부품 장이 아닌 장 위에 오면 바꾼 모습을 미리 보여 준다 */
  stageSlide: Slide
  /** 놓으면 할 일 안내 (무대 위에 띄운다) */
  hint: string | null
  ghost: ReactNode
  toolbar: ReactNode
  libraryOpen: boolean
  setLibraryOpen(open: boolean): void
  /** 부품 고르기 카드를 누르기 시작할 때. 끌면 끌어다 놓기, 그냥 떼면 알아서 넣기 */
  pressCard(e: ReactPointerEvent<HTMLElement>, type: BlockType): void
  insert(type: BlockType, from?: HTMLElement | null): void
  selected: string | null
  select(id: string | null): void
  convert(): void
}

export function useBlockEditing(deck: Deck, slide: Slide, toast: Toast): BlockEditing {
  // 할 일(액션)만 쓰므로 바뀔 때마다 다시 그리지 않게 한 번 꺼내 둔다
  const store = useDeck.getState()
  const [selected, setSelected] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  // 놓은 뒤 끌던 그림이 칸으로 날아가는 동안 (id가 없으면 집어 온 카드로 돌아가 사라진다)
  const [landing, setLanding] = useState<{ id: string | null; ghost: Drag } | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const dragRef = useRef<Drag | null>(null)
  dragRef.current = drag
  const areaEl = useRef<HTMLDivElement | null>(null)
  const ghostEl = useRef<HTMLDivElement | null>(null)
  const slideRef = useRef(slide)
  slideRef.current = slide
  const engine = useMemo(() => motionEngine(), [])
  const look = useMemo(() => ({ meta: deck.meta, theme: deck.theme, title: deck.title, motion: deck.motion }), [deck.meta, deck.theme, deck.title, deck.motion])

  useEffect(() => setSelected(null), [slide.id])

  const compose = slide.layout === 'compose'

  // ---------- 놓기 ----------

  /** 놓은 부품의 칸으로 끌던 그림을 보내고, 닿을 때 칸을 드러낸다 */
  const land = useCallback((d: Drag) => {
    setLanding({ id: d.block.id, ghost: d })
    setSelected(d.block.id)
  }, [])

  const finish = useCallback(
    (d: Drag) => {
      const s = slideRef.current
      dragRef.current = null
      setDrag(null)
      if (d.kind === 'move') {
        // 놓을 자리가 없는 곳에 놓으면 원래 자리로 돌아간다
        const original = targetOf(s.rows ?? [], d.block.id)
        const t = d.plan === 'place' && d.target ? d.target : original
        const next = t ? insertAt(d.base, t, d.block, uid()) : null
        if (next && t && !sameTarget(t, original)) store.setRows(s.id, next)
        land(d)
        return
      }
      if (!d.plan) {
        // 장 밖에 놓으면 그만둔다: 집어 온 카드로 돌아가 사라진다
        setLanding({ id: null, ghost: d })
        return
      }
      const block = d.block
      if (d.plan === 'place' && d.target) {
        store.setRows(s.id, insertAt(d.base, d.target, block, uid())!)
      } else if (d.plan === 'convert' && d.target && d.composed) {
        store.replaceSlide(s.id, { ...d.composed, rows: insertAt(d.base, d.target, block, uid())! })
        toast.show('이 장을 부품 장으로 바꿔 넣었어요', { label: '되돌리기', run: () => useDeck.getState().undo() }, 6000)
      } else {
        store.addComposeSlide([{ id: uid(), blocks: [block] }], s.id)
        toast.show(canCompose(s.layout) || s.layout === 'compose' ? '이 장에는 자리가 없어서 다음 장에 새로 넣었어요' : '이 장 다음에 부품 장을 새로 만들어 넣었어요', undefined, 5000)
      }
      land(d)
    },
    [store, toast, land],
  )

  // 놓은 뒤: 칸이 그려지면 끌던 그림을 그 칸에 맞춰 날려 보내고, 도착하면 칸을 보여 준다
  useLayoutEffect(() => {
    if (!landing) return
    const g = ghostEl.current
    const d = landing.ghost
    if (!landing.id) {
      if (!g || !d.source || reduced()) {
        setLanding(null)
        return
      }
      const r = d.source
      const back = g.animate(
        [
          { translate: g.style.translate, scale: '1', opacity: 1 },
          { translate: `${r.left}px ${r.top}px`, scale: `${r.width / d.ghost.w} ${r.height / d.ghost.h}`, opacity: 0 },
        ],
        { duration: 300, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' },
      )
      g.style.transformOrigin = '0 0'
      back.finished.then(
        () => setLanding((l) => (l === landing ? null : l)),
        () => {},
      )
      return
    }
    const cell = document.querySelector<HTMLElement>(`.ed-canvas .bk[data-block="${CSS.escape(landing.id)}"]`)
    if (!cell || !g || reduced()) {
      setLanding(null)
      return
    }
    // 조립되는 느낌: 손에 든 그림은 칸 가운데로 줄어들며 사라지고, 진짜 칸은 그 그림 자리에서 나와
    // 제 비율 그대로 자기 자리로 커지며 살짝 튀어 맞춰진다. 비율을 한 가지로만 키워서 글자가 늘어나 보이지 않게
    const r = cell.getBoundingClientRect()
    const gr = g.getBoundingClientRect()
    const vs = cell.offsetWidth ? r.width / cell.offsetWidth : 1
    const k = Math.min(gr.width / r.width, gr.height / r.height, 1)
    const dx = (gr.left + gr.width / 2 - (r.left + r.width / 2)) / vs
    const dy = (gr.top + gr.height / 2 - (r.top + r.height / 2)) / vs
    // FLIP으로 이미 움직이기 시작한 칸은 멈추고 여기서 다시
    cell.getAnimations().forEach((a) => a.cancel())
    cell.animate(
      [
        { transformOrigin: '50% 50%', transform: `translate(${dx}px, ${dy}px) scale(${k})`, opacity: 0.35 },
        { transformOrigin: '50% 50%', transform: 'none', opacity: 1 },
      ],
      { duration: 520, easing: SPRING },
    )
    const end = { x: r.left + r.width / 2 - gr.width / 2, y: r.top + r.height / 2 - gr.height / 2 }
    g.style.transformOrigin = '50% 50%'
    const fly = g.animate(
      [
        { translate: g.style.translate, scale: '1', rotate: g.style.rotate || '0deg', opacity: 1 },
        { translate: `${end.x}px ${end.y}px`, scale: String(Math.min(r.width / gr.width, r.height / gr.height)), rotate: '0deg', opacity: 0 },
      ],
      { duration: 300, easing: 'cubic-bezier(0.3, 0, 0.2, 1)', fill: 'forwards' },
    )
    fly.finished.then(
      () => setLanding((l) => (l === landing ? null : l)),
      () => {},
    )
  }, [landing])

  // ---------- 끌기 ----------

  const pointer = useRef({ x: 0, y: 0, vx: 0, tilt: 0 })

  /** 끄는 중의 자리 계산. 바뀔 때만 다시 그린다 */
  const track = useCallback((x: number, y: number) => {
    const d = dragRef.current
    if (!d) return
    const s = slideRef.current
    const frame = document.querySelector<HTMLElement>('.ed-canvas .slide-frame')
    const fr = frame?.getBoundingClientRect()
    const over = !!fr && x >= fr.left - 24 && x <= fr.right + 24 && y >= fr.top - 24 && y <= fr.bottom + 24
    let plan: Drag['plan'] = null
    let target: DropTarget | null = null
    let composed = d.composed
    if (over) {
      if (s.layout === 'compose' || (d.kind === 'new' && canCompose(s.layout))) {
        if (s.layout !== 'compose' && !composed) composed = composeFrom(s)
        // 아직 부품 장으로 바뀌기 전이면 바뀐 뒤의 본문 상자를 어림한다
        const area = measureArea(areaEl.current) ?? (fr ? guessArea(fr) : null)
        const base = s.layout === 'compose' ? d.base : (composed?.rows ?? [])
        if (area) {
          const p = { x: (x - area.rect.left) / area.k, y: (y - area.rect.top) / area.k }
          target = dropTarget(base, d.block, p, area.size)
          // 경계에서 떨리지 않게: 조금 옆에서 봐도 지금 자리면 그대로 둔다
          if (target && d.target && !sameTarget(target, d.target)) {
            const near = [-30, 30].flatMap((o) => [dropTarget(base, d.block, { x: p.x + o, y: p.y }, area.size), dropTarget(base, d.block, { x: p.x, y: p.y + o }, area.size)])
            if (near.some((t) => sameTarget(t, d.target))) target = d.target
          }
        }
        plan = target ? (s.layout === 'compose' ? 'place' : 'convert') : d.kind === 'new' ? 'next' : null
        if (d.kind === 'move' && !target) plan = null
      } else if (d.kind === 'new') plan = 'next'
    }
    const base = s.layout === 'compose' ? d.base : (composed?.rows ?? d.base)
    if (plan !== d.plan || !sameTarget(target, d.target) || composed !== d.composed) {
      const next = { ...d, plan, target, composed, base }
      // 놓는 순간에도 바로 읽을 수 있게 그리기를 기다리지 않고 맞춘다
      dragRef.current = next
      setDrag(next)
    }
  }, [])

  const moveGhost = useCallback((x: number, y: number) => {
    const g = ghostEl.current
    const d = dragRef.current
    if (!g || !d) return
    const p = pointer.current
    p.vx = p.vx * 0.7 + (x - p.x) * 0.3
    p.x = x
    p.y = y
    // 옆으로 빨리 끌면 그 쪽으로 살짝 기운다 (손에 쥔 느낌)
    p.tilt = Math.max(-5, Math.min(5, p.vx * 0.45))
    g.style.translate = `${x - d.grab.x * d.ghost.w}px ${y - d.grab.y * d.ghost.h}px`
    g.style.rotate = `${p.tilt.toFixed(2)}deg`
  }, [])

  const begin = useCallback(
    (d: Drag, x: number, y: number, from: DOMRect | null) => {
      pointer.current = { x, y, vx: 0, tilt: 0 }
      setSelected(null)
      dragRef.current = d
      setDrag(d)
      document.body.classList.add('is-block-dragging')
      // 그림이 그려지면 집어 든 자리(칸 또는 카드)에서 손 아래 크기로 줄어들며 들린다
      requestAnimationFrame(() => {
        const g = ghostEl.current
        if (!g) return
        moveGhost(x, y)
        g.style.transformOrigin = `${d.grab.x * d.ghost.w}px ${d.grab.y * d.ghost.h}px`
        if (from && !reduced()) g.animate([{ scale: String(from.width / d.ghost.w), opacity: 0.6 }, { scale: '1', opacity: 1 }], { duration: 380, easing: SPRING })
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
        if (!cur) return
        finish(cancel ? { ...cur, plan: null, target: null } : cur)
      }
      const onUp = (e: PointerEvent) => {
        track(e.clientX, e.clientY)
        end(false)
      }
      const onCancel = () => end(true)
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          end(true)
        }
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)
      window.addEventListener('keydown', onKey)
    },
    [finish, moveGhost, track],
  )

  /** 눌렀다가 조금 움직이면 끌기 시작. 그냥 떼면 onClick */
  const press = useCallback((e: ReactPointerEvent<HTMLElement>, start: (x: number, y: number) => void, onClick?: () => void) => {
    if (e.button !== 0) return
    const sx = e.clientX
    const sy = e.clientY
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return
      cleanup()
      start(ev.clientX, ev.clientY)
    }
    const up = () => {
      cleanup()
      onClick?.()
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [])

  /** 캔버스 크기의 부품 그림을 손 아래에 들 만한 크기로 */
  const ghostSize = (canvas: { w: number; h: number }, k: number) => {
    const w = canvas.w * k
    const h = canvas.h * k
    const f = Math.min(1, GHOST_MAX.w / w, GHOST_MAX.h / h)
    return { w: w * f, h: h * f }
  }

  const startMove = useCallback(
    (block: Block, x: number, y: number) => {
      const s = slideRef.current
      const cell = areaEl.current?.querySelector<HTMLElement>(`:scope > .bk[data-block="${CSS.escape(block.id)}"]`)
      const area = measureArea(areaEl.current)
      if (!cell || !area) return
      const r = cell.getBoundingClientRect()
      const canvas = { w: cell.offsetWidth + 80, h: cell.offsetHeight + 80 }
      const ghost = ghostSize(canvas, area.k)
      const grab = { x: Math.min(1, Math.max(0, (x - r.left) / r.width)), y: Math.min(1, Math.max(0, (y - r.top) / r.height)) }
      begin(
        { kind: 'move', block, base: removeBlock(s.rows ?? [], block.id), composed: null, target: targetOf(s.rows ?? [], block.id), plan: 'place', canvas, ghost, grab, source: r },
        x,
        y,
        r,
      )
    },
    [begin],
  )

  const newDrag = (type: BlockType, from: DOMRect | null, x: number, y: number): Drag => {
    const s = slideRef.current
    const block = makeBlock(type)
    const spec = BLOCKS[type]
    const area = measureArea(areaEl.current)
    const k = area?.k ?? (document.querySelector<HTMLElement>('.ed-canvas .slide-frame')?.getBoundingClientRect().width ?? 960) / 1920
    const colW = (1680 - 11 * BLOCK_GAP) / 12
    const canvas = { w: spec.prefSpan * (colW + BLOCK_GAP) - BLOCK_GAP + 80, h: Math.max(blockMinH(block), 300) + 80 }
    const ghost = ghostSize(canvas, k)
    const grab = from ? { x: Math.min(1, Math.max(0, (x - from.left) / from.width)), y: Math.min(1, Math.max(0, (y - from.top) / from.height)) } : { x: 0.5, y: 0.5 }
    return { kind: 'new', block, base: s.rows ?? [], composed: null, target: null, plan: null, canvas, ghost, grab, source: from }
  }

  const pressCard = useCallback(
    (e: ReactPointerEvent<HTMLElement>, type: BlockType) => {
      const card = e.currentTarget
      press(
        e,
        (x, y) => {
          const from = card.getBoundingClientRect()
          begin(newDrag(type, from, x, y), x, y, from)
        },
        () => insert(type, card),
      )
    },
    // eslint 없음: newDrag와 insert는 그릴 때마다 새로 만들어지지만 slideRef로 지금 장을 읽는다
    [press, begin],
  )

  /** 눌러서 넣기: 알아서 고른 자리에, 카드에서 날아와 맞춰진다 */
  function insert(type: BlockType, from?: HTMLElement | null) {
    const s = slideRef.current
    const r = from?.getBoundingClientRect() ?? null
    const d = newDrag(type, r, r ? r.left + r.width / 2 : 0, r ? r.top + r.height / 2 : 0)
    const area = measureArea(areaEl.current)
    let plan: Drag['plan'] = 'next'
    let target: DropTarget | null = null
    let composed: Slide | null = null
    let base = d.base
    if (s.layout === 'compose') {
      target = autoTarget(base, d.block, area?.size.h)
      plan = target ? 'place' : 'next'
    } else if (canCompose(s.layout)) {
      composed = composeFrom(s)
      base = composed.rows ?? []
      const fr = document.querySelector<HTMLElement>('.ed-canvas .slide-frame')?.getBoundingClientRect()
      target = autoTarget(base, d.block, fr ? guessArea(fr).size.h : undefined)
      plan = target ? 'convert' : 'next'
    }
    const full = { ...d, plan, target, composed, base }
    if (!r) {
      finish(full)
      return
    }
    // 카드 자리에 그림을 띄워 두고 놓기와 같은 길로 보낸다
    pointer.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, vx: 0, tilt: 0 }
    setDrag(full)
    requestAnimationFrame(() => {
      const g = ghostEl.current
      if (g) {
        g.style.translate = `${r.left + r.width / 2 - d.ghost.w / 2}px ${r.top + r.height / 2 - d.ghost.h / 2}px`
        g.style.transformOrigin = `${d.ghost.w / 2}px ${d.ghost.h / 2}px`
      }
      requestAnimationFrame(() => finish(full))
    })
  }

  // ---------- 칸 너비 ----------

  const onGutterPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>, rowId: string, gutter: number) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const s = slideRef.current
      document.body.classList.add('is-block-resizing')
      const onMove = (ev: PointerEvent) => {
        const cur = slideRef.current
        const row = (cur.rows ?? []).find((r) => r.id === rowId)
        const area = measureArea(areaEl.current)
        if (!row || !area) return
        const frac = (ev.clientX - area.rect.left) / area.rect.width
        const spans = spansAt(row, gutter, frac)
        if (row.spans && row.spans.join() === spans.join()) return
        store.setRows(cur.id, (cur.rows ?? []).map((r) => (r.id === rowId ? { ...r, spans } : r)), `${s.id}.spans.${rowId}`)
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.classList.remove('is-block-resizing')
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [store],
  )

  // ---------- 고른 부품의 도구 ----------

  const update = (id: string, fn: (b: Block) => Block) => store.updateBlock(slideRef.current.id, id, fn)
  const remove = (b: Block) => {
    const s = slideRef.current
    store.setRows(s.id, removeBlock(s.rows ?? [], b.id))
    setSelected(null)
    toast.show(`${BLOCKS[b.type].name} 부품을 뺐어요`, { label: '되돌리기', run: () => useDeck.getState().undo() })
  }
  const duplicate = (b: Block) => {
    const s = slideRef.current
    const copy = copyBlock(b)
    const area = measureArea(areaEl.current)
    const t = autoTarget(s.rows ?? [], copy, area?.size.h)
    if (!t) {
      toast.show('이 장에는 더 넣을 자리가 없어요. 부품을 빼거나 다음 장에 넣어 주세요.')
      return
    }
    store.setRows(s.id, insertAt(s.rows ?? [], t, copy, uid())!)
    setSelected(copy.id)
  }
  const preview = (b: Block, effect: BlockEffect) => {
    const cell = areaEl.current?.querySelector<HTMLElement>(`:scope > .bk[data-block="${CSS.escape(b.id)}"]`)
    if (!cell || effect === 'none') return
    const level = motionOf(deck, slideRef.current)
    const old = [...cell.classList].filter((c) => c.startsWith('fx-'))
    cell.classList.remove(...old)
    cell.classList.add(`fx-${effect}`)
    engine.play(cell, level === 'none' ? 'calm' : level)
    cell.classList.remove(`fx-${effect}`)
    cell.classList.add(...old)
  }

  const selectedBlock = selected ? (slide.rows ?? []).flatMap((r) => r.blocks).find((x) => x.id === selected) : undefined
  /** 부품을 바꿔도(항목 더하기, 모양 바꾸기) 모든 줄이 잘리지 않고 장에 들어가는지 */
  const fitsWith = (b: Block, fn: (x: Block) => Block) => {
    const area = measureArea(areaEl.current)
    if (!area) return true
    const rows = (slide.rows ?? []).map((r) => ({ ...r, blocks: r.blocks.map((x) => (x.id === b.id ? fn(x) : x)) }))
    return fitsHeight(rows, area.size.h)
  }
  const tools = (b: Block) => (
    <BlockTools
      block={b}
      roomForItem={fitsWith(b, withItem)}
      roomForVariant={(v) => fitsWith(b, (x) => ({ ...x, variant: v }))}
      onGrip={(e) => press(e, (x, y) => startMove(b, x, y))}
      onShift={(dir) => store.setRows(slideRef.current.id, shiftBlock(slideRef.current.rows ?? [], b.id, dir))}
      onLook={(lk) => update(b.id, (x) => ({ ...x, look: lk }))}
      onEffect={(fx) => {
        update(b.id, (x) => ({ ...x, effect: fx }))
        requestAnimationFrame(() => preview(b, fx))
      }}
      onPreview={(fx) => preview(b, fx)}
      onVariant={(v) => update(b.id, (x) => ({ ...x, variant: v }))}
      onAddItem={() => update(b.id, withItem)}
      onDuplicate={() => duplicate(b)}
      onRemove={() => remove(b)}
    />
  )

  // 고른 부품: 지우기 키로 빼고, Esc로 고르기를 끝낸다 (글을 쓰는 중이 아닐 때)
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest?.('input, textarea, [contenteditable]')
      if (typing) return
      if (e.key === 'Escape') setSelected(null)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const b = (slideRef.current.rows ?? []).flatMap((r) => r.blocks).find((x) => x.id === selected)
        if (b) {
          e.preventDefault()
          remove(b)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---------- 무대에 넘길 것 ----------

  const showConverted = !!drag && drag.plan === 'convert' && !!drag.composed
  const stageSlide = showConverted ? drag!.composed! : slide
  const stageRows = stageSlide.rows ?? []
  let previewRows: BlockRow[] | null = null
  let dragId: string | null = null
  if (drag) {
    if (drag.target && (drag.plan === 'place' || drag.plan === 'convert')) {
      previewRows = insertAt(drag.base, drag.target, drag.block, `drop-${drag.block.id}`)
      dragId = drag.block.id
    } else if (drag.kind === 'move') {
      // 장 밖으로 끌고 나가면 원래 자리를 비워 둔다. 놓으면 돌아온다
      previewRows = stageRows
      dragId = drag.block.id
    }
  }

  const edit: BlockEdit = {
    rows: previewRows,
    dragId,
    selected: drag ? null : selected,
    incoming: !!drag && drag.plan === 'next',
    onCellPointerDown: (e, b) => {
      if (e.button !== 0) return
      const t = e.target as HTMLElement
      setSelected(b.id)
      // 글을 쓰는 칸, 단추, 그림 칸에서는 끌지 않는다 (글자를 고르거나 누를 수 있게)
      if (t.closest('.ed-input, button, input, textarea, .img-ed, .bk-bar, .it-remove')) return
      e.preventDefault()
      press(e, (x, y) => startMove(b, x, y))
    },
    onGutterPointerDown,
    empty: () => (
      <div className="bk-empty">
        <p className="bk-empty-t">부품을 골라 넣어 이 장을 꾸며요</p>
        <p className="bk-empty-s">끌어다 놓으면 알맞은 자리에 들어가요. 아무 데나 놓아도 줄과 칸이 맞춰져요.</p>
        <button type="button" className="bk-empty-btn" onClick={() => setLibraryOpen(true)}>
          <BlocksIcon />
          부품 고르기
        </button>
      </div>
    ),
    areaRef: (el) => {
      areaEl.current = el
    },
  }

  const hint = !drag
    ? null
    : drag.plan === 'convert'
      ? '놓으면 이 장을 부품 장으로 바꿔서 넣어요. 지금 내용은 그대로예요.'
      : drag.plan === 'next'
        ? compose || canCompose(slide.layout)
          ? '이 장에는 자리가 없어요. 놓으면 다음 장에 새로 만들어 넣어요.'
          : '표지와 단락 장에는 넣을 수 없어요. 놓으면 다음 장에 부품 장을 새로 만들어요.'
        : drag.kind === 'new' && !drag.plan
          ? '슬라이드 위로 끌어 오세요'
          : null

  const shown = drag ?? landing?.ghost ?? null
  const ghost = shown
    ? createPortal(
        <div
          ref={ghostEl}
          className={cx('bk-ghost', drag && 'is-held', drag?.plan === 'next' && 'is-next')}
          style={{ width: shown.ghost.w, height: shown.ghost.h }}
          aria-hidden="true"
        >
          <div className="bk-ghost-scale" style={{ width: shown.canvas.w, height: shown.canvas.h, transform: `scale(${shown.ghost.w / shown.canvas.w})` }}>
            <SlideCanvas deck={look} slide={soloSlide(shown.block)} mode="preview" solo={shown.canvas} />
          </div>
        </div>,
        document.body,
      )
    : null

  // 고른 부품의 도구는 슬라이드 밖(화면 맨 위 층)에 띄운다: 슬라이드 축소와 상관없이 같은 크기, 슬라이드 끝에서 잘리지 않게
  const toolbar =
    selectedBlock && !drag && !landing && compose
      ? createPortal(<Floating anchor={selectedBlock.id}>{tools(selectedBlock)}</Floating>, document.body)
      : null

  return {
    edit,
    stageSlide,
    hint,
    ghost,
    toolbar,
    libraryOpen,
    setLibraryOpen,
    pressCard,
    insert,
    selected,
    select: setSelected,
    convert: () => {
      store.toCompose(slide.id)
      toast.show('이 장을 부품 장으로 바꿨어요. 부품을 끌어 옮기거나 더 넣을 수 있어요.', { label: '되돌리기', run: () => useDeck.getState().undo() }, 6000)
    },
  }
}

// ---------- 고른 부품 위의 도구 ----------

/** 고른 칸 바로 위에 붙어 다닌다. 칸이 미끄러지는 동안에도 따라가게 매 프레임 자리를 맞춘다 */
function Floating({ anchor, children }: { anchor: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    let raf = 0
    const tick = () => {
      const el = ref.current
      const cell = document.querySelector<HTMLElement>(`.ed-canvas .bk[data-block="${CSS.escape(anchor)}"]`)
      const stage = document.querySelector<HTMLElement>('.ed-canvas')
      if (el && cell && stage) {
        const c = cell.getBoundingClientRect()
        const st = stage.getBoundingClientRect()
        // 위에 자리가 없으면 칸 안쪽 위에 얹는다
        let top = c.top - el.offsetHeight - 8
        if (top < st.top + 2) top = c.top + 8
        const left = Math.max(st.left + 4, Math.min(c.left, st.right - el.offsetWidth - 4))
        el.style.translate = `${Math.round(left)}px ${Math.round(top)}px`
        el.style.visibility = 'visible'
      } else if (el) el.style.visibility = 'hidden'
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [anchor])
  return (
    <div ref={ref} className="bk-float" style={{ visibility: 'hidden' }}>
      {children}
    </div>
  )
}

/** 항목을 하나 더한 부품. 보이는 항목 수(max) 뒤에 숨은 항목이 있으면 그 앞에 넣는다 */
function withItem(x: Block): Block {
  const max = BLOCKS[x.type].items?.max ?? 0
  const visible = Math.min(x.items.length, max)
  if (visible >= max) return x
  const items = [...x.items]
  items.splice(visible, 0, emptyItem())
  return { ...x, items }
}

const NO_ROOM = '장에 자리가 모자라요. 다른 부품을 빼거나 다음 장으로 나눠 보세요'

function BlockTools({
  block,
  roomForItem,
  roomForVariant,
  onGrip,
  onShift,
  onLook,
  onEffect,
  onPreview,
  onVariant,
  onAddItem,
  onDuplicate,
  onRemove,
}: {
  block: Block
  /** 항목을 더해도 잘리지 않는지 */
  roomForItem: boolean
  roomForVariant(variant: string): boolean
  onGrip(e: ReactPointerEvent<HTMLElement>): void
  onShift(dir: -1 | 1): void
  onLook(look: Block['look']): void
  onEffect(effect: BlockEffect): void
  onPreview(effect: BlockEffect): void
  onVariant(variant: string): void
  onAddItem(): void
  onDuplicate(): void
  onRemove(): void
}) {
  const spec = BLOCKS[block.type]
  const [menu, setMenu] = useState<'motion' | null>(null)
  const look = lookOf(block)
  const effect = effectOf(block)
  const variants = spec.variants ?? []
  const variant = variantOfBlock(block)
  const canAdd = !!spec.items && blockItems(block).length < spec.items.max
  const nextVariant = variants.length > 1 ? variants[(variants.findIndex((v) => v.id === variant) + 1) % variants.length] : null
  const variantRoom = !nextVariant || roomForVariant(nextVariant.id)
  return (
    <div className="bk-tools" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="bk-tool bk-grip"
        title="끌어서 옮기기 (화살표 키로도 옮겨요)"
        aria-label={`${spec.name} 옮기기`}
        onPointerDown={(e) => {
          e.preventDefault()
          onGrip(e)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') onShift(-1)
          else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') onShift(1)
          else return
          e.preventDefault()
        }}
      >
        <GripIcon />
        <span>{spec.name}</span>
      </button>
      <span className="bk-tool-sep" />
      <div className="bk-looks" role="group" aria-label="바탕">
        {BLOCK_LOOKS.map((l) => (
          <button
            key={l.id}
            type="button"
            className={cx('bk-look', `is-${l.id}`, look === l.id && 'is-on')}
            title={l.name}
            aria-label={l.name}
            aria-pressed={look === l.id}
            onClick={() => onLook(l.id)}
          />
        ))}
      </div>
      <span className="bk-tool-sep" />
      <div className="bk-tool-menu">
        <button type="button" className={cx('bk-tool', menu === 'motion' && 'is-on')} aria-expanded={menu === 'motion'} onClick={() => setMenu(menu === 'motion' ? null : 'motion')}>
          <MotionIcon />
          <span>{BLOCK_EFFECTS.find((x) => x.id === effect)?.name}</span>
        </button>
        {menu === 'motion' && (
          <ul className="bk-menu" role="menu" onMouseLeave={() => undefined}>
            {BLOCK_EFFECTS.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={effect === x.id}
                  className={cx('bk-menu-item', effect === x.id && 'is-on')}
                  onMouseEnter={() => onPreview(x.id)}
                  onFocus={() => onPreview(x.id)}
                  onClick={() => {
                    onEffect(x.id)
                    setMenu(null)
                  }}
                >
                  <b>{x.name}</b>
                  <span>{x.id === 'auto' ? spec.motion : x.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {nextVariant && (
        <button type="button" className="bk-tool" disabled={!variantRoom} title={variantRoom ? `다음 모양: ${nextVariant.name}` : NO_ROOM} onClick={() => onVariant(nextVariant.id)}>
          <ShapesIcon />
          <span>{variants.find((v) => v.id === variant)?.name}</span>
        </button>
      )}
      {spec.items && (
        <button
          type="button"
          className="bk-tool"
          disabled={!canAdd || !roomForItem}
          title={!canAdd ? `${spec.items.label} ${spec.items.max}개까지 넣을 수 있어요` : roomForItem ? `${spec.items.label} 추가` : NO_ROOM}
          onClick={onAddItem}
        >
          <PlusIcon />
          <span>{spec.items.label}</span>
        </button>
      )}
      <span className="bk-tool-sep" />
      <button type="button" className="bk-tool is-icon" title="복제" aria-label="복제" onClick={onDuplicate}>
        <CopyIcon />
      </button>
      <button type="button" className="bk-tool is-icon" title="빼기 (Delete)" aria-label="빼기" onClick={onRemove}>
        <TrashIcon />
      </button>
    </div>
  )
}
