import { describe, expect, it } from 'vitest'
import { BLOCK_EFFECT_IDS, BLOCK_FROM_IDS, BLOCK_SPEED_IDS, BLOCK_TYPES, BLOCK_WHEN_IDS, isLayoutBlock } from '../deck/blocks'
import { LAYOUTS } from '../deck/layouts'
import { motionEngine } from './engine'

describe('움직임 엔진', () => {
  it('바깥의 아무것도 참조하지 않아서 소스만으로 다시 만들 수 있다 (내보낸 HTML에 소스가 그대로 들어간다)', () => {
    const rebuilt = new Function(`return (${motionEngine.toString()})`)() as typeof motionEngine
    const engine = rebuilt()
    expect(typeof engine.play).toBe('function')
    expect(typeof engine.swap).toBe('function')
  })

  it('부품 장만의 부품마다 짠 움직임이 있고, 고를 수 있는 움직임은 모두 엔진이 안다', () => {
    const src = motionEngine.toString()
    // 부품마다 짠 움직임은 nativeAuto의 case로, 고르는 움직임은 block()의 effect 비교로 들어 있다
    // (변환을 거친 소스라 따옴표 꼴은 가리지 않는다)
    for (const type of BLOCK_TYPES.filter((t) => !isLayoutBlock(t))) expect(src, type).toMatch(new RegExp(`case ["']${type}["']`))
    for (const id of BLOCK_EFFECT_IDS.filter((e) => e !== 'auto' && e !== 'none')) expect(src, id).toMatch(new RegExp(`effect === ["']${id}["']`))
  })

  it('고를 수 있는 나오는 때, 빠르기, 들어오는 쪽을 엔진이 안다', () => {
    const src = motionEngine.toString()
    // 칸에 붙인 data-when, data-speed, data-from을 읽는다 (slides/blocks.tsx)
    for (const id of BLOCK_WHEN_IDS.filter((w) => w !== 'after')) expect(src, id).toMatch(new RegExp(`dataset\\.when [!=]== ["']${id}["']`))
    for (const id of BLOCK_SPEED_IDS.filter((w) => w !== 'normal')) expect(src, id).toMatch(new RegExp(`dataset\\.speed === ["']${id}["']`))
    for (const id of BLOCK_FROM_IDS) expect(src, id).toMatch(new RegExp(`["']${id}["']`))
  })

  it('레이아웃마다 짠 연출이 있다 (없으면 소리 없이 기본 연출로 떨어진다)', () => {
    const src = motionEngine.toString()
    const choreo = src.slice(src.indexOf('function choreo'), src.indexOf('function nativeAuto'))
    for (const id of Object.keys(LAYOUTS)) expect(choreo, id).toMatch(new RegExp(`case ["']${id}["']`))
  })
})
