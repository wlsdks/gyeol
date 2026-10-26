import { describe, expect, it } from 'vitest'
import { makeSlide } from '../generate'
import type { Block, Slide } from '../types'
import { autoPlace, currentPreset, insertAt, makeBlock, MOTION_PRESETS, playOrder, presetFits, whenOf, withPreset } from '../blocks'

// 연출: 컴포넌트마다의 '언제'와 장의 나오는 차례를 한 번에. 움직임(effect)과 빠르기는 그대로 둔다

const block = (type: Block['type'], id: string): Block => ({ ...makeBlock(type), id })

/** 위에 전과 후와 추이, 아래에 강조 상자 (놓인 차례: d, t, c). 강조 상자는 알아서 넣으면 위로 가서(결론부터) 맨 아래 자리에 끌어 놓은 것처럼 */
function slide(): Slide {
  const top = [block('delta', 'd'), block('trend', 't')].reduce<Block[]>((out, b) => autoPlace(out, b) ?? out, [])
  const bs = insertAt(top, { at: null, side: 'below' }, block('callout', 'c'))!
  return { ...makeSlide('compose'), id: 's', blocks: bs }
}

const plan = (s: Slide) => playOrder(s).map((b) => `${b.id}:${whenOf(b)}`)

describe('연출', () => {
  it('차례로: 놓인 차례대로 이어서, 정한 차례는 지운다', () => {
    const s = slide()
    const order = playOrder(s).map((b) => b.id)
    const mixed = { ...s, options: { ...s.options, order: [...order].reverse() }, blocks: s.blocks!.map((b) => ({ ...b, when: 'click' as const })) }
    const next = withPreset(mixed, 'steps')
    expect(plan(next)).toEqual(order.map((id) => `${id}:after`))
    expect(next.options.order).toBeUndefined()
    // 이어서는 기본이라 적지 않는다
    expect(next.blocks!.every((b) => b.when === undefined)).toBe(true)
  })

  it('한꺼번에: 첫 컴포넌트 다음은 모두 함께', () => {
    const next = withPreset(slide(), 'together')
    expect(plan(next).map((p) => p.split(':')[1])).toEqual(['after', 'with', 'with'])
  })

  it('누를 때마다: 모두 누르면', () => {
    expect(plan(withPreset(slide(), 'clicks')).every((p) => p.endsWith(':click'))).toBe(true)
  })

  it('결론 먼저: 강조 상자가 맨 앞으로, 나머지는 놓인 차례', () => {
    const next = withPreset(slide(), 'answer')
    expect(plan(next)[0]).toBe('c:after')
    expect(next.options.order?.[0]).toBe('c')
  })

  it('결론은 마지막에: 근거가 이어서 나온 뒤 결론은 누르면', () => {
    const next = withPreset(slide(), 'reveal')
    const p = plan(next)
    expect(p[p.length - 1]).toBe('c:click')
    expect(p.slice(0, -1).every((x) => x.endsWith(':after'))).toBe(true)
  })

  it('움직임과 빠르기는 건드리지 않는다', () => {
    const s = slide()
    const styled = { ...s, blocks: s.blocks!.map((b) => ({ ...b, effect: 'pop' as const, speed: 'slow' as const })) }
    for (const p of MOTION_PRESETS) {
      const next = withPreset(styled, p.id)
      expect(next.blocks!.every((b) => b.effect === 'pop' && b.speed === 'slow')).toBe(true)
    }
  })

  it('결론이 없거나 모두 결론이면 결론을 옮기는 연출은 쓸 수 없다', () => {
    const noEnd = { ...slide(), blocks: slide().blocks!.filter((b) => b.type !== 'callout') }
    expect(presetFits(noEnd, 'answer')).toBe(false)
    expect(presetFits(noEnd, 'reveal')).toBe(false)
    expect(withPreset(noEnd, 'answer')).toBe(noEnd)
    expect(presetFits(noEnd, 'steps')).toBe(true)
    expect(presetFits({ blocks: [] }, 'steps')).toBe(false)
  })

  it('지금 장이 어느 연출과 같은지 알아본다. 하나하나 바꿨으면 없다', () => {
    const s = slide()
    expect(currentPreset(s)).toBe('steps')
    for (const p of MOTION_PRESETS) expect(currentPreset(withPreset(s, p.id))).toBe(p.id)
    const odd = { ...s, blocks: s.blocks!.map((b, i) => (i === 1 ? { ...b, when: 'click' as const } : b)) }
    expect(currentPreset(odd)).toBeNull()
  })
})
