import { describe, expect, it } from 'vitest'
import { sampleBlock } from './blockSamples'
import { currentPreset, withPreset } from './blocks'
import { makeSlide } from './generate'
import { copyMotion, planMotionCopy, withMotionCopy } from './motionCopy'
import type { BlockType, Deck, Slide } from './types'

const compose = (id: string, ...types: BlockType[]): Slide => ({
  ...makeSlide('compose'),
  id,
  blocks: types.map((t, i) => ({ ...sampleBlock(t), id: `${id}b${i}` })),
})
const slide = (id: string, layout: Parameters<typeof makeSlide>[0], options: Slide['options'] = {}): Slide => ({ ...makeSlide(layout), id, options })

describe('이 장의 움직임을 다른 장에도', () => {
  it('옮길 장: 이 장과 숨긴 장은 빼고, 모양이 같은 장을 표시하고, 맞지 않는 장면은 알린다', () => {
    const deck = {
      slides: [
        slide('a', 'kpi', { scene: 'numbers' }),
        slide('b', 'kpi'),
        { ...slide('c', 'kpi'), hidden: true },
        slide('d', 'points'),
      ],
    }
    expect(planMotionCopy(deck, 'a')).toEqual([
      { slideId: 'b', page: 2, same: true, sceneSkipped: false },
      { slideId: 'd', page: 4, same: false, sceneSkipped: true },
    ])
  })

  it('움직임 정도, 장 넘기기, 장면을 옮긴다. 비운 값은 비우고, 맞지 않는 장면은 그 장의 것을 둔다', () => {
    const from = slide('a', 'kpi', { motion: 'lively', transition: 'slide', scene: 'numbers' })
    expect(copyMotion(from, slide('b', 'kpi', { highlight: 1 })).options).toEqual({ highlight: 1, motion: 'lively', transition: 'slide', scene: 'numbers' })
    expect(copyMotion(from, slide('d', 'points', { scene: 'flow' })).options).toEqual({ motion: 'lively', transition: 'slide', scene: 'flow' })
    // 이 장이 전체대로면 그 장도 전체대로로, 장면이 없으면 그 장도 끈다
    const plain = slide('p', 'kpi')
    expect(copyMotion(plain, slide('b', 'kpi', { motion: 'none', transition: 'zoom', scene: 'numbers' })).options).toEqual({})
  })

  it('바뀌는 것이 없으면 같은 장, 같은 발표를 돌려준다 (되돌리기 기록이 늘지 않게)', () => {
    const from = slide('a', 'kpi', { transition: 'fade' })
    const to = slide('b', 'kpi', { transition: 'fade' })
    expect(copyMotion(from, to)).toBe(to)
    const deck = { slides: [from, to] }
    expect(withMotionCopy(deck, 'a', ['b'])).toBe(deck)
  })

  it('컴포넌트 장끼리: 연출을 그 장에 맞게 다시 짜고, 같은 종류의 컴포넌트에 같은 움직임을 준다', () => {
    let from = compose('a', 'number', 'message', 'text')
    from = withPreset(from, 'answer')
    from.blocks = from.blocks!.map((b) => (b.type === 'number' ? { ...b, effect: 'pop', speed: 'slow' } : b))
    const to = compose('b', 'text', 'number', 'number', 'message', 'bullets')
    to.blocks![4] = { ...to.blocks![4], effect: 'fade' }
    const next = copyMotion(from, to)
    expect(currentPreset(next)).toBe('answer')
    const types = (next.blocks ?? []).map((b) => [b.type, b.effect, b.speed])
    expect(types).toEqual([
      ['text', undefined, undefined],
      ['number', 'pop', 'slow'],
      ['number', 'pop', 'slow'],
      ['message', undefined, undefined],
      // 이 장에 없는 종류는 그대로
      ['bullets', 'fade', undefined],
    ])
    // 글은 그대로
    expect(next.blocks!.map((b) => b.fields)).toEqual(to.blocks!.map((b) => b.fields))
  })

  it('결론이 없는 장에는 결론을 옮기는 연출을 넣지 않는다', () => {
    const from = withPreset(compose('a', 'message', 'text'), 'reveal')
    const to = compose('b', 'text', 'number')
    expect(currentPreset(copyMotion(from, to))).toBe(currentPreset(to))
  })

  it('고른 장에만, 숨긴 장과 이 장은 빼고 옮긴다', () => {
    const deck: Pick<Deck, 'slides'> = {
      slides: [slide('a', 'kpi', { transition: 'zoom' }), slide('b', 'kpi'), { ...slide('c', 'kpi'), hidden: true }, slide('d', 'kpi')],
    }
    const next = withMotionCopy(deck, 'a', ['a', 'b', 'c'])
    expect(next.slides.map((s) => s.options.transition)).toEqual(['zoom', 'zoom', undefined, undefined])
  })
})
