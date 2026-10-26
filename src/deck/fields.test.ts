import { describe, expect, it } from 'vitest'
import { isBlankItem, presentable, shownOnly, unshownCount } from './fields'
import { emptyItem, makeSlide } from './generate'
import { BLOCKS, withLayout } from './blocks'
import { labelFor, labelIn, LAYOUT_ORDER, LAYOUTS } from './layouts'
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

  it('가장 적은 수를 채우려 남긴 항목은 빈 항목(isBlankItem)으로 알아볼 수 있다', () => {
    // 그리는 쪽(fields.tsx의 ItemTools)이 이것으로 빈 사분면, 단계의 표시 글자(S, 번호, 화살표)를 같이 감춘다
    const slide = { ...makeSlide('matrix'), items: [item('가'), emptyItem(), emptyItem(), emptyItem()] }
    expect(presentable(slide).items.map(isBlankItem)).toEqual([false, true, true, true])
    expect(isBlankItem({ ...emptyItem(), image: 'data:image/png;base64,AA' })).toBe(false)
  })

  it('강조는 같은 항목을 따라가고, 빈 항목을 강조했으면 강조하지 않는다', () => {
    const slide = { ...makeSlide('kpi'), items: [emptyItem(), item('가'), item('나')] }
    expect(presentable({ ...slide, options: { highlight: 2 } }).options.highlight).toBe(1)
    expect(presentable({ ...slide, options: { highlight: 0 } }).options.highlight).toBe(-1)
  })
})

describe('레이아웃에 없어 가려진 칸 (unshownCount)', () => {
  const points = () => ({
    ...makeSlide('points'),
    fields: { title: '다음 주 할 일', lead: '' },
    items: [
      { ...item('양식 배포'), body: '모든 팀에 새 양식을 보내요' },
      { ...item('사용법 안내'), body: '짧은 안내 글을 붙여요' },
      { ...item('의견 모으기'), body: '두 주 뒤에 설문을 해요' },
    ],
  })

  it('레이아웃이 그리는 칸만 채웠으면 0', () => {
    expect(unshownCount(points())).toBe(0)
  })

  it('항목이 없는 레이아웃으로 바꾸면 항목의 칸이 모두, 설명을 그리지 않는 레이아웃이면 설명만 가려진다', () => {
    expect(unshownCount(withLayout(points(), 'statement'))).toBe(6)
    expect(unshownCount(withLayout(points(), 'bars'))).toBe(3)
    // 되돌리면 다시 보인다 (지우지 않았다)
    expect(unshownCount(withLayout(withLayout(points(), 'statement'), 'points'))).toBe(0)
  })

  it('컴포넌트 장으로 바꾸면 글을 컴포넌트로 옮겨 가려지는 칸이 없다', () => {
    expect(unshownCount(withLayout(points(), 'compose'))).toBe(0)
  })

  it('컴포넌트 장을 다른 레이아웃으로 바꾸면 남겨 둔 컴포넌트의 칸이 모두 가려진다', () => {
    const composed = withLayout(points(), 'compose')
    // 핵심 포인트 부품 하나뿐이면 그 레이아웃으로 되돌려서 가려지는 칸이 없다
    expect(unshownCount(withLayout(composed, 'points'))).toBe(0)
    // 다른 레이아웃이면 부품이 남아 그 안의 글 여섯 곳이 가려진다
    expect(unshownCount(withLayout(composed, 'statement'))).toBe(6)
  })

  it('최대 수 너머의 항목과, 컴포넌트 장이 아닌 장에 남은 컴포넌트의 칸도 센다', () => {
    const five = { ...points(), items: [...points().items, item('넷째'), item('다섯째')] }
    // 핵심 포인트는 넷까지: 다섯째 항목의 이름이 가려진다
    expect(unshownCount(five)).toBe(1)
    const composed = withLayout(points(), 'compose')
    const back = { ...composed, layout: 'points' as const, blocks: [...composed.blocks!, { ...composed.blocks![0], id: 'b2' }] }
    expect(unshownCount(back)).toBeGreaterThanOrEqual(6)
  })

  it('표지의 소속, 발표자처럼 발표 전체의 값은 세지 않는다', () => {
    const cover = { ...makeSlide('cover'), fields: { title: '분기 보고', $org: '품질팀' } }
    expect(unshownCount(cover)).toBe(0)
  })
})

describe('그리는 칸만 남긴 장 (shownOnly)', () => {
  // 레이아웃이 그리는 칸만 모두 채운 장
  const filled = (id: (typeof LAYOUT_ORDER)[number]) => {
    const spec = LAYOUTS[id]
    const fields = Object.fromEntries(spec.fields.filter((f) => !f.key.startsWith('$')).map((f) => [f.key, `${f.label} 글`]))
    const items = spec.items ? Array.from({ length: spec.items.max }, (_, i) => ({ ...emptyItem(), ...Object.fromEntries(spec.items!.fields.map((f) => [f.key, `${f.label} ${i + 1}`])) })) : []
    return { ...makeSlide(id), fields, items }
  }

  it('그리는 칸만 채운 장은 그대로 둔다', () => {
    for (const id of LAYOUT_ORDER) {
      const slide = filled(id)
      expect(shownOnly(slide), id).toEqual(slide)
    }
  })

  it('가려진 칸은 빼고 보이는 칸은 남긴다', () => {
    const bars = shownOnly(withLayout(filled('points'), 'bars'))
    expect(bars.items.map((it) => it.title)).toEqual(['이름 1', '이름 2', '이름 3', '이름 4'])
    expect(bars.items.every((it) => !it.body)).toBe(true)
    // 컴포넌트 장이었던 장에 남겨 둔 컴포넌트는 뺀다
    const statement = shownOnly(withLayout(withLayout(filled('points'), 'compose'), 'statement'))
    expect(statement.blocks).toBeUndefined()
    expect(statement.fields.title).toBe('제목 글')
    for (const id of LAYOUT_ORDER) for (const to of LAYOUT_ORDER) expect(unshownCount(shownOnly(withLayout(filled(id), to))), `${id}→${to}`).toBe(0)
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

  it('컴포넌트 장의 모든 컴포넌트의 칸에도 이름이 있다', () => {
    for (const spec of Object.values(BLOCKS)) {
      for (const f of spec.fields) expect(labelIn(spec, f.key), `${spec.type}.${f.key}`).not.toBe('')
      for (const f of spec.items?.fields ?? []) expect(labelIn(spec, f.key, f.key, 0), `${spec.type}.items.${f.key}`).not.toBe('')
    }
    expect(labelIn(BLOCKS.bullets, 'title', 'title', 1)).toBe('줄 2 요점')
  })
})
