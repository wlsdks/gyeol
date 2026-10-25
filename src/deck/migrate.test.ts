import { describe, expect, it } from 'vitest'
import { makeBlock, tiles } from './blocks'
import { createDeck } from './generate'
import { LAYOUTS } from './layouts'
import { migrateDeck } from './migrate'
import type { Deck } from './types'

const deck = (): Deck =>
  createDeck({ type: 'business', audience: 'mixed', minutes: 10, method: 'live', title: '', org: '', presenter: '', theme: 'white' })

describe('예전 발표 읽기', () => {
  it('바꾸기 전의 역할 이름과 테마를 지금 것으로 읽는다', () => {
    const d = deck()
    const old: Deck = { ...d, theme: { ...d.theme, id: 'serif' as Deck['theme']['id'] }, slides: [{ ...d.slides[0], layout: 'compose', blocks: [], purpose: '부품으로 꾸미기' }, ...d.slides.slice(1)] }
    const now = migrateDeck(old)
    expect(now.slides[0].purpose).toBe(LAYOUTS.compose.name)
    expect(now.theme.id).toBe('white')
    expect(now.theme.font).toBe('serif')
  })

  it('판 전(0.4까지)의 부품 장은 줄을 판으로 바꾸고, 글은 그대로 둔다', () => {
    const d = deck()
    const rows = [
      { id: 'r1', blocks: [{ ...makeBlock('number'), id: 'n', fields: { value: '가짜 12%' } }, { ...makeBlock('callout'), id: 'c' }], spans: [5, 7] },
      { id: 'r2', blocks: [{ ...makeBlock('bullets'), id: 'b' }] },
    ]
    const old = { ...d, version: 1, slides: [{ ...d.slides[0], layout: 'compose', ...({ rows } as object) }] } as unknown as Deck
    const now = migrateDeck(old)
    const s = now.slides[0]
    expect(now.version).toBe(2)
    expect(s).not.toHaveProperty('rows')
    expect(s.blocks?.map((b) => b.id)).toEqual(['n', 'c', 'b'])
    expect(tiles(s.blocks ?? [])).toBe(true)
    expect(s.blocks?.[0].fields.value).toBe('가짜 12%')
    expect(s.blocks?.[0].at?.w).toBe(5)
    expect(migrateDeck(now)).toEqual(now)
  })

  it('지금 꼴의 발표는 그대로, 여러 번 읽어도 같다', () => {
    const d = deck()
    expect(migrateDeck(d)).toEqual(d)
    expect(migrateDeck(migrateDeck(d))).toEqual(migrateDeck(d))
  })
})
