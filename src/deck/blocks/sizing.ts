// 칸 너비와 줄 높이: 부품마다 잰 높이, 남는 높이 나누기, CSS 격자 값, 본문 상자 높이 어림

import { BLOCK_HEIGHTS } from '../blockHeights'
import { FRAME, HEAD, TEXT_SCALE, TITLE_TRIM } from '../frame'
import { hintFor, logoColumns } from '../layouts'
import type { Block, BlockLook, BlockRow, BlockType, Slide } from '../types'
import { BLOCK_GROUPS, BLOCKS } from './catalog'
import { blockItems, mapBlock, membersOf, placeOf, variantOfBlock } from './cells'
import { LINK_PAD, linkAt } from './links'
import type { NoRoom } from './place'
import { BLOCK_COL_GAP, BLOCK_GAP, COMBOS, lookIssue, maxInRow, shownLook, withLook } from './rules'

/**
 * 이 부품이 들어갈 가장 좁은 칸. 로고 모음은 로고가 많을수록 넓어야 한다: 칸 너비를 로고 수로 나눠 쓰므로
 * 좁은 칸에 여럿이면 글자는 안 잘려도 로고 하나하나를 알아볼 수 없게 작아진다 (다섯 개부터 3분의 2, 아홉 개부터 한 줄)
 */
export function minSpanOf(block: Block): number {
  const base = BLOCKS[block.type].minSpan
  if (block.type !== 'logos') return base
  const n = block.items.length
  return Math.max(base, n > 8 ? 12 : n > 4 ? 8 : 6)
}

/** 칸이 들어갈 가장 좁은 너비: 쌓은 부품 가운데 가장 넓어야 하는 것 */
export const cellMinSpan = (cell: Block) => Math.max(...membersOf(cell).map(minSpanOf))

/** 이 너비에서 칸을 막는 부품: 그 너비보다 넓어야 하거나, 그 너비로는 높이가 아무리 높아도 잘리는 것. 다 들어가면 null */
export const cellBlocker = (cell: Block, span: number): Block | null => membersOf(cell).find((b) => span < minSpanOf(b) || blockMinH(b, span) >= NO_FIT) ?? null

// 그 너비로는 높이가 아무리 높아도 잘리는 부품(blockHeights.ts의 999)도 그 너비에 넣지 않는다
const fits = (cells: Block[], combo: number[]) => combo.every((s, i) => !cellBlocker(cells[i], s))
const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i])

/**
 * 이 부품들을 한 줄에 놓을 때의 칸 너비. 지금 너비가 맞으면 그대로, 아니면 넓어야 하는 부품에 넓은 칸을 준다.
 * 어떤 비율로도 들어가지 않으면 null (그 줄에는 넣을 수 없다)
 */
export function fitSpans(blocks: Block[], spans?: number[]): number[] | null {
  const combos = COMBOS[blocks.length]
  if (!combos || blocks.length > maxInRow(blocks)) return null
  if (spans && combos.some((c) => same(c, spans)) && fits(blocks, spans)) return spans
  let best: number[] | null = null
  let bestScore = -Infinity
  for (const c of combos) {
    if (!fits(blocks, c)) continue
    // 바라는 너비를 얼마나 채우는지가 먼저, 같으면 똑같이 나눈 쪽
    const score = c.reduce((n, s, i) => n + Math.min(s, cellPrefSpan(blocks[i])), 0) * 10 - (c.every((s) => s === c[0]) ? 0 : 1)
    if (score > bestScore) {
      best = c
      bestScore = score
    }
  }
  return best
}

/** 한 줄의 칸 너비: 저장된 값이 맞으면 그것, 아니면 알아서 */
export function spansOf(row: BlockRow): number[] {
  return fitSpans(row.blocks, row.spans) ?? row.blocks.map(() => 12 / Math.max(1, row.blocks.length))
}

/** 이 줄에서 고를 수 있는 칸 너비들 (칸 사이를 끌어 비율을 바꿀 때) */
export function spanChoices(row: BlockRow): number[][] {
  return (COMBOS[row.blocks.length] ?? []).filter((c) => fits(row.blocks, c))
}

/** 부품 장에서 나올 수 있는 칸 너비 (COMBOS에 있는 것) */
const SPANS = [3, 4, 6, 8, 12]
/** blockHeights.ts에서 그 너비로는 860px로도 안 되는 것 */
export const NO_FIT = 999

/**
 * 잘리지는 않아도 너무 낮으면 보기 나쁜 부품의 바닥 높이. 차트는 막대와 선이 납작해지고, 원과 그림은 띠처럼 작아진다.
 * 잰 높이(blockHeights.ts)는 '잘리지 않는' 높이라서 이것과 견줘 큰 쪽을 쓴다
 */
const FLOOR: Partial<Record<BlockType, (variant: string) => number>> = {
  // 세로 막대는 숫자와 이름 자리를 빼고 남는 높이가 막대라서, 낮으면 글은 멀쩡해도 막대가 거의 사라진다
  bars: (v) => (v === 'columns' ? 340 : 0),
  // 선 차트는 낮으면 선이 납작한 띠가 되고, 점 위아래의 숫자가 이름 줄로 내려앉는다
  versus: (v) => (v === 'lines' ? 420 : 360),
  bridge: () => 380,
  trend: () => 380,
  share: (v) => (v === 'donut' ? 380 : 320),
  ring: () => 220,
  ratio: () => 220,
  spark: () => 240,
  matrix: () => 380,
  // 점과 이름표가 판 위에 흩어져서, 낮으면 이름표끼리 비킬 자리가 없다 (편집할 때는 점수 줄까지 붙는다)
  position: () => 460,
  swot: () => 420,
  // 이미지는 낮으면 화면 캡처가 글씨를 알아볼 수 없는 작은 그림이 된다(설명 한 줄을 빼면 이미지는 220px 남짓)
  image: () => 280,
  // 겹친 원은 낮으면 안쪽 원(목표)이 점처럼 작아진다
  market: () => 340,
  // 세로 막대 차트: 숫자와 이름 자리를 빼고 남는 높이가 막대라서 낮으면 막대가 납작해진다
  pareto: () => 380,
  attain: () => 380,
  stack: () => 380,
  // 색 표는 낮으면 칸이 띠처럼 납작해져 색이 면으로 읽히지 않는다
  heat: () => 300,
  // 지표 흐름표는 낮으면 줄마다의 선이 납작한 줄이 되어 오르내림이 보이지 않는다
  sparks: () => 280,
}
/** 항목이 셋 이상인 부품: 칸이 이보다 낮으면 줄 사이가 붙어 빽빽해진다. 로고는 그림이라 빼고 */
const LIST_FLOOR = 240

/**
 * 선 차트는 한 줄을 다 쓰면(1680px) 바닥 높이를 이만큼 낮춘다. 납작해 보이는 것은 높이가 아니라 너비와 높이의
 * 비율이라, 넓은 칸에서는 낮아도 선의 오르내림이 보인다. 이 덕에 핵심 숫자 한 줄 아래에 추이 한 줄이 들어간다
 * (예전에는 편집 화면에서 장 높이를 18px 넘어 막혔다).
 * 막대 차트는 낮추지 않는다: 막대 위 숫자, 아래 이름과 증감 같은 글 자리는 너비와 상관없이 그대로라 낮춘 만큼이
 * 다 막대에서 빠진다(두 값 비교 아래 증감을 쌓으면 막대가 20px로 눌렸다). 원, 점 판, 네 칸은 높이가 곧 크기라 그대로
 */
const WIDE_CUT = 80
const lineChart = (type: BlockType, variant: string) => type === 'trend' || (type === 'versus' && variant === 'lines')

/** 로고 모음: 로고 판 한 줄이 150px는 되어야 로고를 알아본다. 그림은 칸에 맞춰 줄어서 글처럼 잘리지 않으니 잰 높이로는 모른다 */
const logoFloor = (n: number) => {
  const rows = Math.ceil(n / logoColumns(n))
  return rows * 150 + (rows - 1) * 20
}

/**
 * 부품을 이 너비(12칸 중 몇 칸)에 놓을 때 잘리지 않는 가장 낮은 칸 높이(캔버스 px).
 * 모양, 바탕(그대로 / 카드와 강조색 면), 항목 수, 너비마다 갤러리에서 잰 값(blockHeights.ts)에 보기 좋은 바닥을 더한다.
 * 줄 높이는 이보다 낮아지지 않고, 모두 합쳐 장에 들어가지 않으면 그 자리에는 넣지 않는다. 그 너비로 안 되면 NO_FIT 이상.
 */
export function blockMinH(block: Block, span: number): number {
  const spec = BLOCKS[block.type]
  const variant = variantOfBlock(block)
  const n = spec.items ? blockItems(block).length : 0
  // 그려지는 면으로 본다: 한 줄을 다 쓰는 너비(12)면 혼자인 줄이라 고른 면이 있어도 바탕 없이 그려진다 (shownLook)
  const table = BLOCK_HEIGHTS[`${block.type}.${variant}.${shownLook(block, span >= 12 ? 1 : 2) === 'plain' ? 'plain' : 'card'}`]
  // 잰 너비가 아니면 그보다 넓은 것 가운데 가장 가까운 것 (없으면 가장 넓은 것)
  const at = SPANS.find((x) => x >= span && table?.[x]) ?? [...SPANS].reverse().find((x) => table?.[x])
  const hs = at !== undefined ? table?.[at] : undefined
  // 아직 재지 않은 부품 (새로 만들고 갤러리에서 재기 전): 넉넉하게
  const measured = hs?.length ? hs[Math.min(n, hs.length - 1)] : 400
  if (measured >= NO_FIT) return measured
  const base = block.type === 'logos' ? logoFloor(n) : (FLOOR[block.type]?.(variant) ?? 0)
  const floor = span >= 12 && base && lineChart(block.type, variant) ? base - WIDE_CUT : base
  return Math.max(measured, floor, n >= 3 && block.type !== 'logos' ? LIST_FLOOR : 0)
}

/** 부품 고르기 그림처럼 놓일 너비를 모를 때: 보기 좋은 너비에 놓았을 때 */
export const blockPrefH = (block: Block) => blockMinH(block, BLOCKS[block.type].prefSpan)

/** 칸이 보기 좋은 너비: 쌓은 부품 가운데 가장 넓은 것 */
export const cellPrefSpan = (cell: Block) => Math.max(...membersOf(cell).map((b) => BLOCKS[b.type].prefSpan))

/** 칸 안에 쌓은 부품마다 가장 낮은 높이 (위에서부터) */
export const stackMins = (cell: Block, span: number) => membersOf(cell).map((b) => blockMinH(b, span))

/** 칸이 잘리지 않을 높이: 쌓은 부품마다의 가장 낮은 높이와 그 사이 간격 */
export function cellMinH(cell: Block, span: number, gap = BLOCK_GAP): number {
  const mins = stackMins(cell, span)
  return mins.reduce((a, h) => a + h, 0) + (mins.length - 1) * gap
}

/**
 * 칸 안에 쌓은 부품마다 남는 높이를 받는 몫: 높이를 받으면 커지는 부품(차트, 표)이 있으면 그것만 받고,
 * 없으면 모두 똑같이. 차트 아래 주석까지 높아지면 주석 칸 아래가 빈다. CSS(blocks.css의 .bk-stack > .bk)의 flex와 같다
 */
export function stackGrows(cell: Block): number[] {
  const s = membersOf(cell).map((b) => (STRETCHY.has(b.type) ? 1 : 0))
  return s.some(Boolean) ? s : s.map(() => 1)
}

/** 칸 높이(h)를 쌓은 부품마다 나눈 높이 (캔버스 px): 가장 낮은 높이에 남는 높이를 몫대로 더한다 */
export function stackHeights(cell: Block, span: number, h: number, gap = BLOCK_GAP): number[] {
  const mins = stackMins(cell, span)
  const grows = stackGrows(cell)
  const spare = Math.max(0, h - mins.reduce((a, m) => a + m, 0) - (mins.length - 1) * gap)
  const g = grows.reduce((a, x) => a + x, 0) || 1
  return mins.map((m, i) => m + (spare * grows[i]) / g)
}

export const rowMinH = (row: BlockRow) => {
  const spans = spansOf(row)
  return Math.max(0, ...row.blocks.map((b, i) => cellMinH(b, spans[i])))
}

/** 줄마다 잘리지 않을 높이. 줄 사이에 이음표가 서면 위아래 줄이 그만큼 비켜 주므로 그 몫을 더한다 */
export function rowNeeds(rows: BlockRow[]): number[] {
  return rows.map((r, i) => rowMinH(r) + (linkAt(rows, { dir: 'v', row: i }) ? LINK_PAD : 0) + (i > 0 && linkAt(rows, { dir: 'v', row: i - 1 }) ? LINK_PAD : 0))
}

/** 줄 높이 비중의 범위 (BlockRow.grow) */
export const GROW_MIN = 1
export const GROW_MAX = 100
export const isGrow = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= GROW_MIN && (v as number) <= GROW_MAX

/** 사람이 줄 높이를 정했는지: 줄이 둘 이상이고 모든 줄에 비중이 있을 때 */
export const weighted = (rows: BlockRow[]) => rows.length > 1 && rows.every((r) => isGrow(r.grow))

/** 줄 높이를 똑같이 나누던 대로 되돌린 줄들 */
export const unweighted = (rows: BlockRow[]): BlockRow[] => rows.map(({ grow: _, ...r }) => r)

/** 한 칸의 자리: 몇째 줄, 12칸 격자의 어디서부터 몇 칸 */
export interface CellBox {
  /** 칸의 맨 위 부품 */
  block: Block
  /** 칸에 쌓은 부품들 (맨 위 부품부터) */
  members: Block[]
  rowId: string
  row: number
  rows: number
  /** 줄 안에서 몇째 칸 */
  col: number
  cols: number
  start: number
  span: number
}

export function cellBoxes(rows: BlockRow[]): CellBox[] {
  const out: CellBox[] = []
  rows.forEach((row, r) => {
    const spans = spansOf(row)
    let start = 0
    row.blocks.forEach((block, c) => {
      out.push({ block, members: membersOf(block), rowId: row.id, row: r, rows: rows.length, col: c, cols: row.blocks.length, start, span: spans[c] })
      start += spans[c]
    })
  })
  return out
}

/**
 * 높이를 받으면 커지는 부품: 차트, 그림, 표처럼 칸 높이를 다 쓰는 것. 사람이 줄 높이를 정하지 않은 장에서는 남는 높이를
 * 이 부품이 든 줄끼리만 나눠 가진다(stretchRows). 글과 숫자는 높이를 더 받아도 칸 안이 빌 뿐이다
 */
const STRETCHY = new Set<BlockType>([
  ...(BLOCK_GROUPS.find((g) => g.short === '차트')?.types ?? []),
  'ring',
  'ratio',
  'spark',
  'gantt',
  'matrix',
  'position',
  'swot',
  'table',
  'image',
  'logos',
])

/**
 * 남는 높이를 나눠 가질 줄: 높이를 받으면 커지는 부품이 든 줄. 그런 줄이 없으면(글과 숫자뿐이면) 모든 줄.
 * 모든 줄에 똑같이 나누면 차트 위의 핵심 한 줄도 차트만큼 높아져서, 칸이 내용보다 훨씬 크게 잡히고 칸 안 위아래가 비었다
 */
export function stretchRows(rows: BlockRow[]): boolean[] {
  const s = rows.map((r) => r.blocks.some((c) => membersOf(c).some((b) => STRETCHY.has(b.type))))
  return s.some(Boolean) ? s : rows.map(() => true)
}

/**
 * 부품 장의 본문 상자: 12칸 격자. 줄마다 잘리지 않을 높이를 주고, 남는 높이는 나눠 가질 줄(stretchRows)에 더한다.
 * 모든 줄이 나눠 가지면 똑같이 나눠 더하고(minmax(최소, auto)를 격자가 늘린다), 차트·그림·표가 든 줄이 있으면
 * 그 줄끼리 똑같이 나누고(1fr) 글과 숫자의 줄은 잘리지 않을 높이 그대로 둔다.
 * 계산은 브라우저의 격자가 한다. 그래서 내보낸 HTML도 자바스크립트 없이 같은 자리에 그려진다.
 */
export function areaStyle(rows: BlockRow[]): Record<string, string> {
  // --bk-sq: 놓은 뒤에 내용이 늘어 줄들이 장보다 높아지면 slides/fitBlocks.ts가 줄 높이를 같은 비율로 낮춘다.
  // --bk-r1..: 그래도 글이 넘치는 줄은 fitBlocks가 남는 높이를 가져다 이 줄의 바닥을 올린다.
  // 사람이 줄 높이를 정했으면(weighted) 그 비중으로 나눈다(fr). 비중대로면 잘리는 줄은 격자가 잘리지 않을 높이로 묶고 나머지를 나눈다
  const w = weighted(rows)
  const needs = rowNeeds(rows)
  const stretch = stretchRows(rows)
  const some = !stretch.every(Boolean)
  return {
    gridTemplateRows: rows
      .map((r, i) => {
        const least = `max(calc(${needs[i]}px * var(--bk-sq, 1)), var(--bk-r${i + 1}, 0px))`
        if (w) return `minmax(${least}, ${r.grow}fr)`
        if (!some) return `minmax(${least}, auto)`
        return stretch[i] ? `minmax(${least}, 1fr)` : least
      })
      .join(' '),
  }
}

/** 줄마다 잘리지 않을 높이 (본문 상자의 data-mins. fitBlocks가 한 줄에 더 줄 수 있는 높이를 셀 때 쓴다) */
export const rowMins = (rows: BlockRow[]): string => rowNeeds(rows).map((h) => Math.round(h)).join(',')

export function cellStyle(b: CellBox): Record<string, string> {
  return { gridRow: String(b.row + 1), gridColumn: `${b.start + 1} / span ${b.span}` }
}

/**
 * 줄마다의 높이(px). 격자의 minmax(최소, auto)와 같은 계산이다: 줄마다 잘리지 않을 높이에 남는 높이를
 * 똑같이 나눠 더한다(남는 높이가 없으면 잘리지 않을 높이 그대로). 끌어다 놓는 동안 놓일 자리를 찾을 때 쓴다.
 */
export function rowHeights(rows: BlockRow[], areaH: number, gap = BLOCK_GAP): number[] {
  const free = areaH - Math.max(0, rows.length - 1) * gap
  const mins = rowNeeds(rows)
  const w = weighted(rows)
  const stretch = stretchRows(rows)
  if (w || !stretch.every(Boolean)) {
    // 격자의 fr 나누기와 같게: 비중대로 나누다 잘리지 않을 높이보다 낮아지는 줄은 그 높이로 묶고, 남은 줄끼리 다시 나눈다.
    // 비중이 없으면 나눠 가질 줄(stretchRows)이 1씩, 나머지 줄은 처음부터 잘리지 않을 높이로 묶는다
    const share = (i: number) => (w ? rows[i].grow! : 1)
    const fixed = new Set<number>(w ? [] : rows.map((_, i) => i).filter((i) => !stretch[i]))
    for (;;) {
      const left = free - [...fixed].reduce((a, i) => a + mins[i], 0)
      const g = rows.reduce((a, _, i) => a + (fixed.has(i) ? 0 : share(i)), 0)
      const unit = g ? Math.max(0, left) / g : 0
      const low = rows.map((_, i) => i).filter((i) => !fixed.has(i) && mins[i] > share(i) * unit)
      if (!low.length) return rows.map((_, i) => (fixed.has(i) ? mins[i] : share(i) * unit))
      low.forEach((i) => fixed.add(i))
    }
  }
  const spare = Math.max(0, free - mins.reduce((a, m) => a + m, 0))
  return mins.map((m) => m + (rows.length ? spare / rows.length : 0))
}

/**
 * 줄 사이(between째 줄과 그 아래 줄)를 끌어 둘의 높이를 나눈 비중. 두 줄 높이의 합은 그대로 두고,
 * 위 줄이 차지하는 몫(part, 0~1)을 24분의 1에 붙인 뒤 잘리지 않을 높이 안으로 줄인다.
 * heights는 지금 그려진 줄 높이(px). 모든 줄의 비중을 높이의 백분율로 돌려준다
 */
export function growAt(rows: BlockRow[], heights: number[], between: number, part: number): number[] {
  const pair = heights[between] + heights[between + 1]
  const needs = rowNeeds(rows)
  const lo = needs[between] / pair
  const hi = 1 - needs[between + 1] / pair
  const snapped = Math.round(part * 24) / 24
  const f = lo > hi ? heights[between] / pair : Math.min(hi, Math.max(lo, snapped))
  const hs = heights.map((h, i) => (i === between ? pair * f : i === between + 1 ? pair * (1 - f) : h))
  const total = hs.reduce((a, h) => a + h, 0) || 1
  return hs.map((h) => Math.min(GROW_MAX, Math.max(GROW_MIN, Math.round((h / total) * 100))))
}

/** 줄들을 잘리지 않게 놓는 데 드는 높이: 줄마다 가장 낮은 높이와 줄 사이 */
export function needH(rows: BlockRow[], gap = BLOCK_GAP): number {
  return rowNeeds(rows).reduce((a, h) => a + h, 0) + Math.max(0, rows.length - 1) * gap
}

/** 모든 줄이 잘리지 않고 장에 들어가는지 */
export function fitsHeight(rows: BlockRow[], areaH: number, gap = BLOCK_GAP): boolean {
  return needH(rows, gap) <= areaH + 1
}

/** 부품 하나를 바꾼 줄들. 바뀐 부품이 지금 너비에 들어가지 않으면 그 줄의 너비를 다시 고른다 (놓을 때와 같은 규칙) */
export function changeRows(rows: BlockRow[], blockId: string, fn: (b: Block) => Block): BlockRow[] {
  const at = placeOf(rows, blockId)
  if (!at) return rows
  return mapBlock(rows, blockId, fn).map((r, i) => (i === at.row ? { ...r, spans: fitSpans(r.blocks, r.spans) ?? r.spans } : r))
}

/** 부품 하나를 바꾸면(항목 더하기, 모양이나 바탕 바꾸기) 장에 들어가지 않을 때 그 까닭. 들어가면 null */
export function changeIssue(rows: BlockRow[], blockId: string, fn: (b: Block) => Block, areaH: number): NoRoom | null {
  const next = changeRows(rows, blockId, fn)
  return fitsHeight(next, areaH) ? null : { kind: 'height', need: Math.round(needH(next)), room: Math.round(areaH) }
}

/**
 * 면을 이것으로 바꿀 수 없는 까닭: 면의 규칙(lookIssue), 그리고 같은 줄이 함께 바뀐 뒤(withLook)에도 장에 들어가는지.
 * 옅은 면은 안쪽 여백만큼 높아져서, 고른 부품만 보면 옆 부품까지 바뀌어 넘치는 것을 놓친다
 */
export function lookChangeIssue(rows: BlockRow[], blockId: string, look: BlockLook, areaH?: number): NoRoom | null {
  const why = lookIssue(rows, blockId, look)
  if (why || areaH === undefined) return why
  const next = withLook(rows, blockId, look)
  return fitsHeight(next, areaH) ? null : { kind: 'height', need: Math.round(needH(next)), room: Math.round(areaH) }
}

/** 부품 하나를 바꿔도(항목 더하기, 모양 바꾸기) 모든 줄이 장에 들어가는지 */
export function fitsWith(rows: BlockRow[], blockId: string, fn: (b: Block) => Block, areaH: number): boolean {
  return !changeIssue(rows, blockId, fn, areaH)
}

/** 글자 하나의 평균 너비(글자 크기의 몫). 한글과 띄어쓰기를 섞은 제목을 재어 정한 값이다 */
const EM_PER_CHAR = 0.67

/** 이 크기의 글이 이 너비에서 몇 줄인지 */
const lineCount = (text: string, fs: number, width: number) => Math.max(1, Math.ceil(([...text].length * EM_PER_CHAR * fs) / width))

/**
 * 부품 장 본문 상자의 높이 어림 (발표 화면 기준: 비운 제목과 부제는 자리를 차지하지 않는다. edit면 편집 화면 기준).
 * 슬라이드가 그려져 있지 않아 잴 수 없을 때(문서 보기, 시험) 쓴다. 제목은 길이에 따라 글자가 작아지고(fields.tsx의 fit, 24자와 40자)
 * 머리 너비(HEAD.titleW)를 넘으면 줄이 바뀐다. 부제 너비, 제목과 부제 사이, 머리 아래 FRAME.gap도 틀(frame.ts)의 값이다. 발표 설정(글자 크기, 보내는 자료)도 본다.
 * 장의 틀(frame.ts)에서 제목은 글자 윗선을 맞추느라 조금 올라간다
 */
export function composeAreaH(slide: Slide, look?: { meta?: { method?: string }; theme?: { size?: string } }, edit?: boolean): number {
  // 편집 화면은 비운 제목에도 안내를 보여서 그만큼 본문이 낮다. 비운 부제의 안내는 제목 아래 여백 위에 겹쳐 두어
  // 자리를 밀지 않는다(edit.css)
  const title = slide.fields.title?.trim() || (edit ? hintFor('compose', slide.hints ?? {}, 'title') : '')
  const lead = slide.fields.lead?.trim() ?? ''
  const type = look?.meta?.method === 'send' ? HEAD.read : HEAD.present
  const scale = look?.theme?.size === 'small' ? TEXT_SCALE.small : look?.theme?.size === 'large' ? TEXT_SCALE.large : 1
  const n = [...title].length
  const tfs = type.title * scale * (n > 40 ? 0.7 : n > 24 ? 0.84 : 1)
  const lfs = type.lead * scale
  const titleH = title ? lineCount(title, tfs, HEAD.titleW) * tfs * HEAD.titleLine : 0
  const leadH = lead ? lineCount(lead, lfs, HEAD.leadW) * lfs * HEAD.leadLine : 0
  const head = titleH - (title ? tfs * TITLE_TRIM : 0) + leadH + (title && lead ? HEAD.between : 0)
  return Math.floor(1080 - FRAME.y - FRAME.bottom - (head ? head + FRAME.gap : 0))
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 칸마다의 자리를 px로 (본문 상자 크기 기준). 맨 위 부품의 id로 찾는다 (쌓은 칸이면 칸 전체) */
export function boxRects(rows: BlockRow[], size: { w: number; h: number }, gap = BLOCK_GAP): Map<string, Rect> {
  const colW = (size.w - 11 * BLOCK_COL_GAP) / 12
  const heights = rowHeights(rows, size.h, gap)
  const tops = heights.map((_, i) => heights.slice(0, i).reduce((a, h) => a + h + gap, 0))
  const out = new Map<string, Rect>()
  for (const b of cellBoxes(rows)) {
    out.set(b.block.id, { x: b.start * (colW + BLOCK_COL_GAP), y: tops[b.row], w: b.span * colW + (b.span - 1) * BLOCK_COL_GAP, h: heights[b.row] })
  }
  return out
}

/** 부품마다의 자리를 px로 (본문 상자 크기 기준). 부품 id로 찾는다. 쌓은 부품은 칸 높이를 나눠 가진 자리 (stackHeights) */
export function cellRects(rows: BlockRow[], size: { w: number; h: number }, gap = BLOCK_GAP): Map<string, Rect> {
  const boxes = boxRects(rows, size, gap)
  const out = new Map<string, Rect>()
  for (const b of cellBoxes(rows)) {
    const r = boxes.get(b.block.id)!
    if (b.members.length === 1) {
      out.set(b.block.id, r)
      continue
    }
    let y = r.y
    stackHeights(b.block, b.span, r.h, gap).forEach((h, i) => {
      out.set(b.members[i].id, { x: r.x, y, w: r.w, h })
      y += h + gap
    })
  }
  return out
}
