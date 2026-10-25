import { describe, expect, it } from 'vitest'
import { allBlocks, makeBlock, partFrom, type SavedPart } from '../deck/blocks'
import { makeSlide } from '../deck/generate'
import type { Block, Slide } from '../deck/types'
import { decodePartsFile, encodePartsFile } from './partsFile'

// 내 컴포넌트 파일(.components): 보관 폴더에 두고 다른 사람과 주고받는다. 읽을 때는 결의 파일만, 아는 것만

const block = (type: Block['type'], id: string = type, fields: Record<string, string> = {}): Block => ({ ...makeBlock(type), id, fields: { ...makeBlock(type).fields, ...fields } })

const sample = (): Slide => ({
  ...makeSlide('compose'),
  id: 's1',
  fields: { title: '가짜 제목' },
  rows: [
    { id: 'r1', blocks: [block('kpi', 'k'), block('callout', 'c', { text: '가짜 결정 요청' })], spans: [8, 4] },
    { id: 'r2', blocks: [block('bullets', 'b')] },
  ],
  options: { tone: 'invert', motion: 'calm', transition: 'fade', order: ['c', 'k', 'b'] },
})

describe('내 컴포넌트 파일', () => {
  const parts = (): SavedPart[] => [partFrom(sample(), 'block', 'c', { w: 528, h: 254 })!, partFrom(sample(), 'slide', null)!]

  it('저장한 것을 그대로 읽는다 (읽을 때마다 새 id)', () => {
    const list = parts()
    const read = decodePartsFile(encodePartsFile(list, 123))!
    expect(read.updatedAt).toBe(123)
    expect(read.lost).toBe(0)
    expect(read.parts.map((p) => [p.name, p.kind])).toEqual(list.map((p) => [p.name, p.kind]))
    expect(read.parts[0].size).toEqual({ w: 528, h: 254 })
    expect(read.parts[1].slide?.options).toEqual(list[1].slide?.options)
    expect(read.parts[0].id).not.toBe(list[0].id)
  })

  it('결의 파일이 아니거나 깨진 글이면 읽지 않는다', () => {
    expect(decodePartsFile('{"nope":1}')).toBeNull()
    expect(decodePartsFile('{')).toBeNull()
    expect(decodePartsFile(JSON.stringify({ format: 'html-maker/deck', parts: [] }))).toBeNull()
  })

  it('모르는 컴포넌트와 값은 빼고 몇 개를 뺐는지 센다', () => {
    const text = JSON.stringify({
      format: 'html-maker/components',
      version: 1,
      updatedAt: 1,
      parts: [
        { name: '섞인 것', kind: 'row', rows: [{ id: 'r', blocks: [{ id: 'x', type: 'hologram', fields: {}, items: [] }, { ...block('callout', 'c') }] }] },
        { name: '빈 것', kind: 'block', rows: [] },
        'not a part',
      ],
    })
    const read = decodePartsFile(text)!
    expect(read.parts).toHaveLength(1)
    expect(allBlocks(read.parts[0].rows).map((b) => b.type)).toEqual(['callout'])
    expect(read.lost).toBe(3)
  })
})
