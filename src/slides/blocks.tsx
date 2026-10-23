import { useContext, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import { areaStyle, BLOCKS, blockFieldPrefix, blockItems, blockMinH, blockSlide, cellBoxes, cellStyle, effectOf, lookOf, spansOf, variantOfBlock, type CellBox } from '../deck/blocks'
import { readField } from '../deck/fields'
import { hintFor } from '../deck/layouts'
import type { Block, NativeBlockType } from '../deck/types'
import { cx } from '../lib/cx'
import { BlockEditContext, type BlockEdit } from './blockEdit'
import { SlideContext, useSlide, type SlideActions } from './context'
import { IT, ImageSlot, ItemTools, T } from './fields'
import { LAYOUT_VIEWS } from './layouts'
import { formatNumber, parseDelta } from './numbers'

// 부품 장(compose). 칸의 자리는 deck/blocks.ts가 계산하고, 여기서는 그 자리에 부품을 그린다.
// 부품 안의 칸은 슬라이드의 칸 그리기(T, IT, 그림 칸)를 그대로 쓴다. 부품을 장처럼 보이게 한
// 가짜 장(blockSlide)을 SlideContext로 한 번 더 감싸서, 레이아웃 부품은 그 레이아웃의 그리기를 그대로 쓴다.

/** 숫자 칸을 읽는다. 비었거나 숫자가 없으면 null */
function numberOrNull(text: string): number | null {
  return text.trim() && /\d/.test(text) ? parseDelta(text) : null
}

/** 편집할 때 비어 있으면 안내 문구의 예시 숫자로 흐리게 그린다. 발표할 때는 적은 값만 */
function useDemo(keys: string[]) {
  const { slide, meta, mode } = useSlide()
  const demo = mode !== 'final' && keys.every((k) => !readField(slide, meta, k).trim())
  const read = (k: string) => (demo ? hintFor(slide.layout, slide.hints, k) : readField(slide, meta, k))
  return { demo, read }
}

// ---------- 부품 장만의 부품 ----------

function Message() {
  return (
    <div className="bk-msg">
      <T k="text" as="p" className="bk-msg-t" fit={[30, 52]} multiline />
      <T k="sub" className="bk-msg-s" multiline />
    </div>
  )
}

function Text() {
  return (
    <div className="bk-tx">
      <T k="label" className="bk-label" />
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <T k="body" className="bk-body" multiline />
    </div>
  )
}

function Bullets() {
  const { slide } = useSlide()
  const items = slide.items.slice(0, BLOCKS.bullets.items!.max)
  return (
    <div className="bk-bl">
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <ul className="bk-list" data-n={items.length}>
        {items.map((it, i) => (
          <li key={it.id} className="it bk-li">
            <span className="bk-dot" aria-hidden="true" />
            <div className="bk-li-text">
              <IT i={i} k="title" className="bk-li-t" multiline />
              <IT i={i} k="body" className="bk-li-b" multiline />
            </div>
            <ItemTools i={i} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function Quote() {
  return (
    <figure className="bk-q">
      <span className="bk-q-mark" aria-hidden="true">
        “
      </span>
      <T k="quote" as="blockquote" className="bk-q-t" fit={[40, 70]} multiline />
      <T k="by" as="figcaption" className="bk-q-by" />
    </figure>
  )
}

function Callout() {
  return (
    <div className="bk-call">
      <T k="label" className="bk-call-l" />
      <T k="text" className="bk-call-t" fit={[30, 56]} multiline />
    </div>
  )
}

function BigNumber() {
  return (
    <div className="bk-num">
      <T k="label" className="bk-num-l" />
      <T k="value" className="bk-num-v" oneLine />
      <T k="note" className="bk-num-n" multiline />
    </div>
  )
}

/** 전과 후의 차이. 둘 다 %면 %p로, 아니면 전 값에 대한 % */
function deltaOf(before: string, after: string): { text: string; dir: -1 | 0 | 1 } | null {
  const a = numberOrNull(before)
  const b = numberOrNull(after)
  if (a === null || b === null) return null
  const d = b - a
  const dir = d > 0 ? 1 : d < 0 ? -1 : 0
  const round = (n: number) => (Math.abs(n) < 10 ? Math.round(n * 10) / 10 : Math.round(n))
  if (before.includes('%') && after.includes('%')) return { text: `${formatNumber(Math.abs(round(d)))}%p`, dir }
  if (a === 0) return null
  return { text: `${formatNumber(Math.abs(round((d / Math.abs(a)) * 100)))}%`, dir }
}

function Delta() {
  const { demo, read } = useDemo(['before', 'after'])
  const delta = deltaOf(read('before'), read('after'))
  return (
    <div className={cx('bk-dl', demo && 'is-demo')}>
      <T k="label" className="bk-dl-l" />
      <div className="bk-dl-row">
        <div className="bk-dl-side bk-dl-from">
          <span className="bk-dl-k">전</span>
          <div className="bk-dl-vbox">
            <T k="before" className="bk-dl-v" oneLine />
          </div>
        </div>
        <span className="bk-dl-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 12h15M13 6l6 6-6 6" />
          </svg>
        </span>
        <div className="bk-dl-side bk-dl-to">
          <span className="bk-dl-k">후</span>
          <div className="bk-dl-vbox">
            <T k="after" className="bk-dl-v" oneLine />
          </div>
        </div>
      </div>
      <div className="bk-dl-foot">
        {delta && (
          <span className={cx('bk-dl-chip', delta.dir < 0 ? 'is-down' : delta.dir > 0 ? 'is-up' : 'is-flat')}>
            {delta.dir < 0 ? '▼' : delta.dir > 0 ? '▲' : '–'} {delta.text}
          </span>
        )}
        <T k="note" className="bk-dl-n" />
      </div>
    </div>
  )
}

function Goal() {
  const { mode } = useSlide()
  const { demo, read } = useDemo(['value', 'target'])
  const value = numberOrNull(read('value'))
  const target = numberOrNull(read('target'))
  const pct = value !== null && target !== null && target > 0 ? (value / target) * 100 : null
  return (
    <div className={cx('bk-gl', demo && 'is-demo', pct !== null && pct >= 100 && 'is-met')} style={{ '--p': Math.min(100, Math.max(0, pct ?? 0)).toFixed(1) } as CSSProperties}>
      <div className="bk-gl-top">
        <T k="label" className="bk-gl-l" />
        <span className="bk-gl-pct">{pct === null ? '–' : `${formatNumber(Math.round(pct))}%`}</span>
      </div>
      <div className="bk-gl-bar" aria-hidden="true">
        <span className="bk-gl-fill" />
      </div>
      <p className="bk-gl-of">
        <span className="bk-gl-num">
          <T k="value" as="span" className="bk-gl-v" />
          {/* 단위는 한 번만 적고 실적과 목표에 같이 붙인다 */}
          {mode !== 'edit' && read('unit').trim() && <span className="bk-gl-vu">{read('unit')}</span>}
        </span>
        <span className="bk-gl-sep">/ 목표</span>
        <span className="bk-gl-num">
          <T k="target" as="span" className="bk-gl-t" />
          {(mode !== 'final' || read('unit').trim()) && <T k="unit" as="span" className="bk-gl-u" />}
        </span>
      </p>
      <T k="note" className="bk-gl-n" multiline />
    </div>
  )
}

function Picture() {
  const { slide } = useSlide()
  return (
    <figure className="bk-img">
      <ImageSlot k="image" className="bk-img-i" contain={slide.variant === 'contain'} />
      <T k="caption" as="figcaption" className="bk-img-c" />
    </figure>
  )
}

const NATIVE_VIEWS: Record<NativeBlockType, () => ReactNode> = {
  message: Message,
  text: Text,
  bullets: Bullets,
  quote: Quote,
  callout: Callout,
  number: BigNumber,
  delta: Delta,
  goal: Goal,
  image: Picture,
}

// ---------- 부품 하나 ----------

function BlockBody({ block }: { block: Block }) {
  const ctx = useSlide()
  const spec = BLOCKS[block.type]
  const outer = ctx.actions
  const inner = useMemo(() => blockSlide(ctx.slide, block), [ctx.slide, block])
  const actions = useMemo<SlideActions | undefined>(() => {
    const update = outer?.updateBlock
    if (!outer || !update) return undefined
    return {
      // 발표 전체의 값($org 같은)은 부품이 아니라 발표에 적는다
      setField: (k, v) => (k.startsWith('$') ? outer.setField(k, v) : update(block.id, (b) => ({ ...b, fields: { ...b.fields, [k]: v } }), `${block.id}.${k}`)),
      setItem: (i, k, v) => update(block.id, (b) => ({ ...b, items: b.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) }), `${block.id}.${i}.${k}`),
      removeItem: (i) => update(block.id, (b) => ({ ...b, items: b.items.filter((_, j) => j !== i) })),
    }
  }, [outer, block.id])
  const View = spec.layout ? LAYOUT_VIEWS[spec.layout] : NATIVE_VIEWS[block.type as NativeBlockType]
  return (
    <SlideContext.Provider
      value={{
        ...ctx,
        slide: inner,
        actions,
        canRemoveItem: !!spec.items && blockItems(block).length > spec.items.min,
        fieldPrefix: blockFieldPrefix(block.id),
      }}
    >
      <div className="bk-in">
        <View />
      </div>
    </SlideContext.Provider>
  )
}

function BlockCell({ box, live }: { box: CellBox; live: BlockEdit | null }) {
  const b = box.block
  const spec = BLOCKS[b.type]
  const look = lookOf(b)
  const slot = live?.dragId === b.id
  const selected = !!live && live.selected === b.id && !live.dragId
  return (
    <div
      className={cx(
        'bk',
        `bk-${b.type}`,
        `bk-look-${look}`,
        `fx-${effectOf(b)}`,
        spec.layout && 'bk-layout',
        `va-${variantOfBlock(b)}`,
        selected && 'is-selected',
        slot && 'is-slot',
      )}
      style={cellStyle(box)}
      data-block={b.id}
      data-type={b.type}
      data-row={box.row}
      onPointerDown={live && !slot ? (e) => live.onCellPointerDown(e, b) : undefined}
    >
      {slot ? <div className="bk-slot" aria-hidden="true" /> : <BlockBody block={b} />}
      {/* 끌어서 옮기는 손잡이. 글 칸이 부품을 거의 덮어도 잡을 데가 있게 */}
      {live && !slot && <span className="bk-handle" title="끌어서 옮기기" aria-hidden="true" />}
    </div>
  )
}

/** 줄 안의 칸 사이마다 너비를 바꾸는 손잡이. 놓으면 정해진 비율 가운데 가장 가까운 것에 붙는다 */
function Gutters({ boxes, live }: { boxes: CellBox[]; live: BlockEdit }) {
  return (
    <>
      {boxes
        .filter((b) => b.col > 0)
        .map((b) => (
          <div
            key={`${b.rowId}-${b.col}`}
            className="bk-gutter"
            style={{ gridRow: String(b.row + 1), gridColumn: `${b.start + 1} / span 1` }}
            role="separator"
            aria-label="칸 너비 바꾸기"
            title="끌어서 칸 너비 바꾸기"
            onPointerDown={(e) => live.onGutterPointerDown(e, b.rowId, b.col - 1)}
          >
            <span className="bk-gutter-grip" />
          </div>
        ))}
    </>
  )
}

type Box = { x: number; y: number; w: number; h: number }

/** 칸들이 지금 화면에 보이는 자리 (움직이는 중이면 움직이는 중의 자리). 캔버스 px, 본문 상자 기준 */
function visualBoxes(area: HTMLElement): Map<string, Box> {
  const a = area.getBoundingClientRect()
  const k = area.offsetWidth ? a.width / area.offsetWidth : 1
  const out = new Map<string, Box>()
  for (const el of area.querySelectorAll<HTMLElement>(':scope > .bk')) {
    const r = el.getBoundingClientRect()
    out.set(el.dataset.block!, { x: (r.left - a.left) / k, y: (r.top - a.top) / k, w: r.width / k, h: r.height / k })
  }
  return out
}

/** 편집할 때 칸이 자리를 옮기면 원래 자리에서 새 자리로 미끄러지게 (FLIP). 새로 생긴 칸은 제자리에서 맞춰 들어온다 */
const FLIP_EASING =
  'linear(0, 0.0576, 0.1409, 0.2066, 0.3123, 0.4188, 0.5204, 0.6135, 0.6697, 0.7445, 0.8079, 0.8604, 0.9029, 0.9261, 0.9543, 0.9755, 0.991, 1.0019, 1.007, 1.0122, 1.0151, 1.0162, 1.0161, 1.0156, 1.0143, 1.0127, 1.011, 1.0093, 1.0082, 1.0066, 1.0052, 1.004, 1.003, 1.0025, 1.0017, 1.0011, 1.0007, 1.0004, 1.0002, 1, 1)'

function useFlip(area: React.RefObject<HTMLDivElement | null>, on: boolean, key: string) {
  const before = useRef<Map<string, Box> | null>(null)
  // 그리기 전에(아직 옛 모습일 때) 지금 보이는 자리를 재 둔다
  if (on && area.current) before.current = visualBoxes(area.current)
  useLayoutEffect(() => {
    const el = area.current
    const first = before.current
    before.current = null
    if (!on || !el || !first || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    for (const cell of el.querySelectorAll<HTMLElement>(':scope > .bk')) {
      const id = cell.dataset.block!
      const f = first.get(id)
      cell.getAnimations().forEach((a) => a.cancel())
      const last = { x: cell.offsetLeft, y: cell.offsetTop, w: cell.offsetWidth, h: cell.offsetHeight }
      if (!f) {
        cell.animate([{ opacity: 0, scale: '0.94' }, { opacity: 1, scale: '1' }], { duration: 420, easing: FLIP_EASING })
        continue
      }
      const dx = f.x - last.x
      const dy = f.y - last.y
      const sx = f.w / (last.w || 1)
      const sy = f.h / (last.h || 1)
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.002 && Math.abs(sy - 1) < 0.002) continue
      cell.animate(
        [
          { transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
          { transformOrigin: '0 0', transform: 'none' },
        ],
        { duration: 470, easing: FLIP_EASING },
      )
    }
  }, [key, on, area])
}

export function BlockArea() {
  const { slide, mode } = useSlide()
  const edit = useContext(BlockEditContext)
  const live = mode === 'edit' && edit ? edit : null
  const rows = live?.rows ?? slide.rows ?? []
  const boxes = cellBoxes(rows)
  const ref = useRef<HTMLDivElement | null>(null)
  // 자리가 바뀔 때만: 줄마다 부품 id와 칸 너비
  const key = rows.map((r) => `${r.blocks.map((b) => `${b.id}:${blockMinH(b)}`).join(',')}|${spansOf(r).join(',')}`).join('/')
  useFlip(ref, !!live, key)
  const setRef = (el: HTMLDivElement | null) => {
    ref.current = el
    live?.areaRef(el)
  }
  return (
    <div
      ref={setRef}
      className={cx('bk-area', live && 'is-live', live?.dragId && 'is-dragging', !rows.length && 'is-empty')}
      style={rows.length ? areaStyle(rows) : undefined}
      data-rows={rows.length}
    >
      {!rows.length && mode !== 'final' && (live ? live.empty() : <p className="bk-empty-t">부품을 골라 넣어 꾸미는 장이에요</p>)}
      {boxes.map((box) => (
        <BlockCell key={box.block.id} box={box} live={live} />
      ))}
      {live && !live.dragId && <Gutters boxes={boxes} live={live} />}
      {live?.incoming && <div className="bk-incoming" aria-hidden="true" />}
    </div>
  )
}

/** 부품 장. 머리(제목, 부제)는 비우면 발표할 때 자리를 차지하지 않는다 */
export function Compose() {
  return (
    <>
      <header className="s-head">
        <T k="title" as="h2" className="s-title" fit={[24, 40]} multiline />
        <T k="lead" as="p" className="s-lead" multiline />
      </header>
      <BlockArea />
      <T k="source" className="s-source" />
    </>
  )
}
