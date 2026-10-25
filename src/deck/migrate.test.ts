import { describe, expect, it } from 'vitest'
import { createDeck } from './generate'
import { LAYOUTS } from './layouts'
import { migrateDeck } from './migrate'
import type { Deck } from './types'

const deck = (): Deck =>
  createDeck({ type: 'business', audience: 'mixed', minutes: 10, method: 'live', title: '', org: '', presenter: '', theme: 'white' })

describe('예전 발표 읽기', () => {
  it('바꾸기 전의 역할 이름과 테마를 지금 것으로 읽는다', () => {
    const d = deck()
    const old: Deck = { ...d, theme: { ...d.theme, id: 'serif' as Deck['theme']['id'] }, slides: [{ ...d.slides[0], layout: 'compose', rows: [], purpose: '부품으로 꾸미기' }, ...d.slides.slice(1)] }
    const now = migrateDeck(old)
    expect(now.slides[0].purpose).toBe(LAYOUTS.compose.name)
    expect(now.theme.id).toBe('white')
    expect(now.theme.font).toBe('serif')
  })

  it('지금 꼴의 발표는 그대로, 여러 번 읽어도 같다', () => {
    const d = deck()
    expect(migrateDeck(d)).toEqual(d)
    expect(migrateDeck(migrateDeck(d))).toEqual(migrateDeck(d))
  })
})
