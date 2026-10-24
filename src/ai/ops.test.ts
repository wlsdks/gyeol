import { describe, expect, it } from 'vitest'
import { BLOCKS, canCompose } from '../deck/blocks'
import { createSampleDeck } from '../deck/sample'
import type { Deck, Item } from '../deck/types'
import { applyOps, parseOp, parseRequest, REQUEST_FORMAT, slideEmpty, type Op } from './ops'
import { checkShape, shapeSlideId, toShape } from './share'

const deck = createSampleDeck()
const shape = toShape(deck)
const sid = (i: number) => shape.slides[i].id
const run = (...ops: Op[]) => applyOps(deck, ops)

/** 사람이 적은 글만 모은다. 적용 전후로 같아야 한다(지운 빈 장 제외). */
function writtenText(d: typeof deck) {
  return d.slides
    .filter((s) => !slideEmpty(s))
    .map((s) => JSON.stringify([s.id, s.fields, s.items.filter((it) => it.title || it.body || it.value || it.meta || it.image).map((it) => [it.id, it.title, it.body, it.value, it.meta, it.image]), s.notes]))
    .sort()
}

describe('제안 읽기', () => {
  it('칸의 글을 쓰는 동작은 없다', () => {
    expect(parseOp({ op: 'set_field', slide: sid(0), key: 'title', text: 'x' })).toBeNull()
    expect(parseOp({ op: 'set_item', slide: sid(0), item: 0, key: 'body', text: 'x' })).toBeNull()
    expect(parseOp({ op: 'set_title', text: 'x' })).toBeNull()
  })

  it('모르는 키가 섞이면 받지 않는다', () => {
    expect(parseOp({ op: 'set_layout', slide: sid(1), layout: 'points', fields: { title: 'x' } })).toBeNull()
    expect(parseOp({ op: 'add_slide', after: null, layout: 'points', fields: { title: 'x' } })).toBeNull()
    expect(parseOp({ op: 'set_layout', slide: sid(1), layout: 'points' })).not.toBeNull()
  })

  it('안내 글은 짧은 한 줄만, 제어 문자는 받지 않는다', () => {
    expect(parseOp({ op: 'set_hint', slide: sid(1), field: 'title', text: 'a'.repeat(81) })).toBeNull()
    expect(parseOp({ op: 'set_hint', slide: sid(1), field: 'title', text: '한 줄\n두 줄' })).toBeNull()
    expect(parseOp({ op: 'set_hint', slide: sid(1), field: 'title', text: '방향‮바꾸기' })).toBeNull()
    expect(parseOp({ op: 'set_hint', slide: sid(1), field: 'title', text: '결론을 한 줄로' })).not.toBeNull()
  })

  it('요청 파일은 통째로 확인한다', () => {
    const base = { format: REQUEST_FORMAT, version: 1, id: 'r0123456789ab', deck: shape.deck, createdAt: 1, note: '', ops: [{ op: 'set_hidden', slide: sid(2), hidden: true }] }
    expect(parseRequest(base)).not.toBeNull()
    expect(parseRequest({ ...base, ops: [...base.ops, { op: 'nope' }] })).toBeNull()
    expect(parseRequest({ ...base, ops: [] })).toBeNull()
    expect(parseRequest({ ...base, extra: 1 })).toBeNull()
    expect(parseRequest({ ...base, id: '../../x' })).toBeNull()
  })
})

describe('제안 적용', () => {
  it('레이아웃, 순서, 숨김, 테마를 바꿔도 적은 글은 그대로다', () => {
    const { deck: next, results } = run(
      { op: 'set_layout', slide: sid(5), layout: 'bars' },
      { op: 'move_slide', slide: sid(3), after: sid(6) },
      { op: 'set_hidden', slide: sid(2), hidden: true },
      { op: 'set_theme', theme: 'navy', accent: '#FF6600' },
      { op: 'set_hint', slide: sid(1), field: 'body', item: 0, text: '배경을 숫자 하나로' },
      { op: 'set_guide', slide: sid(1), text: '결론부터 쓰세요' },
    )
    expect(results.every((r) => r.ok)).toBe(true)
    expect(writtenText(next)).toEqual(writtenText(deck))
    expect(next.theme).toEqual({ id: 'navy', accent: '#ff6600' })
    expect(next.slides.find((s) => shapeSlideId(s) === sid(5))?.layout).toBe('bars')
    expect(next.slides[1].hints['items.0.body']).toBe('배경을 숫자 하나로')
  })

  it('내용이 있는 장과 항목은 지우지 못한다', () => {
    const { deck: next, results } = run({ op: 'remove_slide', slide: sid(1) }, { op: 'set_item_count', slide: sid(1), count: 2 })
    expect(results.map((r) => r.code)).toEqual(['has_content', 'has_content'])
    expect(next.slides).toEqual(deck.slides)
  })

  it('새로 넣은 빈 장은 지울 수 있고, 같은 제안 안에서 이름으로 가리킬 수 있다', () => {
    const { deck: next, results } = run(
      { op: 'add_slide', after: sid(1), role: '위험과 대응', as: 'n1' },
      { op: 'set_hint', slide: 'n1', field: 'title', text: '가장 큰 위험 하나' },
      { op: 'set_item_count', slide: 'n1', count: 4 },
    )
    expect(results.every((r) => r.ok)).toBe(true)
    const added = next.slides[2]
    expect(added.layout).toBe('compare')
    expect(added.purpose).toBe('위험과 대응')
    expect(added.fields.leftTitle).toBe('예상 위험')
    expect(added.items).toHaveLength(4)
    expect(added.hints.title).toBe('가장 큰 위험 하나')
    const removed = applyOps(next, [{ op: 'remove_slide', slide: shapeSlideId(added) }])
    expect(removed.results[0].ok).toBe(true)
    expect(removed.deck.slides).toHaveLength(deck.slides.length)
  })

  it('맞지 않는 옵션은 건너뛴다', () => {
    const { results } = run({ op: 'set_options', slide: sid(0), highlight: 1 }, { op: 'set_options', slide: 's00000000', flip: true })
    expect(results.map((r) => r.code)).toEqual(['not_for_layout', 'no_slide'])
  })

  it('장마다 바탕과 움직임, 발표 전체의 글꼴과 전환을 정해진 값으로만 바꾼다', () => {
    const body = shape.slides.findIndex((s) => s.layout === 'kpi')
    const { deck: next, results } = run(
      { op: 'set_options', slide: sid(body), tone: 'invert', motion: 'lively' },
      { op: 'set_options', slide: sid(0), tone: 'accent' },
      { op: 'set_theme', font: 'serif', size: 'large', footer: 'page', transition: 'zoom' },
      { op: 'set_theme', font: 'serif', size: 'large' },
    )
    expect(results.map((r) => r.code)).toEqual(['applied', 'not_for_layout', 'applied', 'no_change'])
    expect(next.slides[body].options).toMatchObject({ tone: 'invert', motion: 'lively' })
    expect(next.theme).toMatchObject({ font: 'serif', size: 'large', footer: 'page', transition: 'zoom' })
    expect(writtenText(next)).toEqual(writtenText(deck))

    const back = applyOps(next, [{ op: 'set_options', slide: sid(body), tone: 'base', motion: null }]).deck
    expect(back.slides[body].options.tone).toBeUndefined()
    expect(back.slides[body].options.motion).toBeUndefined()

    expect(parseOp({ op: 'set_options', slide: sid(body), tone: 'neon' })).toBeNull()
    expect(parseOp({ op: 'set_theme', font: 'Comic Sans' })).toBeNull()
    // 글꼴 짝은 카탈로그에 있는 것 모두
    for (const font of ['sans', 'suit', 'serif', 'myeongjo']) {
      const op = parseOp({ op: 'set_theme', font })
      expect(op, font).not.toBeNull()
      expect(applyOps(deck, [op!]).deck.theme.font).toBe(font)
    }
    expect(parseOp({ op: 'set_theme', transition: 'spin' })).toBeNull()
  })

  it('두 판으로 나뉜 장은 옆 판의 자리와 너비를 정해진 값으로만 바꾼다. 글은 그대로', () => {
    const cover = shape.slides.findIndex((s) => s.layout === 'cover')
    const closing = shape.slides.findIndex((s) => s.layout === 'closing')
    const kpi = shape.slides.findIndex((s) => s.layout === 'kpi')
    const { deck: next, results } = run(
      { op: 'set_options', slide: sid(cover), flip: true, pane: 5 },
      { op: 'set_options', slide: sid(closing), pane: 9 },
      { op: 'set_options', slide: sid(kpi), flip: true },
    )
    expect(results.map((r) => r.code)).toEqual(['applied', 'out_of_range', 'not_for_layout'])
    expect(next.slides[cover].options).toMatchObject({ flip: true, pane: 5 })
    expect(writtenText(next)).toEqual(writtenText(deck))
    // 모양에 옆 판의 자리와 너비가 숫자와 참거짓으로만 실린다
    const s = toShape(next).slides[cover]
    expect(s.options).toMatchObject({ flip: true, pane: 5 })
    expect(checkShape(toShape(next))).toBe(true)
    // 기본 너비로 되돌리면 값이 남지 않는다
    const back = applyOps(next, [{ op: 'set_options', slide: sid(cover), pane: null, flip: false }]).deck
    expect(back.slides[cover].options.pane).toBeUndefined()
    expect(back.slides[cover].options.flip).toBeUndefined()
    // 아래 띠 모양의 표지는 판이 아래에 있어서 좌우와 너비가 없다
    const band = applyOps(deck, [{ op: 'set_layout', slide: sid(cover), layout: 'cover', variant: 'band' }]).deck
    expect(applyOps(band, [{ op: 'set_options', slide: sid(cover), flip: true }]).results[0].code).toBe('not_for_layout')
    expect(parseOp({ op: 'set_options', slide: sid(cover), pane: 1.5 })).toBeNull()
    expect(parseOp({ op: 'set_options', slide: sid(cover), pane: '4' })).toBeNull()
  })
})

describe('부품 장', () => {
  const block = (id: string, fields: Record<string, string> = {}) => ({ id, type: 'text' as const, fields, items: [] })
  const withCompose = (fields: Record<string, string>) => {
    const d = createSampleDeck()
    const slide = { ...d.slides[1], id: 'compose-1', layout: 'compose' as const, fields: {}, items: [], notes: '', rows: [{ id: 'r', blocks: [block('b', fields)] }] }
    return { ...d, slides: [...d.slides, slide] }
  }

  /** 발표의 모든 글 (장의 칸과 항목, 부품의 칸과 항목, 노트). 모양만 바꾸는 제안 전후로 같아야 한다 */
  function allText(d: Deck): string[] {
    const out: string[] = []
    const keys = ['title', 'body', 'value', 'meta', 'image'] as const
    const take = (fields: Record<string, string>, items: Item[]) => {
      for (const v of Object.values(fields)) if (v.trim()) out.push(v)
      for (const it of items) for (const k of keys) if (it[k]?.trim()) out.push(it[k]!)
    }
    for (const s of d.slides) {
      take(s.fields, s.items)
      for (const r of s.rows ?? []) for (const b of r.blocks) take(b.fields, b.items)
      if (s.notes.trim()) out.push(s.notes)
    }
    return out.sort()
  }

  // 예시 발표에서 항목이 있고 부품 장으로 바꿀 수 있는 첫 장을 부품 장으로 바꾼 것
  const at = deck.slides.findIndex((s) => canCompose(s.layout) && s.layout !== 'statement' && s.layout !== 'imageText' && s.layout !== 'case' && s.items.length > 0)
  const composed = applyOps(deck, [{ op: 'set_layout', slide: sid(at), layout: 'compose' }]).deck
  const cshape = () => toShape(composed).slides[at]

  it('장을 부품 장으로 바꿔도 글은 하나도 잃지 않고, 부품에 해시 id가 붙는다', () => {
    const { deck: next, results } = applyOps(deck, [{ op: 'set_layout', slide: sid(at), layout: 'compose' }])
    expect(results[0]).toEqual({ ok: true, code: 'applied' })
    expect(next.slides[at].layout).toBe('compose')
    expect(allText(next)).toEqual(allText(deck))
    const ids = cshape().blocks!.flat().map((b) => b.id)
    expect(ids.every((id) => /^b[0-9a-f]{8}$/.test(id!))).toBe(true)
    expect(checkShape(toShape(next))).toBe(true)
  })

  it('표지와 단락 장은 부품 장으로 바꾸지 않는다', () => {
    const cover = deck.slides.findIndex((s) => s.layout === 'cover')
    expect(applyOps(deck, [{ op: 'set_layout', slide: sid(cover), layout: 'compose' }]).results[0]).toEqual({ ok: false, code: 'not_for_layout' })
  })

  it('그 레이아웃의 부품 하나뿐인 부품 장만 다시 그 레이아웃으로 되돌린다', () => {
    const layout = deck.slides[at].layout
    const back = applyOps(composed, [{ op: 'set_layout', slide: cshape().id, layout }])
    expect(back.results[0]).toEqual({ ok: true, code: 'applied' })
    expect(back.deck.slides[at].layout).toBe(layout)
    expect(allText(back.deck)).toEqual(allText(deck))
    // 부품이 더 있으면 되돌리면서 그 부품을 버리게 되므로 하지 않는다
    const more = applyOps(composed, [{ op: 'add_block', slide: cshape().id, type: 'callout', row: 1 }]).deck
    expect(applyOps(more, [{ op: 'set_layout', slide: cshape().id, layout }]).results[0]).toEqual({ ok: false, code: 'not_for_layout' })
  })

  it('빈 부품을 넣고 같은 제안 안에서 이름으로 가리켜 모양, 너비, 자리를 바꾼다. 글은 그대로', () => {
    const sh = cshape()
    const { deck: next, results } = applyOps(composed, [
      { op: 'add_block', slide: sh.id, type: 'number', row: 1, as: 'p1' },
      { op: 'add_block', slide: sh.id, type: 'callout', beside: 'p1', as: 'p2' },
      { op: 'set_block', slide: sh.id, block: 'p2', look: 'card', effect: 'rise' },
      { op: 'set_spans', slide: sh.id, block: 'p1', spans: [8, 4] },
      { op: 'move_block', slide: sh.id, block: 'p2', beside: 'p1', side: 'before' },
      // 이미 그 자리면 바꾸지 않는다
      { op: 'move_block', slide: sh.id, block: 'p2', beside: 'p1', side: 'before' },
    ])
    expect(results.map((r) => r.code)).toEqual(['applied', 'applied', 'applied', 'applied', 'applied', 'no_change'])
    const row = next.slides[at].rows![1]
    expect(row.blocks.map((b) => b.type)).toEqual(['callout', 'number'])
    expect(row.blocks[0]).toMatchObject({ look: 'card', effect: 'rise', fields: {} })
    expect(allText(next)).toEqual(allText(composed))
    // 처음 있던 부품(글이 든 것)도 옮길 수 있고, 글은 부품과 함께 간다
    const first = sh.blocks![0][0].id!
    const moved = applyOps(next, [{ op: 'move_block', slide: sh.id, block: first, row: 1 }])
    expect(moved.results[0]).toEqual({ ok: true, code: 'applied' })
    expect(moved.deck.slides[at].rows!.map((r) => r.blocks.map((b) => b.type))).toEqual([['callout', 'number'], [composed.slides[at].rows![0].blocks[0].type]])
    expect(allText(moved.deck)).toEqual(allText(composed))
  })

  it('줄 높이 비중을 바꾸고 되돌린다. 글은 그대로', () => {
    const two = applyOps(composed, [{ op: 'add_block', slide: cshape().id, type: 'callout', row: 1 }]).deck
    const sh = toShape(two).slides[at]
    expect(sh.rowGrow).toBeUndefined()
    const { deck: next, results } = applyOps(two, [
      { op: 'set_row_grow', slide: sh.id, grow: [70, 30] },
      { op: 'set_row_grow', slide: sh.id, grow: [70, 30] },
      { op: 'set_row_grow', slide: sh.id, grow: [50, 30, 20] },
    ])
    expect(results.map((r) => r.code)).toEqual(['applied', 'no_change', 'out_of_range'])
    expect(next.slides[at].rows!.map((r) => r.grow)).toEqual([70, 30])
    expect(toShape(next).slides[at].rowGrow).toEqual([70, 30])
    expect(allText(next)).toEqual(allText(two))
    const back = applyOps(next, [{ op: 'set_row_grow', slide: sh.id, grow: [] }])
    expect(back.results[0]).toEqual({ ok: true, code: 'applied' })
    expect(toShape(back.deck).slides[at].rowGrow).toBeUndefined()
    // 범위 밖의 값은 제안으로 받지 않는다
    expect(parseOp({ op: 'set_row_grow', slide: sh.id, grow: [0, 100] })).toBeNull()
    expect(parseOp({ op: 'set_row_grow', slide: sh.id, grow: [50, 50], note: 'x' })).toBeNull()
  })

  it('이음표를 부품 사이와 줄 사이에 끼우고 바꾸고 뺀다. 글은 그대로', () => {
    const sh = cshape()
    const first = sh.blocks![0][0].id!
    const { deck: next, results } = applyOps(composed, [
      { op: 'add_block', slide: sh.id, type: 'number', row: 1, as: 'p1' },
      { op: 'add_block', slide: sh.id, type: 'number', beside: 'p1', as: 'p2' },
      { op: 'set_link', slide: sh.id, block: 'p1', side: 'right', link: 'arrow' },
      { op: 'set_link', slide: sh.id, block: 'p1', side: 'right', link: 'arrow' },
      { op: 'set_link', slide: sh.id, block: first, side: 'below', link: 'plus' },
      // 줄의 마지막 부품 오른쪽, 마지막 줄 아래에는 설 데가 없다
      { op: 'set_link', slide: sh.id, block: 'p2', side: 'right', link: 'plus' },
      { op: 'set_link', slide: sh.id, block: 'p1', side: 'below', link: 'plus' },
    ])
    expect(results.map((r) => r.code)).toEqual(['applied', 'applied', 'applied', 'no_change', 'applied', 'out_of_range', 'out_of_range'])
    const rows = next.slides[at].rows!
    expect(rows[1].blocks[0].link).toBe('arrow')
    expect(rows[0].link).toBe('plus')
    const shaped = toShape(next).slides[at]
    expect(shaped.blocks![1][0].link).toBe('arrow')
    expect(shaped.rowLinks).toEqual(['plus'])
    expect(checkShape(toShape(next))).toBe(true)
    expect(allText(next)).toEqual(allText(composed))
    const p1 = shaped.blocks![1][0].id!
    const off = applyOps(next, [{ op: 'set_link', slide: sh.id, block: p1, side: 'right', link: null }])
    expect(off.results[0]).toEqual({ ok: true, code: 'applied' })
    expect(off.deck.slides[at].rows![1].blocks[0]).not.toHaveProperty('link')
    // 오른쪽 부품을 빼면 설 데가 없어진 이음표도 빠진다
    const gone = applyOps(next, [{ op: 'remove_block', slide: sh.id, block: shaped.blocks![1][1].id! }])
    expect(gone.results[0]).toEqual({ ok: true, code: 'applied' })
    expect(gone.deck.slides[at].rows![1].blocks[0]).not.toHaveProperty('link')
    // 카탈로그에 없는 이음표, 모르는 자리는 받지 않는다
    expect(parseOp({ op: 'set_link', slide: sh.id, block: first, side: 'right', link: 'spiral' })).toBeNull()
    expect(parseOp({ op: 'set_link', slide: sh.id, block: first, side: 'left', link: 'arrow' })).toBeNull()
    expect(parseOp({ op: 'set_link', slide: sh.id, block: first, side: 'right', link: 'arrow', text: 'x' })).toBeNull()
  })

  it('빈 부품만 빼고, 글이 있는 부품은 빼지 않는다', () => {
    const sh = cshape()
    const { deck: next, results } = applyOps(composed, [
      { op: 'add_block', slide: sh.id, type: 'number', row: 1, as: 'p1' },
      { op: 'remove_block', slide: sh.id, block: 'p1' },
      { op: 'remove_block', slide: sh.id, block: sh.blocks![0][0].id! },
    ])
    expect(results.map((r) => r.code)).toEqual(['applied', 'applied', 'has_content'])
    expect(next.slides[at].rows).toHaveLength(1)
  })

  it('항목 수는 정한 범위에서, 줄일 때는 끝의 빈 항목만', () => {
    const sh = cshape()
    const b = composed.slides[at].rows![0].blocks[0]
    const n = b.items.length
    const { results } = applyOps(composed, [
      { op: 'set_block', slide: sh.id, block: sh.blocks![0][0].id!, count: n - 1 },
      { op: 'set_block', slide: sh.id, block: sh.blocks![0][0].id!, count: 99 },
    ])
    expect(results.map((r) => r.code)).toEqual(['has_content', 'out_of_range'])
  })

  it('자리가 모자라면 넣지 않는다', () => {
    const sh = cshape()
    const ops: Op[] = Array.from({ length: 8 }, () => ({ op: 'add_block' as const, slide: sh.id, type: 'number' as const }))
    const { deck: next, results } = applyOps(composed, ops)
    expect(results.some((r) => r.code === 'no_room')).toBe(true)
    expect(next.slides[at].rows!.flatMap((r) => r.blocks).length).toBeLessThanOrEqual(6)
  })

  it('없는 부품, 정해지지 않은 너비, 부품 장이 아닌 장은 건너뛴다', () => {
    const sh = cshape()
    const { results } = applyOps(composed, [
      { op: 'set_block', slide: sh.id, block: 'b00000000', look: 'card' },
      { op: 'set_spans', slide: sh.id, block: sh.blocks![0][0].id!, spans: [5] },
      { op: 'add_block', slide: sid(0), type: 'number' },
    ])
    expect(results.map((r) => r.code)).toEqual(['no_block', 'out_of_range', 'not_for_layout'])
  })

  it('부품의 칸 안내 문구를 바꾼다 (글은 그대로)', () => {
    const sh = cshape()
    const id = sh.blocks![0][0].id!
    const type = composed.slides[at].rows![0].blocks[0].type
    const field = BLOCKS[type].items?.fields[0].key ?? BLOCKS[type].fields[0].key
    const { deck: next, results } = applyOps(composed, [
      { op: 'set_hint', slide: sh.id, block: id, field, text: '숫자부터 적어 주세요' },
      { op: 'set_hint', slide: sh.id, block: id, field: 'nothing', text: '안내' },
    ])
    expect(results.map((r) => r.code)).toEqual(['applied', 'not_for_layout'])
    expect(Object.values(next.slides[at].rows![0].blocks[0].hints ?? {})).toContain('숫자부터 적어 주세요')
    expect(allText(next)).toEqual(allText(composed))
  })

  it('부품의 글을 쓰는 키는 받지 않는다', () => {
    const sh = cshape()
    const id = sh.blocks![0][0].id!
    expect(parseOp({ op: 'add_block', slide: sh.id, type: 'text', fields: { body: 'x' } })).toBeNull()
    expect(parseOp({ op: 'set_block', slide: sh.id, block: id, fields: { body: 'x' } })).toBeNull()
    expect(parseOp({ op: 'set_block', slide: sh.id, block: id, items: [{ title: 'x' }] })).toBeNull()
    expect(parseOp({ op: 'move_block', slide: sh.id, block: id })).toBeNull()
    expect(parseOp({ op: 'add_block', slide: sh.id, type: 'text', row: 0, beside: id })).toBeNull()
  })

  it('빈 부품 장을 새로 만들 수 있다', () => {
    const { deck: next, results } = applyOps(deck, [
      { op: 'add_slide', after: sid(0), layout: 'compose', as: 'n1' },
      { op: 'add_block', slide: 'n1', type: 'number' },
      { op: 'add_block', slide: 'n1', type: 'number' },
    ])
    expect(results.map((r) => r.code)).toEqual(['applied', 'applied', 'applied'])
    expect(next.slides[1].layout).toBe('compose')
    expect(next.slides[1].rows!.flatMap((r) => r.blocks)).toHaveLength(2)
  })

  it('부품이 있는 장은 글을 비워 둬도 빈 장이 아니라서 지우지 못한다', () => {
    const d = withCompose({})
    expect(slideEmpty(d.slides[d.slides.length - 1])).toBe(false)
    const id = shapeSlideId(d.slides[d.slides.length - 1])
    const { deck: next, results } = applyOps(d, [{ op: 'remove_slide', slide: id }])
    expect(results[0]).toEqual({ ok: false, code: 'has_content' })
    expect(next.slides).toHaveLength(d.slides.length)
  })
})
