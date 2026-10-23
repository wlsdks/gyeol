import { describe, expect, it } from 'vitest'
import { createSampleDeck } from '../deck/sample'
import { applyOps, parseOp, parseRequest, REQUEST_FORMAT, slideEmpty, type Op } from './ops'
import { shapeSlideId, toShape } from './share'

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
    expect(parseOp({ op: 'set_theme', transition: 'spin' })).toBeNull()
  })
})
