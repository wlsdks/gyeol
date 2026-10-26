import { describe, expect, it } from 'vitest'
import { presentable } from './fields'
import { emptyItem, makeSlide } from './generate'
import { labelFor, LAYOUTS } from './layouts'
import type { Item } from './types'

const item = (title: string): Item => ({ ...emptyItem(), title })

describe('발표 화면에 그릴 장 (presentable)', () => {
  it('하나도 채우지 않은 항목을 빼고, 다 채웠으면 받은 장 그대로', () => {
    const slide = { ...makeSlide('closing'), items: [item('예산 승인'), item(''), item('일정 확보')] }
    expect(presentable(slide).items.map((it) => it.title)).toEqual(['예산 승인', '일정 확보'])
    const full = { ...slide, items: [item('예산 승인'), item('일정 확보')] }
    expect(presentable(full)).toBe(full)
  })

  it('이미지나 숫자만 채운 항목은 남긴다', () => {
    const slide = { ...makeSlide('kpi'), items: [{ ...emptyItem(), value: '4시간' }, emptyItem(), { ...emptyItem(), image: 'data:image/png;base64,AA' }] }
    expect(presentable(slide).items).toHaveLength(2)
  })

  it('레이아웃의 가장 적은 수 밑으로는 빼지 않는다', () => {
    const slide = { ...makeSlide('matrix'), items: [item('가'), emptyItem(), emptyItem(), emptyItem()] }
    expect(presentable(slide).items).toHaveLength(4)
  })

  it('숨긴 항목은 앞의 빈 항목이 빠져도 끌려 올라오지 않는다', () => {
    const max = LAYOUTS.closing.items!.max
    const items = [item('가'), ...Array.from({ length: max - 1 }, () => emptyItem()), item('숨긴 항목')]
    const shown = presentable({ ...makeSlide('closing'), items }).items.map((it) => it.title)
    expect(shown).toEqual(['가'])
  })

  it('강조는 같은 항목을 따라가고, 빈 항목을 강조했으면 강조하지 않는다', () => {
    const slide = { ...makeSlide('kpi'), items: [emptyItem(), item('가'), item('나')] }
    expect(presentable({ ...slide, options: { highlight: 2 } }).options.highlight).toBe(1)
    expect(presentable({ ...slide, options: { highlight: 0 } }).options.highlight).toBe(-1)
  })
})

describe('칸의 이름 (labelFor)', () => {
  it('항목 칸은 몇째 항목인지까지, 안내 문구(예시)는 쓰지 않는다', () => {
    expect(labelFor('kpi', 'title')).toBe('제목')
    expect(labelFor('kpi', 'title', 'title', 1)).toBe('숫자 2 이름')
    expect(labelFor('kpi', 'value', 'value', 0)).toBe('숫자 1')
  })

  it('모든 레이아웃의 모든 칸에 이름이 있다', () => {
    for (const spec of Object.values(LAYOUTS)) {
      for (const f of spec.fields) expect(labelFor(spec.id, f.key), `${spec.id}.${f.key}`).not.toBe('')
      for (const f of spec.items?.fields ?? []) expect(labelFor(spec.id, f.key, f.key, 0), `${spec.id}.items.${f.key}`).not.toBe('')
    }
  })
})
