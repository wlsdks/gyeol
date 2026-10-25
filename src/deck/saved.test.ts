import { describe, expect, it } from 'vitest'
import { allBlocks, blockCount, cleanPart, freshRows, insertRows, makeBlock, MAX_BLOCKS, MAX_IN_ROW, needH, partFrom, rowsIssue, SAVED_NAME_MAX, slideFromPart } from './blocks'
import { makeSlide } from './generate'
import type { Block, BlockRow, Slide } from './types'

// 내 컴포넌트: 장에서 떼어 저장하고(partFrom), 넣을 때마다 새 id로(freshRows, slideFromPart),
// 파일에서 읽을 때는 정해진 꼴로만(cleanPart), 장에 넣을 자리가 없으면 넣지 않는다(rowsIssue)

const block = (type: Block['type'], id: string = type, fields: Record<string, string> = {}): Block => ({ ...makeBlock(type), id, fields: { ...makeBlock(type).fields, ...fields } })
const row = (id: string, ...blocks: Block[]): BlockRow => ({ id, blocks })

function composed(rows: BlockRow[], options: Slide['options'] = {}): Slide {
  return { ...makeSlide('compose'), id: 's1', fields: { title: '가짜 제목' }, rows, options }
}

const sample = () =>
  composed(
    [
      { ...row('r1', block('kpi', 'k'), block('callout', 'c', { text: '가짜 결정 요청' })), spans: [8, 4], link: 'arrow' as never, grow: 2 },
      row('r2', block('bullets', 'b')),
    ],
    { tone: 'invert', motion: 'calm', transition: 'fade', order: ['c', 'k', 'b'], highlight: 1, place: 'top' },
  )

describe('내 컴포넌트로 저장', () => {
  it('컴포넌트 하나는 그 컴포넌트만, 깊은 복사로 (저장한 뒤 장을 고쳐도 저장한 것은 그대로)', () => {
    const slide = sample()
    const part = partFrom(slide, 'block', 'c', { w: 528.4, h: 253.6 })!
    expect(part.kind).toBe('block')
    expect(allBlocks(part.rows).map((b) => b.id)).toEqual(['c'])
    expect(part.name).toBe('강조 상자')
    expect(part.size).toEqual({ w: 528, h: 254 })
    slide.rows![0].blocks[1].fields.text = '바뀐 글'
    expect(part.rows[0].blocks[0].fields.text).toBe('가짜 결정 요청')
  })

  it('한 줄은 놓인 비율 그대로, 줄 밖으로 이어지던 이음표와 높이 비중은 뗀다', () => {
    const part = partFrom(sample(), 'row', 'k')!
    expect(part.rows).toHaveLength(1)
    expect(part.rows[0].spans).toEqual([8, 4])
    expect(part.rows[0].link).toBeUndefined()
    expect(part.rows[0].grow).toBeUndefined()
    expect(part.name).toBe('핵심 숫자 + 강조 상자')
  })

  it('장 하나는 제목 칸과 바탕, 움직임, 장 넘기기, 나오는 차례까지. 레이아웃 장의 설정은 가져가지 않는다', () => {
    const part = partFrom(sample(), 'slide', null, { w: 999, h: 999 })!
    expect(blockCount(part.rows)).toBe(3)
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
    const slide = composed([row('r1', block('kpi', 'a'), block('callout', 'b')), row('r2', block('bullets', 'c'), block('quote', 'd'))])
    expect(partFrom(slide, 'slide', null)!.name).toBe('핵심 숫자 + 강조 상자 외 2')
  })
})

describe('내 컴포넌트 넣기', () => {
  it('넣을 때마다 부품, 줄, 항목이 모두 새 id (같은 것을 두 번 넣어도 겹치지 않는다)', () => {
    const part = partFrom(sample(), 'slide', null)!
    const a = freshRows(part.rows)
    const b = freshRows(part.rows)
    const ids = (rows: BlockRow[]) => rows.flatMap((r) => [r.id, ...r.blocks.flatMap((x) => [x.id, ...x.items.map((it) => it.id)])])
    const all = [...ids(part.rows), ...ids(a.rows), ...ids(b.rows)]
    expect(new Set(all).size).toBe(all.length)
    expect([...a.ids.keys()].sort()).toEqual(['b', 'c', 'k'])
  })

  it('장 하나는 새 부품 장으로, 나오는 차례는 새 id로 옮긴다', () => {
    const part = partFrom(sample(), 'slide', null)!
    const slide = slideFromPart(part)
    expect(slide.layout).toBe('compose')
    expect(slide.fields.title).toBe('가짜 제목')
    expect(slide.options.tone).toBe('invert')
    const byType = Object.fromEntries(allBlocks(slide.rows ?? []).map((b) => [b.type, b.id]))
    expect(slide.options.order).toEqual([byType.callout, byType.kpi, byType.bullets])
  })

  it('한 줄을 맨 아래에 넣고, 넘치면 까닭을 알린다 (무조건 넣지 않는다)', () => {
    const rows = [row('r1', block('message', 'm'))]
    const add = freshRows(partFrom(sample(), 'row', 'k')!.rows).rows
    const next = insertRows(rows, rows.length, add)!
    expect(next.map((r) => r.blocks.map((b) => b.type))).toEqual([['message'], ['kpi', 'callout']])
    expect(rowsIssue(rows, add)).toBeNull()

    // 부품 수: 한 장에 MAX_BLOCKS까지
    const many = [row('a', block('text', 't1'), block('text', 't2'), block('text', 't3')), row('b', block('text', 't4'), block('text', 't5'))]
    expect(blockCount(many) + blockCount(add)).toBeGreaterThan(MAX_BLOCKS)
    expect(rowsIssue(many, add)).toEqual({ kind: 'full' })
    expect(insertRows(many, many.length, add)).toBeNull()

    // 줄 수
    const three = [row('a', block('text', 't1')), row('b', block('text', 't2')), row('c', block('text', 't3'))]
    expect(rowsIssue(three, add)).toEqual({ kind: 'rows' })

    // 높이: 장보다 높아지면
    const low = needH(rows) + 40
    expect(rowsIssue(rows, add, low)?.kind).toBe('height')
  })

  it('넣는 줄의 진한 면이 장의 진한 면과 겹치면 바탕 없이 넣는다', () => {
    const rows = [row('r1', { ...block('callout', 'c0'), look: 'bold' })]
    const add = [row('n', { ...block('callout', 'c1'), look: 'bold' })]
    const next = insertRows(rows, 1, add)!
    expect(next[0].blocks[0].look).toBe('bold')
    expect(next[1].blocks[0].look).toBe('plain')
  })
})

describe('파일에서 읽은 내 컴포넌트 하나 (cleanPart)', () => {
  it('정해진 값만 남긴다: 모르는 바탕, 없는 부품의 차례, 장 밖의 크기는 버린다', () => {
    const part = cleanPart({
      name: '  가짜 이름  ',
      kind: 'slide',
      rows: [row('r', block('kpi', 'k'), block('callout', 'c'))],
      slide: { fields: { title: '제목', bad: 3 }, options: { tone: 'rainbow', motion: 'calm', transition: 'warp', order: ['c', 'ghost', 'c'] } },
      size: { w: 500, h: 200 },
    })!
    expect(part.name).toBe('가짜 이름')
    expect(part.slide?.fields).toEqual({ title: '제목' })
    expect(part.slide?.options).toEqual({ motion: 'calm', order: ['c'] })
    expect(part.size).toBeUndefined()
    expect(cleanPart({ kind: 'block', rows: [row('r', block('kpi'))], size: { w: 5000, h: 10 } })!.size).toBeUndefined()
  })

  it('적힌 종류보다 많이 들었으면 맞는 종류로 읽는다', () => {
    expect(cleanPart({ kind: 'block', rows: [row('r', block('kpi', 'a'), block('callout', 'b'))] })!.kind).toBe('row')
    expect(cleanPart({ kind: 'row', rows: [row('a', block('kpi', 'a')), row('b', block('callout', 'b'))] })!.kind).toBe('slide')
  })

  it('이름은 정한 길이까지, 없으면 컴포넌트 이름으로', () => {
    expect(cleanPart({ kind: 'block', name: '가'.repeat(80), rows: [row('r', block('kpi'))] })!.name).toHaveLength(SAVED_NAME_MAX)
    expect(cleanPart({ kind: 'block', rows: [row('r', block('kpi'))] })!.name).toBe('핵심 숫자')
  })

  it('부품이 없으면 버리고, 한 줄과 한 장에 넣는 수를 넘는 부품은 빼고 센다', () => {
    expect(cleanPart({ kind: 'row', rows: [] })).toBeNull()
    const lost = { n: 0 }
    const many = Array.from({ length: 9 }, (_, i) => block('text', `t${i}`))
    const part = cleanPart({ kind: 'slide', rows: [row('a', ...many.slice(0, 4)), row('b', ...many.slice(4, 7)), row('c', ...many.slice(7))] }, lost)!
    expect(blockCount(part.rows)).toBe(MAX_BLOCKS)
    expect(part.rows.every((r) => r.blocks.length <= MAX_IN_ROW)).toBe(true)
    expect(lost.n).toBe(9 - MAX_BLOCKS)
  })
})
