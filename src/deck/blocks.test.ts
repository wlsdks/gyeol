import { BLOCK_HEIGHTS } from './blockHeights'
import { describe, expect, it } from 'vitest'
import {
  autoPlace,
  bandOf,
  byReading,
  BLOCK_GROUPS,
  BLOCK_TYPES,
  BLOCKS,
  blockMinH,
  blockMissing,
  blockNames,
  boardFit,
  boardFromRows,
  BOARD_COLS,
  BOARD_ROWS,
  canCompose,
  cleanBlocks,
  composeAreaH,
  composeFrom,
  copyBlocks,
  dropTarget,
  fitImage,
  fitsWith,
  foldableFields,
  fromOf,
  gutterLimit,
  guttersOf,
  imagePlace,
  insertAt,
  isLayoutBlock,
  isSolo,
  isStacked,
  linkAt,
  linkFits,
  linkIssue,
  linkTargets,
  lookIssue,
  lookOf,
  makeBlock,
  mapBlock,
  MAX_BLOCKS,
  MAX_LARGE,
  minSpanOf,
  moveAt,
  needRows,
  placeIssue,
  playOrder,
  removeBlock,
  resizeBlock,
  shownBlocks,
  shownLook,
  slideName,
  speedOf,
  tidyLinks,
  tiles,
  unwrapCompose,
  validTargets,
  whenOf,
  whyNot,
  withItem,
  withLink,
  withLook,
} from './blocks'
import { sampleBlock } from './blockSamples'
import { followIndex, moveIn } from './fields'
import { FRAME } from './frame'
import { makeSlide } from './generate'
import { LAYOUT_ORDER } from './layouts'
import { showcaseSlides } from './showcase'
import { transitionOf } from './themes'
import type { Block, BlockType, Slide } from './types'

const block = (type: Block['type'], id: string = type): Block => ({ ...makeBlock(type), id })
/** 제목이 있는 장의 본문 높이 (편집 화면과 같은 어림) */
const H = composeAreaH({ fields: { title: '제목' } } as unknown as Slide)
/** 차례대로 눌러 넣은 판 (편집기의 '넣기'와 같다) */
const board = (...bs: Block[]): Block[] => bs.reduce<Block[]>((out, b) => autoPlace(out, b, H) ?? out, [])
const areaOf = (bs: Block[], id: string) => bs.find((b) => b.id === id)!.at!

/** 판이 빈틈없이 덮이고, 부품마다 잘리지 않는 크기인지 */
function sound(bs: Block[], areaH = H): boolean {
  const fit = boardFit(areaH, bs)
  return tiles(bs) && bs.every((b) => b.at!.w >= fit.minW(b) && b.at!.h >= fit.minH(b, b.at!.w))
}

/** 장에 사람이 적은 글을 모두 모은다 (칸, 항목) */
function texts(slide: Slide): string[] {
  const out = Object.values(slide.fields).filter((v) => v.trim())
  for (const it of slide.items) for (const k of ['title', 'body', 'value', 'meta', 'image'] as const) if (it[k].trim()) out.push(it[k])
  for (const b of slide.blocks ?? []) {
    out.push(...Object.values(b.fields).filter((v) => v.trim()))
    for (const it of b.items) for (const k of ['title', 'body', 'value', 'meta', 'image'] as const) if (it[k].trim()) out.push(it[k])
  }
  return out.sort()
}

describe('부품 목록', () => {
  it('레이아웃 부품인지는 Object의 이름(constructor 같은)에 속지 않는다', () => {
    expect(isLayoutBlock('kpi')).toBe(true)
    expect(isLayoutBlock('constructor')).toBe(false)
    expect(isLayoutBlock('toString')).toBe(false)
  })

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

  it("'칸 더하기'로 꺼내는 칸마다 무엇에 쓰는 칸인지 적혀 있고, 한 부품 안에서 겹치지 않는다", () => {
    for (const type of BLOCK_TYPES) {
      const folds = foldableFields(type)
      for (const f of folds) expect(f.use, `${type} ${f.key}`).not.toBe('')
      expect(new Set(folds.map((f) => f.use)).size, type).toBe(folds.length)
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
  it('바꿀 수 있는 모든 장에서 적은 글이 하나도 빠지지 않고, 판을 빈틈없이 덮는다', () => {
    const slides = showcaseSlides().filter((s) => canCompose(s.layout))
    const layouts = new Set(slides.map((s) => s.layout))
    // 표지와 단락, 부품 장 말고는 모두 예시가 있어야 확인이 된다
    for (const id of LAYOUT_ORDER) if (canCompose(id)) expect(layouts.has(id)).toBe(true)
    for (const s of slides) {
      const composed = composeFrom(s)
      expect(composed.layout).toBe('compose')
      expect(texts(composed)).toEqual(texts({ ...s, items: s.items.slice(0, 20) }))
      expect((composed.blocks ?? []).length).toBeLessThanOrEqual(MAX_BLOCKS)
      expect(tiles(composed.blocks ?? [])).toBe(true)
    }
  })

  it('레이아웃 부품 하나뿐이면 원래 레이아웃으로 그대로 되돌아간다', () => {
    for (const s of showcaseSlides().filter((x) => canCompose(x.layout))) {
      const composed = composeFrom(s)
      const blocks = composed.blocks ?? []
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
  it('어떤 두 부품을 차례로 넣어도 판은 빈틈없이 덮이고, 부품마다 잘리지 않는 크기를 지킨다', () => {
    for (const a of BLOCK_TYPES)
      for (const b of BLOCK_TYPES) {
        const bs = board(block(a, 'a'), block(b, 'b'))
        expect(bs.length, `${a} ${b}`).toBeGreaterThan(0)
        expect(sound(bs), `${a} ${b}`).toBe(true)
      }
  })

  it('결론 부품(핵심 한 줄, 강조 상자)은 알아서 넣으면 근거 위에, 이미 결론이 있으면 판에 맡긴다', () => {
    const top = (bs: Block[]) => byReading(bs)[0].id
    for (const lead of ['message', 'callout'] as const) {
      const bs = board(block('kpi', 'k'), block('bullets', 'l'), block(lead, 'm'))
      expect(top(bs), lead).toBe('m')
      expect(sound(bs), lead).toBe(true)
    }
    // 이미 결론이 위에 있으면 두 번째 결론은 맨 위로 끼어들지 않는다
    const two = board(block('kpi', 'k'), block('message', 'm'), block('callout', 'c'))
    expect(top(two)).toBe('m')
    // 끌어 놓은 자리(insertAt)는 그대로
    const dropped = insertAt(board(block('kpi', 'k')), { at: null, side: 'below' }, block('message', 'm'), H)!
    expect(top(dropped)).toBe('k')
  })

  it('넣고 빼면 원래대로', () => {
    // 강조 상자는 알아서 넣으면 위로 가서(결론부터) 아래 자리에 끌어 놓은 것처럼
    const bs = insertAt(board(block('number', 'n')), { at: null, side: 'below' }, block('callout', 'c'), H)!
    const added = autoPlace(bs, block('bullets', 'b'), H)!
    expect(added).toHaveLength(3)
    const back = removeBlock(added, 'b', H)
    expect(back.map((b) => b.id)).toEqual(['n', 'c'])
    expect(back.map((b) => b.at)).toEqual(bs.map((b) => b.at))
  })

  it('장 추가로 만든 컴포넌트 장은 넣은 컴포넌트 이름으로 부른다', () => {
    const below = (bs: Block[], b: Block) => insertAt(bs, { at: null, side: 'below' }, b)!
    const s = { ...makeSlide('compose'), blocks: below(below(board(block('kpi', 'k')), block('trend', 't')), block('callout', 'c')) }
    expect(slideName(s)).toBe('핵심 숫자, 추이 외 1')
    expect(slideName({ ...s, blocks: board(block('kpi', 'k')) })).toBe('핵심 숫자')
    // 보고 종류가 정해 준 이름과 빈 장은 그대로
    expect(slideName({ ...s, purpose: '주요 숫자' })).toBe('주요 숫자')
    expect(slideName({ ...s, blocks: [] })).toBe(s.purpose)
  })

  it('작은 컴포넌트를 잇달아 넣으면 혼자 두지 않고 앞의 것 곁에 둔다', () => {
    const bs = board(block('funnel', 'f'), block('stat', 's1'), block('stat', 's2'))
    const near = bandOf(bs, 's2').some((b) => b.id === 's1') || isStacked(bs, 's2')
    expect(near).toBe(true)
    expect(sound(bs)).toBe(true)
  })

  it('작은 부품은 넓은 차트 옆에서 차트 높이만큼 늘어나지 않는다 (위아래로 비어 보였다)', () => {
    // 강점과 약점 옆의 진행 막대 하나가 높은 칸 가운데 떠 있었다
    const bs = board(block('swot', 'w'), block('meter', 'm'))
    const m = areaOf(bs, 'm')
    expect(m.w === BOARD_COLS || m.h < BOARD_ROWS).toBe(true)
  })

  it('눌러서 넣을 자리가 없는 것과 카드에 보이는 까닭이 늘 같다', () => {
    // 부품 고르기의 카드 표시(placeIssue)와 누를 때(autoPlace)가 다르면, 표가 없는 카드를 눌렀는데 다음 장이 생기거나 그 반대가 된다
    const areaH = 1080 - FRAME.y - FRAME.bottom
    const boards: Block[][] = [
      [],
      board(block('points', 'p'), block('ring', 'r'), block('number', 'a'), block('number', 'b')),
      board(block('message', 'm'), block('kpi', 'k'), block('bars', 'b')),
      board(block('table', 't')),
      board(block('people', 'pp'), block('checks', 'ck'), block('risks', 'rk')),
    ]
    for (const bs of boards)
      for (const type of BLOCK_TYPES)
        for (const h of [areaH, areaH - 200, areaH - 400]) {
          const b = block(type, 'new')
          expect([type, h, autoPlace(bs, b, h) === null]).toEqual([type, h, placeIssue(bs, b, h) !== null])
        }
  })

  it('부품 수의 끝을 넘지 않는다', () => {
    let bs: Block[] = []
    for (let i = 0; i < 12; i++) {
      const next = autoPlace(bs, block('callout', `c${i}`))
      if (!next) break
      bs = next
    }
    // 강조 상자는 작은 부품이 아니라 큰 부품 수(MAX_LARGE)에서 멈춘다
    expect(bs).toHaveLength(MAX_LARGE)
    expect(autoPlace(bs, block('callout', 'more'))).toBeNull()
    expect(placeIssue(bs, block('callout', 'more'))).toEqual({ kind: 'large' })
  })

  it('놓을 수 있는 자리는 모두 잘리지 않는 크기로 들어가고, whyNot과 같은 것을 말한다', () => {
    const bs = board(block('message', 'm'), block('kpi', 'k'), block('bars', 'b'))
    for (const type of ['callout', 'bullets', 'stat', 'trend', 'table'] as BlockType[]) {
      const b = block(type, 'x')
      for (const t of validTargets(bs, b, H)) {
        expect(whyNot(bs, t, b, H)).toBeNull()
        const next = t.kind === 'spot' ? insertAt(bs, t.spot, b, H) : null
        expect(next && sound(next), `${type} ${JSON.stringify(t)}`).toBe(true)
      }
    }
  })

  it('표나 일정처럼 넓게 짜인 부품은 장 너비를 혼자 쓴다', () => {
    const bs = board(block('bullets', 'b'))
    // 점 목록 옆에 표를 놓을 수 없고, 표 옆에 점 목록도 놓을 수 없다. 아래로는 된다
    expect(whyNot(bs, { kind: 'spot', spot: { at: 'b', side: 'right' } }, block('table', 't'))).toEqual({ kind: 'solo', type: 'table' })
    expect(whyNot(board(block('table', 't')), { kind: 'spot', spot: { at: 't', side: 'right' } }, block('bullets', 'x'))).toEqual({ kind: 'solo', type: 'table' })
    expect(whyNot(bs, { kind: 'spot', spot: { at: 'b', side: 'below' } }, block('table', 't'))).toBeNull()
    for (const t of ['table', 'gantt', 'timeline', 'process', 'compare', 'pricing'] as const) expect(isSolo(t)).toBe(true)
    expect(isSolo('bars')).toBe(false)
  })

  it('한 장에는 면 한 가지만: 진한 면은 하나, 진한 면과 옅은 면은 섞지 않는다', () => {
    const withLooks = (...looks: Block['look'][]) => board(...looks.map((look, i) => ({ ...block('text', `k${i}`), look })))
    expect(lookIssue(withLooks('bold', 'plain'), 'k1', 'bold')).toEqual({ kind: 'look', why: 'one-bold' })
    expect(lookIssue(withLooks('bold', 'plain'), 'k1', 'card')).toEqual({ kind: 'look', why: 'mix' })
    expect(lookIssue(withLooks('card', 'plain'), 'k1', 'bold')).toEqual({ kind: 'look', why: 'mix' })
    expect(lookIssue(withLooks('card', 'plain'), 'k1', 'card')).toBeNull()
    // 혼자 장 너비를 다 쓰는 작은 부품은 면을 깔지 않는다 (그려질 때도 바탕 없이)
    const ring = { ...block('ring', 'g'), look: 'card' as const }
    expect(lookIssue(board(ring), 'g', 'card')).toEqual({ kind: 'look', why: 'alone' })
    expect(shownLook(ring, true)).toBe('plain')
    expect(shownLook(ring, false)).toBe('card')
    // 강조 상자는 띠처럼 혼자 써도 된다
    expect(lookIssue(board(block('callout', 'c')), 'c', 'bold')).toBeNull()
  })

  it('넣은 부품의 면이 장과 어긋나면 바탕 없이, 옅은 면은 나란한 부품이 함께 바뀐다', () => {
    // 진한 면이 이미 있는 장에 강조 상자(처음엔 진한 면)를 넣으면 바탕 없이
    const bs = board({ ...block('text', 'a'), look: 'bold' })
    const next = insertAt(bs, { at: null, side: 'below' }, block('callout', 'c'))!
    expect(lookOf(next.find((b) => b.id === 'c')!)).toBe('plain')
    // 옅은 면을 고르면 나란한 부품도 옅은 면, 아래 묶음은 그대로
    const two = insertAt(insertAt(board(block('text', 'a')), { at: 'a', side: 'right' }, block('bullets', 'b'))!, { at: null, side: 'below' }, block('number', 'n'))!
    const carded = withLook(two, 'a', 'card')
    expect(['a', 'b'].map((id) => lookOf(carded.find((x) => x.id === id)!))).toEqual(['card', 'card'])
    expect(lookOf(carded.find((x) => x.id === 'n')!)).toBe('plain')
    // 진한 면은 그 부품 하나만
    const bold = withLook(two, 'a', 'bold')
    expect(['a', 'b'].map((id) => lookOf(bold.find((x) => x.id === id)!))).toEqual(['bold', 'plain'])
  })

  it('같은 장에 같은 부품이 둘이면 빈칸 목록에서 자리로 부른다', () => {
    const bs = insertAt(insertAt(board(block('kpi', 'k')), { at: null, side: 'below' }, block('faq', 'f1'))!, { at: 'f1', side: 'right' }, block('faq', 'f2'))!
    const names = blockNames(bs)
    expect(names.get('k')).toBe(BLOCKS.kpi.name)
    expect(names.get('f1')).toBe(`왼쪽 ${BLOCKS.faq.name}`)
    expect(names.get('f2')).toBe(`오른쪽 ${BLOCKS.faq.name}`)
    // 위아래로 놓이면 위, 아래로
    const stacked = blockNames(insertAt(board(block('number', 'n1')), { at: 'n1', side: 'below' }, block('number', 'n2'))!)
    expect([stacked.get('n1'), stacked.get('n2')]).toEqual([`위 ${BLOCKS.number.name}`, `아래 ${BLOCKS.number.name}`])
    // 빈칸 이름에도 붙는다
    const f2 = bs.find((b) => b.id === 'f2')!
    const labels = blockMissing(f2, names.get('f2')).map((m) => m.label)
    expect(labels.every((l) => l.startsWith('오른쪽 '))).toBe(true)
  })

  it('로고가 많으면 넓은 칸에만 놓는다', () => {
    const logos = (n: number) => ({ ...block('logos', 'l'), items: Array.from({ length: n }, (_, i) => ({ ...block('logos').items[0], id: `l${i}` })) })
    expect([3, 6, 10].map((n) => minSpanOf(logos(n)))).toEqual([6, 8, 12])
    const bs = board(block('callout', 'c'))
    expect(whyNot(bs, { kind: 'spot', spot: { at: 'c', side: 'right' } }, logos(4))).toBeNull()
    expect(whyNot(bs, { kind: 'spot', spot: { at: 'c', side: 'right' } }, logos(10))).toEqual({ kind: 'narrow', span: 12 })
    expect(whyNot(bs, { kind: 'spot', spot: { at: 'c', side: 'below' } }, logos(10))).toBeNull()
  })

  it('항목을 더하면 장을 넘칠 때는 더할 수 없다', () => {
    const checks = block('checks', 'p')
    let bs = board(block('message', 'm'), { ...checks, items: checks.items.slice(0, 2) }, block('callout', 'c'))
    expect(sound(bs)).toBe(true)
    // 더할 수 있는 동안 더하면, 마지막까지 잘리지 않는 크기 안에 있다
    for (let i = 0; i < 20 && fitsWith(bs, 'p', withItem, H); i++) bs = mapBlock(bs, 'p', withItem)
    expect(needRows(bs, boardFit(H, bs))).toBeLessThanOrEqual(BOARD_ROWS)
    expect(fitsWith(bs, 'p', withItem, H)).toBe(false)
    // 제목과 부제를 비우면 본문 상자가 그만큼 높다
    expect(composeAreaH({ fields: {} } as unknown as Slide)).toBe(1080 - FRAME.y - FRAME.bottom)
  })

  it('아무 데나 놓아도 놓을 수 있는 자리 가운데 하나로 들어간다', () => {
    const size = { w: 1680, h: H }
    const bs = board(block('number', 'n'), block('bullets', 'b'))
    const dragged = block('callout', 'c')
    for (let x = 0; x <= size.w; x += 120)
      for (let y = -100; y <= size.h + 100; y += 90) {
        const t = dropTarget(bs, dragged, { x, y }, size)
        expect(t).not.toBeNull()
        expect(t!.kind === 'spot' && insertAt(bs, t!.spot, dragged, size.h)).toBeTruthy()
      }
  })

  it('옮길 때 다른 부품의 가운데에 놓으면 두 부품이 자리를 맞바꾼다', () => {
    const size = { w: 1680, h: H }
    const bs = board(block('number', 'n'), block('delta', 'd'))
    const n = areaOf(bs, 'n')
    const d = areaOf(bs, 'd')
    const base = removeBlock(bs, 'n', H)
    const mid = { x: ((d.x + d.w / 2) * (size.w + 72)) / BOARD_COLS - 36, y: ((d.y + d.h / 2) * (size.h + 48)) / BOARD_ROWS - 24 }
    const t = dropTarget(base, bs[0], mid, size, null, bs)
    expect(t).toEqual({ kind: 'swap', with: 'd' })
    const swapped = moveAt(bs, 'n', t!, H)!
    expect(areaOf(swapped, 'n')).toEqual(d)
    expect(areaOf(swapped, 'd')).toEqual(n)
  })

  it('나누는 선을 더 끌 수 없으면 막는 부품을 알려 준다', () => {
    // 막대 비교는 절반보다 좁아지지 않는다: 가운데 선을 오른쪽 끝으로 끌면 막대 비교 때문
    const bs = insertAt(board(block('kpi', 'k')), { at: 'k', side: 'right' }, block('bars', 'b'), H)!
    const g = guttersOf(bs).find((x) => x.dir === 'h')!
    expect(gutterLimit(bs, g, 11, H)).toEqual({ kind: 'block', type: 'bars', minSpan: BLOCKS.bars.minSpan })
    // 끌 수 있는 데까지는 알리지 않는다
    expect(gutterLimit(bs, g, g.at, H)).toBeNull()
  })

  it('부품의 크기를 칸 수로 정하면 닿은 선을 옮겨 옆 부품과 주고받는다', () => {
    const bs = insertAt(board(block('text', 't')), { at: 't', side: 'right' }, block('bullets', 'b'), H)!
    const wide = resizeBlock(bs, 't', 'w', 8, H)!
    expect(areaOf(wide, 't').w).toBe(8)
    expect(areaOf(wide, 'b').w).toBe(4)
    // 오른쪽 끝 부품은 왼쪽 선을 옮긴다
    expect(areaOf(resizeBlock(bs, 'b', 'w', 8, H)!, 'b').w).toBe(8)
    // 잘리는 크기는 받지 않는다
    expect(resizeBlock(bs, 't', 'w', 11, H)).toBeNull()
  })
})

describe('판에서 위아래로 놓기', () => {
  it('부품 아래에 놓으면 그 부품의 너비를 나눠 쓰고 옆 부품은 그대로다', () => {
    const bs = insertAt(board(block('number', 'n')), { at: 'n', side: 'right' }, block('bars', 'c'), H)!
    const n = areaOf(bs, 'n')
    const next = insertAt(bs, { at: 'n', side: 'below' }, block('delta', 'd'), H)!
    expect(areaOf(next, 'd').x).toBe(n.x)
    expect(areaOf(next, 'd').w).toBe(n.w)
    expect(areaOf(next, 'c')).toEqual(areaOf(bs, 'c'))
    expect(isStacked(next, 'd')).toBe(true)
    expect(sound(next)).toBe(true)
  })

  it('글 목록을 아래에 넣으면 남는 높이는 면이 있는 윗줄이 받는다 (목록 위아래가 비지 않게)', () => {
    const top = insertAt(board({ ...block('callout', 'c'), look: 'bold' }), { at: 'c', side: 'right' }, block('kpi', 'k'), H)!
    const next = insertAt(top, { at: null, side: 'below' }, block('bullets', 'b'), H)!
    const b = areaOf(next, 'b')
    // 한 줄을 다 쓰는 점 목록 셋은 한 줄로 늘어서서 낮다: 가장 낮은 높이만 받는다
    expect(b.h).toBe(boardFit(H, next).minH(next.find((x) => x.id === 'b')!, BOARD_COLS))
    expect(areaOf(next, 'c').h).toBe(BOARD_ROWS - b.h)
    expect(sound(next)).toBe(true)
  })

  it('빼면 위아래 이웃이 자리를 덮고, 복사하면 자리와 이음표까지 새 id로 따라간다', () => {
    const bs = withLink(insertAt(board(block('number', 'n')), { at: 'n', side: 'below' }, block('delta', 'd'), H)!, { id: 'n', dir: 'v' }, 'arrow')
    const gone = removeBlock(bs, 'd', H)
    expect(areaOf(gone, 'n').h).toBe(BOARD_ROWS)
    expect(gone[0]).not.toHaveProperty('linkBelow')
    const copy = copyBlocks(bs)
    expect(copy.map((b) => b.type)).toEqual(['number', 'delta'])
    expect(copy.some((b) => b.id === 'n' || b.id === 'd')).toBe(false)
    expect(copy.map((b) => b.at)).toEqual(bs.map((b) => b.at))
    expect(linkAt(copy, { id: copy[0].id, dir: 'v' })).toBe('arrow')
  })
})

describe('파일에서 읽은 부품 장', () => {
  it('모르는 부품과 꼴이 틀린 값은 빼고 글은 남긴다, 자리가 판을 덮지 않으면 다시 나눈다', () => {
    const bs = cleanBlocks([
      { id: 'a', type: 'text', fields: { body: '본문', bad: 3 }, items: 'x', look: 'neon', effect: 'spin', at: { x: 0, y: 0, w: 5, h: 5 } },
      { id: 'b', type: 'virus' },
      'junk',
      { id: 'c', type: 'bullets', items: [{ title: '하나', body: 7 }], variant: 'nope', at: { x: 'a', y: 0, w: 1, h: 1 } },
    ])
    expect(bs.map((b) => b.id)).toEqual(['a', 'c'])
    expect(bs[0]).toMatchObject({ id: 'a', type: 'text', fields: { body: '본문' }, items: [] })
    expect(bs[0]).not.toHaveProperty('look')
    expect(bs[1].items[0]).toMatchObject({ title: '하나', body: '' })
    expect(tiles(bs)).toBe(true)
    // 몇 번을 거쳐도 같다
    expect(cleanBlocks(bs)).toEqual(bs)
    expect(cleanBlocks(null)).toEqual([])
  })

  it('나오는 때, 빠르기, 들어오는 쪽은 아는 값만 남긴다', () => {
    const [a, b] = cleanBlocks([
      { id: 'a', type: 'text', fields: {}, items: [], when: 'click', speed: 'slow', from: 'left' },
      { id: 'b', type: 'text', fields: {}, items: [], when: 'later', speed: 9, from: 'up' },
    ])
    expect(a).toMatchObject({ when: 'click', speed: 'slow', from: 'left' })
    expect(b).not.toHaveProperty('when')
    expect(b).not.toHaveProperty('speed')
    expect(b).not.toHaveProperty('from')
  })

  it('예전(0.4까지)의 줄은 판으로 옮긴다: 칸 너비, 쌓은 부품, 이음표가 따라오고 글은 하나도 빠지지 않는다', () => {
    const lost = { n: 0 }
    const rows = [
      {
        id: 'r1',
        spans: [4, 8],
        blocks: [{ ...block('number', 'n'), fields: { value: '12%' }, link: 'arrow', stack: [{ ...block('delta', 'd'), fields: { before: '3' } }] }, block('bars', 'c')],
        link: 'plus',
      },
      { id: 'r2', blocks: [{ ...block('text', 't'), fields: { body: '설명' } }, { id: 'x', type: 'virus' }] },
    ]
    const bs = boardFromRows(rows, boardFit(H), lost)
    expect(bs.map((b) => b.id).sort()).toEqual(['c', 'd', 'n', 't'])
    expect(tiles(bs)).toBe(true)
    // 칸 너비는 그대로, 쌓은 부품은 같은 너비로 아래에
    expect(areaOf(bs, 'n').w).toBe(4)
    expect(areaOf(bs, 'd')).toMatchObject({ x: 0, w: 4 })
    expect(areaOf(bs, 'd').y).toBeGreaterThan(areaOf(bs, 'n').y)
    // 칸 사이 이음표는 맨 위 부품의 오른쪽 선에, 줄 사이 이음표는 판 가운데를 덮는 부품의 아래 선에
    expect(linkAt(bs, { id: 'n', dir: 'h' })).toBe('arrow')
    expect(linkAt(bs, { id: 'c', dir: 'v' })).toBe('plus')
    expect(bs.find((b) => b.id === 'n')!.fields.value).toBe('12%')
    expect(lost.n).toBe(1)
  })
})

describe('발표할 때 나오는 차례', () => {
  const blocks = insertAt(insertAt(board(block('kpi', 'a')), { at: 'a', side: 'right' }, block('callout', 'b'))!, { at: null, side: 'below' }, block('faq', 'c'))!
  const slide = (order?: string[]): Pick<Slide, 'blocks' | 'options'> => ({ blocks, options: order ? { order } : {} })

  it('정한 차례를 앞에, 빠진 부품은 놓인 차례(위에서 아래, 왼쪽에서 오른쪽)로 뒤에', () => {
    expect(playOrder(slide()).map((b) => b.id)).toEqual(['a', 'b', 'c'])
    expect(playOrder(slide(['c'])).map((b) => b.id)).toEqual(['c', 'a', 'b'])
    // 지운 부품의 id와 겹친 id는 건너뛴다
    expect(playOrder(slide(['gone', 'b', 'b', 'a'])).map((b) => b.id)).toEqual(['b', 'a', 'c'])
  })

  it('정하지 않은 값은 기본값으로, 들어오는 쪽은 쪽이 있는 움직임에만', () => {
    const b = block('text')
    expect([whenOf(b), speedOf(b), fromOf(b)]).toEqual(['after', 'normal', null])
    expect(fromOf({ ...b, effect: 'rise' })).toBe('below')
    expect(fromOf({ ...b, effect: 'slide', from: 'left' })).toBe('left')
    expect(fromOf({ ...b, effect: 'fade', from: 'left' })).toBeNull()
  })

  it('장마다 고른 장 넘기기가 발표 전체 설정보다 먼저다', () => {
    const deck = { motion: 'calm' as const, theme: { id: 'white' as const, transition: 'zoom' as const } }
    const s = makeSlide('kpi')
    expect(transitionOf(deck, s)).toBe('zoom')
    expect(transitionOf(deck, { ...s, options: { transition: 'morph' } })).toBe('morph')
    // 장마다의 '움직임에 맞춰'는 따로 정하지 않은 것과 같다
    expect(transitionOf(deck, { ...s, options: { transition: 'auto' } })).toBe('zoom')
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

  it('빈 부품은 빠지고 남은 부품이 그 자리를 덮는다', () => {
    const bs = board(filled('text', 'a'), block('text', 'b'))
    const shown = shownBlocks(bs)
    expect(shown.map((b) => b.id)).toEqual(['a'])
    expect(tiles(shown)).toBe(true)
  })

  it('빠진 부품에 닿아 있던 이음표도 뗀다: 남은 두 부품 사이에 서면 뜻이 바뀐다', () => {
    let bs = insertAt(insertAt(board(filled('number', 'a')), { at: 'a', side: 'right' }, block('number', 'b'))!, { at: 'b', side: 'right' }, filled('number', 'c'))!
    bs = withLink(withLink(bs, { id: 'a', dir: 'h' }, 'arrow'), { id: 'b', dir: 'h' }, 'plus')
    const shown = shownBlocks(bs)
    expect(shown.map((b) => b.id)).toEqual(['a', 'c'])
    expect(shown.every((b) => !b.link)).toBe(true)
  })

  it('빈 부품이 없으면 그대로, 사람이 적은 글은 하나도 빠지지 않는다', () => {
    const bs = board(filled('text', 'a'), filled('number', 'b'))
    expect(shownBlocks(bs)).toBe(bs)
    const mixed = board(filled('text', 'a'), block('quote', 'q'), block('number', 'n'))
    expect(shownBlocks(mixed).map((b) => b.id)).toEqual(['a'])
  })
})

describe('이음표', () => {
  // 위에 숫자 둘, 아래에 설명
  const bs = insertAt(insertAt(board(block('number', 'a')), { at: 'a', side: 'right' }, block('number', 'b'))!, { at: null, side: 'below' }, block('text', 'c'))!

  it('부품 사이의 선에만 선다: 오른쪽 선과 아래 선', () => {
    expect(linkTargets(bs)).toEqual(
      expect.arrayContaining([
        { id: 'a', dir: 'h' },
        { id: 'a', dir: 'v' },
        { id: 'b', dir: 'v' },
      ]),
    )
    expect(linkTargets(bs).some((t) => t.id === 'b' && t.dir === 'h')).toBe(false)
    expect(linkTargets(bs).some((t) => t.id === 'c')).toBe(false)
    const linked = withLink(withLink(bs, { id: 'a', dir: 'h' }, 'arrow'), { id: 'a', dir: 'v' }, 'equals')
    expect(linkAt(linked, { id: 'a', dir: 'h' })).toBe('arrow')
    expect(linkAt(linked, { id: 'a', dir: 'v' })).toBe('equals')
    // 빼면 값이 남지 않는다
    expect(withLink(linked, { id: 'a', dir: 'h' }, null).find((b) => b.id === 'a')).not.toHaveProperty('link')
  })

  it('뜻이 서는 짝만 잇는다: 더하기와 견주기는 같은 갈래끼리, 결과는 숫자나 한마디로', () => {
    expect(linkFits('plus', 'number', 'delta')).toBe(true)
    expect(linkFits('versus', 'goal', 'market')).toBe(false)
    expect(linkFits('arrow', 'bullets', 'message')).toBe(true)
    expect(linkFits('equals', 'bullets', 'number')).toBe(true)
    expect(linkFits('equals', 'bullets', 'bullets')).toBe(false)
    expect(linkIssue(bs, { id: 'a', dir: 'h' }, 'plus')).toBeNull()
    expect(linkIssue(bs, { id: 'a', dir: 'v' }, 'versus')).toEqual({ from: 'number', to: 'text' })
  })

  it('이음표가 선 자리는 양쪽 부품이 비켜 나는 만큼 높이가 더 든다', () => {
    const fit = boardFit(H, bs)
    expect(needRows(withLink(bs, { id: 'a', dir: 'v' }, 'arrow'), fit)).toBeGreaterThanOrEqual(needRows(bs, fit))
  })

  it('설 데가 없어진 이음표는 빠진다: 건너편 부품을 빼면', () => {
    const linked = withLink(withLink(bs, { id: 'a', dir: 'h' }, 'arrow'), { id: 'b', dir: 'v' }, 'equals')
    expect(removeBlock(linked, 'b').find((b) => b.id === 'a')).not.toHaveProperty('link')
    expect(removeBlock(linked, 'c').find((b) => b.id === 'b')).not.toHaveProperty('linkBelow')
    expect(tidyLinks(linked)).toBe(linked)
  })

  it('파일에서 읽을 때 아는 이음표만, 설 데가 있는 것만 남긴다', () => {
    const raw = bs.map((b) => (b.id === 'a' ? { ...b, link: 'arrow', linkBelow: 'spiral' } : b.id === 'c' ? { ...b, link: 'plus', linkBelow: 'plus' } : b))
    const clean = cleanBlocks(raw)
    expect(clean.map((b) => [b.link ?? null, b.linkBelow ?? null])).toEqual([
      ['arrow', null],
      [null, null],
      [null, null],
    ])
  })
})

describe('이미지에 맞춘 칸 크기', () => {
  const img = (fields: Record<string, string> = {}) => ({ ...block('image', 'img'), fields: { image: 'data:image/png;base64,', ...fields } })
  const pair = () => insertAt(board(img()), { at: 'img', side: 'right' }, block('bullets', 't'), H)!

  it('넓은 화면 캡처는 넓은 칸으로, 세로 사진은 좁은 칸으로', () => {
    expect(areaOf(fitImage(pair(), 'img', 16 / 10, H), 'img').w).toBeGreaterThan(6)
    expect(areaOf(fitImage(pair(), 'img', 3 / 4, H), 'img').w).toBeLessThan(6)
  })

  it('판에 이미지 하나뿐이면 그대로', () => {
    const alone = board(img())
    expect(fitImage(alone, 'img', 3 / 4, H)).toBe(alone)
  })

  it('고른 크기에서도 이웃이 잘리지 않는다', () => {
    for (const aspect of [0.4, 0.75, 1, 1.6, 3]) expect(sound(fitImage(insertAt(board(img()), { at: 'img', side: 'right' }, block('points', 't'), H)!, 'img', aspect, H))).toBe(true)
  })

  // 가로세로가 읽히는 PNG (IHDR까지만)
  const png = (w: number, h: number) => {
    const be32 = (n: number) => String.fromCharCode((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255)
    return `data:image/png;base64,${btoa(`\x89PNG\r\n\x1a\n${be32(13)}IHDR${be32(w)}${be32(h)}\x08\x06\x00\x00\x00`)}`
  }

  it('붙여 넣은 세로 이미지는 장 너비의 낮은 띠가 아니라 옆 칸으로', () => {
    const bs = board(block('bullets', 't'))
    const portrait = { ...img(), fields: { image: png(900, 1200) } }
    const t = imagePlace(bs, portrait, H)
    expect(t?.kind === 'spot' && (t.spot.side === 'left' || t.spot.side === 'right')).toBe(true)
    const placed = autoPlace(bs, portrait, H)!
    expect(areaOf(placed, 'img').h).toBe(BOARD_ROWS)
  })

  it('이웃을 빼면 남은 판을 이미지에 다시 맞춘다', () => {
    const shot = { ...img(), fields: { image: png(1600, 1000) } }
    const bs = insertAt(insertAt(board(shot), { at: 'img', side: 'right' }, block('bullets', 't'), H)!, { at: 't', side: 'right' }, block('number', 'n'), H)!
    expect(areaOf(removeBlock(bs, 'n', H), 'img').w).toBeGreaterThan(6)
  })
})
