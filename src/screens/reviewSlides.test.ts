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
    }
    for (const id of ['white', 'navy', 'serif'] as const) {
      for (const size of [undefined, 'large'] as const) {
        for (const slide of reviewSlides({ theme: { id, size } })) {
          expect(slide.blocks?.map((b) => b.type), `${id} ${size ?? 'normal'} ${slide.id}`).toEqual(expected[slide.id.replace('review-', '')])
        }
      }
    }
  })
})
