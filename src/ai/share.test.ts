import { describe, expect, it } from 'vitest'
import { createSampleDeck } from '../deck/sample'
import type { Deck } from '../deck/types'
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
    meta: { ...deck.meta, org: s('org'), presenter: s('presenter'), date: s('date'), contact: s('contact'), logo: `data:image/png;base64,${SECRET}` },
    // 가져온 파일이면 고르는 값 자리에도 아무 글이나 들어 있을 수 있다
    theme: { id: deck.theme.id, accent: s('accent'), font: s('font'), size: s('size'), footer: s('footer'), transition: s('transition') } as unknown as Deck['theme'],
    slides: deck.slides.map((slide, i) => ({
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
    })),
  }
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

  it('원래 덱에서는 장 역할과 칸 상태가 보인다', () => {
    const shape = toShape(createSampleDeck())
    expect(shape.slides[1]).toMatchObject({ layout: 'summary', role: '한 장 요약', fields: { title: 'filled' } })
    expect(shape.slides[1].items).toHaveLength(4)
    expect(shape.slides.find((s) => s.layout === 'kpi')?.items[0]).toEqual({ value: 'filled', title: 'filled', body: 'filled' })
    expect(checkShape(shape)).toBe(true)
  })

  it('비밀을 심은 덱에서 만든 모양도 꼴은 맞다', () => {
    expect(checkShape(toShape(secretDeck()))).toBe(true)
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
  })

  it('마지막 그물은 모르는 글자를 잡는다', () => {
    const shape = toShape(createSampleDeck())
    const words = ['format', 'version', 'deck', 'type', 'audience', 'duration', 'method', 'theme', 'accent', 'motion', 'font', 'size', 'footer', 'transition', 'tone', 'updatedAt', 'slides', 'id', 'layout', 'role', 'section', 'hidden', 'hiddenItems', 'fields', 'items', 'options', 'highlight', 'flip', 'contain', 'variant', 'base', 'empty', 'filled', 'long', 'html-maker/shape']
    expect(onlyKnownStrings(shape, words)).toBe(true)
    expect(onlyKnownStrings({ ...shape, extra: SECRET }, [...words, 'extra'])).toBe(false)
    expect(onlyKnownStrings({ [SECRET]: 1 }, words)).toBe(false)
  })
})
