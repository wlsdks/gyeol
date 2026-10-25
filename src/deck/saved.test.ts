import { describe, expect, it } from 'vitest'
import { autoPlace, cleanPart, freshBlocks, groupIssue, insertAt, insertParts, makeBlock, MAX_LARGE, partFrom, SAVED_NAME_MAX, slideFromPart, tiles, withLink } from './blocks'
import { makeSlide } from './generate'
import type { Block, Slide } from './types'

// 내 컴포넌트: 장에서 떼어 저장하고(partFrom), 넣을 때마다 새 id로(freshBlocks, slideFromPart),
// 파일에서 읽을 때는 정해진 꼴로만(cleanPart), 장에 넣을 자리가 없으면 넣지 않는다(groupIssue)

const block = (type: Block['type'], id: string = type, fields: Record<string, string> = {}): Block => ({ ...makeBlock(type), id, fields: { ...makeBlock(type).fields, ...fields } })
const BELOW = { at: null, side: 'below' } as const

function composed(blocks: Block[], options: Slide['options'] = {}): Slide {
  return { ...makeSlide('compose'), id: 's1', fields: { title: '가짜 제목' }, blocks, options }
}

/** 위에 핵심 숫자와 강조 상자(이음표로 이은), 아래에 점 목록 */
const sample = () => {
  const top = insertAt([{ ...block('kpi', 'k'), at: { x: 0, y: 0, w: 12, h: 12 } }], { at: 'k', side: 'right' }, block('callout', 'c', { text: '가짜 결정 요청' }))!
  const bs = withLink(withLink(insertAt(top, BELOW, block('bullets', 'b'))!, { id: 'k', dir: 'h' }, 'arrow'), { id: 'k', dir: 'v' }, 'equals')
  return composed(bs, { tone: 'invert', motion: 'calm', transition: 'fade', order: ['c', 'k', 'b'], highlight: 1, place: 'top' })
}

describe('내 컴포넌트로 저장', () => {
  it('컴포넌트 하나는 그 컴포넌트만, 깊은 복사로 (저장한 뒤 장을 고쳐도 저장한 것은 그대로)', () => {
    const slide = sample()
    const part = partFrom(slide, 'block', 'c', { w: 528.4, h: 253.6 })!
    expect(part.kind).toBe('block')
    expect(part.blocks.map((b) => b.id)).toEqual(['c'])
    expect(part.blocks[0].at).toMatchObject({ x: 0, y: 0 })
    expect(part.name).toBe('강조 상자')
    expect(part.size).toEqual({ w: 528, h: 254 })
    slide.blocks!.find((b) => b.id === 'c')!.fields.text = '바뀐 글'
    expect(part.blocks[0].fields.text).toBe('가짜 결정 요청')
  })

  it('나란한 묶음은 놓인 비율 그대로, 묶음 밖으로 이어지던 이음표는 뗀다', () => {
    const part = partFrom(sample(), 'row', 'k')!
    expect(part.blocks.map((b) => b.id)).toEqual(['k', 'c'])
    expect(tiles(part.blocks, { x: 0, y: 0, w: 12, h: part.blocks[0].at!.h })).toBe(true)
    // 묶음 안의 이음표는 남고, 아래 점 목록으로 가던 이음표는 뗀다
    expect(part.blocks[0].link).toBe('arrow')
    expect(part.blocks[0].linkBelow).toBeUndefined()
    expect(part.name).toBe('핵심 숫자 + 강조 상자')
  })

  it('장 하나는 제목 칸과 바탕, 움직임, 장 넘기기, 나오는 차례까지. 레이아웃 장의 설정은 가져가지 않는다', () => {
    const part = partFrom(sample(), 'slide', null, { w: 999, h: 999 })!
    expect(part.blocks).toHaveLength(3)
    expect(part.slide?.fields.title).toBe('가짜 제목')
    expect(part.slide?.options).toEqual({ tone: 'invert', motion: 'calm', transition: 'fade', order: ['c', 'k', 'b'] })
    // 장 하나는 늘 장 전체로 그리니 크기를 두지 않는다
    expect(part.size).toBeUndefined()
  })

  it('부품 장이 아니거나 없는 부품이면 저장하지 않는다', () => {
    expect(partFrom({ ...makeSlide('statement'), id: 'x' }, 'slide', null)).toBeNull()
    expect(partFrom(sample(), 'block', 'none')).toBeNull()
  })

  it('처음 이름은 컴포넌트 이름들로, 셋이 넘으면 앞의 둘과 외 n', () => {
    const bs = [block('kpi', 'a'), block('callout', 'b'), block('bullets', 'c'), block('quote', 'd')].reduce<Block[]>((out, b) => autoPlace(out, b) ?? out, [])
    expect(partFrom(composed(bs), 'slide', null)!.name).toBe('핵심 숫자 + 강조 상자 외 2')
  })
})

describe('내 컴포넌트 넣기', () => {
  it('넣을 때마다 부품과 항목이 모두 새 id (같은 것을 두 번 넣어도 겹치지 않는다)', () => {
    const part = partFrom(sample(), 'slide', null)!
    const a = freshBlocks(part.blocks)
    const b = freshBlocks(part.blocks)
    const ids = (bs: Block[]) => bs.flatMap((x) => [x.id, ...x.items.map((it) => it.id)])
    const all = [...ids(part.blocks), ...ids(a.blocks), ...ids(b.blocks)]
    expect(new Set(all).size).toBe(all.length)
    expect([...a.ids.keys()].sort()).toEqual(['b', 'c', 'k'])
  })

  it('장 하나는 새 부품 장으로, 자리와 나오는 차례는 새 id로 옮긴다', () => {
    const part = partFrom(sample(), 'slide', null)!
    const slide = slideFromPart(part)
    expect(slide.layout).toBe('compose')
    expect(slide.fields.title).toBe('가짜 제목')
    expect(slide.options.tone).toBe('invert')
    expect(slide.blocks?.map((b) => b.at)).toEqual(part.blocks.map((b) => b.at))
    const byType = Object.fromEntries((slide.blocks ?? []).map((b) => [b.type, b.id]))
    expect(slide.options.order).toEqual([byType.callout, byType.kpi, byType.bullets])
  })

  it('묶음을 맨 아래에 넣으면 묶음 안의 짜임은 그대로, 넘치면 까닭을 알린다 (무조건 넣지 않는다)', () => {
    const bs = autoPlace([], block('message', 'm'))!
    const add = freshBlocks(partFrom(sample(), 'row', 'k')!.blocks).blocks
    const next = insertParts(bs, BELOW, add)!
    expect(tiles(next)).toBe(true)
    const [k, c] = add.map((a) => next.find((b) => b.id === a.id)!.at!)
    expect(k.y).toBe(c.y)
    expect(k.x + k.w).toBe(c.x)
    expect(groupIssue(bs, add)).toBeNull()

    // 부품 수: 한 장에 큰 부품은 MAX_LARGE까지
    const many = ['t1', 't2', 't3', 't4', 't5'].reduce<Block[]>((out, id) => autoPlace(out, block('text', id)) ?? out, [])
    expect(many.length + add.length).toBeGreaterThan(MAX_LARGE)
    expect(groupIssue(many, add)).toEqual({ kind: 'large' })
    expect(insertParts(many, BELOW, add)).toBeNull()

    // 높이: 장보다 높아지면
    expect(groupIssue(bs, add, 260)?.kind).toBe('height')
  })

  it('넣는 묶음의 진한 면이 장의 진한 면과 겹치면 바탕 없이 넣는다', () => {
    const bs = autoPlace([], { ...block('callout', 'c0'), look: 'bold' })!
    const next = insertParts(bs, BELOW, [{ ...block('callout', 'c1'), look: 'bold', at: { x: 0, y: 0, w: 12, h: 12 } }])!
    expect(next.find((b) => b.id === 'c0')!.look).toBe('bold')
    expect(next.find((b) => b.id === 'c1')!.look).toBe('plain')
  })
})

describe('파일에서 읽은 내 컴포넌트 하나 (cleanPart)', () => {
  it('정해진 값만 남긴다: 모르는 바탕, 없는 부품의 차례, 장 밖의 크기는 버린다', () => {
    const part = cleanPart({
      name: '  가짜 이름  ',
      kind: 'slide',
      blocks: sample().blocks,
      slide: { fields: { title: '제목', bad: 3 }, options: { tone: 'rainbow', motion: 'calm', transition: 'warp', order: ['c', 'ghost', 'c'] } },
      size: { w: 500, h: 200 },
    })!
    expect(part.name).toBe('가짜 이름')
    expect(part.slide?.fields).toEqual({ title: '제목' })
    expect(part.slide?.options).toEqual({ motion: 'calm', order: ['c'] })
    expect(part.size).toBeUndefined()
    expect(cleanPart({ kind: 'block', blocks: [block('kpi')], size: { w: 5000, h: 10 } })!.size).toBeUndefined()
  })

  it('적힌 종류보다 많이 들었으면 묶음으로 읽고, 자리가 빈틈없는 꼴이 아니면 다시 나눈다', () => {
    const part = cleanPart({ kind: 'block', blocks: [block('kpi', 'a'), { ...block('callout', 'b'), at: { x: 3, y: 9, w: 1, h: 1 } }] })!
    expect(part.kind).toBe('row')
    expect(tiles(part.blocks)).toBe(true)
  })

  it('예전(0.4까지) 파일의 줄은 판으로 읽는다', () => {
    const part = cleanPart({ kind: 'row', rows: [{ id: 'r', blocks: [block('kpi', 'a'), block('callout', 'b')], spans: [8, 4] }] })!
    expect(part.blocks.map((b) => [b.id, b.at?.w])).toEqual([
      ['a', 8],
      ['b', 4],
    ])
  })

  it('이름은 정한 길이까지, 없으면 컴포넌트 이름으로', () => {
    expect(cleanPart({ kind: 'block', name: '가'.repeat(80), blocks: [block('kpi')] })!.name).toHaveLength(SAVED_NAME_MAX)
    expect(cleanPart({ kind: 'block', blocks: [block('kpi')] })!.name).toBe('핵심 숫자')
  })

  it('부품이 없으면 버리고, 한 장에 넣는 수를 넘는 부품은 빼고 센다', () => {
    expect(cleanPart({ kind: 'row', blocks: [] })).toBeNull()
    const lost = { n: 0 }
    const many = Array.from({ length: 9 }, (_, i) => block('text', `t${i}`))
    const part = cleanPart({ kind: 'slide', blocks: many }, lost)!
    // 글 부품은 큰 부품이라 MAX_LARGE까지 (모든 부품의 끝 MAX_BLOCKS보다 먼저 닿는다)
    expect(part.blocks).toHaveLength(MAX_LARGE)
    expect(tiles(part.blocks)).toBe(true)
    expect(lost.n).toBe(9 - MAX_LARGE)
  })
})
