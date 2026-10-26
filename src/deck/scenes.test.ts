import { describe, expect, it } from 'vitest'
import { sampleBlock } from './blockSamples'
import { composeFrom } from './blocks'
import { knownOnly, unknownParts } from './compat'
import { makeSlide } from './generate'
import { LAYOUTS } from './layouts'
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

  it('발표 전체에 입히기: 골라 둔 장은 그대로 두고, 숨긴 장과 맞는 장면이 없는 장은 건너뛴다', () => {
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

  it('모든 레이아웃에서 고른 장면은 그대로 열고, 모르는 장면은 센다', () => {
    for (const s of SCENES) for (const l of s.layouts) expect(unknownParts({ ...createSampleDeck(), slides: [{ ...makeSlide(l), options: { scene: s.id } }] })).toBe(0)
    const odd = { ...createSampleDeck(), slides: [{ ...makeSlide('kpi'), options: { scene: 'spiral' as SceneId } }] }
    expect(unknownParts(odd)).toBe(1)
    expect(knownOnly(odd).slides[0].options.scene).toBeUndefined()
    expect(unknownParts(knownOnly(odd))).toBe(0)
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
