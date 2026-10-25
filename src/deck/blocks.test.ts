import { BLOCK_HEIGHTS } from './blockHeights'
import { describe, expect, it } from 'vitest'
import {
  BLOCK_GAP,
  areaStyle,
  allBlocks,
  autoTarget,
  BLOCK_GROUPS,
  BLOCK_TYPES,
  BLOCKS,
  blockCount,
  blockMinH,
  blockMissing,
  blockNames,
  canCompose,
  cleanRows,
  composeAreaH,
  composeFrom,
  dropTarget,
  fitImage,
  imageTarget,
  fitSpans,
  fitsHeight,
  fitsWith,
  insertAt,
  isSolo,
  LINK_PAD,
  linkAt,
  linkTargets,
  needH,
  placeIssue,
  tidyLinks,
  withLink,
  lookIssue,
  lookOf,
  makeBlock,
  MAX_BLOCKS,
  minSpanOf,
  MAX_IN_ROW,
  MAX_ROWS,
  removeBlock,
  rowHeights,
  stretchRows,
  shownRows,
  growAt,
  unweighted,
  weighted,
  shownLook,
  slideName,
  spanChoices,
  spansAt,
  spanLimit,
  spansOf,
  targetOf,
  unwrapCompose,
  validTargets,
  whyNot,
  withItem,
  withLook,
} from './blocks'
import { sampleBlock } from './blockSamples'
import { followIndex, moveIn } from './fields'
import { FRAME } from './frame'
import { makeSlide } from './generate'
import { LAYOUT_ORDER } from './layouts'
import { showcaseSlides } from './showcase'
import type { Block, BlockRow, Slide } from './types'

const row = (...blocks: Block[]): BlockRow => ({ id: `r-${blocks.map((b) => b.id).join('-')}`, blocks })
const block = (type: Block['type'], id: string = type): Block => ({ ...makeBlock(type), id })

/** 장에 사람이 적은 글을 모두 모은다 (칸, 항목) */
function texts(slide: Slide): string[] {
  const out = Object.values(slide.fields).filter((v) => v.trim())
  for (const it of slide.items) for (const k of ['title', 'body', 'value', 'meta', 'image'] as const) if (it[k].trim()) out.push(it[k])
  for (const b of allBlocks(slide.rows ?? [])) {
    out.push(...Object.values(b.fields).filter((v) => v.trim()))
    for (const it of b.items) for (const k of ['title', 'body', 'value', 'meta', 'image'] as const) if (it[k].trim()) out.push(it[k])
  }
  return out.sort()
}

describe('부품 목록', () => {
  it('부품 고르기 묶음에 모든 부품이 한 번씩 있다', () => {
    const listed = BLOCK_GROUPS.flatMap((g) => g.types)
    expect(new Set(listed).size).toBe(listed.length)
    expect([...listed].sort()).toEqual([...BLOCK_TYPES].sort())
  })

  it('부품마다 예시가 있고 정한 너비 안에서 고를 수 있다', () => {
    for (const type of BLOCK_TYPES) {
      const spec = BLOCKS[type]
      expect(sampleBlock(type).type).toBe(type)
      expect(spec.minSpan).toBeLessThanOrEqual(spec.prefSpan)
      expect(spec.prefSpan).toBeLessThanOrEqual(12)
      expect(blockMinH(makeBlock(type), spec.prefSpan)).toBeGreaterThan(0)
    }
  })

  it('모든 부품의 모든 모양, 바탕, 항목 수, 너비를 쟀다 (blockHeights.ts)', () => {
    // 새 부품이나 모양을 만들면 갤러리에서 measureAll()로 다시 재야 한다
    for (const type of BLOCK_TYPES) {
      const spec = BLOCKS[type]
      for (const v of spec.variants?.map((x) => x.id) ?? ['base']) {
        for (const look of ['plain', 'card']) {
          const t = BLOCK_HEIGHTS[`${type}.${v}.${look}`]
          expect(t, `${type}.${v}.${look}`).toBeDefined()
          for (const span of [3, 4, 6, 8, 12].filter((x) => x >= spec.minSpan)) {
            expect(t?.[span]?.length, `${type}.${v}.${look} 너비 ${span}`).toBe((spec.items?.max ?? 0) + 1)
          }
        }
      }
      // 어느 부품이든 가장 넓게 놓으면 들어간다
      expect(blockMinH(makeBlock(type), 12), type).toBeLessThan(700)
    }
  })
})

describe('장을 부품 장으로', () => {
  it('바꿀 수 있는 모든 장에서 적은 글이 하나도 빠지지 않는다', () => {
    const slides = showcaseSlides().filter((s) => canCompose(s.layout))
    const layouts = new Set(slides.map((s) => s.layout))
    // 표지와 단락, 부품 장 말고는 모두 예시가 있어야 확인이 된다
    for (const id of LAYOUT_ORDER) if (canCompose(id)) expect(layouts.has(id)).toBe(true)
    for (const s of slides) {
      const composed = composeFrom(s)
      expect(composed.layout).toBe('compose')
      expect(texts(composed)).toEqual(texts({ ...s, items: s.items.slice(0, 20) }))
      expect(blockCount(composed.rows ?? [])).toBeLessThanOrEqual(MAX_BLOCKS)
    }
  })

  it('레이아웃 부품 하나뿐이면 원래 레이아웃으로 그대로 되돌아간다', () => {
    for (const s of showcaseSlides().filter((x) => canCompose(x.layout))) {
      const composed = composeFrom(s)
      const blocks = allBlocks(composed.rows ?? [])
      if (blocks.length !== 1 || blocks[0].type !== s.layout) continue
      const back = unwrapCompose(composed, s.layout)!
      expect(back.layout).toBe(s.layout)
      expect(texts(back)).toEqual(texts(s))
      expect(back.variant).toBe(s.variant)
    }
  })

  it('표지와 단락 장은 부품 장으로 바꾸지 않는다', () => {
    expect(canCompose('cover')).toBe(false)
    expect(canCompose('section')).toBe(false)
    expect(canCompose('compose')).toBe(false)
  })
})

describe('자리 정하기', () => {
  it('줄의 칸 너비는 늘 정해진 비율이고, 부품마다 가장 좁은 너비를 지킨다', () => {
    for (const a of BLOCK_TYPES)
      for (const b of BLOCK_TYPES) {
        const blocks = [block(a, 'a'), block(b, 'b')]
        const spans = fitSpans(blocks)
        if (!spans) {
          expect(minSpanOf(blocks[0]) + minSpanOf(blocks[1])).toBeGreaterThan(12)
          continue
        }
        expect(spans.reduce((x, y) => x + y, 0)).toBe(12)
        spans.forEach((sp, i) => expect(sp).toBeGreaterThanOrEqual(minSpanOf(blocks[i])))
      }
  })

  it('넣고 빼면 원래대로', () => {
    const rows = [row(block('number', 'n'), block('callout', 'c'))]
    const t = autoTarget(rows, block('bullets', 'b'))!
    const added = insertAt(rows, t, block('bullets', 'b'))!
    expect(blockCount(added)).toBe(3)
    const back = removeBlock(added, 'b')
    expect(back.map((r) => r.blocks.map((b) => b.id))).toEqual([['n', 'c']])
    expect(targetOf(added, 'b')).not.toBeNull()
  })

  it('눌러서 넣으면 새 줄이 들어가지 않을 때 마지막 줄 끝에 붙는다', () => {
    // 원 두 개 줄(250) + 간격 + 새 줄(240)이 넘치는 낮은 본문
    const areaH = 450
    const rows = [row(block('ring', 'r'), block('ratio', 'q'))]
    const t = autoTarget(rows, block('spark', 's'), areaH)
    expect(t).toEqual({ kind: 'cell', row: 0, index: 2 })
  })

  it('장 추가로 만든 컴포넌트 장은 넣은 컴포넌트 이름으로 부른다', () => {
    const s = { ...makeSlide('compose'), rows: [row(block('kpi', 'k')), row(block('trend', 't'), block('callout', 'c'), block('kpi', 'k2'))] }
    expect(slideName(s)).toBe('핵심 숫자, 추이 외 1')
    expect(slideName({ ...s, rows: [row(block('kpi', 'k'))] })).toBe('핵심 숫자')
    // 보고 종류가 정해 준 이름과 빈 장은 그대로
    expect(slideName({ ...s, purpose: '주요 숫자' })).toBe('주요 숫자')
    expect(slideName({ ...s, rows: [] })).toBe(s.purpose)
  })

  it('작은 컴포넌트를 잇달아 넣으면 새 줄에 혼자 두지 않고 앞의 것 옆에 둔다', () => {
    // 깔때기 옆 큰 숫자에 큰 숫자를 하나 더: 8·4에 셋째 칸은 보기 좋은 너비가 아니지만(6·3·3) 숫자끼리 나란히
    const rows = [row(block('funnel', 'f'), block('number', 'n1'))]
    expect(autoTarget(rows, block('number', 'n2'))).toEqual({ kind: 'cell', row: 0, index: 2 })
    // 다른 종류면 그대로 새 줄
    expect(autoTarget(rows, block('ring', 'r'))).toEqual({ kind: 'row', index: 1 })
  })

  it('끝에도 새 줄에도 들어가지 않으면 읽는 차례에서 가장 뒤의 자리에 넣는다', () => {
    // 핵심 한 줄 아래 숫자와 막대: 셋째 칸도, 셋째 줄도 들어가지 않는 높이에서 강조 상자를 누르면 핵심 한 줄 뒤로
    const rows = [row(block('message', 'm')), row(block('kpi', 'k'), block('bars', 'b'))]
    const c = block('callout', 'c')
    const below = { kind: 'row', index: 2 } as const
    const end = { kind: 'cell', row: 1, index: 2 } as const
    const areaH = Array.from({ length: 80 }, (_, i) => needH(rows) + i * 10).find(
      (h) => whyNot(rows, below, c, h) && whyNot(rows, end, c, h) && validTargets(rows, c, h).length,
    )!
    expect(areaH).toBeDefined()
    const t = autoTarget(rows, c, areaH)!
    expect(t).not.toBeNull()
    const order = insertAt(rows, t, c, 'x', areaH)!.flatMap((r) => r.blocks.map((b) => b.id))
    expect(order.indexOf('c')).toBeGreaterThan(order.indexOf('m'))
  })

  it('칸 너비 손잡이를 더 끌 수 없으면 막는 부품을 알려 준다', () => {
    // 막대 비교는 절반보다 좁아지지 않는다: 가운데 손잡이를 오른쪽 끝(8:4 쪽)으로 끌면 막대 비교 때문
    const rows = row(block('kpi', 'k'), block('bars', 'b'))
    expect(spanLimit(rows, 0, 0.7)).toEqual({ kind: 'block', type: 'bars', minSpan: 6 })
    // 손이 붙은 비율 가까이에 있으면 알리지 않는다
    expect(spanLimit(rows, 0, 0.52)).toBeNull()
    // 막는 것이 없으면 알리지 않는다
    expect(spanLimit(row(block('text', 't'), block('callout', 'c')), 0, 0.68)).toBeNull()
  })

  it('고를 비율이 하나뿐인 줄은 어느 쪽으로 끌어도 까닭을 알려 준다', () => {
    // 핵심 포인트(3분의 2 이상)와 비율 원은 8:4 하나뿐. 왼쪽으로 끌면 핵심 포인트가 막고,
    // 오른쪽으로 끌면 더 벌어진 비율이 없다: 비율 원이 이미 가장 좁은 칸
    const rows = row(block('points', 'p'), block('ring', 'r'))
    expect(spanChoices(rows)).toEqual([[8, 4]])
    expect(spanLimit(rows, 0, 0.5)).toEqual({ kind: 'block', type: 'points', minSpan: 8 })
    expect(spanLimit(rows, 0, 0.9)).toEqual({ kind: 'end', type: 'ring', span: 4 })
    expect(spanLimit(rows, 0, 0.7)).toBeNull()
    // 세 칸 줄의 끝(6:3:3)에서 더 끌어도 같다
    const three = { ...row(block('text', 't'), block('number', 'a'), block('number', 'b')), spans: [6, 3, 3] }
    expect(spanLimit(three, 0, 0.95)).toEqual({ kind: 'end', type: 'number', span: 3 })
  })

  it('눌러서 넣을 자리가 없는 것과 카드에 보이는 까닭이 늘 같다', () => {
    // 부품 고르기의 카드 표시(placeIssue)와 누를 때(autoTarget)가 다르면, 표가 없는 카드를 눌렀는데 다음 장이 생기거나 그 반대가 된다
    const areaH = 1080 - FRAME.y - FRAME.bottom
    const layouts: BlockRow[][] = [
      [],
      [row(block('points', 'p'), block('ring', 'r')), row(block('number', 'a'), block('number', 'b'), block('number', 'c'))],
      [row(block('message', 'm')), row(block('kpi', 'k'), block('bars', 'b'))],
      [row(block('table', 't'))],
      [row(block('people', 'pp')), row(block('checks', 'ck'), block('risks', 'rk'))],
    ]
    for (const rows of layouts)
      for (const type of BLOCK_TYPES)
        for (const h of [areaH, areaH - 200, areaH - 400]) {
          const b = block(type, 'new')
          expect([type, h, autoTarget(rows, b, h) === null]).toEqual([type, h, placeIssue(rows, b, h) !== null])
        }
  })

  it('한 줄을 다 쓰는 선 차트만 바닥 높이를 낮추고 막대 차트는 그대로 둔다', () => {
    // 선은 넓으면 낮아도 오르내림이 보이지만, 막대는 위아래 글 자리가 그대로라 낮춘 만큼 막대가 눌린다
    expect(blockMinH(block('trend', 't'), 12)).toBeLessThan(blockMinH(block('trend', 't'), 8))
    expect(blockMinH(block('versus', 'v'), 12)).toBeGreaterThanOrEqual(360)
    expect(blockMinH(block('bridge', 'g'), 12)).toBeGreaterThanOrEqual(380)
  })

  it('줄 수, 줄마다 칸 수, 부품 수의 끝을 넘지 않는다', () => {
    let rows: BlockRow[] = []
    for (let i = 0; i < 12; i++) {
      const b = block('callout', `c${i}`)
      const t = autoTarget(rows, b)
      if (!t) break
      rows = insertAt(rows, t, b)!
    }
    expect(blockCount(rows)).toBe(MAX_BLOCKS)
    expect(rows.length).toBeLessThanOrEqual(MAX_ROWS)
    expect(rows.every((r) => r.blocks.length <= MAX_IN_ROW)).toBe(true)
    expect(autoTarget(rows, block('callout', 'more'))).toBeNull()
  })

  it('새 줄이 들어갈 높이가 모자라면 다른 줄의 칸 너비를 다시 나눠 넣는다', () => {
    // 짧은 글 옆의 4칸짜리 전과 후는 위아래로 쌓여 높고, 8칸이면 옆으로 놓여 낮다
    const rows = [{ ...row(block('text', 't'), block('delta', 'd')), spans: [8, 4] }]
    const chart = block('bars', 'c')
    const below = { kind: 'row', index: 1 } as const
    const stacked = needH(insertAt(rows, below, chart, 'x')!)
    const areaH = stacked - 60
    const placed = insertAt(rows, below, chart, 'x', areaH)!
    expect(fitsHeight(placed, areaH)).toBe(true)
    expect(spansOf(placed[0])).toEqual([4, 8])
    expect(whyNot(rows, below, chart, areaH)).toBeNull()
    expect(validTargets(rows, chart, areaH)).toContainEqual(below)
    // 그대로 들어가면 사람이 고른 비율을 바꾸지 않는다
    expect(spansOf(insertAt(rows, below, chart, 'x', stacked)![0])).toEqual([8, 4])
  })

  it('놓을 자리를 고르면 잘리지 않는 높이 안에서만 고른다', () => {
    const areaH = 1080 - FRAME.y - FRAME.bottom
    const rows = [row(block('table', 't'))]
    for (const t of validTargets(rows, block('pricing', 'p'), areaH)) expect(fitsHeight(insertAt(rows, t, block('pricing', 'p'), 'x', areaH)!, areaH)).toBe(true)
    const hs = rowHeights([row(block('message', 'm')), row(block('bars', 'b'))], areaH)
    expect(hs.reduce((a, b) => a + b, 0) + 48).toBeLessThanOrEqual(areaH + 1)
  })

  it('표나 일정처럼 넓게 짜인 부품은 한 줄을 혼자 쓴다', () => {
    const rows = [row(block('bullets', 'b'))]
    // 점 목록 옆에 표를 놓을 수 없고, 표 옆에 점 목록도 놓을 수 없다. 새 줄로는 된다
    expect(whyNot(rows, { kind: 'cell', row: 0, index: 1 }, block('table', 't'))).toEqual({ kind: 'solo', type: 'table' })
    expect(whyNot([row(block('table', 't'))], { kind: 'cell', row: 0, index: 1 }, block('bullets', 'x'))).toEqual({ kind: 'solo', type: 'table' })
    expect(whyNot(rows, { kind: 'row', index: 1 }, block('table', 't'))).toBeNull()
    for (const t of ['table', 'gantt', 'timeline', 'process', 'compare', 'pricing'] as const) expect(isSolo(t)).toBe(true)
    expect(isSolo('bars')).toBe(false)
  })

  it('한 장에는 면 한 가지만: 진한 면은 하나, 진한 면과 옅은 면은 섞지 않는다', () => {
    const withLooks = (...looks: Block['look'][]) => [row(...looks.map((look, i) => ({ ...block('text', `k${i}`), look })))]
    expect(lookIssue(withLooks('bold', 'plain'), 'k1', 'bold')).toEqual({ kind: 'look', why: 'one-bold' })
    expect(lookIssue(withLooks('bold', 'plain'), 'k1', 'card')).toEqual({ kind: 'look', why: 'mix' })
    expect(lookIssue(withLooks('card', 'plain'), 'k1', 'bold')).toEqual({ kind: 'look', why: 'mix' })
    expect(lookIssue(withLooks('card', 'plain'), 'k1', 'card')).toBeNull()
    // 혼자 한 줄을 다 쓰는 작은 부품은 면을 깔지 않는다 (그려질 때도 바탕 없이)
    const ring = { ...block('ring', 'g'), look: 'card' as const }
    expect(lookIssue([row(ring)], 'g', 'card')).toEqual({ kind: 'look', why: 'alone' })
    expect(shownLook(ring, 1)).toBe('plain')
    expect(shownLook(ring, 2)).toBe('card')
    // 강조 상자는 띠처럼 혼자 써도 된다
    expect(lookIssue([row(block('callout', 'c'))], 'c', 'bold')).toBeNull()
  })

  it('넣은 부품의 면이 장과 어긋나면 바탕 없이, 옅은 면은 같은 줄이 함께 바뀐다', () => {
    // 진한 면이 이미 있는 장에 강조 상자(처음엔 진한 면)를 넣으면 바탕 없이
    const rows = [row({ ...block('text', 'a'), look: 'bold' })]
    const next = insertAt(rows, { kind: 'row', index: 1 }, block('callout', 'c'))!
    expect(lookOf(next[1].blocks[0])).toBe('plain')
    // 옅은 면을 고르면 같은 줄의 다른 부품도 옅은 면, 다른 줄은 그대로
    const two = [row(block('text', 'a'), block('bullets', 'b')), row(block('number', 'n'))]
    const carded = withLook(two, 'a', 'card')
    expect(carded[0].blocks.map(lookOf)).toEqual(['card', 'card'])
    expect(lookOf(carded[1].blocks[0])).toBe('plain')
    // 진한 면은 그 부품 하나만
    expect(withLook(two, 'a', 'bold')[0].blocks.map(lookOf)).toEqual(['bold', 'plain'])
  })

  it('같은 장에 같은 부품이 둘이면 빈칸 목록에서 자리로 부른다', () => {
    const rows = [row(block('kpi', 'k')), row(block('faq', 'f1'), block('faq', 'f2'))]
    const names = blockNames(rows)
    expect(names.get('k')).toBe(BLOCKS.kpi.name)
    expect(names.get('f1')).toBe(`왼쪽 ${BLOCKS.faq.name}`)
    expect(names.get('f2')).toBe(`오른쪽 ${BLOCKS.faq.name}`)
    // 줄이 다르면 위, 아래로
    const stacked = blockNames([row(block('number', 'n1')), row(block('number', 'n2'), block('callout', 'c'))])
    expect([stacked.get('n1'), stacked.get('n2'), stacked.get('c')]).toEqual([`위 ${BLOCKS.number.name}`, `아래 ${BLOCKS.number.name}`, BLOCKS.callout.name])
    // 빈칸 이름에도 붙는다
    const labels = blockMissing(rows[1].blocks[1], names.get('f2')).map((m) => m.label)
    expect(labels.every((l) => l.startsWith('오른쪽 '))).toBe(true)
    expect(blockMissing(rows[1].blocks[0], names.get('f1')).some((m) => labels.includes(m.label))).toBe(false)
  })

  it('줄마다 잘리지 않을 높이를 주고, 남는 높이는 똑같이 나눠 더한다', () => {
    // 자리가 없으면 줄마다 잘리지 않을 높이가 그대로 나온다
    const tight = [row(block('message', 'm')), row(block('faq', 'f'))]
    const [low, need] = rowHeights(tight, 0)
    expect(low).toBeLessThan(need - 40)
    // 남는 높이 200은 두 줄이 100씩: 핵심 문장 줄이 질문 줄만큼 높아지지 않고, 질문 줄만 장 끝까지 늘어나지도 않는다
    const hs = rowHeights(tight, low + need + 48 + 200)
    expect(hs[0]).toBeCloseTo(low + 100, 0)
    expect(hs[1]).toBeCloseTo(need + 100, 0)
    const three = rowHeights([row(block('message', 'm')), row(block('faq', 'f')), row(block('callout', 'c'))], 1080 - FRAME.y - FRAME.bottom)
    const mins = rowHeights([row(block('message', 'm')), row(block('faq', 'f')), row(block('callout', 'c'))], 0)
    const extra = three.map((h, i) => h - mins[i])
    expect(Math.max(...extra) - Math.min(...extra)).toBeLessThan(1)
  })

  it('차트, 표, 그림이 든 줄이 있으면 남는 높이는 그 줄끼리 나누고, 글과 숫자 줄은 잘리지 않을 높이 그대로', () => {
    const areaH = 1080 - FRAME.y - FRAME.bottom
    const free = areaH - BLOCK_GAP
    const two = [row(block('message', 'm')), row(block('bars', 'b'))]
    expect(stretchRows(two)).toEqual([false, true])
    const [lowM] = rowHeights(two, 0)
    const hs = rowHeights(two, areaH)
    expect(hs[0]).toBeCloseTo(lowM, 0)
    expect(hs[0] + hs[1]).toBeCloseTo(free, 0)
    // 격자도 같은 계산: 글 줄은 높이 그대로, 차트 줄은 1fr
    const rowsCss = areaStyle(two).gridTemplateRows
    expect(rowsCss).toMatch(/^max\(.*\) minmax\(.*, 1fr\)$/)
    // 차트가 같은 줄에 있으면 그 줄도 나눠 가진다
    expect(stretchRows([row(block('delta', 'd'), block('versus', 'v')), row(block('text', 't'))])).toEqual([true, false])
    // 글과 숫자뿐이면 모든 줄이 나눠 가진다 (위의 똑같이 나누기)
    expect(stretchRows([row(block('message', 'm')), row(block('kpi', 'k'))])).toEqual([true, true])
  })

  it('사람이 줄 높이를 정하면 그 비중으로 나누되, 줄마다 잘리지 않을 높이는 지킨다', () => {
    const two = [row(block('message', 'm')), row(block('bars', 'b'))]
    const [lowM, lowB] = rowHeights(two, 0)
    const areaH = 1080 - FRAME.y - FRAME.bottom
    const free = areaH - BLOCK_GAP
    // 비중이 하나라도 빠지면 예전처럼 똑같이 나눈다
    expect(weighted([{ ...two[0], grow: 30 }, two[1]])).toBe(false)
    const even = rowHeights([{ ...two[0], grow: 50 }, { ...two[1], grow: 50 }], areaH)
    expect(even[0]).toBeCloseTo(free / 2, 0)
    // 위 줄을 아주 작게 해도 잘리지 않을 높이 아래로는 내려가지 않는다
    const squeezed = rowHeights([{ ...two[0], grow: 1 }, { ...two[1], grow: 99 }], areaH)
    expect(squeezed[0]).toBeCloseTo(lowM, 0)
    expect(squeezed[0] + squeezed[1]).toBeCloseTo(free, 0)
    // 줄 사이를 끌면 위아래 두 줄이 나눠 갖고 24분의 1에 붙는다. 잘리지 않을 높이 밖으로는 못 끈다
    const heights = rowHeights(two, areaH)
    const mid = Math.round(((lowM / free + 1 - lowB / free) / 2) * 24) / 24
    const g = growAt(two, heights, 0, mid + 0.01)
    expect(g[0] / (g[0] + g[1])).toBeCloseTo(mid, 1)
    const g2 = growAt(two, heights, 0, 0)
    expect(g2[0] / (g2[0] + g2[1])).toBeCloseTo(lowM / free, 1)
    expect(lowB).toBeGreaterThan(0)
    // 파일에서 읽을 때 범위 밖의 비중은 버린다
    const read = cleanRows([{ id: 'a', blocks: [block('message')], grow: 40 }, { id: 'b', blocks: [block('bars')], grow: 400 }])
    expect(read.map((r) => r.grow)).toEqual([40, undefined])
    expect(weighted(read)).toBe(false)
    expect(unweighted([{ ...two[0], grow: 40 }]).every((r) => r.grow === undefined)).toBe(true)
  })

  it('로고가 많으면 넓은 칸에만 놓는다', () => {
    const logos = (n: number) => ({ ...block('logos', 'l'), items: Array.from({ length: n }, (_, i) => ({ ...block('logos').items[0], id: `l${i}` })) })
    expect([3, 6, 10].map((n) => minSpanOf(logos(n)))).toEqual([6, 8, 12])
    const rows = [row(block('callout', 'c'))]
    expect(whyNot(rows, { kind: 'cell', row: 0, index: 1 }, logos(4))).toBeNull()
    expect(whyNot(rows, { kind: 'cell', row: 0, index: 1 }, logos(10))).toEqual({ kind: 'narrow', span: 12 })
    expect(whyNot(rows, { kind: 'row', index: 1 }, logos(10))).toBeNull()
  })

  it('항목을 더하면 장을 넘칠 때는 더할 수 없다', () => {
    const slide = { fields: { title: '제목' } } as unknown as Slide
    const areaH = composeAreaH(slide)
    // 점검 목록은 항목이 늘면 장보다 높아진다 (blockHeights.ts). 둘에서 시작한다
    const checks = block('checks', 'p')
    let rows = [row(block('message', 'm')), row({ ...checks, items: checks.items.slice(0, 2) }, block('callout', 'c'))]
    expect(fitsHeight(rows, areaH)).toBe(true)
    // 더할 수 있는 동안 더하면, 마지막까지 잘리지 않는 높이 안에 있다
    for (let i = 0; i < 20 && fitsWith(rows, 'p', withItem, areaH); i++) {
      rows = rows.map((r) => ({ ...r, blocks: r.blocks.map((b) => (b.id === 'p' ? withItem(b) : b)) }))
    }
    expect(fitsHeight(rows, areaH)).toBe(true)
    expect(fitsWith(rows, 'p', withItem, areaH)).toBe(false)
    // 제목과 부제를 비우면 본문 상자가 그만큼 높다
    expect(composeAreaH({ fields: {} } as unknown as Slide)).toBe(1080 - FRAME.y - FRAME.bottom)
  })

  it('아무 데나 놓아도 정해진 자리 가운데 하나로 들어간다', () => {
    const size = { w: 1680, h: 1080 - FRAME.y - FRAME.bottom - 200 }
    const rows = [row(block('number', 'n')), row(block('bullets', 'b'))]
    const dragged = block('callout', 'c')
    for (let x = 0; x <= size.w; x += 120)
      for (let y = -100; y <= size.h + 100; y += 90) {
        const t = dropTarget(rows, dragged, { x, y }, size)
        expect(t).not.toBeNull()
        expect(insertAt(rows, t!, dragged)).not.toBeNull()
      }
    // 첫 줄의 오른쪽 가운데에 놓으면 그 줄 옆자리
    expect(dropTarget(rows, dragged, { x: size.w * 0.9, y: size.h * 0.25 }, size)).toEqual({ kind: 'cell', row: 0, index: 1 })
  })

  it('손이 보이는 자리 안에 있으면 자리를 바꾸지 않는다 (보이는 것과 놓이는 곳이 어긋나지 않게)', () => {
    const size = { w: 1680, h: 640 }
    const rows = [row(block('number', 'n'))]
    const dragged = block('callout', 'c')
    const left = { kind: 'cell', row: 0, index: 0 } as const
    // 끄는 부품을 뺀 모습으로는 큰 숫자의 위쪽(새 줄)이지만, 보이는 모습에서는 왼쪽 옆자리 칸 안
    const p = { x: size.w * 0.2, y: size.h * 0.2 }
    expect(dropTarget(rows, dragged, p, size)).toEqual({ kind: 'row', index: 0 })
    expect(dropTarget(rows, dragged, p, size, undefined, left)).toEqual(left)
    // 그 칸을 벗어나면 다시 찾는다
    expect(dropTarget(rows, dragged, { x: size.w * 0.9, y: size.h * 0.5 }, size, undefined, left)).toEqual({ kind: 'cell', row: 0, index: 1 })
  })

  it('칸 사이를 끌면 정해진 비율에 붙는다', () => {
    const r = row(block('trend', 't'), block('bullets', 'b'))
    expect(spansAt(r, 0, 0.66)).toEqual([8, 4])
    expect(spansAt(r, 0, 0.52)).toEqual([6, 6])
    // 차트는 6칸보다 좁아지지 않는다
    expect(spansAt(r, 0, 0.2)[0]).toBeGreaterThanOrEqual(BLOCKS.trend.minSpan)
    expect(spansOf({ ...r, spans: [1, 11] })).not.toEqual([1, 11])
  })
})

describe('파일에서 읽은 부품 장', () => {
  it('모르는 부품과 꼴이 틀린 값은 빼고 글은 남긴다', () => {
    const rows = cleanRows([
      { id: 'r1', blocks: [{ id: 'a', type: 'text', fields: { body: '본문', bad: 3 }, items: 'x', look: 'neon', effect: 'spin' }, { id: 'b', type: 'virus' }] },
      { id: 'r2', blocks: [] },
      'junk',
      { blocks: [{ id: 'c', type: 'bullets', items: [{ title: '하나', body: 7 }], variant: 'nope', spans: [3] }], spans: [99] },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0].blocks).toEqual([{ id: 'a', type: 'text', fields: { body: '본문' }, items: [] }])
    expect(rows[1].blocks[0].items[0]).toMatchObject({ title: '하나', body: '' })
    expect(rows[1].spans).toBeUndefined()
    expect(cleanRows(rows)).toEqual(rows)
    expect(cleanRows(null)).toEqual([])
  })
})

describe('항목 순서 바꾸기', () => {
  it('옮긴 항목 사이의 항목은 한 칸씩 밀리고, 고른 강조는 그 항목을 따라간다', () => {
    expect(moveIn(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveIn(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(moveIn(['a', 'b'], 0, 9)).toEqual(['b', 'a'])
    // 강조: 옮긴 항목이면 새 자리로, 사이에 있던 항목이면 한 칸 밀린 자리로
    expect(followIndex(0, 0, 2)).toBe(2)
    expect(followIndex(1, 0, 2)).toBe(0)
    expect(followIndex(3, 0, 2)).toBe(3)
    expect(followIndex(0, 3, 0)).toBe(1)
    // 고르지 않은 강조(마지막 점처럼 자리로 정한 것)와 강조 없음은 그대로
    expect(followIndex(undefined, 0, 2)).toBeUndefined()
    expect(followIndex(-1, 0, 2)).toBe(-1)
  })
})

describe('발표할 때 비워 둔 부품', () => {
  const filled = (type: Block['type'], id: string): Block => ({ ...block(type, id), fields: { title: '적은 글' } })

  it('빈 부품은 빠지고 남은 부품이 줄을 나눠 쓴다 (고른 칸 너비는 다시 고른다)', () => {
    const rows = [{ ...row(filled('text', 'a'), block('text', 'b')), spans: [8, 4] }]
    const shown = shownRows(rows)
    expect(shown).toHaveLength(1)
    expect(shown[0].blocks.map((b) => b.id)).toEqual(['a'])
    expect(shown[0]).not.toHaveProperty('spans')
  })

  it('빠진 부품에 닿아 있던 이음표도 뗀다: 남은 두 부품 사이에 서면 뜻이 바뀐다', () => {
    const rows = [row({ ...filled('text', 'a'), link: 'arrow' }, { ...block('text', 'b'), link: 'plus' }, filled('text', 'c'))]
    const shown = shownRows(rows)
    expect(shown[0].blocks.map((b) => b.id)).toEqual(['a', 'c'])
    expect(shown[0].blocks.every((b) => !b.link)).toBe(true)
  })

  it('줄이 통째로 비면 그 줄과 위 줄을 잇던 이음표도 뗀다', () => {
    const rows = [{ ...row(filled('text', 'a')), link: 'plus' as const }, row(block('number', 'b'))]
    const shown = shownRows(rows)
    expect(shown).toHaveLength(1)
    expect(shown[0]).not.toHaveProperty('link')
  })

  it('빈 부품이 없으면 그대로, 사람이 적은 글은 하나도 빠지지 않는다', () => {
    const rows = [row(filled('text', 'a'), filled('number', 'b'))]
    expect(shownRows(rows)).toBe(rows)
    const mixed = [row(filled('text', 'a'), block('quote', 'q')), row(block('number', 'n'))]
    const kept = shownRows(mixed).flatMap((r) => r.blocks.map((b) => b.id))
    expect(kept).toEqual(['a'])
  })
})

describe('이음표', () => {
  const rows = [row(block('number', 'a'), block('number', 'b')), row(block('text', 'c'))]

  it('칸 사이와 줄 사이에만 선다', () => {
    expect(linkTargets(rows)).toEqual([
      { dir: 'h', row: 0, col: 0 },
      { dir: 'v', row: 0 },
    ])
    const linked = withLink(withLink(rows, { dir: 'h', row: 0, col: 0 }, 'arrow'), { dir: 'v', row: 0 }, 'plus')
    expect(linkAt(linked, { dir: 'h', row: 0, col: 0 })).toBe('arrow')
    expect(linkAt(linked, { dir: 'v', row: 0 })).toBe('plus')
    // 빼면 값이 남지 않는다
    expect(withLink(linked, { dir: 'h', row: 0, col: 0 }, null)[0].blocks[0]).not.toHaveProperty('link')
  })

  it('줄 사이의 이음표는 위아래 줄이 비켜 나는 만큼 높이가 더 든다. 칸 사이는 높이가 그대로', () => {
    expect(needH(withLink(rows, { dir: 'v', row: 0 }, 'arrow'))).toBe(needH(rows) + LINK_PAD * 2)
    expect(needH(withLink(rows, { dir: 'h', row: 0, col: 0 }, 'arrow'))).toBe(needH(rows))
  })

  it('설 데가 없어진 이음표는 빠진다: 오른쪽 부품을 빼거나, 아래 줄이 없어지면', () => {
    const linked = withLink(withLink(rows, { dir: 'h', row: 0, col: 0 }, 'arrow'), { dir: 'v', row: 0 }, 'plus')
    expect(removeBlock(linked, 'b')[0].blocks[0]).not.toHaveProperty('link')
    expect(removeBlock(linked, 'c')[0]).not.toHaveProperty('link')
    expect(tidyLinks(linked)).toBe(linked)
  })

  it('파일에서 읽을 때 아는 이음표만, 설 데가 있는 것만 남긴다', () => {
    const raw = [
      { id: 'r1', blocks: [{ ...block('number', 'a'), link: 'arrow' }, { ...block('number', 'b'), link: 'plus' }], link: 'equals' },
      { id: 'r2', blocks: [{ ...block('text', 'c'), link: 'spiral' }, block('text', 'd')], link: 'versus' },
    ]
    const clean = cleanRows(raw)
    expect(clean.map((r) => r.blocks.map((b) => b.link ?? null))).toEqual([
      ['arrow', null],
      [null, null],
    ])
    expect(clean.map((r) => r.link ?? null)).toEqual(['equals', null])
  })
})

describe('이미지에 맞춘 칸 너비', () => {
  const img = (fields: Record<string, string> = {}) => ({ ...block('image', 'img'), fields: { image: 'data:image/png;base64,', ...fields } })

  it('넓은 화면 캡처는 넓은 칸으로, 세로 사진은 좁은 칸으로', () => {
    const rows = [row(img(), block('bullets', 't'))]
    expect(spansOf(fitImage(rows, 'img', 16 / 10, 700)[0])).toEqual([8, 4])
    expect(spansOf(fitImage(rows, 'img', 3 / 4, 700)[0])).toEqual([4, 8])
  })

  it('지금 너비가 이미 맞으면, 줄에 이미지 하나뿐이면 그대로', () => {
    const wide = [{ ...row(img(), block('bullets', 't')), spans: [8, 4] }]
    expect(fitImage(wide, 'img', 16 / 10, 700)).toBe(wide)
    const alone = [row(img())]
    expect(fitImage(alone, 'img', 3 / 4, 700)).toBe(alone)
  })

  it('고른 너비에서도 이웃이 제 가장 좁은 너비보다 좁아지지 않는다', () => {
    for (const aspect of [0.4, 0.75, 1, 1.6, 3]) {
      const next = fitImage([row(img(), block('points', 't'))], 'img', aspect, 700)
      for (const r of next) expect(r.blocks.every((b, i) => spansOf(r)[i] >= minSpanOf(b))).toBe(true)
    }
  })

  // 가로세로가 읽히는 PNG (IHDR까지만)
  const png = (w: number, h: number) => {
    const be32 = (n: number) => String.fromCharCode((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255)
    return `data:image/png;base64,${btoa(`\x89PNG\r\n\x1a\n${be32(13)}IHDR${be32(w)}${be32(h)}\x08\x06\x00\x00\x00`)}`
  }

  it('붙여 넣은 세로 이미지는 새 줄의 낮은 띠가 아니라 옆 칸으로, 이미 쓴 내용 뒤에', () => {
    const rows = [row(block('bullets', 't'))]
    const portrait = { ...img(), fields: { image: png(900, 1200) } }
    expect(imageTarget(rows, portrait, 700)).toEqual({ kind: 'cell', row: 0, index: 1 })
    expect(autoTarget(rows, portrait, 700)).toEqual({ kind: 'cell', row: 0, index: 1 })
  })

  it('이웃을 빼면 남은 줄을 이미지에 다시 맞춘다', () => {
    const shot = { ...img(), fields: { image: png(1600, 1000) } }
    const rows = [{ ...row(shot, block('bullets', 't'), block('number', 'n')), spans: [4, 4, 4] }]
    expect(spansOf(removeBlock(rows, 'n', 700)[0])).toEqual([8, 4])
    // 장 높이를 모르면 똑같이 나눈 너비 그대로
    expect(spansOf(removeBlock(rows, 'n')[0])).toEqual([6, 6])
  })
})
