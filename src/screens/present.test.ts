import { describe, expect, it } from 'vitest'
import { createDeck } from '../deck/generate'
import { startIndex } from './Present'

describe('발표를 시작할 장', () => {
  const deck = createDeck({ type: 'report', audience: 'mixed', minutes: 20, method: 'live', title: '', org: '', presenter: '', theme: 'white' })
  deck.slides[2].hidden = true
  const shown = deck.slides.filter((s) => !s.hidden)

  it('발표에서 뺀 장에서 시작하면 그 뒤의 첫 장부터', () => {
    expect(shown[startIndex(deck, shown, deck.slides[2].id)].id).toBe(deck.slides[3].id)
  })

  it('맨 끝의 뺀 장이면 바로 앞 장부터', () => {
    const last = deck.slides.length - 1
    const d = { ...deck, slides: deck.slides.map((s, i) => (i === last ? { ...s, hidden: true } : s)) }
    const v = d.slides.filter((s) => !s.hidden)
    expect(v[startIndex(d, v, d.slides[last].id)].id).toBe(d.slides[last - 1].id)
  })

  it('고른 장이 없으면 첫 장부터', () => {
    expect(startIndex(deck, shown)).toBe(0)
  })
})
