// 부품 장(compose). 칸의 자리는 deck/blocks.ts가 계산하고, 여기서는 그 자리에 부품을 그린다.
// 부품 안의 칸은 슬라이드의 칸 그리기(T, IT, 그림 칸)를 그대로 쓴다. 부품을 장처럼 보이게 한
// 가짜 장(blockSlide)을 SlideContext로 한 번 더 감싸서, 레이아웃 부품은 그 레이아웃의 그리기를 그대로 쓴다.
// 칸 둘 이상의 숫자로 계산하는 곳(비율, 합, 차이)은 단위까지 읽어 같은 기준으로 맞춘다 (numbers.ts의 seriesIn, amountPair)
// 부품 장만의 부품 하나의 그리기는 blocks/<이름>.tsx, 여러 부품이 같이 쓰는 조각은 blocks/parts.tsx

import { useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { areaStyle, BLOCK_LINKS, BLOCKS, blockFieldPrefix, foldableFields, blockItems, blockMinH, blockSlide, cellBoxes, cellStyle, effectOf, knownRows, linkAt, rowMins, sameLinkTarget, shownLook, shownRows, spansOf, variantOfBlock, withLink, type CellBox, type LinkTarget } from '../deck/blocks'
import { followIndex, moveIn } from '../deck/fields'
import type { Block, BlockLink, BlockRow, BlockType, NativeBlockType } from '../deck/types'
import { cx } from '../lib/cx'
import { BlockEditContext, type BlockEdit } from './blockEdit'
import { Attain } from './blocks/Attain'
import { BigNumber } from './blocks/BigNumber'
import { Bullets } from './blocks/Bullets'
import { Callout } from './blocks/Callout'
import { Checks } from './blocks/Checks'
import { Delta } from './blocks/Delta'
import { Diverge } from './blocks/Diverge'
import { Facts } from './blocks/Facts'
import { Faq } from './blocks/Faq'
import { Gantt } from './blocks/Gantt'
import { Goal } from './blocks/Goal'
import { Heat } from './blocks/Heat'
import { Market } from './blocks/Market'
import { Message } from './blocks/Message'
import { Pareto } from './blocks/Pareto'
import { People } from './blocks/People'
import { Picture } from './blocks/Picture'
import { Quote } from './blocks/Quote'
import { Rating } from './blocks/Rating'
import { Ratio } from './blocks/Ratio'
import { Ring } from './blocks/Ring'
import { Risks } from './blocks/Risks'
import { Spark } from './blocks/Spark'
import { Sparks } from './blocks/Sparks'
import { Stack } from './blocks/Stack'
import { Swot } from './blocks/Swot'
import { Text } from './blocks/Text'
import { SlideContext, useSlide, type SlideActions } from './context'
import { T } from './fields'
import { fitBlocks } from './fitBlocks'
import { LAYOUT_VIEWS } from './layouts'

const NATIVE_VIEWS: Record<NativeBlockType, () => ReactNode> = {
  message: Message,
  text: Text,
  bullets: Bullets,
  quote: Quote,
  callout: Callout,
  number: BigNumber,
  delta: Delta,
  goal: Goal,
  ring: Ring,
  ratio: Ratio,
  spark: Spark,
  facts: Facts,
  risks: Risks,
  swot: Swot,
  faq: Faq,
  checks: Checks,
  gantt: Gantt,
  people: People,
  image: Picture,
  rating: Rating,
  market: Market,
  pareto: Pareto,
  attain: Attain,
  diverge: Diverge,
  stack: Stack,
  heat: Heat,
  sparks: Sparks,
}

const FOLDS = new Map<BlockType, ReadonlySet<string>>()

/** 부품에서 비어 있으면 접어 두는 칸 (deck/blocks.ts의 foldableFields) */
function foldsOf(type: BlockType): ReadonlySet<string> {
  let m = FOLDS.get(type)
  if (!m) FOLDS.set(type, (m = new Set(foldableFields(type).map((f) => f.key))))
  return m
}

function BlockBody({ block, span }: { block: Block; span: number }) {
  const ctx = useSlide()
  const opened = useContext(BlockEditContext)?.opened
  // 편집기에서 '칸 더하기'로 연 칸은 비어 있어도 그린다
  const folds = useMemo(() => {
    const all = foldsOf(block.type)
    return opened?.size ? new Set([...all].filter((k) => !opened.has(`${block.id} ${k}`))) : all
  }, [block.type, block.id, opened])
  const spec = BLOCKS[block.type]
  const outer = ctx.actions
  const inner = useMemo(() => blockSlide(ctx.slide, block), [ctx.slide, block])
  const actions = useMemo<SlideActions | undefined>(() => {
    const update = outer?.updateBlock
    if (!outer || !update) return undefined
    return {
      // 발표 전체의 값($org 같은)은 부품이 아니라 발표에 적는다. 이미지를 넣으면 그 줄의 칸 너비도 이미지에 맞춘다
      setField: (k, v) =>
        k.startsWith('$')
          ? outer.setField(k, v)
          : block.type === 'image' && k === 'image' && v && outer.placeImage
            ? outer.placeImage(block.id, v)
            : update(block.id, (b) => ({ ...b, fields: { ...b.fields, [k]: v } }), `${block.id}.${k}`),
      setItem: (i, k, v) => update(block.id, (b) => ({ ...b, items: b.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) }), `${block.id}.${i}.${k}`),
      removeItem: (i) => update(block.id, (b) => ({ ...b, items: b.items.filter((_, j) => j !== i) })),
      moveItem: (from, to, key) =>
        update(
          block.id,
          (b) => {
            const highlight = followIndex(b.highlight, from, to)
            return { ...b, items: moveIn(b.items, from, to), ...(highlight !== undefined ? { highlight } : {}) }
          },
          key,
        ),
    }
  }, [outer, block.id, block.type])
  const View = spec.layout ? LAYOUT_VIEWS[spec.layout] : NATIVE_VIEWS[block.type as NativeBlockType]
  return (
    <SlideContext.Provider
      value={{
        ...ctx,
        slide: inner,
        actions,
        canRemoveItem: !!spec.items && blockItems(block).length > spec.items.min,
        fieldPrefix: blockFieldPrefix(block.id),
        folds,
        span,
      }}
    >
      <div className="bk-in">
        <View />
      </div>
    </SlideContext.Provider>
  )
}

/** 칸 둘레의 이음표: 그 쪽으로 칸이 비켜 이음표가 설 자리를 낸다 (blocks.css의 .lk-r, .lk-l, .lk-b, .lk-t) */
function linkSides(rows: BlockRow[], box: CellBox): string[] {
  const out: string[] = []
  if (linkAt(rows, { dir: 'h', row: box.row, col: box.col })) out.push('lk-r')
  if (box.col > 0 && linkAt(rows, { dir: 'h', row: box.row, col: box.col - 1 })) out.push('lk-l')
  if (linkAt(rows, { dir: 'v', row: box.row })) out.push('lk-b')
  if (box.row > 0 && linkAt(rows, { dir: 'v', row: box.row - 1 })) out.push('lk-t')
  // 칸 사이에 이음표가 선 줄: 이음표가 줄 가운데에 서니 그 줄의 부품도 가운데에 (위에 붙이면 이음표만 아래에 떠 보인다)
  if (rows[box.row]?.blocks.some((_, c) => linkAt(rows, { dir: 'h', row: box.row, col: c }))) out.push('lk-row')
  return out
}

/** 이음표의 모양. 줄 사이의 화살표는 아래를 본다 */
export function LinkGlyph({ link }: { link: BlockLink }) {
  if (link === 'versus') return <span className="bk-link-vs">vs</span>
  return (
    <svg viewBox="0 0 48 48">
      {link === 'arrow' ? (
        <path d="M9 24h28M27 13l11 11-11 11" />
      ) : link === 'plus' ? (
        <path d="M24 11v26M11 24h26" />
      ) : (
        <path d="M11 18.5h26M11 29.5h26" />
      )}
    </svg>
  )
}

/**
 * 칸 사이와 줄 사이의 이음표. 칸 사이는 왼쪽 칸의 자리에, 줄 사이는 위 줄의 자리에 붙여 그 바깥 간격 가운데에 세운다.
 * 떠 있는(absolute) 격자 자식은 끝 줄을 auto로 두면 격자 끝까지 늘어나서 끝을 span 1로 정한다
 */
function Links({ rows, boxes, live }: { rows: BlockRow[]; boxes: CellBox[]; live: BlockEdit | null }) {
  // after: 발표할 때 이 부품 다음에 나타난다 (칸 사이는 왼쪽 부품, 줄 사이는 위 줄의 마지막 부품)
  const marks: { key: string; t: LinkTarget; link: BlockLink; area: React.CSSProperties; after: string; side?: string }[] = []
  for (const b of boxes) {
    const t: LinkTarget = { dir: 'h', row: b.row, col: b.col }
    const link = linkAt(rows, t)
    // 줄 사이에도 이음표가 있으면 칸이 위아래로 비켜 있어서, 칸 사이의 이음표도 칸의 가운데로 옮긴다
    const below = !!linkAt(rows, { dir: 'v', row: b.row })
    const above = b.row > 0 && !!linkAt(rows, { dir: 'v', row: b.row - 1 })
    const side = below && !above ? 'lk-up' : above && !below ? 'lk-down' : undefined
    if (link) marks.push({ key: `h${b.rowId}-${b.col}`, t, link, area: { gridRow: `${b.row + 1} / span 1`, gridColumn: `${b.start + 1} / span ${b.span}` }, after: b.block.id, side })
  }
  rows.forEach((r, i) => {
    const t: LinkTarget = { dir: 'v', row: i }
    const link = linkAt(rows, t)
    if (link) marks.push({ key: `v${r.id}`, t, link, area: { gridRow: `${i + 1} / span 1`, gridColumn: '1 / -1' }, after: r.blocks[r.blocks.length - 1].id })
  })
  return (
    <>
      {marks.map((m) => {
        const name = BLOCK_LINKS.find((l) => l.id === m.link)!.name
        const preview = !!live?.linkPreview && sameLinkTarget(live.linkPreview.target, m.t)
        return (
          <span
            key={m.key}
            className={cx('bk-link', `lk-${m.t.dir}`, m.side, `is-${m.link}`, preview && 'is-preview', !!live && sameLinkTarget(live.selectedLink, m.t) && 'is-selected')}
            style={m.area}
            data-link={m.t.dir === 'h' ? `h${m.t.row}-${m.t.col}` : `v${m.t.row}`}
            data-after={m.after}
            {...(live && !preview
              ? { role: 'button', 'aria-label': `이음표: ${name}`, title: `${name} (눌러서 바꾸거나 빼기)`, onPointerDown: (e: React.PointerEvent<HTMLElement>) => live.onLinkPointerDown(e, m.t) }
              : { 'aria-hidden': true })}
          >
            <span className="bk-link-g">
              <LinkGlyph link={m.link} />
            </span>
          </span>
        )
      })}
    </>
  )
}

function BlockCell({ box, live, rows }: { box: CellBox; live: BlockEdit | null; rows: BlockRow[] }) {
  const b = box.block
  const spec = BLOCKS[b.type]
  const look = shownLook(b, box.cols)
  const slot = live?.dragId === b.id
  const selected = !!live && live.selected === b.id && !live.dragId
  return (
    <div
      className={cx(
        'bk',
        ...linkSides(rows, box),
        `bk-${b.type}`,
        `bk-look-${look}`,
        `fx-${effectOf(b)}`,
        spec.layout && 'bk-layout',
        `va-${variantOfBlock(b)}`,
        box.cols > 1 && 'is-shared',
        selected && 'is-selected',
        slot && 'is-slot',
      )}
      style={cellStyle(box)}
      data-block={b.id}
      data-type={b.type}
      data-row={box.row}
      onPointerDown={live && !slot ? (e) => live.onCellPointerDown(e, b) : undefined}
    >
      {slot ? <div className="bk-slot" aria-hidden="true" /> : <BlockBody block={b} span={box.span} />}
      {/* 끌어서 옮기는 손잡이: 칸 왼쪽 위에 붙는 이름표. 글 칸이 부품을 거의 덮어도 잡을 데가 있게 */}
      {live && !slot && (
        <span className="bk-handle" title="끌어서 옮기기" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M9 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm6 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-6 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm6 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-6 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm6 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
          </svg>
          {spec.name}
        </span>
      )}
    </div>
  )
}

/** 줄 안의 칸 사이마다 너비를 바꾸는 손잡이. 놓으면 정해진 비율 가운데 가장 가까운 것에 붙는다 */
function Gutters({ rows, boxes, live }: { rows: BlockRow[]; boxes: CellBox[]; live: BlockEdit }) {
  return (
    <>
      {boxes
        .filter((b) => b.col > 0)
        .map((b) => (
          <div
            key={`${b.rowId}-${b.col}`}
            // 이음표가 선 사이는 손잡이 선이 이음표를 가로지르지 않게 가운데를 비운다
            className={cx('bk-gutter', linkAt(rows, { dir: 'h', row: b.row, col: b.col - 1 }) && 'has-link')}
            style={{ gridRow: String(b.row + 1), gridColumn: `${b.start + 1} / span 1` }}
            role="separator"
            aria-label="컴포넌트 너비 바꾸기"
            title="끌어서 컴포넌트 너비 바꾸기"
            onPointerDown={(e) => live.onGutterPointerDown(e, b.rowId, b.col - 1)}
          >
            <span className="bk-gutter-grip" />
          </div>
        ))}
    </>
  )
}

/** 줄 사이마다 높이를 나누는 손잡이. 끌면 위아래 줄이 높이를 나눠 갖고(24분의 1에 붙는다), 두 번 누르면 똑같이 */
function RowGaps({ rows, live }: { rows: BlockRow[]; live: BlockEdit }) {
  return (
    <>
      {Array.from({ length: rows.length - 1 }, (_, i) => (
        <div
          key={i}
          className={cx('bk-rowgap', linkAt(rows, { dir: 'v', row: i }) && 'has-link')}
          style={{ gridRow: String(i + 2), gridColumn: '1 / -1' }}
          role="separator"
          aria-orientation="horizontal"
          aria-label="줄 높이 바꾸기"
          title="끌어서 줄 높이 바꾸기 (두 번 누르면 똑같이)"
          onPointerDown={(e) => live.onRowGapPointerDown(e, i)}
          onDoubleClick={() => live.onRowGapReset()}
        >
          <span className="bk-rowgap-grip" />
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
      const dw = f.w - last.w
      const dh = f.h - last.h
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(dw) < 1 && Math.abs(dh) < 1) continue
      // 자리는 미끄러지고, 크기는 늘이지 않는다(가로세로를 다르게 늘이면 글자가 찌그러져 보인다).
      // 커지는 칸은 옛 크기만큼 보이던 데서 새 크기로 펼쳐지고, 작아지는 칸은 새 크기로 바로 바뀐 채 미끄러진다
      const round = getComputedStyle(cell).borderTopLeftRadius || '0px'
      const clip = (w: number, h: number) => `inset(0 ${Math.max(0, last.w - w)}px ${Math.max(0, last.h - h)}px 0 round ${round})`
      const grow = dw < -1 || dh < -1
      cell.animate(
        [
          { translate: `${dx}px ${dy}px`, ...(grow ? { clipPath: clip(f.w, f.h) } : {}) },
          { translate: '0 0', ...(grow ? { clipPath: clip(last.w, last.h) } : {}) },
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
  // 발표할 때는 비워 둔 부품을 빼고 그린다 (남은 부품이 줄을 채운다)
  const known = knownRows(slide.rows ?? [])
  const saved = live?.rows ?? (mode === 'final' ? shownRows(known) : known)
  // 이음표를 끄는 동안에는 놓일 자리에 흐리게 미리 세운다 (양쪽 칸이 비켜 나는 것까지)
  const rows = live?.linkPreview ? withLink(saved, live.linkPreview.target, live.linkPreview.link) : saved
  const boxes = cellBoxes(rows)
  const ref = useRef<HTMLDivElement | null>(null)
  // 자리가 바뀔 때만: 줄마다 부품 id와 칸 너비
  const key = rows
    .map((r) => {
      const spans = spansOf(r)
      return `${r.blocks.map((b, i) => `${b.id}:${blockMinH(b, spans[i])}:${b.link ?? ''}`).join(',')}|${spans.join(',')}|${r.link ?? ''}`
    })
    .join('/')
  // 넘치는 부품 맞추기는 자리 옮기는 움직임(useFlip)이 끝자리를 재기 전에
  useLayoutEffect(() => {
    if (ref.current) fitBlocks(ref.current)
  })
  useEffect(() => {
    let on = true
    const fit = () => on && ref.current && fitBlocks(ref.current)
    document.fonts?.ready.then(fit)
    // 그릴 때 안 보이던 장이 보이게 되거나, 제목이 두 줄이 되어 본문 상자가 낮아지면 다시 맞춘다.
    // 맞추기는 칸 안만 바꾸고 본문 상자의 크기는 바꾸지 않아서 되풀이되지 않는다
    const ro = typeof ResizeObserver === 'undefined' || !ref.current ? null : new ResizeObserver(fit)
    if (ref.current) ro?.observe(ref.current)
    return () => {
      on = false
      ro?.disconnect()
    }
  }, [])
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
      data-mins={rows.length ? rowMins(rows) : undefined}
    >
      {!rows.length && mode !== 'final' && (live ? live.empty() : <p className="bk-empty-t">컴포넌트를 골라 넣어 꾸미는 장이에요</p>)}
      {boxes.map((box) => (
        <BlockCell key={box.block.id} box={box} live={live} rows={rows} />
      ))}
      <Links rows={rows} boxes={boxes} live={live} />
      {live && !live.dragId && <Gutters rows={rows} boxes={boxes} live={live} />}
      {live && !live.dragId && rows.length > 1 && <RowGaps rows={rows} live={live} />}
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
