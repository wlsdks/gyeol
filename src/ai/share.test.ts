import { describe, expect, it } from 'vitest'
import { AUDIENCES, DECK_TYPES } from '../deck/blueprints'
import { createDeck } from '../deck/generate'
import { createSampleDeck } from '../deck/sample'
import { LAYOUTS } from '../deck/layouts'
import type { Block, BlockRow, Deck, LayoutId } from '../deck/types'
import { parseOp } from './ops'
import { HIGHLIGHT_MAX, HIGHLIGHT_MIN } from './protocol'
import { checkShape, onlyKnownStrings, toShape } from './share'

export const SECRET = '기밀7731'

/** 사람이 글을 적을 수 있는 모든 곳, 그리고 가져온 파일이라면 아무 글이나 들어 있을 수 있는 곳에 비밀을 심는다 */
export function secretDeck(): Deck {
  const deck = createSampleDeck()
  const s = (k: string) => `${SECRET}-${k}`
  return {
    ...deck,
    id: s('deck-id'),
    title: s('title'),
    // 발표 종류, 듣는 사람, 방식도 고르는 값이지만 가져온 파일(또는 새 버전이 더한 값)이면 아무 글이나 있을 수 있다
    meta: {
      ...deck.meta,
      type: s('type'),
      audience: s('audience'),
      method: s('method'),
      org: s('org'),
      presenter: s('presenter'),
      date: s('date'),
      contact: s('contact'),
      logo: `data:image/png;base64,${SECRET}`,
    } as unknown as Deck['meta'],
    // 가져온 파일이면 고르는 값 자리에도 아무 글이나 들어 있을 수 있다
    theme: { id: deck.theme.id, accent: s('accent'), font: s('font'), size: s('size'), footer: s('footer'), transition: s('transition') } as unknown as Deck['theme'],
    slides: (deck.slides.map((slide, i) => ({
      ...slide,
      id: s(`slide-${i}`),
      purpose: s('purpose'),
      section: s('section'),
      guide: s('guide'),
      notes: s('notes'),
      hints: { title: s('hint') },
      options: { ...slide.options, motion: s('motion'), tone: s('tone') } as unknown as Deck['slides'][number]['options'],
      fields: Object.fromEntries([...Object.keys(slide.fields), 'title', 'lead', 'body'].map((k) => [k, s(`field-${k}`)])),
      items: slide.items.map((it, j) => ({ ...it, id: s(`item-${j}`), title: s('t'), body: s('b'), value: s('v'), meta: s('m'), image: s('img') })),
    })) as Deck['slides']).concat(composeSecret(s)),
  }
}

/** 부품 장: 부품의 칸, 항목, 안내, id, 그리고 고르는 값 자리(바탕, 움직임, 모양, 너비)에도 비밀을 심는다 */
function composeSecret(s: (k: string) => string): Deck['slides'] {
  const it = (j: number) => ({ id: s(`bi-${j}`), title: s('bt'), body: s('bb'), value: s('bv'), meta: s('bm'), image: s('bimg') })
  const block = (type: string, j: number) =>
    ({ id: s(`block-${j}`), type, fields: { text: s('bf'), body: s('bf'), label: s('bf'), [s('key')]: s('bf') }, items: [it(0), it(1)], hints: { body: s('bh') }, look: s('look'), effect: s('fx'), variant: s('va'), highlight: 1 }) as unknown as Block
  return [
    {
      id: s('compose'),
      layout: 'compose',
      purpose: s('purpose'),
      section: s('section'),
      guide: s('guide'),
      notes: s('notes'),
      hints: { title: s('hint') },
      options: {},
      fields: { title: s('ct'), lead: s('cl') },
      items: [],
      // 이음표 자리에도: 첫 줄은 맞는 이음표, 둘째 줄과 마지막 부품은 비밀
      rows: [
        { id: s('row-1'), spans: [s('span')] as unknown as number[], blocks: [{ ...block('message', 1), link: 'arrow' }, { ...block('bullets', 2), link: s('link') } as unknown as Block], link: 'plus' },
        { id: s('row-2'), blocks: [{ ...block('kpi', 3), link: s('link') } as unknown as Block, block(s('type'), 4)], link: s('rowlink') } as unknown as BlockRow,
      ],
    },
  ]
}

describe('모양만 고르기', () => {
  it('적은 글, 제목, 이름, 노트, 이미지, 원래 id가 하나도 들어가지 않는다', () => {
    const text = JSON.stringify(toShape(secretDeck()))
    expect(text).not.toContain(SECRET)
    expect(text).not.toContain('7731')
  })

  it('카탈로그에 없는 역할과 단락 이름은 null로 둔다', () => {
    const shape = toShape(secretDeck())
    expect(shape.slides.every((s) => s.role === null && s.section === null)).toBe(true)
    expect(shape.accent).toBeNull()
  })

  it('부품 장은 부품의 종류, 너비, 바탕, 움직임과 칸 상태만 보인다', () => {
    const shape = toShape(secretDeck())
    const compose = shape.slides.find((x) => x.layout === 'compose')!
    expect(compose.blocks?.map((r) => r.map((b) => b.type))).toEqual([['message', 'bullets'], ['kpi']])
    expect(compose.blocks?.[0][0]).toMatchObject({ look: 'plain', effect: 'auto', variant: 'base', fields: { text: 'filled' } })
    expect(compose.blocks?.[0].reduce((a, b) => a + b.span, 0)).toBe(12)
    // 이음표는 카탈로그의 말만: 맞지 않는 값과 설 데가 없는 것(줄의 끝, 마지막 줄 아래)은 빠진다
    expect(compose.blocks?.[0].map((b) => b.link)).toEqual(['arrow', undefined])
    expect(compose.blocks?.[1][0].link).toBeUndefined()
    expect(compose.rowLinks).toEqual(['plus'])
    expect(checkShape(shape)).toBe(true)
  })

  it('원래 덱에서는 장 역할과 칸 상태가 보인다', () => {
    const shape = toShape(createSampleDeck())
    expect(shape.slides[1]).toMatchObject({ layout: 'summary', role: '한 장 요약', fields: { title: 'filled' } })
    expect(shape.slides[1].items).toHaveLength(4)
    expect(shape.slides.find((s) => s.layout === 'kpi')?.items[0]).toEqual({ value: 'filled', title: 'filled', body: 'filled' })
    expect(checkShape(shape)).toBe(true)
  })

  it('비밀을 심은 덱에서 만든 모양도 꼴은 맞다', () => {
    const shape = toShape(secretDeck())
    expect(checkShape(shape)).toBe(true)
    // 모르는 종류, 듣는 사람, 방식은 정해진 값으로 바꾼다
    expect([shape.type, shape.audience, shape.method]).toEqual(['blank', 'mixed', 'live'])
  })

  it('모든 발표 종류와 듣는 사람의 구성이 꼴 확인과 마지막 그물을 지난다', () => {
    const words = ['format', 'version', 'deck', 'type', 'audience', 'duration', 'method', 'theme', 'accent', 'motion', 'font', 'size', 'footer', 'transition', 'tone', 'updatedAt', 'slides', 'id', 'layout', 'role', 'section', 'hidden', 'hiddenItems', 'fields', 'items', 'options', 'highlight', 'flip', 'pane', 'contain', 'place', 'variant', 'base', 'empty', 'filled', 'long', 'html-maker/shape']
    for (const type of [...DECK_TYPES, 'blank' as const]) {
      for (const { id: audience } of AUDIENCES) {
        const shape = toShape(createDeck({ type, audience, minutes: 30, method: 'send', title: SECRET, org: SECRET, presenter: SECRET, ask: SECRET, theme: 'white' }))
        expect(shape.type, type).toBe(type)
        expect(shape.audience).toBe(audience)
        expect(checkShape(shape), `${type} ${audience}`).toBe(true)
        expect(onlyKnownStrings(shape, words), `${type} ${audience}`).toBe(true)
        // 장 역할과 단락 이름은 구성에 있는 말이라 그대로 보인다
        expect(shape.slides.every((s) => s.role !== null), type).toBe(true)
        expect(JSON.stringify(shape)).not.toContain(SECRET)
      }
    }
  })

  it('정해진 꼴에서 하나라도 벗어나면 받지 않는다', () => {
    const shape = toShape(createSampleDeck())
    const bad = (fn: (v: Record<string, unknown> & { slides: Record<string, unknown>[] }) => void) => {
      const copy = structuredClone(shape) as unknown as Record<string, unknown> & { slides: Record<string, unknown>[] }
      fn(copy)
      return checkShape(copy)
    }
    expect(bad((v) => (v.title = SECRET))).toBe(false)
    expect(bad((v) => (v.slides[0].role = SECRET))).toBe(false)
    expect(bad((v) => (v.slides[0].note = SECRET))).toBe(false)
    expect(bad((v) => ((v.slides[0].fields as Record<string, string>).title = SECRET))).toBe(false)
    expect(bad((v) => ((v.slides[1].items as Record<string, string>[])[0].body = SECRET))).toBe(false)
    expect(bad((v) => (v.slides[0].id = SECRET))).toBe(false)
    expect(bad((v) => (v.accent = SECRET))).toBe(false)
    expect(bad((v) => (v.deck = 'd' + SECRET))).toBe(false)
    // 부품 장이 아닌 장에 부품, 모르는 부품, 모르는 바탕
    expect(bad((v) => (v.slides[1].blocks = []))).toBe(false)
    const withBlocks = toShape(secretDeck())
    const badBlocks = (fn: (b: Record<string, unknown>) => void) => {
      const copy = structuredClone(withBlocks) as unknown as { slides: { layout: string; blocks?: Record<string, unknown>[][] }[] }
      fn(copy.slides.find((x) => x.layout === 'compose')!.blocks![0][0])
      return checkShape(copy)
    }
    expect(badBlocks(() => {})).toBe(true)
    expect(badBlocks((b) => (b.type = SECRET))).toBe(false)
    expect(badBlocks((b) => (b.look = SECRET))).toBe(false)
    expect(badBlocks((b) => (b.span = 13))).toBe(false)
    expect(badBlocks((b) => (b.note = SECRET))).toBe(false)
    expect(badBlocks((b) => ((b.fields as Record<string, string>).text = SECRET))).toBe(false)
    // 부품 id는 해시 id(b로 시작)만. 원래 id나 글이면 버린다. 예전 앱이 쓴 모양 파일처럼 없으면 받는다
    expect(badBlocks((b) => (b.id = SECRET))).toBe(false)
    expect(badBlocks((b) => (b.id = 's12345678'))).toBe(false)
    expect(badBlocks((b) => delete b.id)).toBe(true)
    expect(badBlocks((b) => (b.highlight = SECRET))).toBe(false)
  })

  it('Object.prototype의 이름을 레이아웃으로 써도 예외 없이 거른다', () => {
    // `in`으로 찾으면 constructor, toString도 레이아웃으로 알아서, 꼴 확인이 false 대신 예외를 던졌다
    const shape = toShape(createSampleDeck())
    for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const copy = structuredClone(shape) as unknown as { slides: Record<string, unknown>[] }
      copy.slides[1].layout = name
      expect(() => checkShape(copy), name).not.toThrow()
      expect(checkShape(copy), name).toBe(false)
      const deck = createSampleDeck()
      deck.slides[1] = { ...deck.slides[1], layout: name as LayoutId }
      expect(() => toShape(deck), name).not.toThrow()
      expect(toShape(deck).slides).toHaveLength(deck.slides.length - 1)
    }
  })

  it('강조할 항목 번호는 제안과 모양이 같은 범위를 받는다', () => {
    const deck = createSampleDeck()
    const at = deck.slides.findIndex((s) => LAYOUTS[s.layout].highlight)
    const shape = toShape(deck)
    for (const n of [HIGHLIGHT_MIN - 1, HIGHLIGHT_MIN, 0, HIGHLIGHT_MAX, HIGHLIGHT_MAX + 1]) {
      const copy = structuredClone(shape)
      copy.slides[at].options.highlight = n
      const proposed = parseOp({ op: 'set_options', slide: shape.slides[at].id, highlight: n }) !== null
      expect(checkShape(copy), String(n)).toBe(proposed)
    }
    // 가져온 파일의 범위 밖 번호는 모양에 넣지 않는다. 넣으면 모양 전체가 꼴 확인에서 버려진다
    deck.slides[at] = { ...deck.slides[at], options: { ...deck.slides[at].options, highlight: 99 } }
    expect(toShape(deck).slides[at].options.highlight).toBeUndefined()
    expect(checkShape(toShape(deck))).toBe(true)
  })

  it('마지막 그물은 모르는 글자를 잡는다', () => {
    const shape = toShape(createSampleDeck())
    const words = ['format', 'version', 'deck', 'type', 'audience', 'duration', 'method', 'theme', 'accent', 'motion', 'font', 'size', 'footer', 'transition', 'tone', 'updatedAt', 'slides', 'id', 'layout', 'role', 'section', 'hidden', 'hiddenItems', 'fields', 'items', 'options', 'highlight', 'flip', 'contain', 'place', 'variant', 'base', 'empty', 'filled', 'long', 'html-maker/shape', 'blocks', 'span', 'look', 'effect', 'link', 'rowLinks']
    expect(onlyKnownStrings(shape, words)).toBe(true)
    expect(onlyKnownStrings(toShape(secretDeck()), words)).toBe(true)
    expect(onlyKnownStrings({ ...shape, extra: SECRET }, [...words, 'extra'])).toBe(false)
    expect(onlyKnownStrings({ [SECRET]: 1 }, words)).toBe(false)
  })
})
