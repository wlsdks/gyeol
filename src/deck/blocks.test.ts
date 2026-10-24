import { BLOCK_HEIGHTS } from './blockHeights'
import { describe, expect, it } from 'vitest'
import {
  BLOCK_GAP,
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
  fitSpans,
  fitsHeight,
  fitsWith,
  insertAt,
  isSolo,
  LINK_PAD,
  linkAt,
  linkTargets,
  needH,
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
  growAt,
  unweighted,
  weighted,
  shownLook,
  spansAt,
  spansOf,
  targetOf,
  unwrapCompose,
  validTargets,
  whyNot,
  withItem,
  withLook,
} from './blocks'
import { sampleBlock } from './blockSamples'
import { FRAME } from './frame'
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

  it('놓을 자리를 고르면 잘리지 않는 높이 안에서만 고른다', () => {
    const areaH = 1080 - FRAME.y - FRAME.bottom
    const rows = [row(block('table', 't'))]
    for (const t of validTargets(rows, block('pricing', 'p'), areaH)) expect(fitsHeight(insertAt(rows, t, block('pricing', 'p'))!, areaH)).toBe(true)
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
