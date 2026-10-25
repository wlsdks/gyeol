import { describe, expect, it } from 'vitest'
import { asCompose, autoPlace, dropTarget, insertAt, makeBlock, placeIssue, removeBlock } from '../../deck/blocks'
import { makeSlide } from '../../deck/generate'
import type { Block, Slide } from '../../deck/types'
import { dropBlocks, planDrop, type DropState } from './planDrop'

const block = (type: Block['type'], id: string = type): Block => ({ ...makeBlock(type), id })
/** 1920×1080 장의 본문 상자 (위아래 틀과 제목을 뺀 어림) */
const SIZE = { w: 1680, h: 760 }
/** 차례대로 눌러 넣은 부품 장 */
const compose = (...bs: Block[]): Slide => ({ ...makeSlide('compose'), blocks: bs.reduce<Block[]>((out, b) => autoPlace(out, b, SIZE.h) ?? out, []) })
/** 큰 부품 수(MAX_LARGE)가 찬 장 (높이는 따지지 않고 넣은 것) */
const full = (): Slide => ({ ...makeSlide('compose'), blocks: ['a', 'b', 'c', 'd', 'e', 'f'].reduce<Block[]>((out, id) => autoPlace(out, block('callout', id)) ?? out, []) })
const fresh = (s: Slide, b: Block): DropState => ({ kind: 'new', block: b, base: s.blocks ?? [], moving: null, composed: null, target: null })

describe('컴포넌트를 놓을 판', () => {
  it('부품 장은 그 판, 바꿀 수 있는 장은 바꾼 모습의 판, 표지와 섹션은 없다', () => {
    const s = compose(block('kpi', 'k'))
    expect(dropBlocks(s)).toEqual({ blocks: s.blocks, composed: null })
    const points = makeSlide('points')
    const at = dropBlocks(points)
    expect(at?.composed?.layout).toBe('compose')
    // 바꿀 때마다 새 id를 받으니 무엇이 들었는지로 견준다
    const kinds = (bs?: Block[]) => bs?.map((b) => [b.type, b.at])
    expect(kinds(at?.blocks)).toEqual(kinds(asCompose(points).blocks))
    expect(dropBlocks(makeSlide('cover'))).toBeNull()
    expect(dropBlocks(makeSlide('section'))).toBeNull()
  })

  it('이미 바꿔 둔 모습이 있으면 그것을 쓴다 (끄는 동안 기준이 바뀌지 않게)', () => {
    const points = makeSlide('points')
    const composed = asCompose(points)
    expect(dropBlocks(points, composed)?.composed).toBe(composed)
  })
})

describe('눌러 넣기', () => {
  it('부품 장: 알아서 고른 자리에. 자리가 없으면 다음 장에 넣고 까닭을 남긴다', () => {
    const s = compose(block('kpi', 'k'))
    const b = block('trend', 't')
    const p = planDrop(s, fresh(s, b), { by: 'auto', h: SIZE.h })
    expect(p).toEqual({ plan: 'place', target: null, result: autoPlace(s.blocks!, b, SIZE.h), blocked: null, composed: null, base: s.blocks, room: SIZE.h })

    const f = full()
    expect(f.blocks).toHaveLength(6)
    const q = planDrop(f, fresh(f, b), { by: 'auto', h: SIZE.h })
    expect(q.plan).toBe('next')
    expect(q.result).toBeNull()
    expect(q.blocked).toEqual(placeIssue(f.blocks!, b, SIZE.h))
  })

  it('바꿀 수 있는 장: 부품 장으로 바꾼 모습에 넣는다. 아래 빈자리로 고르면 맨 아래 장 너비로', () => {
    const points = makeSlide('points', { items: 1 })
    const b = block('message', 'm')
    const p = planDrop(points, fresh(points, b), { by: 'auto', h: SIZE.h })
    expect(p.plan).toBe('convert')
    expect(p.composed?.layout).toBe('compose')
    expect(p.base).toEqual(p.composed?.blocks)
    expect(p.result).toEqual(autoPlace(p.base, b, SIZE.h))

    const bottom = planDrop(points, fresh(points, b), { by: 'auto', h: SIZE.h, bottom: true })
    const m = bottom.result!.find((x) => x.id === 'm')!.at!
    expect(m.w).toBe(12)
    expect(m.y + m.h).toBe(12)
  })

  it('표지: 다음 장에 새로 만든다', () => {
    const cover = makeSlide('cover')
    const b = block('kpi', 'k')
    expect(planDrop(cover, fresh(cover, b), { by: 'auto', h: undefined })).toEqual({ plan: 'next', target: null, result: null, blocked: null, composed: null, base: [], room: undefined })
  })
})

describe('끌어 놓기', () => {
  const s = compose(block('kpi', 'k'), block('trend', 't'), block('bullets', 'l'))
  const b = block('callout', 'c')

  it('장 밖이면 할 일이 없다. 지금까지의 높이와 바꾼 모습은 그대로 둔다', () => {
    const d = { ...fresh(s, b), room: 500 }
    expect(planDrop(s, d, { by: 'pointer', over: false, at: null })).toEqual({ plan: null, target: null, result: null, blocked: null, composed: null, base: s.blocks, room: 500 })
  })

  it('부품 장 위: 손 아래 자리에 놓고, 놓은 뒤의 판을 미리 만든다', () => {
    const p = { x: 1500, y: 600 }
    const plan = planDrop(s, fresh(s, b), { by: 'pointer', over: true, at: { p, size: SIZE } })
    expect(plan.plan).toBe('place')
    const t = dropTarget(s.blocks!, b, p, SIZE)!
    expect(plan.target).toEqual(t)
    expect(plan.result).toEqual(t.kind === 'spot' ? insertAt(s.blocks!, t.spot, b, SIZE.h) : null)
    expect(plan.room).toBe(SIZE.h)
  })

  it('경계에서 떨리지 않게: 손 아래 자리가 바뀌어도 30px 옆에서 지금 자리가 나오면 그대로 둔다', () => {
    // 자리가 여럿 나오는 넉넉한 판
    const s = compose(block('kpi', 'k'), block('bullets', 'l'))
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
    // 가로로 지나가며 손 아래 자리가 바뀌는 곳을 찾는다
    let checked = 0
    for (let x = 100; x < SIZE.w; x += 10) {
      const before = dropTarget(s.blocks!, b, { x, y: 600 }, SIZE)
      const after = dropTarget(s.blocks!, b, { x: x + 10, y: 600 }, SIZE)
      if (!before || same(before, after)) continue
      const plan = planDrop(s, { ...fresh(s, b), target: before }, { by: 'pointer', over: true, at: { p: { x: x + 10, y: 600 }, size: SIZE } })
      expect(plan.target).toEqual(before)
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('옮기기: 처음 자리 안이면 그대로, 밖이면 옮기는 컴포넌트를 뺀 판에서 찾는다', () => {
    const moving = s.blocks![0]
    const d: DropState = { kind: 'move', block: moving, base: removeBlock(s.blocks!, moving.id, SIZE.h), moving: s.blocks!, composed: null, target: { kind: 'stay' } }
    const a = moving.at!
    const home = { x: ((a.x + a.w / 2) * (SIZE.w + 72)) / 12 - 36, y: ((a.y + a.h / 2) * (SIZE.h + 48)) / 12 - 24 }
    const stay = planDrop(s, d, { by: 'pointer', over: true, at: { p: home, size: SIZE } })
    expect(stay.target).toEqual({ kind: 'stay' })
    expect(stay.result).toBe(s.blocks)
    const away = planDrop(s, d, { by: 'pointer', over: true, at: { p: { x: SIZE.w - 40, y: SIZE.h - 40 }, size: SIZE } })
    expect(away.base).toBe(d.base)
    expect(away.plan).toBe('place')
    expect(away.result?.map((x) => x.id).sort()).toEqual(s.blocks!.map((x) => x.id).sort())
    // 잴 수 없으면 자리도 없다
    expect(planDrop(s, d, { by: 'pointer', over: true, at: null }).plan).toBeNull()
  })

  it('바꿀 수 있는 장 위: 바꾼 모습에 놓고, 표지 위는 다음 장에', () => {
    const points = makeSlide('points', { items: 1 })
    const plan = planDrop(points, fresh(points, b), { by: 'pointer', over: true, at: { p: { x: 800, y: 700 }, size: SIZE } })
    expect(plan.plan).toBe('convert')
    expect(plan.composed?.layout).toBe('compose')
    expect(plan.base).toEqual(plan.composed?.blocks)

    const cover = makeSlide('cover')
    expect(planDrop(cover, fresh(cover, b), { by: 'pointer', over: true, at: { p: { x: 800, y: 700 }, size: SIZE } }).plan).toBe('next')
    // 부품 장이 아닌 장에서는 옮길 수 없다
    expect(planDrop(points, { ...fresh(points, b), kind: 'move' }, { by: 'pointer', over: true, at: { p: { x: 800, y: 700 }, size: SIZE } }).plan).toBeNull()
  })

  it('장에 자리가 없으면 새 컴포넌트는 다음 장에, 그 까닭을 남긴다', () => {
    const f = full()
    const plan = planDrop(f, fresh(f, b), { by: 'pointer', over: true, at: { p: { x: 800, y: 300 }, size: SIZE } })
    expect(plan.plan).toBe('next')
    // 강조 상자는 작은 부품이 아니라 큰 부품 수가 찬다
    expect(plan.blocked).toEqual({ kind: 'large' })
  })
})
