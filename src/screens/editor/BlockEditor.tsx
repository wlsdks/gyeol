import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  autoTarget,
  blockFieldPrefix,
  blockItems,
  blockPrefH,
  changeIssue,
  BLOCK_EFFECTS,
  BLOCK_GAP,
  BLOCK_LOOKS,
  BLOCKS,
  canCompose,
  composeFrom,
  copyBlock,
  dropTarget,
  effectOf,
  foldableFields,
  growAt,
  insertAt,
  lookChangeIssue,
  shownLook,
  makeBlock,
  placeIssue,
  pointerTarget,
  removeBlock,
  sameTarget,
  shiftBlock,
  spansAt,
  spanLimit,
  targetOf,
  unweighted,
  variantOfBlock,
  weighted,
  whyNot,
  withItem,
  withLook,
  type DropTarget,
  type NoRoom,
} from '../../deck/blocks'
import { FRAME } from '../../deck/frame'
import { uid } from '../../deck/generate'
import { motionOf } from '../../deck/themes'
import type { Block, BlockEffect, BlockLink, BlockRow, BlockType, Deck, Slide } from '../../deck/types'
import { cx } from '../../lib/cx'
import { motionEngine } from '../../motion/engine'
import type { BlockEdit } from '../../slides/blockEdit'
import { SlideCanvas } from '../../slides/SlideCanvas'
import { useDeck } from '../../store/deckStore'
import { BlocksIcon, CopyIcon, dialogOpen, GripIcon, MotionIcon, PlusIcon, ShapesIcon, TrashIcon, undoAction } from '../ui'
import { useLinkEditing } from './LinkEditor'
import { narrowText, noRoomText } from './noRoom'

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
  /** 자리를 고를 때 잰 본문 높이. 넣을 때도 이 높이로 칸 너비를 다시 나눠야(insertAt) 끄는 동안 보인 모습 그대로 놓인다 */
  room?: number
  /** 손 아래 자리에 놓을 수 없는 까닭 (그래서 다른 자리에 놓이거나, 다음 장에 들어간다) */
  blocked: NoRoom | null
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
 * 부품 장이 아닌 장을 부품 장으로 바꿨을 때의 본문 상자 어림: 장의 틀(위, 본문 아래의 띠, 옆),
 * 지금 장의 제목 높이와 제목 아래 간격(FRAME.gap)을 뺀다. 바뀐 모습이 그려지면 그때부터는 실제로 잰다
 */
function guessArea(frame: DOMRect) {
  const head = document.querySelector<HTMLElement>('.ed-canvas .slide .s-head')
  const k = frame.width / 1920
  const top = FRAME.y + (head && head.offsetHeight ? head.offsetHeight + FRAME.gap : 0)
  const size = { w: 1920 - FRAME.x * 2, h: 1080 - top - FRAME.bottom }
  return { rect: new DOMRect(frame.left + FRAME.x * k, frame.top + top * k, size.w * k, size.h * k), k, size }
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
  /** 부품 고르기 카드를 누르기 시작할 때. 끌면 끌어다 놓기, 그냥 떼면 알아서 넣기 (onTap을 주면 그것을) */
  pressCard(e: ReactPointerEvent<HTMLElement>, type: BlockType, onTap?: () => void): void
  insert(type: BlockType, from?: HTMLElement | null): void
  /** 이 부품을 지금 장 어디에도 넣을 수 없을 때 그 까닭 (부품 고르기 카드에 보인다) */
  issueFor(type: BlockType): NoRoom | null
  /** 이음표 카드를 누르기 시작할 때. 끌면 컴포넌트 사이에 놓고, 그냥 떼면 알아서 고른 사이에 넣는다 */
  pressLinkCard(e: ReactPointerEvent<HTMLElement>, link: BlockLink): void
  insertLink(link: BlockLink): void
  selected: string | null
  select(id: string | null): void
  convert(): void
  /** 부품 장이 아닌 장의 아래쪽이 비었을 때 그 자리에 띄우는 '여기에 부품 넣기' */
  room: ReactNode
}

export function useBlockEditing(deck: Deck, slide: Slide, toast: Toast): BlockEditing {
  // 할 일(액션)만 쓰므로 바뀔 때마다 다시 그리지 않게 한 번 꺼내 둔다
  const store = useDeck.getState()
  const [selected, setSelected] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  // 놓은 뒤 끌던 그림이 칸으로 날아가는 동안 (id가 없으면 집어 온 카드로 돌아가 사라진다)
  const [landing, setLanding] = useState<{ id: string | null; ghost: Drag } | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  // 장 아래 빈자리의 '여기에 부품 넣기'로 부품 고르기를 열었으면, 눌러 넣는 부품을 그 자리(맨 아래 새 줄)에
  const [toBottom, setToBottom] = useState(false)
  useEffect(() => {
    if (!libraryOpen) setToBottom(false)
  }, [libraryOpen])
  const dragRef = useRef<Drag | null>(null)
  dragRef.current = drag
  const areaEl = useRef<HTMLDivElement | null>(null)
  const ghostEl = useRef<HTMLDivElement | null>(null)
  const slideRef = useRef(slide)
  slideRef.current = slide
  const engine = useMemo(() => motionEngine(), [])
  const look = useMemo(() => ({ meta: deck.meta, theme: deck.theme, title: deck.title, motion: deck.motion }), [deck.meta, deck.theme, deck.title, deck.motion])

  // '칸 더하기'로 연 빈칸 ('부품id 칸키'). 다른 장으로 가면 다시 접는다
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    setSelected(null)
    setOpened(new Set())
  }, [slide.id])

  const compose = slide.layout === 'compose'

  const links = useLinkEditing({ slideRef, areaEl, toast, deselectBlock: () => setSelected(null), selectedBlock: selected })

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
        const next = t ? insertAt(d.base, t, d.block, uid(), d.room) : null
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
        store.setRows(s.id, insertAt(d.base, d.target, block, uid(), d.room)!)
      } else if (d.plan === 'convert' && d.target && d.composed) {
        store.replaceSlide(s.id, { ...d.composed, rows: insertAt(d.base, d.target, block, uid(), d.room)! })
        toast.show('이 장을 컴포넌트 장으로 바꿔 넣었어요', undoAction(toast), 6000)
      } else {
        store.addComposeSlide([{ id: uid(), blocks: [block] }], s.id)
        const why = d.blocked && (canCompose(s.layout) || s.layout === 'compose') ? noRoomText(d.blocked, block.type, 'slide').why : null
        toast.show(
          why ? `${why} 그래서 다음 장에 새로 넣었어요` : canCompose(s.layout) || s.layout === 'compose' ? '이 장에는 자리가 없어서 다음 장에 새로 넣었어요' : '이 장 다음에 컴포넌트 장을 새로 만들어 넣었어요',
          undefined,
          6000,
        )
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
    // 넣은 뒤에 발표할 때의 움직임을 이어서 틀지 않는다: 자리에 맞춰진 내용이 사라졌다가 조각조각 다시 나타나서
    // 넣자마자 깨진 것처럼 보였다. 움직임은 '이 장 설정'의 움직임 ▶나 컴포넌트 도구의 움직임에서 미리 본다
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
    let blocked: NoRoom | null = null
    let room = d.room
    let composed = d.composed
    if (over) {
      if (s.layout === 'compose' || (d.kind === 'new' && canCompose(s.layout))) {
        if (s.layout !== 'compose' && !composed) composed = composeFrom(s)
        // 아직 부품 장으로 바뀌기 전이면 바뀐 뒤의 본문 상자를 어림한다
        const area = measureArea(areaEl.current) ?? (fr ? guessArea(fr) : null)
        const base = s.layout === 'compose' ? d.base : (composed?.rows ?? [])
        if (area) {
          room = area.size.h
          const p = { x: (x - area.rect.left) / area.k, y: (y - area.rect.top) / area.k }
          target = dropTarget(base, d.block, p, area.size, undefined, d.target)
          // 경계에서 떨리지 않게: 조금 옆에서 봐도 지금 자리면 그대로 둔다
          if (target && d.target && !sameTarget(target, d.target)) {
            const near = [-30, 30].flatMap((o) => [dropTarget(base, d.block, { x: p.x + o, y: p.y }, area.size), dropTarget(base, d.block, { x: p.x, y: p.y + o }, area.size)])
            if (near.some((t) => sameTarget(t, d.target))) target = d.target
          }
          // 손 아래 자리에 놓을 수 없으면 그 까닭. 어디에도 놓을 수 없으면 이 장의 까닭
          const wanted = pointerTarget(base, p, area.size)
          blocked = !target ? placeIssue(base, d.block, area.size.h) : sameTarget(wanted, target) ? null : whyNot(base, wanted, d.block, area.size.h)
        }
        plan = target ? (s.layout === 'compose' ? 'place' : 'convert') : d.kind === 'new' ? 'next' : null
        if (d.kind === 'move' && !target) plan = null
      } else if (d.kind === 'new') plan = 'next'
    }
    const base = s.layout === 'compose' ? d.base : (composed?.rows ?? d.base)
    if (plan !== d.plan || !sameTarget(target, d.target) || composed !== d.composed || room !== d.room || JSON.stringify(blocked) !== JSON.stringify(d.blocked)) {
      const next = { ...d, plan, target, blocked, composed, base, room }
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
        finish(cancel ? { ...cur, plan: null, target: null, blocked: null } : cur)
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
      // 옆 부품과 잇던 이음표는 두고 간다 (새 자리의 옆 부품과는 이어지지 않는다). 제자리에 놓으면 그대로 남는다
      const { link: _, ...bare } = block
      begin(
        { kind: 'move', block: bare, base: removeBlock(s.rows ?? [], block.id), composed: null, target: targetOf(s.rows ?? [], block.id), blocked: null, plan: 'place', canvas, ghost, grab, source: r },
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
    const canvas = { w: spec.prefSpan * (colW + BLOCK_GAP) - BLOCK_GAP + 80, h: Math.max(blockPrefH(block), 300) + 80 }
    const ghost = ghostSize(canvas, k)
    const grab = from ? { x: Math.min(1, Math.max(0, (x - from.left) / from.width)), y: Math.min(1, Math.max(0, (y - from.top) / from.height)) } : { x: 0.5, y: 0.5 }
    return { kind: 'new', block, base: s.rows ?? [], composed: null, target: null, blocked: null, plan: null, canvas, ghost, grab, source: from }
  }

  const pressCard = useCallback(
    (e: ReactPointerEvent<HTMLElement>, type: BlockType, onTap?: () => void) => {
      const card = e.currentTarget
      press(
        e,
        (x, y) => {
          const from = card.getBoundingClientRect()
          begin(newDrag(type, from, x, y), x, y, from)
        },
        onTap ?? (() => insert(type, card)),
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
    let blocked: NoRoom | null = null
    let room = area?.size.h
    if (s.layout === 'compose') {
      target = autoTarget(base, d.block, area?.size.h)
      plan = target ? 'place' : 'next'
      if (!target) blocked = placeIssue(base, d.block, area?.size.h)
    } else if (canCompose(s.layout)) {
      composed = composeFrom(s)
      base = composed.rows ?? []
      const fr = document.querySelector<HTMLElement>('.ed-canvas .slide-frame')?.getBoundingClientRect()
      const h = fr ? guessArea(fr).size.h : undefined
      room = h
      const bottom: DropTarget = { kind: 'row', index: base.length }
      target = toBottom && !whyNot(base, bottom, d.block, h) ? bottom : autoTarget(base, d.block, h)
      plan = target ? 'convert' : 'next'
      if (!target) blocked = placeIssue(base, d.block, h)
    }
    const full = { ...d, plan, target, blocked, composed, base, room }
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

  /** 부품 고르기 카드마다: 지금 장 어디에도 넣을 수 없으면 그 까닭. 부품 장이 아닌 장은 부품 장으로 바꾼 모습으로 본다 */
  function issueFor(type: BlockType): NoRoom | null {
    const s = slideRef.current
    const block = makeBlock(type)
    if (s.layout === 'compose') return placeIssue(s.rows ?? [], block, measureArea(areaEl.current)?.size.h)
    if (!canCompose(s.layout)) return null
    const fr = document.querySelector<HTMLElement>('.ed-canvas .slide-frame')?.getBoundingClientRect()
    return placeIssue(composeFrom(s).rows ?? [], block, fr ? guessArea(fr).size.h : undefined)
  }

  // ---------- 칸 너비 ----------

  const onGutterPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>, rowId: string, gutter: number) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const s = slideRef.current
      // 더 끌 수 없는 쪽으로 끌면 손잡이가 꿈쩍하지 않아 고장처럼 보인다. 끄는 동안 한 번만 까닭을 알린다
      let told = false
      document.body.classList.add('is-block-resizing')
      const onMove = (ev: PointerEvent) => {
        const cur = slideRef.current
        const row = (cur.rows ?? []).find((r) => r.id === rowId)
        const area = measureArea(areaEl.current)
        if (!row || !area) return
        const frac = (ev.clientX - area.rect.left) / area.rect.width
        const limit = told ? null : spanLimit(row, gutter, frac)
        if (limit) {
          told = true
          toast.show(narrowText(limit.type, limit.minSpan), undefined, 4000)
        }
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
    [store, toast],
  )

  // ---------- 줄 높이 ----------

  const onRowGapPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>, between: number) => {
      const el = areaEl.current
      if (e.button !== 0 || !el) return
      e.preventDefault()
      e.stopPropagation()
      // 지금 그려진 줄 높이와 줄 사이(격자가 나눈 값, 캔버스 px). 끄는 동안은 이 값을 기준으로 위아래 두 줄만 나눈다
      const css = getComputedStyle(el)
      const heights = css.gridTemplateRows.split(' ').map(parseFloat)
      const gap = parseFloat(css.rowGap) || 0
      const top = heights.slice(0, between).reduce((a, h) => a + h + gap, 0)
      const pair = heights[between] + heights[between + 1]
      const startY = e.clientY
      let moved = false
      document.body.classList.add('is-row-resizing')
      const onMove = (ev: PointerEvent) => {
        if (!moved && Math.abs(ev.clientY - startY) < 3) return
        moved = true
        const cur = slideRef.current
        const rows = cur.rows ?? []
        const rect = el.getBoundingClientRect()
        const k = el.offsetHeight ? rect.height / el.offsetHeight : 1
        const y = (ev.clientY - rect.top) / k
        const grow = growAt(rows, heights, between, (y - top - gap / 2) / pair)
        if (rows.every((r, i) => r.grow === grow[i])) return
        store.setRows(cur.id, rows.map((r, i) => ({ ...r, grow: grow[i] })), `${cur.id}.grow`)
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.classList.remove('is-row-resizing')
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [store],
  )
  const onRowGapReset = useCallback(() => {
    const s = slideRef.current
    if (weighted(s.rows ?? [])) store.setRows(s.id, unweighted(s.rows ?? []))
  }, [store])

  // ---------- 고른 부품의 도구 ----------

  const update = (id: string, fn: (b: Block) => Block) => store.updateBlock(slideRef.current.id, id, fn)
  const remove = (b: Block) => {
    const s = slideRef.current
    store.setRows(s.id, removeBlock(s.rows ?? [], b.id))
    setSelected(null)
    toast.show(`${BLOCKS[b.type].name} 컴포넌트를 뺐어요`, undoAction(toast))
  }
  const duplicate = (b: Block) => {
    const s = slideRef.current
    const { link: _, ...copy } = copyBlock(b)
    const area = measureArea(areaEl.current)
    const t = autoTarget(s.rows ?? [], copy, area?.size.h)
    if (!t) {
      toast.show('이 장에는 더 넣을 자리가 없어요. 컴포넌트를 빼거나 다음 장에 넣어 주세요.')
      return
    }
    store.setRows(s.id, insertAt(s.rows ?? [], t, copy, uid(), area?.size.h)!)
    setSelected(copy.id)
  }
  /** 접어 둔 칸을 열고 그 칸(항목이면 처음 빈 항목)에 바로 쓰게 한다 */
  const openField = (b: Block, key: string) => {
    setOpened((o) => new Set(o).add(`${b.id} ${key}`))
    requestAnimationFrame(() => {
      const k = key.startsWith('items.') ? key.slice(6) : key
      const prefix = blockFieldPrefix(b.id)
      const sel = key.startsWith('items.') ? `[data-field^="${CSS.escape(prefix)}"][data-field$=".${CSS.escape(k)}"]` : `[data-field="${CSS.escape(prefix + k)}"]`
      const el = [...document.querySelectorAll<HTMLElement>(`.ed-canvas ${sel}`)].find((x) => !x.innerText.trim())
      el?.focus()
    })
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
  /** 부품을 바꾸면(항목 더하기, 모양이나 바탕 바꾸기) 장에 들어가지 않을 때 그 까닭. 본문 상자는 화면에서 잰다 */
  const issue = (b: Block, fn: (x: Block) => Block) => {
    const area = measureArea(areaEl.current)
    return area ? changeIssue(slide.rows ?? [], b.id, fn, area.size.h) : null
  }
  const tools = (b: Block) => (
    <BlockTools
      block={b}
      inRow={(slide.rows ?? []).find((r) => r.blocks.some((x) => x.id === b.id))?.blocks.length ?? 1}
      itemIssue={issue(b, withItem)}
      variantIssue={(v) => issue(b, (x) => ({ ...x, variant: v }))}
      lookIssue={(lk) => lookChangeIssue(slide.rows ?? [], b.id, lk ?? 'plain', measureArea(areaEl.current)?.size.h)}
      onBlocked={(r) => {
        const t = noRoomText(r, b.type, 'change')
        toast.show(`${t.why} ${t.fix}`, undefined, 6000)
      }}
      onGrip={(e) => press(e, (x, y) => startMove(b, x, y))}
      onShift={(dir) => store.setRows(slideRef.current.id, shiftBlock(slideRef.current.rows ?? [], b.id, dir))}
      onLook={(lk) => store.setRows(slideRef.current.id, withLook(slideRef.current.rows ?? [], b.id, lk ?? 'plain'))}
      onEffect={(fx) => {
        update(b.id, (x) => ({ ...x, effect: fx }))
        requestAnimationFrame(() => preview(b, fx))
      }}
      onPreview={(fx) => preview(b, fx)}
      onVariant={(v) => update(b.id, (x) => ({ ...x, variant: v }))}
      onAddItem={() => update(b.id, withItem)}
      adds={foldableFields(b.type).filter((f) => !opened.has(`${b.id} ${f.key}`) && (f.item ? blockItems(b).some((it) => !it[f.key.slice(6) as keyof typeof it]?.trim()) : !b.fields[f.key]?.trim()))}
      onOpenField={(key) => openField(b, key)}
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
      // 대화 창이 떠 있으면 그 창의 키다: 창을 닫는 Esc로 고르기를 끝내거나, 창 뒤의 컴포넌트를 지우지 않는다
      if (e.defaultPrevented || dialogOpen()) return
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
      previewRows = insertAt(drag.base, drag.target, drag.block, `drop-${drag.block.id}`, drag.room)
      dragId = drag.block.id
    } else if (drag.kind === 'move') {
      // 장 밖으로 끌고 나가면 원래 자리를 비워 둔다. 놓으면 돌아온다
      previewRows = stageRows
      dragId = drag.block.id
    }
  }

  const edit: BlockEdit = {
    rows: previewRows ?? links.previewRows,
    dragId,
    selected: drag ? null : selected,
    opened,
    incoming: !!drag && drag.plan === 'next',
    selectedLink: links.selectedLink,
    linkPreview: links.preview,
    onLinkPointerDown: links.onLinkPointerDown,
    onCellPointerDown: (e, b) => {
      if (e.button !== 0) return
      const t = e.target as HTMLElement
      setSelected(b.id)
      links.selectLink(null)
      // 글을 쓰는 칸, 단추, 그림 칸에서는 끌지 않는다 (글자를 고르거나 누를 수 있게)
      if (t.closest('.ed-input, button, input, textarea, .img-ed, .bk-bar, .it-remove')) return
      e.preventDefault()
      press(e, (x, y) => startMove(b, x, y))
    },
    onGutterPointerDown,
    onRowGapPointerDown,
    onRowGapReset,
    empty: () => (
      <div className="bk-empty">
        <p className="bk-empty-t">컴포넌트를 골라 넣어 이 장을 꾸며요</p>
        <p className="bk-empty-s">끌어다 놓으면 알맞은 자리에 들어가요. 아무 데나 놓아도 줄과 칸이 맞춰져요.</p>
        <button type="button" className="bk-empty-btn" onClick={() => setLibraryOpen(true)}>
          <BlocksIcon />
          컴포넌트 고르기
        </button>
      </div>
    ),
    areaRef: (el) => {
      areaEl.current = el
    },
  }

  const hint = links.hint
    ? links.hint
    : !drag
    ? null
    : drag.plan === 'convert'
      ? '놓으면 이 장을 컴포넌트 장으로 바꿔서 넣어요. 지금 내용은 그대로예요.'
      : drag.plan === 'next'
        ? compose || canCompose(slide.layout)
          ? `${drag.blocked ? noRoomText(drag.blocked, drag.block.type, 'slide').why : '이 장에는 자리가 없어요.'} 놓으면 다음 장에 새로 만들어 넣어요.`
          : '표지와 섹션 장에는 넣을 수 없어요. 놓으면 다음 장에 컴포넌트 장을 새로 만들어요.'
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
          <div className="bk-ghost-clip">
            <div className="bk-ghost-scale" style={{ width: shown.canvas.w, height: shown.canvas.h, transform: `scale(${shown.ghost.w / shown.canvas.w})` }}>
              <SlideCanvas deck={look} slide={soloSlide(shown.block)} mode="preview" solo={shown.canvas} />
            </div>
          </div>
          {/* 손 아래 자리에 놓을 수 없을 때: 왜 안 되는지와 대신 어디에 놓이는지 */}
          {drag?.blocked && drag.target && (
            <p className="bk-ghost-why">
              <b>여기에는 못 놓아요</b>
              {noRoomText(drag.blocked, drag.block.type, 'here').why} 가장 가까운 자리에 놓을게요.
            </p>
          )}
        </div>,
        document.body,
      )
    : null

  // 고른 부품의 도구는 그 부품 바로 위에 뜬다 (Editor의 FloatTools)
  const toolbar = selectedBlock && !drag && !landing && compose ? tools(selectedBlock) : compose ? links.toolbar : null

  // 부품 장으로 바꿔 아래에 새 줄을 둘 수 있을 만큼 비었을 때만
  const roomFits = (h: number) => {
    const base = composeFrom(slide).rows ?? []
    return !whyNot(base, { kind: 'row', index: base.length }, makeBlock('message'), h)
  }
  const room =
    !compose && canCompose(slide.layout) && !drag && !landing
      ? createPortal(
          <RoomZone
            key={slide.id}
            fits={roomFits}
            onOpen={() => {
              setToBottom(true)
              setLibraryOpen(true)
            }}
          />,
          document.body,
        )
      : null

  return {
    edit,
    stageSlide,
    hint,
    room,
    ghost: (
      <>
        {ghost}
        {links.ghost}
      </>
    ),
    toolbar,
    libraryOpen,
    setLibraryOpen,
    pressCard,
    insert,
    issueFor,
    pressLinkCard: links.pressCard,
    insertLink: links.insert,
    selected,
    select: (id) => {
      setSelected(id)
      if (!id) links.selectLink(null)
    },
    convert: () => {
      store.toCompose(slide.id)
      toast.show('이 장을 컴포넌트 장으로 바꿨어요. 컴포넌트를 끌어 옮기거나 더 넣을 수 있어요.', undoAction(toast), 6000)
    },
  }
}

// ---------- 장 아래 빈자리 ----------

/** 본문 상자(.s-body) 아래쪽에서 글이나 그림이 없는 높이 (캔버스 px)와 그 자리의 화면 위치 */
function freeBelow(slideEl: HTMLElement) {
  const body = slideEl.querySelector<HTMLElement>(':scope > .s-body')
  if (!body) return null
  const b = body.getBoundingClientRect()
  const k = slideEl.offsetWidth ? slideEl.getBoundingClientRect().width / slideEl.offsetWidth : 1
  let top = b.bottom
  let bottom = b.top
  for (const el of body.querySelectorAll<HTMLElement>('*')) {
    if (el.classList.contains('ed-halo')) continue
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) continue
    if (r.bottom > bottom) bottom = r.bottom
    if (r.top < top) top = r.top
  }
  // 가운데 맞춘 장(한 문장, 큰 숫자)의 위아래 빈자리는 일부러 비운 것이라 세지 않는다: 위가 붙어 있고 아래만 빈 장만
  const anchored = (top - b.top) / k < 60
  return { free: anchored ? (b.bottom - bottom) / k : 0, rect: new DOMRect(b.left, bottom, b.width, b.bottom - bottom), k }
}

/**
 * 장 아래가 넉넉히 비면 그 자리에 '여기에 부품 넣기'. 누르면 부품 고르기가 열리고, 고른 부품이 그 자리(맨 아래 새 줄)에 들어간다.
 * 끌어다 놓아도 된다. 장이 움직이거나 글이 늘어도 따라가게, 무대의 크기나 장 안이 바뀌거나 스크롤할 때 다시 잰다.
 * (예전에는 매 프레임 장 안의 모든 요소를 쟀다. 가만히 있어도 CPU를 써서 느린 노트북의 배터리를 닳게 했다)
 */
function RoomZone({ fits, onOpen }: { fits(h: number): boolean; onOpen(): void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const ok = useRef<{ h: number; fits: boolean } | null>(null)
  const fitsRef = useRef(fits)
  fitsRef.current = fits
  const measure = useCallback(() => {
    const el = ref.current
    const slideEl = document.querySelector<HTMLElement>('.ed-canvas .slide.m-edit')
    const f = slideEl ? freeBelow(slideEl) : null
    // 부품이 들어갈 만한지는 본문 높이가 바뀔 때만 다시 본다
    const areaH = slideEl ? Math.round(slideEl.querySelector<HTMLElement>(':scope > .s-body')?.offsetHeight ?? 0) : 0
    if (f && ok.current?.h !== areaH) ok.current = { h: areaH, fits: fitsRef.current(areaH) }
    if (el && f && f.free >= 220 && ok.current?.fits) {
      const pad = 24 * f.k
      el.style.translate = `${Math.round(f.rect.left)}px ${Math.round(f.rect.top + pad)}px`
      el.style.width = `${Math.round(f.rect.width)}px`
      el.style.height = `${Math.round(f.rect.height - pad)}px`
      el.style.visibility = 'visible'
    } else if (el) el.style.visibility = 'hidden'
  }, [])
  // 다시 그릴 때마다(덱이 바뀌면) 바로 잰다. 장이 바뀌었을 수 있으니 들어갈 만한지도 새로 본다
  useLayoutEffect(() => {
    ok.current = null
    measure()
  })
  // 그 밖에는 바뀔 때만: 무대 크기(창, 오른쪽 칸), 장 안의 글과 모양, 그림을 다 받았을 때, 스크롤. 한 프레임에 한 번만 잰다
  useEffect(() => {
    const canvas = document.querySelector<HTMLElement>('.ed-canvas')
    let raf = 0
    const schedule = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0
          measure()
        })
    }
    const ro = new ResizeObserver(schedule)
    // 이 단추는 body에 붙어 있어서, 여기서 고치는 단추의 style은 아래 감시에 걸리지 않는다
    const mo = new MutationObserver(schedule)
    if (canvas) {
      ro.observe(canvas)
      mo.observe(canvas, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] })
      canvas.addEventListener('load', schedule, true)
      canvas.addEventListener('transitionend', schedule, true)
    }
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    void document.fonts?.ready.then(schedule)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      mo.disconnect()
      canvas?.removeEventListener('load', schedule, true)
      canvas?.removeEventListener('transitionend', schedule, true)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [measure])
  return (
    <button ref={ref} type="button" className="ed-room" style={{ visibility: 'hidden' }} onClick={onOpen}>
      <span className="ed-room-t">
        <PlusIcon />
        여기에 컴포넌트 넣기
      </span>
      <span className="ed-room-s">숫자, 차트, 글을 이 아래에 더 놓을 수 있어요. 컴포넌트 고르기에서 끌어다 놓아도 돼요.</span>
    </button>
  )
}

// ---------- 고른 부품 위의 도구 ----------

/** 바탕 메뉴의 설명 */
const LOOK_NOTES: Record<Block['look'] & string, string> = {
  plain: '장 바탕 위에 바로 놓여요. 가장 가벼워요.',
  card: '옅은 면 위에 놓여 한 묶음으로 보여요.',
  bold: '진한 면 위에 놓여 가장 눈에 띄어요. 한 장에 하나만 써요.',
}

function BlockTools({
  block,
  inRow,
  itemIssue,
  variantIssue,
  lookIssue,
  onBlocked,
  onGrip,
  onShift,
  onLook,
  onEffect,
  onPreview,
  onVariant,
  onAddItem,
  adds,
  onOpenField,
  onDuplicate,
  onRemove,
}: {
  block: Block
  /** 항목을 더하거나 모양, 바탕을 바꾸면 장에 들어가지 않을 때 그 까닭 */
  itemIssue: NoRoom | null
  variantIssue(variant: string): NoRoom | null
  /** 이 부품의 줄에 놓인 부품 수 (혼자 한 줄을 다 쓰는 작은 부품은 면 없이 그려진다) */
  inRow: number
  lookIssue(look: Block['look']): NoRoom | null
  /** 그런 단추를 눌렀을 때 (막아 두되, 누르면 까닭을 보여 준다) */
  onBlocked(r: NoRoom): void
  onGrip(e: ReactPointerEvent<HTMLElement>): void
  onShift(dir: -1 | 1): void
  onLook(look: Block['look']): void
  onEffect(effect: BlockEffect): void
  onPreview(effect: BlockEffect): void
  onVariant(variant: string): void
  onAddItem(): void
  /** 비어 있어서 접어 둔 칸. '칸 더하기'로 연다 */
  adds: { key: string; label: string; item: boolean }[]
  onOpenField(key: string): void
  onDuplicate(): void
  onRemove(): void
}) {
  const spec = BLOCKS[block.type]
  const [menu, setMenu] = useState<'look' | 'motion' | 'variant' | 'fields' | null>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  // 메뉴는 도구 아래로 연다. 고른 부품이 장 아래쪽이라 아래에 자리가 모자라면 위로 (위 끝은 머리 띠 아래).
  // 남은 높이만큼만 쓰고 나머지는 메뉴 안에서 스크롤 (노트북의 낮은 창에서 잘리지 않게)
  useLayoutEffect(() => {
    const el = menuRef.current
    const at = el?.parentElement?.getBoundingClientRect()
    if (!el || !at) return
    const below = innerHeight - at.bottom - 16
    const above = at.top - 64
    const up = below < 260 && above > below
    el.classList.toggle('is-up', up)
    el.style.maxHeight = `${Math.max(160, Math.min(520, up ? above : below))}px`
  }, [menu])
  // 메뉴 밖을 누르면 닫는다. Esc는 메뉴만 닫는다 (먼저 받아서 부품 고르기 닫기, 부품 고르기 끝내기로 넘기지 않는다)
  useEffect(() => {
    if (!menu) return
    const close = (e: PointerEvent) => !(e.target as Element).closest?.('.bk-tool-menu') && setMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setMenu(null)
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [menu])
  // 그려지는 면을 보인다: 혼자 한 줄을 다 쓰는 작은 부품은 고른 면이 있어도 바탕 없이 그려진다
  const look = shownLook(block, inRow)
  const effect = effectOf(block)
  const variants = spec.variants ?? []
  const variant = variantOfBlock(block)
  const canAdd = !!spec.items && blockItems(block).length < spec.items.max
  const tip = (r: NoRoom | null, ok: string) => (r ? noRoomText(r, block.type, 'change').why : ok)
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
      {/* 바탕: 견본만 늘어놓으면 무엇을 고르는지 알 수 없어서, 지금 바탕의 이름을 보이고 누르면 설명과 함께 고른다 */}
      <div className="bk-tool-menu">
        <button type="button" className={cx('bk-tool', menu === 'look' && 'is-on')} aria-expanded={menu === 'look'} title="컴포넌트의 바탕" onClick={() => setMenu(menu === 'look' ? null : 'look')}>
          <span className={cx('bk-look', `is-${look}`)} aria-hidden="true" />
          <span>{BLOCK_LOOKS.find((l) => l.id === look)?.name}</span>
        </button>
        {menu === 'look' && (
          <ul ref={menuRef} className="bk-menu is-looks" role="menu">
            {BLOCK_LOOKS.map((l) => {
              // 옅은 면과 진한 면은 안쪽 여백만큼 높아져서, 장이 꽉 찼으면 바꿀 수 없다
              const r = look === l.id ? null : lookIssue(l.id)
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={look === l.id}
                    aria-disabled={!!r}
                    className={cx('bk-menu-item', look === l.id && 'is-on', r && 'is-blocked')}
                    onClick={() => {
                      if (r) onBlocked(r)
                      else onLook(l.id)
                      setMenu(null)
                    }}
                  >
                    <span className={cx('bk-look', `is-${l.id}`)} aria-hidden="true" />
                    <b>{l.name}</b>
                    <span className="bk-menu-d">{r ? noRoomText(r, block.type, 'change').why : LOOK_NOTES[l.id]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className="bk-tool-menu">
        <button
          type="button"
          className={cx('bk-tool', menu === 'motion' && 'is-on')}
          aria-expanded={menu === 'motion'}
          title="발표할 때의 움직임"
          onClick={() => setMenu(menu === 'motion' ? null : 'motion')}
        >
          <MotionIcon />
          {/* 기본이면 무엇을 하는 단추인지를, 고른 것이 있으면 그 이름을 ('기본'만 보이면 무엇의 기본인지 모른다) */}
          <span>{effect === 'auto' ? '움직임' : BLOCK_EFFECTS.find((x) => x.id === effect)?.name}</span>
        </button>
        {menu === 'motion' && (
          <ul ref={menuRef} className="bk-menu" role="menu">
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
                  {/* 작은 그림: 마우스를 올리면 그 움직임을 되풀이한다 */}
                  <span className={cx('fx-demo', `is-${x.id}`)} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <b>{x.name}</b>
                  <span className="bk-menu-d">{x.id === 'auto' ? spec.motion : x.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* 모양: 누를 때마다 다음 모양으로 넘기면 무엇이 나올지 몰라서, 이름을 늘어놓고 고른다 */}
      {variants.length > 1 && (
        <div className="bk-tool-menu">
          <button
            type="button"
            className={cx('bk-tool', menu === 'variant' && 'is-on')}
            aria-expanded={menu === 'variant'}
            title="컴포넌트의 모양"
            onClick={() => setMenu(menu === 'variant' ? null : 'variant')}
          >
            <ShapesIcon />
            <span>{variants.find((v) => v.id === variant)?.name}</span>
          </button>
          {menu === 'variant' && (
            <ul ref={menuRef} className="bk-menu is-variants" role="menu">
              {variants.map((v) => {
                const r = v.id === variant ? null : variantIssue(v.id)
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={v.id === variant}
                      aria-disabled={!!r}
                      className={cx('bk-menu-item', v.id === variant && 'is-on', r && 'is-blocked')}
                      onClick={() => {
                        if (r) onBlocked(r)
                        else onVariant(v.id)
                        setMenu(null)
                      }}
                    >
                      <b>{v.name}</b>
                      {r && <span className="bk-menu-d">{tip(r, '')}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
      {spec.items && (
        <button
          type="button"
          className={cx('bk-tool', canAdd && itemIssue && 'is-blocked')}
          disabled={!canAdd}
          aria-disabled={!canAdd || !!itemIssue}
          title={!canAdd ? `${spec.items.label} ${spec.items.max}개까지 넣을 수 있어요` : tip(itemIssue, `${spec.items.label} 추가`)}
          onClick={() => (itemIssue ? onBlocked(itemIssue) : onAddItem())}
        >
          <PlusIcon />
          <span>{spec.items.label}</span>
        </button>
      )}
      {adds.length > 0 && (
        <div className="bk-tool-menu">
          <button
            type="button"
            className={cx('bk-tool', menu === 'fields' && 'is-on')}
            aria-expanded={menu === 'fields'}
            title="비워 두어 숨긴 칸을 꺼내 써요"
            onClick={() => setMenu(menu === 'fields' ? null : 'fields')}
          >
            <PlusIcon />
            <span>칸 더하기</span>
          </button>
          {menu === 'fields' && (
            <ul ref={menuRef} className="bk-menu is-fields" role="menu">
              {adds.map((f) => (
                <li key={f.key}>
                  <button
                    type="button"
                    role="menuitem"
                    className="bk-menu-item"
                    onClick={() => {
                      onOpenField(f.key)
                      setMenu(null)
                    }}
                  >
                    <b>{f.label}</b>
                    <span className="bk-menu-d">{f.item ? `${spec.items?.label ?? '항목'}마다 한 칸씩` : '이 컴포넌트에 한 칸'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
