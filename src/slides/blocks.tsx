// 부품 장(compose). 부품의 자리(판의 칸 수)는 deck/blocks.ts가 정하고, 여기서는 그 자리에 부품을 그린다.
// 부품 안의 칸은 슬라이드의 칸 그리기(T, IT, 그림 칸)를 그대로 쓴다. 부품을 장처럼 보이게 한
// 가짜 장(blockSlide)을 SlideContext로 한 번 더 감싸서, 레이아웃 부품은 그 레이아웃의 그리기를 그대로 쓴다.
// 칸 둘 이상의 숫자로 계산하는 곳(비율, 합, 차이)은 단위까지 읽어 같은 기준으로 맞춘다 (numbers.ts의 seriesIn, amountPair)
// 부품 장만의 부품 하나의 그리기는 blocks/<이름>.tsx, 여러 부품이 같이 쓰는 조각은 blocks/parts.tsx

import { useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { behind, BLOCK_LINKS, BLOCKS, blockFieldPrefix, boardInfo, byReading, foldableFields, blockItems, blockSlide, effectOf, fromOf, guttersOf, isAlone, knownBlocks, linkAt, playOrder, sameLinkTarget, shownBlocks, shownLook, speedOf, variantOfBlock, whenOf, withLink, type Gutter, type LinkTarget } from '../deck/blocks'
import { followIndex, moveIn, presentable } from '../deck/fields'
import type { Block, BlockLink, BlockType, NativeBlockType } from '../deck/types'
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
import { Flow } from './blocks/Flow'
import { Network } from './blocks/Network'
import { Merge } from './blocks/Merge'
import { Split } from './blocks/Split'
import { Tiles } from './blocks/Tiles'
import { Heading } from './blocks/Heading'
import { Stat } from './blocks/Stat'
import { Meter } from './blocks/Meter'
import { Range } from './blocks/Range'
import { Status } from './blocks/Status'
import { Steps } from './blocks/Steps'
import { DateBlock } from './blocks/DateBlock'
import { Note } from './blocks/Note'
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
import { frameCells } from './blockFrame'
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
  flow: Flow,
  network: Network,
  split: Split,
  merge: Merge,
  tiles: Tiles,
  heading: Heading,
  stat: Stat,
  meter: Meter,
  range: Range,
  status: Status,
  steps: Steps,
  date: DateBlock,
  note: Note,
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
  // 발표 모습에서는 하나도 채우지 않은 항목을 그리지 않는다(장의 항목과 같은 규칙, SlideCanvas)
  const inner = useMemo(() => {
    const own = blockSlide(ctx.slide, block)
    return ctx.mode === 'final' ? presentable(own, spec.items) : own
  }, [ctx.slide, ctx.mode, block, spec])
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
        labels: spec,
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

/** 부품 둘레의 이음표: 그 쪽으로 부품이 비켜 이음표가 설 자리를 낸다 (links.css의 .lk-r, .lk-l, .lk-b, .lk-t) */
function linkSides(blocks: Block[], b: Block): string[] {
  const out: string[] = []
  const has = (o: Block, dir: 'h' | 'v') => !!linkAt(blocks, { id: o.id, dir })
  if (has(b, 'h')) out.push('lk-r')
  if (behind(blocks, b, 'h').some((o) => has(o, 'h'))) out.push('lk-l')
  if (has(b, 'v')) out.push('lk-b')
  if (behind(blocks, b, 'v').some((o) => has(o, 'v'))) out.push('lk-t')
  return out
}

/** 비켜 선 쪽 (위·아래 몫의 차): 옆 이음표는 부품이 그려진 높이의 가운데에, 아래 이음표는 그려진 너비의 가운데에 선다 */
const shift = (sides: string[], a: string, b: string) => (sides.includes(a) ? 1 : 0) - (sides.includes(b) ? 1 : 0)

/**
 * 이음표의 모양. 줄 사이의 화살표는 아래를 본다. 화살표는 짧은 줄기와 머리(옅은 꺾쇠만 두던 때는 화살표로 읽히지 않았다), 더하기와 같음도 같은 굵기의
 * 가는 획, 견주기는 작은 글자(vs)다: 모두 옅은 글자색의 작은 표시라 두 컴포넌트 사이의 빈자리에 조판 기호처럼 선다
 */
export function LinkGlyph({ link }: { link: BlockLink }) {
  if (link === 'versus') return <span className="bk-link-vs">vs</span>
  return (
    <svg viewBox="0 0 48 48">
      {link === 'arrow' ? <path d="M9 24H37M27 14L37 24L27 34" /> : link === 'plus' ? <path d="M24 15v18M15 24h18" /> : <path d="M15 20h18M15 28h18" />}
    </svg>
  )
}

/**
 * 부품 사이의 이음표. 옆 이음표는 부품의 오른쪽 선 위(칸 사이 가운데), 아래 이음표는 아래 선 위(줄 사이 가운데)에,
 * 저마다 그 부품이 그려진 쪽의 가운데에 선다 (blocks.css의 .bk-link가 판의 칸 수로 자리를 계산한다)
 */
function Links({ blocks, live }: { blocks: Block[]; live: BlockEdit | null }) {
  // after: 발표할 때 이 부품 다음에 나타난다 (이음표 앞쪽의 부품)
  const marks: { key: string; t: LinkTarget; link: BlockLink; style: React.CSSProperties }[] = []
  for (const b of blocks) {
    const a = b.at
    if (!a) continue
    const sides = linkSides(blocks, b)
    for (const dir of ['h', 'v'] as const) {
      const t: LinkTarget = { id: b.id, dir }
      const link = linkAt(blocks, t)
      if (!link) continue
      const style = (
        dir === 'h' ? { '--lx': a.x + a.w, '--ly': a.y + a.h / 2, '--ld': shift(sides, 'lk-t', 'lk-b') } : { '--lx': a.x + a.w / 2, '--ly': a.y + a.h, '--ld': shift(sides, 'lk-l', 'lk-r') }
      ) as React.CSSProperties
      marks.push({ key: `${dir}${b.id}`, t, link, style })
    }
  }
  return (
    <>
      {marks.map((m) => {
        const name = BLOCK_LINKS.find((l) => l.id === m.link)!.name
        const preview = !!live?.linkPreview && sameLinkTarget(live.linkPreview.target, m.t)
        return (
          <span
            key={m.key}
            className={cx('bk-link', `lk-${m.t.dir}`, `is-${m.link}`, preview && 'is-preview', !!live && sameLinkTarget(live.selectedLink, m.t) && 'is-selected')}
            style={m.style}
            data-link={`${m.t.dir}${m.t.id}`}
            data-after={m.t.id}
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

/** 판의 자리 (칸 수). blocks.css의 .bk가 칸 사이를 빼고 그린다 */
const atStyle = (b: Block) => ({ '--x': b.at?.x ?? 0, '--y': b.at?.y ?? 0, '--w': b.at?.w ?? 12, '--h': b.at?.h ?? 12 }) as React.CSSProperties

/** 부품 하나 */
function BlockCell({ block: b, blocks, live, seq, band, linked }: { block: Block; blocks: Block[]; live: BlockEdit | null; seq?: number; band?: { band: number; size: number; stacked: boolean }; linked: boolean }) {
  const spec = BLOCKS[b.type]
  const when = whenOf(b)
  const speed = speedOf(b)
  const from = fromOf(b)
  const look = shownLook(b, isAlone(b))
  const slot = live?.dragId === b.id
  const selected = !!live && live.selected === b.id && !live.dragId
  const sides = linkSides(blocks, b)
  return (
    <div
      className={cx(
        'bk',
        ...sides,
        linked && 'lk-row',
        band?.stacked && 'is-stacked',
        `bk-${b.type}`,
        `bk-look-${look}`,
        `fx-${effectOf(b)}`,
        spec.layout && 'bk-layout',
        `va-${variantOfBlock(b)}`,
        !!band && band.size > 1 && 'is-shared',
        selected && 'is-selected',
        slot && 'is-slot',
      )}
      style={atStyle(b)}
      data-block={b.id}
      data-type={b.type}
      data-band={band?.band}
      // 발표할 때의 차례와 때, 빠르기, 들어오는 쪽 (motion/engine.ts가 읽는다). 기본값은 적지 않는다
      data-seq={seq}
      data-when={when === 'after' ? undefined : when}
      data-speed={speed === 'normal' ? undefined : speed}
      data-from={from ?? undefined}
      onPointerDown={live && !slot ? (e) => live.onCellPointerDown(e, b) : undefined}
    >
      {slot ? <div className="bk-slot" aria-hidden="true" /> : <BlockBody block={b} span={b.at?.w ?? 12} />}
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

/**
 * 판을 나누는 선마다의 손잡이. 끌면 선 양쪽이 크기를 주고받고 판의 칸에 붙는다. 선이 그어진 범위만큼 칸 사이를 덮는다
 * (blocks.css의 .bk-line이 판의 칸 수로 자리를 계산한다)
 */
function Lines({ gutters, blocks, live }: { gutters: Gutter[]; blocks: Block[]; live: BlockEdit }) {
  // 고른 부품의 가장자리에 닿는 선: 그 손잡이만 옅게 보여 크기를 바꿀 수 있는 곳을 알린다 (edit.css)
  const sel = blocks.find((b) => b.id === live.selected)?.at
  const near = (g: Gutter) =>
    !!sel &&
    (g.dir === 'h'
      ? (sel.x === g.at || sel.x + sel.w === g.at) && sel.y < g.to && g.from < sel.y + sel.h
      : (sel.y === g.at || sel.y + sel.h === g.at) && sel.x < g.to && g.from < sel.x + sel.w)
  return (
    <>
      {gutters.map((g) => (
        <div
          key={`${g.dir}${g.at}-${g.from}-${g.key}`}
          className={cx('bk-line', `is-${g.dir}`, near(g) && 'is-near')}
          style={{ '--at': g.at, '--from': g.from, '--to': g.to } as React.CSSProperties}
          role="separator"
          aria-orientation={g.dir === 'h' ? 'vertical' : 'horizontal'}
          aria-label={g.dir === 'h' ? '컴포넌트 너비 바꾸기' : '컴포넌트 높이 바꾸기'}
          title={g.dir === 'h' ? '끌어서 너비 바꾸기' : '끌어서 높이 바꾸기'}
          onPointerDown={(e) => live.onGutterPointerDown(e, g)}
        >
          <span className="bk-line-grip" />
        </div>
      ))}
    </>
  )
}

type Box = { x: number; y: number; w: number; h: number }

/** 본문 상자 안의 모든 부품 */
const CELLS = ':scope > .bk'

/** 칸들이 지금 화면에 보이는 자리 (움직이는 중이면 움직이는 중의 자리). 캔버스 px, 본문 상자 기준 */
function visualBoxes(area: HTMLElement): Map<string, Box> {
  const a = area.getBoundingClientRect()
  const k = area.offsetWidth ? a.width / area.offsetWidth : 1
  const out = new Map<string, Box>()
  for (const el of area.querySelectorAll<HTMLElement>(CELLS)) {
    const r = el.getBoundingClientRect()
    out.set(el.dataset.block!, { x: (r.left - a.left) / k, y: (r.top - a.top) / k, w: r.width / k, h: r.height / k })
  }
  return out
}

/**
 * 편집할 때 칸이 자리를 옮기면 원래 자리에서 새 자리로 미끄러지게 (FLIP). 새로 생긴 칸은 제자리에서 맞춰 들어온다.
 * 판의 자리가 바뀔 때만이 아니라 그릴 때마다 본다: 편집 화면도 부품을 위로 올려 붙여서(fitBlocks.ts의 pack), 글을 써서 위 부품이
 * 한 줄 늘거나, 끌기를 시작해 판의 칸으로 내려가거나, 놓아서 다시 올라붙을 때도 칸이 움직인다. 예전에는 그때 칸이 한 번에 튀었다.
 * 자리가 그대로인 칸은 건드리지 않는다. 끝에서 넘었다 돌아오지 않고 부드럽게 멈춘다(--ease-out과 같은 곡선): 둘레의 칸이
 * 비켜 나는 것이라 튀면 장 전체가 출렁여 보였다
 */
const FLIP_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
const FLIP_MS = 360

/**
 * 빠진 칸이 제자리에서 옅어지며 사라지게. 예전에는 빼자마자 없어지고 옆 칸만 미끄러져 와서, 무엇이 빠졌는지 눈으로 따라가기 어려웠다.
 * React가 떼어 낸 칸을 손대지 않는 껍데기(.bk-leaving, 본문 상자와 같은 크기라 칸의 자리 계산이 그대로다)에 넣어 잠깐 보여 준다.
 * 껍데기는 본문 상자의 바로 아래 칸(.bk)이 아니라서 맞추기와 끌기가 세지 않고, 손도 받지 않는다
 */
function fadeOut(area: HTMLElement, cell: HTMLElement, at: Box | undefined) {
  if (!at) return
  const shell = document.createElement('div')
  shell.className = 'bk-leaving'
  shell.setAttribute('aria-hidden', 'true')
  cell.classList.remove('is-selected')
  cell.getAnimations().forEach((a) => a.cancel())
  shell.appendChild(cell)
  area.appendChild(shell)
  // 사라지기 직전에 보이던 자리에 (움직이던 중이었으면 그 자리)
  const dx = at.x - cell.offsetLeft
  const dy = at.y - cell.offsetTop
  const out = cell.animate(
    [
      { translate: `${dx}px ${dy}px`, opacity: 1, scale: '1' },
      { translate: `${dx}px ${dy}px`, opacity: 0, scale: '0.97' },
    ],
    { duration: FLIP_MS * 0.6, easing: FLIP_EASING, fill: 'forwards' },
  )
  out.finished.then(
    () => shell.remove(),
    () => shell.remove(),
  )
}

function useFlip(area: React.RefObject<HTMLDivElement | null>, on: boolean, scope: string) {
  const before = useRef<Map<string, Box> | null>(null)
  // 칸마다 지난번에 맞춘 끝자리. 끝자리가 그대로면 움직이는 중이어도 그대로 둔다 (글자 하나 칠 때마다 움직임이 처음부터 다시 돌지 않게)
  const targets = useRef(new Map<string, Box>())
  // 지난번에 그린 칸 (빠진 칸을 사라지게 하려고)과 그때의 장. 다른 장으로 넘어가면 움직이지 않는다
  const nodes = useRef(new Map<string, HTMLElement>())
  const shown = useRef(scope)
  // 그리기 전에(아직 옛 모습일 때) 지금 보이는 자리를 재 둔다
  if (on && area.current) before.current = visualBoxes(area.current)
  useLayoutEffect(() => {
    const el = area.current
    const first = before.current
    before.current = null
    const cells = el ? Array.from(el.querySelectorAll<HTMLElement>(CELLS)) : []
    const was = nodes.current
    nodes.current = new Map(cells.map((c) => [c.dataset.block!, c]))
    const same = shown.current === scope
    shown.current = scope
    if (!on || !el || !first || !same || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      targets.current = new Map()
      return
    }
    was.forEach((cell, id) => {
      if (!nodes.current.has(id) && !cell.isConnected) fadeOut(el, cell, first.get(id))
    })
    const seen = new Map<string, Box>()
    for (const cell of cells) {
      const id = cell.dataset.block!
      const f = first.get(id)
      // 끝자리 (offset은 움직임의 translate를 세지 않는다)
      const last = { x: cell.offsetLeft, y: cell.offsetTop, w: cell.offsetWidth, h: cell.offsetHeight }
      seen.set(id, last)
      const prev = targets.current.get(id)
      if (prev && prev.x === last.x && prev.y === last.y && prev.w === last.w && prev.h === last.h) continue
      cell.getAnimations().forEach((a) => a.cancel())
      if (!f) {
        cell.animate([{ opacity: 0, scale: '0.96' }, { opacity: 1, scale: '1' }], { duration: FLIP_MS, easing: FLIP_EASING })
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
        { duration: FLIP_MS, easing: FLIP_EASING },
      )
    }
    targets.current = seen
  })
}

/** 받은 글꼴 수. 그 사이에 글꼴이 오면 글자 폭이 바뀌어 다시 맞춰야 한다 */
function loadedFonts(): number {
  let n = 0
  document.fonts?.forEach((f) => {
    if (f.status === 'loaded') n++
  })
  return n
}

/** 본문 상자 밖에서 맞추기에 닿는 것: 본문 상자의 크기, 장의 클래스(테마, 글꼴, 글자 크기, 바탕)와 스타일(색), 받은 글꼴 */
function outerSign(area: HTMLElement): string {
  const slide = area.closest('.slide')
  return `${area.clientWidth}x${area.clientHeight}|${slide?.className}|${slide?.getAttribute('style')}|${loadedFonts()}`
}

export function BlockArea() {
  const { slide, mode } = useSlide()
  const edit = useContext(BlockEditContext)
  const live = mode === 'edit' && edit ? edit : null
  // 발표할 때는 비워 둔 부품을 빼고 그린다 (옆 부품이 그 자리를 덮는다)
  const known = knownBlocks(slide.blocks ?? [])
  const saved = live?.blocks ?? (mode === 'final' ? shownBlocks(known) : known)
  // 이음표를 끄는 동안에는 놓일 자리에 흐리게 미리 세운다 (양쪽 부품이 비켜 나는 것까지)
  const blocks = live?.linkPreview ? withLink(saved, live.linkPreview.target, live.linkPreview.link) : saved
  const info = boardInfo(blocks)
  // 옆 이음표가 선 묶음: 이음표가 부품 가운데에 서니 묶음의 부품도 가운데에 (위에 붙이면 이음표만 아래에 떠 보인다)
  const linked = new Set(blocks.filter((b) => linkAt(blocks, { id: b.id, dir: 'h' })).map((b) => info.get(b.id)?.band))
  // 발표할 때 나오는 차례 (움직임 탭에서 정한 차례, 없으면 읽는 차례). 엔진이 칸의 data-seq로 읽는다
  const seq = new Map(playOrder({ blocks, options: slide.options }).map((b, i) => [b.id, i]))
  const ref = useRef<HTMLDivElement | null>(null)
  // 넘치는 부품 맞추기는 자리 옮기는 움직임(useFlip)이 끝자리를 재기 전에
  // 편집 화면이면 맞춘 뒤의 모습으로 부품마다 테두리 자리를 정한다 (blockFrame.ts)
  // 맞추기는 칸마다 글자 크기와 줄 사이를 바꿔 가며 몇 번씩 다시 재서 부품 장에서 가장 무거운 일이다. 예전에는 그릴 때마다,
  // 그리고 장을 열면 글꼴이 다 왔을 때와 크기 지켜보기의 첫 알림에 한 번씩 더, 같은 장을 세 번 맞췄다. 장 제목이나 발표자 노트를
  // 쓸 때도 글자마다 맞췄다. 본문 상자 안(부품, 글, 클래스)과 장의 클래스·스타일, 본문 상자의 크기, 받은 글꼴이 그대로면
  // 다시 맞춰도 같은 값이 나오므로(맞추기는 앞의 값을 지우고 처음부터 잰다) 건너뛴다. 안이 바뀐 것은 MutationObserver로 안다
  const watch = useRef<MutationObserver | null>(null)
  const changed = useRef(true)
  const fitted = useRef('')
  const fitAll = (el: HTMLElement, rendered: boolean) => {
    if (watch.current?.takeRecords().length) changed.current = true
    const outer = outerSign(el)
    if (outer === fitted.current) {
      if (!changed.current) return
      // 움직이는 동안(엔진이 data-mo-play를 붙인다) 안에서 바뀐 것은 엔진이 잠깐 바꾼 것(굴러가는 숫자, 나눈 낱말)이라 끝나면
      // 되돌아온다. 그릴 때 바뀐 것이면 그때의 맞추기가 움직임이 끝난 뒤로 미뤄 두었다(fitBlocks의 later). 그래서 글꼴 준비나
      // 크기 알림으로 불렸을 때는 건너뛴다. 예전에는 장을 넘길 때마다 움직임이 끝나면 같은 값으로 한 번 더 맞췄다
      if (!rendered && (el.closest('[data-mo-play]') || el.querySelector('[data-mo-play]'))) return
    }
    fitBlocks(el)
    frameCells(el)
    // 맞추며 바꾼 값(칸의 스타일, 이름표 자리)은 바뀐 것으로 세지 않는다. 지켜보지 못하면 늘 다시 맞춘다
    watch.current?.takeRecords()
    changed.current = !watch.current
    fitted.current = outer
  }
  // 맞추기보다 먼저 지켜보기 시작한다 (같은 컴포넌트의 layout effect는 적은 차례대로 돈다)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof MutationObserver === 'undefined') return
    const mo = new MutationObserver(() => {
      changed.current = true
    })
    mo.observe(el, { subtree: true, childList: true, characterData: true, attributes: true })
    watch.current = mo
    return () => {
      mo.disconnect()
      watch.current = null
      changed.current = true
    }
  }, [])
  useLayoutEffect(() => {
    if (ref.current) fitAll(ref.current, true)
  })
  useEffect(() => {
    let on = true
    const fit = () => on && ref.current && fitAll(ref.current, false)
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
  // 글을 쓰는 동안 붙잡아 둔 자리(fitBlocks.ts의 typing)는 이 본문 상자의 글 칸을 떠나면 놓는다: 다시 그려 맞추고, 옮길 칸은
  // 새 자리로 미끄러진다(useFlip). Enter나 Esc로 쓰기를 끝내면 바뀐 것이 없어 다시 그리지 않으니 여기서 부른다
  const [, release] = useReducer((n: number) => n + 1, 0)
  const editing = !!live
  useEffect(() => {
    const el = ref.current
    if (!el || !editing) return
    const out = () =>
      requestAnimationFrame(() => {
        if (!ref.current || ref.current.contains(document.activeElement)) return
        changed.current = true
        release()
      })
    el.addEventListener('focusout', out)
    return () => el.removeEventListener('focusout', out)
  }, [editing])
  useFlip(ref, !!live, slide.id)
  const setRef = (el: HTMLDivElement | null) => {
    ref.current = el
    live?.areaRef(el)
  }
  return (
    <div ref={setRef} className={cx('bk-area', live && 'is-live', live?.dragId && 'is-dragging', !blocks.length && 'is-empty')}>
      {!blocks.length && mode !== 'final' && (live ? live.empty() : <p className="bk-empty-t">컴포넌트를 골라 넣어 꾸미는 장이에요</p>)}
      {/* 끌거나 크기를 바꾸는 동안 판의 칸을 점으로 보여 준다 (부품이 붙는 자리) */}
      {live && blocks.length > 0 && <div className="bk-board" aria-hidden="true" />}
      {/* 읽는 차례로 그린다: 칸 사이를 Tab으로 옮겨 다니는 차례와 화면 읽기 차례가 보이는 차례와 같게 (넣은 차례로 그리면 왼쪽에 넣은 부품이 나중에 온다) */}
      {byReading(blocks).map((b) => (
        <BlockCell key={b.id} block={b} blocks={blocks} live={live} seq={seq.get(b.id)} band={info.get(b.id)} linked={(info.get(b.id)?.size ?? 1) > 1 && linked.has(info.get(b.id)?.band)} />
      ))}
      <Links blocks={blocks} live={live} />
      {live && !live.dragId && <Lines gutters={guttersOf(blocks)} blocks={blocks} live={live} />}
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
    </>
  )
}
