import { describe, expect, it } from 'vitest'
import {
  allBlocks,
  autoTarget,
  BLOCK_GROUPS,
  BLOCK_TYPES,
  BLOCKS,
  blockCount,
  blockMinH,
  canCompose,
  cleanRows,
  composeAreaH,
  composeFrom,
  dropTarget,
  fitSpans,
  fitsHeight,
  fitsWith,
  insertAt,
  makeBlock,
  MAX_BLOCKS,
  MAX_IN_ROW,
  MAX_ROWS,
  removeBlock,
  rowHeights,
  spansAt,
  spansOf,
  targetOf,
  unwrapCompose,
  validTargets,
  withItem,
} from './blocks'
import { sampleBlock } from './blockSamples'
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
      expect(blockMinH(makeBlock(type))).toBeGreaterThan(0)
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
          expect(BLOCKS[a].minSpan + BLOCKS[b].minSpan).toBeGreaterThan(12)
          continue
        }
        expect(spans.reduce((x, y) => x + y, 0)).toBe(12)
        spans.forEach((sp, i) => expect(sp).toBeGreaterThanOrEqual(BLOCKS[blocks[i].type].minSpan))
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
    const areaH = 1080 - 100 - 140 - 200
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
    const areaH = 1080 - 100 - 140
    const rows = [row(block('table', 't'))]
    for (const t of validTargets(rows, block('pricing', 'p'), areaH)) expect(fitsHeight(insertAt(rows, t, block('pricing', 'p'))!, areaH)).toBe(true)
    const hs = rowHeights([row(block('message', 'm')), row(block('bars', 'b'))], areaH)
    expect(hs.reduce((a, b) => a + b, 0) + 48).toBeLessThanOrEqual(areaH + 1)
  })

  it('항목을 더하면 장을 넘칠 때는 더할 수 없다', () => {
    const slide = { fields: { title: '제목' } } as unknown as Slide
    const areaH = composeAreaH(slide)
    let rows = [row(block('message', 'm')), row(block('bullets', 'p'), block('callout', 'c'))]
    expect(fitsHeight(rows, areaH)).toBe(true)
    // 더할 수 있는 동안 더하면, 마지막까지 잘리지 않는 높이 안에 있다
    for (let i = 0; i < 20 && fitsWith(rows, 'p', withItem, areaH); i++) {
      rows = rows.map((r) => ({ ...r, blocks: r.blocks.map((b) => (b.id === 'p' ? withItem(b) : b)) }))
    }
    expect(fitsHeight(rows, areaH)).toBe(true)
    expect(fitsWith(rows, 'p', withItem, areaH)).toBe(false)
    // 제목과 부제를 비우면 본문 상자가 그만큼 높다
    expect(composeAreaH({ fields: {} } as unknown as Slide)).toBe(1080 - 100 - 140)
  })

  it('아무 데나 놓아도 정해진 자리 가운데 하나로 들어간다', () => {
    const size = { w: 1680, h: 1080 - 100 - 140 - 200 }
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
