import { describe, expect, it } from 'vitest'
import { reviewSlides } from './reviewSlides'

describe('대표 조합', () => {
  it('테마와 글자 크기가 달라도 의도한 컴포넌트를 모두 담는다', () => {
    const expected: Record<string, string[]> = {
      user: ['message', 'quote'],
      text: ['message', 'text', 'text'],
      number: ['number', 'number', 'text'],
      chart: ['message', 'trend'],
      quote: ['quote', 'bullets'],
      three: ['text', 'text', 'text'],
      bare: ['message', 'quote'],
      dense: ['number', 'delta', 'goal', 'bullets', 'callout'],
      callout: ['callout', 'bullets'],
      heading: ['heading', 'bullets', 'heading', 'checks'],
      'lead-late': ['bullets', 'trend', 'message'],
      'timeline-facts': ['timeline', 'facts'],
      'pareto-number': ['pareto', 'number'],
      'pair-chart': ['bullets', 'callout', 'trend'],
    }
    for (const id of ['white', 'navy', 'serif'] as const) {
      for (const size of [undefined, 'large'] as const) {
        for (const slide of reviewSlides({ theme: { id, size } })) {
          expect(slide.blocks?.map((b) => b.type), `${id} ${size ?? 'normal'} ${slide.id}`).toEqual(expected[slide.id.replace('review-', '')])
          if (slide.id === 'review-pair-chart') {
            const [list, callout, chart] = slide.blocks!
            expect(list.at?.y).toBe(callout.at?.y)
            expect(chart.at?.y).toBeGreaterThan(list.at!.y)
            expect([chart.at?.x, chart.at?.w]).toEqual([0, 12])
          }
        }
      }
    }
  })

  it('여백을 견줄 두 조합은 항목 수와 차트의 총건수가 맞는다', () => {
    const slides = reviewSlides()
    const timeline = slides.find((s) => s.id === 'review-timeline-facts')!
    expect(timeline.blocks?.map((b) => b.items.length)).toEqual([3, 2])

    const pareto = slides.find((s) => s.id === 'review-pareto-number')!.blocks![0]
    expect(pareto.variant).toBe('rows')
    expect(pareto.items).toHaveLength(4)
    const total = pareto.items.reduce((sum, item) => sum + Number(item.value), 0)
    expect(pareto.fields.heading).toContain(`${total}건`)
  })
})
