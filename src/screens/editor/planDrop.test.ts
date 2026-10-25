import { describe, expect, it } from 'vitest'
import { asCompose, autoTarget, dropTarget, makeBlock, placeIssue, removeBlock } from '../../deck/blocks'
import { makeSlide } from '../../deck/generate'
import type { Block, BlockRow, Slide } from '../../deck/types'
import { dropRows, planDrop, type DropState } from './planDrop'

const row = (...blocks: Block[]): BlockRow => ({ id: `r-${blocks.map((b) => b.id).join('-')}`, blocks })
const block = (type: Block['type'], id: string = type): Block => ({ ...makeBlock(type), id })
const compose = (...rows: BlockRow[]): Slide => ({ ...makeSlide('compose'), rows })
/** 1920×1080 장의 본문 상자 (위아래 틀과 제목을 뺀 어림) */
const SIZE = { w: 1680, h: 760 }
const fresh = (s: Slide, b: Block): DropState => ({ kind: 'new', block: b, base: s.rows ?? [], composed: null, target: null })

describe('컴포넌트를 놓을 줄', () => {
  it('부품 장은 그 줄, 바꿀 수 있는 장은 바꾼 모습의 줄, 표지와 섹션은 없다', () => {
    const s = compose(row(block('kpi', 'k')))
    expect(dropRows(s)).toEqual({ rows: s.rows, composed: null })
    const points = makeSlide('points')
    const at = dropRows(points)
    expect(at?.composed?.layout).toBe('compose')
    // 바꿀 때마다 새 id를 받으니 무엇이 들었는지로 견준다
    const kinds = (rows?: BlockRow[]) => rows?.map((r) => r.blocks.map((b) => b.type))
    expect(kinds(at?.rows)).toEqual(kinds(asCompose(points).rows))
    expect(dropRows(makeSlide('cover'))).toBeNull()
    expect(dropRows(makeSlide('section'))).toBeNull()
  })

  it('이미 바꿔 둔 모습이 있으면 그것을 쓴다 (끄는 동안 기준이 바뀌지 않게)', () => {
    const points = makeSlide('points')
    const composed = asCompose(points)
    expect(dropRows(points, composed)?.composed).toBe(composed)
  })
})

describe('눌러 넣기', () => {
  it('부품 장: 알아서 고른 자리에. 자리가 없으면 다음 장에 넣고 까닭을 남긴다', () => {
    const s = compose(row(block('kpi', 'k')))
    const b = block('trend', 't')
    const p = planDrop(s, fresh(s, b), { by: 'auto', h: SIZE.h })
    expect(p).toEqual({ plan: 'place', target: autoTarget(s.rows!, b, SIZE.h), blocked: null, composed: null, base: s.rows, room: SIZE.h })

    const full = compose(row(block('kpi', 'a'), block('kpi', 'b'), block('kpi', 'c')), row(block('kpi', 'd'), block('kpi', 'e'), block('kpi', 'f')))
    const q = planDrop(full, fresh(full, b), { by: 'auto', h: SIZE.h })
    expect(q.plan).toBe('next')
    expect(q.target).toBeNull()
    expect(q.blocked).toEqual(placeIssue(full.rows!, b, SIZE.h))
  })

  it('바꿀 수 있는 장: 부품 장으로 바꾼 모습에 넣는다. 아래 빈자리로 고르면 맨 아래 새 줄에', () => {
    const points = makeSlide('points', { items: 1 })
    const b = block('message', 'm')
    const p = planDrop(points, fresh(points, b), { by: 'auto', h: SIZE.h })
    expect(p.plan).toBe('convert')
    expect(p.composed?.layout).toBe('compose')
    expect(p.base).toEqual(p.composed?.rows)
    expect(p.target).toEqual(autoTarget(p.base, b, SIZE.h))

    const bottom = planDrop(points, fresh(points, b), { by: 'auto', h: SIZE.h, bottom: true })
    expect(bottom.target).toEqual({ kind: 'row', index: bottom.base.length })
  })

  it('표지: 다음 장에 새로 만든다', () => {
    const cover = makeSlide('cover')
    const b = block('kpi', 'k')
    expect(planDrop(cover, fresh(cover, b), { by: 'auto', h: undefined })).toEqual({ plan: 'next', target: null, blocked: null, composed: null, base: cover.rows ?? [], room: undefined })
  })
})

describe('끌어 놓기', () => {
  const s = compose(row(block('kpi', 'k'), block('trend', 't')), row(block('bullets', 'l')))
  const b = block('callout', 'c')

  it('장 밖이면 할 일이 없다. 지금까지의 높이와 바꾼 모습은 그대로 둔다', () => {
    const d = { ...fresh(s, b), room: 500 }
    expect(planDrop(s, d, { by: 'pointer', over: false, at: null })).toEqual({ plan: null, target: null, blocked: null, composed: null, base: s.rows, room: 500 })
  })

  it('부품 장 위: 손 아래 자리에 놓는다', () => {
    const p = { x: 1500, y: 600 }
    const plan = planDrop(s, fresh(s, b), { by: 'pointer', over: true, at: { p, size: SIZE } })
    expect(plan.plan).toBe('place')
    expect(plan.target).toEqual(dropTarget(s.rows!, b, p, SIZE))
    expect(plan.room).toBe(SIZE.h)
  })

  it('경계에서 떨리지 않게: 손 아래 자리가 바뀌어도 30px 옆에서 지금 자리가 나오면 그대로 둔다', () => {
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
    // 아래 줄을 가로로 지나가며 손 아래 자리가 바뀌는 곳을 찾는다
    let checked = 0
    for (let x = 100; x < SIZE.w; x += 10) {
      const before = dropTarget(s.rows!, b, { x, y: 600 }, SIZE)
      const after = dropTarget(s.rows!, b, { x: x + 10, y: 600 }, SIZE)
      if (!before || same(before, after)) continue
      const plan = planDrop(s, { ...fresh(s, b), target: before }, { by: 'pointer', over: true, at: { p: { x: x + 10, y: 600 }, size: SIZE } })
      expect(plan.target).toEqual(before)
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('옮기기: 옮기는 컴포넌트를 뺀 줄에서 찾고, 놓을 자리가 없으면 할 일이 없다 (제자리로 돌아간다)', () => {
    const moving = s.rows![0].blocks[0]
    const d: DropState = { kind: 'move', block: moving, base: removeBlock(s.rows!, moving.id), composed: null, target: null }
    const plan = planDrop(s, d, { by: 'pointer', over: true, at: { p: { x: 400, y: 600 }, size: SIZE } })
    expect(plan.base).toBe(d.base)
    expect(plan.plan).toBe('place')
    // 잴 수 없으면 자리도 없다
    expect(planDrop(s, d, { by: 'pointer', over: true, at: null }).plan).toBeNull()
  })

  it('바꿀 수 있는 장 위: 바꾼 모습에 놓고, 표지 위는 다음 장에', () => {
    const points = makeSlide('points', { items: 1 })
    const plan = planDrop(points, fresh(points, b), { by: 'pointer', over: true, at: { p: { x: 800, y: 700 }, size: SIZE } })
    expect(plan.plan).toBe('convert')
    expect(plan.composed?.layout).toBe('compose')
    expect(plan.base).toEqual(plan.composed?.rows)

    const cover = makeSlide('cover')
    expect(planDrop(cover, fresh(cover, b), { by: 'pointer', over: true, at: { p: { x: 800, y: 700 }, size: SIZE } }).plan).toBe('next')
    // 부품 장이 아닌 장에서는 옮길 수 없다
    expect(planDrop(points, { ...fresh(points, b), kind: 'move' }, { by: 'pointer', over: true, at: { p: { x: 800, y: 700 }, size: SIZE } }).plan).toBeNull()
  })

  it('장에 자리가 없으면 새 컴포넌트는 다음 장에, 그 까닭을 남긴다', () => {
    const full = compose(row(block('kpi', 'a'), block('kpi', 'b'), block('kpi', 'c')), row(block('kpi', 'd'), block('kpi', 'e'), block('kpi', 'f')))
    const plan = planDrop(full, fresh(full, b), { by: 'pointer', over: true, at: { p: { x: 800, y: 300 }, size: SIZE } })
    expect(plan.plan).toBe('next')
    expect(plan.blocked).toEqual({ kind: 'full' })
  })
})
