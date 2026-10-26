import { describe, expect, it } from 'vitest'
import { sampleBlock } from './blockSamples'
import { composeFrom } from './blocks'
import { knownOnly, unknownParts } from './compat'
import { makeSlide } from './generate'
import { LAYOUTS } from './layouts'
import { migrateDeck } from './migrate'
import { createSampleDeck } from './sample'
import { autoScene, planScenes, SCENES, sceneFits, sceneOf, scenesFor, withScenes } from './scenes'
import type { BlockType, Deck, SceneId, Slide } from './types'

const compose = (...types: BlockType[]): Slide => ({ ...makeSlide('compose'), blocks: types.map((t, i) => ({ ...sampleBlock(t), id: `b${i}` })) })

describe('장면', () => {
  it('장면마다 이름이 다르고, 맞는 레이아웃은 있는 레이아웃이다', () => {
    expect(new Set(SCENES.map((s) => s.name)).size).toBe(SCENES.length)
    for (const s of SCENES) for (const l of s.layouts) expect(Object.hasOwn(LAYOUTS, l), `${s.id} ${l}`).toBe(true)
  })

  it('레이아웃에 맞는 장면만 고를 수 있고, 맞지 않으면 골라 둔 값이 쉰다', () => {
    const kpi = makeSlide('kpi')
    expect(scenesFor(kpi)).toEqual(['numbers'])
    expect(sceneOf({ ...kpi, options: { scene: 'numbers' } })).toBe('numbers')
    expect(sceneOf({ ...kpi, options: { scene: 'flow' } })).toBe(null)
    expect(scenesFor(makeSlide('table'))).toEqual([])
  })

  it('컴포넌트 장은 들어 있는 컴포넌트로 맞는 장면을 고른다', () => {
    expect(scenesFor(compose('message', 'number'))).toEqual(['answer', 'numbers'])
    expect(autoScene(compose('number', 'message'))).toBe('answer')
    expect(scenesFor(compose('text'))).toEqual([])
    // 나란히 선 두 칸은 앞과 뒤
    const two = compose('text', 'text')
    two.blocks![0].at = { x: 0, y: 0, w: 6, h: 12 }
    two.blocks![1].at = { x: 6, y: 0, w: 6, h: 12 }
    expect(sceneFits(two, 'compare')).toBe(true)
  })

  it('알아서 고르기: 골라 둔 장은 그대로 두고, 숨긴 장과 맞는 장면이 없는 장은 건너뛴다', () => {
    const deck: Deck = {
      ...createSampleDeck(),
      slides: [
        makeSlide('cover'),
        { ...makeSlide('kpi'), hidden: true },
        makeSlide('table'),
        { ...makeSlide('statement'), options: { scene: 'answer' } },
        { ...makeSlide('closing'), options: { scene: 'opening' } },
      ],
    }
    const plan = planScenes(deck)
    expect(plan.add.map((r) => [r.page, r.next])).toEqual([[1, 'opening']])
    // 이미 같은 장면이면 바꿀 것이 없다. 다른 장면을 골라 두었으면 따로 알린다
    expect(plan.kept.map((r) => [r.page, r.now, r.next])).toEqual([[5, 'opening', 'closing']])
    const kept = withScenes(deck, false)
    expect(kept.slides.map((s) => s.options.scene)).toEqual(['opening', undefined, undefined, 'answer', 'opening'])
    expect(withScenes(deck, true).slides[4].options.scene).toBe('closing')
    // 다시 입혀도 같다
    expect(withScenes(kept, false)).toEqual(kept)
  })

  it('알아서 고르기는 장면마다 한 번, 맞는 첫 장에만 넣어 나머지 장은 차분하게 둔다', () => {
    const deck: Deck = {
      ...createSampleDeck(),
      slides: ['cover', 'summary', 'kpi', 'kpi', 'section', 'process', 'bars', 'statement', 'closing'].map((l) => makeSlide(l as Slide['layout'])),
    }
    const plan = planScenes(deck)
    // 첫 숫자 장(3)은 바로 앞 장이 움직여서 한 장 쉬고 다음 숫자 장(4)에. 여는 장과 결론은 붙어 있어도 된다
    expect(plan.add.map((r) => [r.page, r.next])).toEqual([[1, 'opening'], [2, 'answer'], [4, 'numbers'], [6, 'flow'], [9, 'closing']])
    // 골라 둔 장면은 다시 쓰지 않는다: 첫 숫자 장에 이미 있으면 둘째 숫자 장에 또 넣지 않는다
    const own = { ...deck, slides: deck.slides.map((s, i) => (i === 3 ? { ...s, options: { scene: 'numbers' as SceneId } } : s)) }
    expect(planScenes(own).add.map((r) => r.next)).not.toContain('numbers')
    // 예시 발표에서도 장의 절반 넘게 움직이지 않는다
    const sample = createSampleDeck()
    expect(planScenes(sample).add.length).toBeLessThanOrEqual(Math.ceil(sample.slides.filter((s) => !s.hidden).length / 2))
  })

  it('모르는 장면(새 버전의 장면)이 있어도 발표를 막지 않고, 값은 그대로 둔 채 장면 없이 움직인다', () => {
    for (const s of SCENES) for (const l of s.layouts) expect(unknownParts({ ...createSampleDeck(), slides: [{ ...makeSlide(l), options: { scene: s.id } }] })).toBe(0)
    const odd = { ...createSampleDeck(), slides: [{ ...makeSlide('kpi'), options: { scene: 'spiral' as SceneId } }] }
    expect(unknownParts(odd)).toBe(0)
    // 열고 고쳐도 값이 남아 새 버전에서 다시 열면 그 장면으로 돌아온다
    const opened = migrateDeck(odd)
    expect(opened.slides[0].options.scene).toBe('spiral')
    expect(sceneOf(opened.slides[0])).toBeNull()
    expect(knownOnly(odd).slides[0].options.scene).toBe('spiral')
  })
})

describe('부품 장으로 바꿀 때의 장면', () => {
  it('바뀐 부품 장에도 맞는 장면은 남기고, 맞지 않으면 뺀다', () => {
    const kpi = { ...makeSlide('kpi'), options: { scene: 'numbers' as SceneId } }
    expect(composeFrom(kpi).options.scene).toBe('numbers')
    // 표지 장면은 부품 장에 맞지 않는다 (표지는 빈 부품 장이 된다)
    const cover = { ...makeSlide('cover'), options: { scene: 'opening' as SceneId } }
    const converted = composeFrom(cover)
    expect(converted.options.scene === undefined || sceneFits(converted, converted.options.scene)).toBe(true)
  })
})
