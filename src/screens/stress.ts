import { autoPlace, BLOCKS, BLOCK_TYPES, BOARD_COLS, BOARD_ROWS, boardFit, composeAreaH } from '../deck/blocks'
import { sampleBlock } from '../deck/blockSamples'
import { makeSlide } from '../deck/generate'
import type { Block, BlockLook, BlockType, Slide } from '../deck/types'
import { blockDrawn, blockTextLines } from '../slides/fitBlocks'
import { checkAssembly } from './assembly'
import { innerProblems } from './comboChecks'

/*
 * 개발용: 부품 하나를 항목 수, 칸 너비, 칸 높이마다 늘어놓고 사이와 짜임을 숫자로 재는 시험.
 *   #/gallery?set=stress&type=bullets            → 콘솔에서 await checkStress()
 *   &bv=list, &bl=card 로 모양과 바탕을 고른다. &type=many 는 부품 하나부터 여섯까지 차례로 넣은 장.
 * 항목이 늘 때 항목 사이가 고르게 좁아지는지(벌어지거나 짓눌리지 않는지), 좁은 칸에서 줄이는 대신 짜임을 바꾸는지
 * (여러 단을 하나로, 옆으로 눕힌 것을 쌓기로), 칸 안이 비거나 한쪽에 몰리는지를 본다. 같은 칸에서 항목 수만 다른 장끼리
 * 견주어 한 개 더할 때 짜임이 갑자기 튀는 곳(단 수, 글자 크기, 사이)도 잡는다.
 * 편집기가 넣지 않는 자리(잘리지 않는 높이보다 낮은 칸)는 그리지 않는다. 내용은 모두 예시 부품의 지어낸 것이다
 */

/** 칸 너비 (12 기준). 편집기가 고를 수 있는 너비 */
const SPANS = [3, 4, 6, 8, 12]

/** 장 하나의 이름. 부제에 적어 두고 checkStress가 읽는다 */
type Case = { type: BlockType; n: number; span: number; rows: number; kind: Kind }
/** 칸 높이의 단계: 편집기가 허락하는 가장 낮은 높이, 판의 반, 판 전체 */
type Kind = 'low' | 'mid' | 'full'
const label = (c: Case) => `${c.type} n=${c.n} w=${c.span} h=${c.rows} ${c.kind}`

function withCount(b: Block, n: number, id: string): Block {
  if (!n || !b.items.length) return { ...b, id }
  return { ...b, id, items: Array.from({ length: n }, (_, i) => ({ ...b.items[i % b.items.length], id: `${id}-it${i}` })) }
}

/** 부품 하나: 항목 수 × 칸 너비 × 칸 높이(가장 낮게, 반, 판 전체). 옆과 아래는 바탕 없는 짧은 글 칸으로 채운다 */
function oneType(type: BlockType, variant?: string | null, look?: string | null): Slide[] {
  const spec = BLOCKS[type]
  const sample = sampleBlock(type)
  const counts = spec.items ? Array.from({ length: spec.items.max - spec.items.min + 1 }, (_, i) => spec.items!.min + i) : [0]
  const out: Slide[] = []
  for (const n of counts)
    for (const span of SPANS) {
      const base: Slide = { ...makeSlide('compose'), fields: { title: '항목 수와 칸 크기를 바꿔 본 장', lead: '' } }
      const fit = boardFit(composeAreaH(base))
      const b: Block = {
        ...withCount(sample, n, `st-${type}-${n}-${span}`),
        ...(variant && spec.variants?.some((v) => v.id === variant) ? { variant } : {}),
        ...(look ? { look: look as BlockLook } : {}),
      }
      if (span < fit.minW(b)) continue
      const low = fit.minH(b, span)
      if (!Number.isFinite(low) || low > BOARD_ROWS) continue
      const kinds = new Map<number, Kind>()
      for (const [rows, kind] of [[BOARD_ROWS, 'full'], [Math.max(low, 6), 'mid'], [low, 'low']] as const) kinds.set(rows, kind)
      for (const [rows, kind] of kinds) {
        const c: Case = { type, n, span, rows, kind }
        const target = { ...b, id: `${b.id}-${rows}`, at: { x: 0, y: 0, w: span, h: rows } }
        const blocks: Block[] = [target]
        const filler = (id: string, at: Block['at']): Block => ({ ...sampleBlock('note'), id: `st-fill-${id}-${b.id}-${rows}`, look: 'plain', at })
        if (span < BOARD_COLS) blocks.push(filler('r', { x: span, y: 0, w: BOARD_COLS - span, h: rows }))
        if (rows < BOARD_ROWS) blocks.push(filler('b', { x: 0, y: rows, w: BOARD_COLS, h: BOARD_ROWS - rows }))
        out.push({ ...base, id: `st-${label(c).replace(/[ =]/g, '-')}`, fields: { ...base.fields, lead: label(c) }, blocks })
      }
    }
  return out
}

/** 부품 장에 하나부터 여섯까지: 편집기의 '넣기'처럼 autoPlace로 차례대로 넣는다 */
const MANY: BlockType[][] = [
  ['message', 'number', 'number', 'bullets', 'trend', 'callout'],
  ['heading', 'text', 'text', 'text', 'stat', 'stat'],
  ['number', 'delta', 'goal', 'ring', 'bars', 'bullets'],
  ['quote', 'people', 'checks', 'steps', 'note', 'status'],
]

function many(): Slide[] {
  return MANY.flatMap((types, s) =>
    types.map((_, upto) => {
      const base: Slide = { ...makeSlide('compose'), id: `st-many-${s}-${upto + 1}`, fields: { title: '컴포넌트를 하나씩 더한 장', lead: `many ${s} k=${upto + 1}` } }
      const areaH = composeAreaH(base, undefined, true)
      let blocks: Block[] = []
      types.slice(0, upto + 1).forEach((t, i) => {
        blocks = autoPlace(blocks, { ...sampleBlock(t), id: `st-many-${s}-${upto}-${i}` }, areaH) ?? blocks
      })
      return { ...base, blocks }
    }),
  )
}

export function stressSlides(type: string | null, variant?: string | null, look?: string | null): Slide[] {
  if (type === 'many') return many()
  const types = type ? (type.split(',').filter((t) => BLOCK_TYPES.includes(t as BlockType)) as BlockType[]) : BLOCK_TYPES
  return types.flatMap((t) => oneType(t, variant, look))
}

type Box = { t: number; b: number; l: number; r: number }

/** 같은 값(4px 안)끼리 모은 수: 단의 수, 줄의 수 */
const clusters = (vs: number[], tol = 4) => {
  const s = [...vs].sort((a, b) => a - b)
  return s.filter((v, i) => i === 0 || v - s[i - 1] > tol).length
}

export interface StressRow {
  id: string
  type: BlockType
  n: number
  span: number
  rows: number
  kind: Kind
  /** 칸 크기 (캔버스 px) */
  w: number
  h: number
  /** 맞추기가 정한 글자 비율과 줄 사이 */
  fit: number
  air: number
  /** 항목 글의 글자 크기 (첫 항목의 가장 큰 글) */
  fs: number
  cols: number
  lines: number
  /** 같은 단에서 위아래로 이웃한 항목 사이 (가장 좁게, 가장 넓게) */
  gapMin: number
  gapMax: number
  /** 옆으로 이웃한 항목 사이 */
  colGap: number
  /** 칸 안 그려진 것의 위아래 빈 몫 */
  top: number
  bottom: number
  /** 그려진 것의 가로 폭이 칸 너비의 몇 분의 몇인지 */
  inkW: number
  problems: string[]
}

/** 장 하나의 시험 칸을 잰다 (캔버스 px) */
function measureCell(cell: HTMLElement, c: Case): StressRow | null {
  const inner = cell.querySelector<HTMLElement>(':scope > .bk-in')
  if (!inner) return null
  const r = cell.getBoundingClientRect()
  const k = r.width / cell.offsetWidth
  const items = [...inner.querySelectorAll<HTMLElement>('.it')].filter((el) => !el.parentElement?.closest('.it') && el.offsetWidth)
  const boxes: Box[] = items.map((el) => {
    const q = el.getBoundingClientRect()
    return { t: (q.top - r.top) / k, b: (q.bottom - r.top) / k, l: (q.left - r.left) / k, r: (q.right - r.left) / k }
  })
  // 같은 단: 왼쪽이 같은 것. 단마다 위에서 아래로 이웃한 사이
  const gaps: number[] = []
  const colGaps: number[] = []
  boxes.forEach((p, i) =>
    boxes.forEach((q, j) => {
      if (i === j) return
      const sameCol = Math.min(p.r, q.r) - Math.max(p.l, q.l) > 4
      const sameRow = Math.min(p.b, q.b) - Math.max(p.t, q.t) > 4
      if (sameCol && q.t >= p.b - 1 && !boxes.some((x, m) => m !== i && m !== j && x.t >= p.b - 1 && x.b <= q.t + 1 && Math.min(x.r, p.r) - Math.max(x.l, p.l) > 4)) gaps.push(q.t - p.b)
      if (sameRow && q.l >= p.r - 1 && !boxes.some((x, m) => m !== i && m !== j && x.l >= p.r - 1 && x.r <= q.l + 1 && Math.min(x.b, p.b) - Math.max(x.t, p.t) > 4)) colGaps.push(q.l - p.r)
    }),
  )
  const ls = blockTextLines(inner)
  let fs = 0
  for (const q of items[0] ? blockTextLines(items[0]) : ls.slice(0, 3)) fs = Math.max(fs, parseFloat(getComputedStyle(q.n.parentElement!).fontSize) || 0)
  const ink = blockDrawn(cell)
  let il = Infinity
  let ir = -Infinity
  for (const q of ls) {
    il = Math.min(il, q.l)
    ir = Math.max(ir, q.r)
  }
  for (const f of inner.querySelectorAll('svg')) {
    if (f.parentElement?.closest('svg')) continue
    const q = f.getBoundingClientRect()
    if (!q.width) continue
    il = Math.min(il, q.left)
    ir = Math.max(ir, q.right)
  }
  // 면이 있는 칸은 칸이 곧 그려진 것이라 면 안의 글로 위아래 빈 몫을 본다
  let top = 0
  let bottom = 0
  if (cell.classList.contains('bk-look-plain')) {
    top = ink ? (ink.t - r.top) / k : 0
    bottom = ink ? (r.bottom - ink.b) / k : 0
  } else if (ls.length) {
    top = (Math.min(...ls.map((q) => q.t)) - r.top) / k
    bottom = (r.bottom - Math.max(...ls.map((q) => q.b))) / k
  }
  const round = (v: number) => Math.round(v)
  return {
    id: cell.dataset.block ?? '',
    ...c,
    w: round(cell.offsetWidth),
    h: round(cell.offsetHeight),
    fit: Number(cell.style.getPropertyValue('--bk-fit') || 1),
    air: parseFloat(cell.style.getPropertyValue('--bk-air')) || 0,
    fs: round(fs),
    cols: clusters(boxes.map((x) => x.l)),
    lines: clusters(boxes.map((x) => x.t)),
    gapMin: gaps.length ? round(Math.min(...gaps)) : -1,
    gapMax: gaps.length ? round(Math.max(...gaps)) : -1,
    colGap: colGaps.length ? round(Math.min(...colGaps)) : -1,
    top: round(top),
    bottom: round(bottom),
    inkW: il < ir ? Math.round(((ir - il) / r.width) * 100) / 100 : 0,
    problems: innerProblems(cell, { covered: false }),
  }
}

/** 이웃한 항목 수끼리 견주어 튀는 곳: 같은 칸(너비, 높이 단계)에서 항목 하나를 더했을 때 */
function jumps(rows: StressRow[]): string[] {
  const out: string[] = []
  const key = (x: StressRow) => `${x.type} w=${x.span} ${x.kind}`
  const byKey = new Map<string, StressRow[]>()
  for (const x of rows) byKey.set(key(x), (byKey.get(key(x)) ?? []).concat(x))
  byKey.forEach((xs, k) => {
    xs.sort((a, b) => a.n - b.n)
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1]
      const b = xs[i]
      // 항목이 늘었는데 사이가 1.5배 넘게 벌어지면 튀어 보인다 (줄 사이를 넓혀 채우는 것은 항목이 적을 때 넓고 많을 때 좁아야 한다)
      if (a.gapMax > 0 && b.gapMax > 0 && b.gapMax > a.gapMax * 1.5 + 8) out.push(`${k}: 항목 ${a.n}→${b.n}에 사이가 ${a.gapMax}→${b.gapMax}로 벌어져요`)
      if (a.fs && b.fs && b.fs > a.fs * 1.1) out.push(`${k}: 항목 ${a.n}→${b.n}에 글자가 ${a.fs}→${b.fs}로 커져요`)
      if (a.fs && b.fs && b.fs < a.fs / 1.45) out.push(`${k}: 항목 ${a.n}→${b.n}에 글자가 ${a.fs}→${b.fs}로 두 단계 넘게 작아져요`)
    }
  })
  return out
}

/** 너비를 다 쓰지 않는 것이 맞는 짧은 컴포넌트 */
const SHORT = new Set(['status', 'date', 'heading', 'note'])

/** 한 칸 안의 사이가 어색한 것 */
function oddities(x: StressRow): string[] {
  const out: string[] = []
  const what = `${label(x)} ${x.w}×${x.h}`
  // 항목 사이가 글자 크기의 3배 넘게 벌어지면 항목끼리 따로 떨어져 보인다
  if (x.gapMax > 0 && x.fs && x.gapMax > Math.max(x.fs * 3, 96)) out.push(`${what}: 항목 사이가 ${x.gapMax}px로 벌어져요(글자 ${x.fs})`)
  // 같은 단의 사이가 고르지 않다
  if (x.gapMin >= 0 && x.gapMax - x.gapMin > Math.max(16, x.gapMin)) out.push(`${what}: 항목 사이가 ${x.gapMin}~${x.gapMax}px로 고르지 않아요`)
  // 그려진 것이 칸 너비의 절반도 안 쓰는 넓은 칸 (8칸 넘게): 짜임을 눕히거나 여러 단으로 흘려야 할 자리
  // 짧은 컴포넌트(상태, 날짜, 소제목, 주석)는 넓은 칸에서도 덧붙임을 글 옆이나 아래에 붙여 왼쪽에 모은다(docs/VISUAL-RULES.md 6의 가로:
  // 양 끝으로 찢지 않는다). 칸 너비를 다 쓰라고 하면 그 규칙과 거꾸로라 뺀다
  if (x.span >= 8 && x.inkW > 0 && x.inkW < 0.5 && !SHORT.has(x.type)) out.push(`${what}: 그려진 것이 칸 너비의 ${Math.round(x.inkW * 100)}%만 써요`)
  for (const p of x.problems) out.push(`${what}: ${p}`)
  return out
}

/** 그려진 시험 장마다 재고, 어색한 곳을 모은다. rows는 장마다 잰 값 (console.table로 본다) */
export async function checkStress(): Promise<{ rows: StressRow[]; problems: string[]; assembly: string[] }> {
  await document.fonts.ready
  await new Promise((r) => setTimeout(r, 300))
  const rows: StressRow[] = []
  for (const slide of document.querySelectorAll<HTMLElement>('.slide')) {
    const lead = slide.querySelector('.s-lead')?.textContent ?? ''
    const m = /^(\S+) n=(\d+) w=(\d+) h=(\d+) (low|mid|full)$/.exec(lead.trim())
    if (!m) continue
    const c: Case = { type: m[1] as BlockType, n: Number(m[2]), span: Number(m[3]), rows: Number(m[4]), kind: m[5] as Kind }
    const cell = [...slide.querySelectorAll<HTMLElement>('.bk-area > .bk')].find((el) => !(el.dataset.block ?? '').startsWith('st-fill-'))
    const row = cell && measureCell(cell, c)
    if (row) rows.push(row)
  }
  const problems = [...rows.flatMap(oddities), ...jumps(rows)]
  const assembly = (await checkAssembly()).problems
  return { rows, problems, assembly }
}
