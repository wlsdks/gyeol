import { describe, expect, it } from 'vitest'
import type { Block, BlockType } from '../types'
import { allSpots, autoInsert, bandOf, BOARD_COLS, BOARD_ROWS, type Fit, guttersOf, insertBlock, insertGroup, isStacked, layTree, leaf, moveBlock, moveGutter, needRows, normalize, removeFromBoard, settle, share, split, swapBlocks, tiles, treeOf } from './board'

// 시험용 크기 규칙: 부품 종류마다 가장 좁은 너비와 높이(네모). 좁을수록 높아지는 부품은 너비마다 다르게
const RULES: Partial<Record<BlockType, { w: number; pref: number; h: (w: number) => number; stretchy?: boolean; fills?: boolean; small?: boolean }>> = {
  bullets: { w: 4, pref: 6, h: (w) => (w >= 8 ? 4 : 6) },
  trend: { w: 6, pref: 8, h: () => 6, stretchy: true },
  number: { w: 3, pref: 4, h: () => 4 },
  stat: { w: 3, pref: 3, h: () => 3, small: true },
  table: { w: 12, pref: 12, h: () => 6, stretchy: true },
  text: { w: 4, pref: 6, h: () => 3 },
  callout: { w: 3, pref: 4, h: () => 3, fills: true },
}
const fit: Fit = {
  minW: (b) => RULES[b.type]!.w,
  minH: (b, w) => (w < RULES[b.type]!.w ? Infinity : RULES[b.type]!.h(w)),
  prefW: (b) => RULES[b.type]!.pref,
  stretchy: (b) => !!RULES[b.type]!.stretchy,
  fills: (b) => !!RULES[b.type]!.fills,
  small: (b) => !!RULES[b.type]!.small,
}

const mk = (id: string, type: BlockType, at?: Block['at']): Block => ({ id, type, fields: {}, items: [], ...(at ? { at } : {}) })
const areas = (bs: Block[]) => Object.fromEntries(bs.map((b) => [b.id, b.at]))

describe('나누기 (share)', () => {
  it('바라는 크기의 합이 맞으면 그대로', () => {
    expect(share(12, [4, 4], [8, 4], [0, 0])).toEqual([8, 4])
  })
  it('남는 길이는 커지는 자식이 받는다', () => {
    expect(share(6, [2, 3], [2, 3], [0, 2])).toEqual([2, 4])
  })
  it('커지는 자식이 없으면 면이 있는 자식이, 그것도 없으면 모두가 비율대로', () => {
    expect(share(12, [3, 3], [3, 3], [1, 0])).toEqual([9, 3])
    expect(share(12, [3, 3], [3, 3], [1, 2])).toEqual([3, 9])
    expect(share(12, [3, 3], [3, 3], [0, 0])).toEqual([6, 6])
  })
  it('위아래로 쌓은 글과 숫자뿐이면 남는 높이는 맨 아래 자식이 다 받는다 (빈 곳은 한곳에)', () => {
    expect(share(12, [3, 3], [3, 3], [0, 0], true)).toEqual([3, 9])
    expect(share(12, [2, 3, 2], [2, 3, 2], [0, 0, 0], true)).toEqual([2, 3, 7])
    // 커지는 자식이 있으면 그대로 그 자식이
    expect(share(12, [3, 3], [3, 3], [2, 0], true)).toEqual([9, 3])
  })
  it('모자라면 여유가 큰 자식이 내준다', () => {
    expect(share(12, [3, 3], [12, 1], [0, 0])).toEqual([9, 3])
  })
  it('가장 작은 크기의 합이 넘치면 null', () => {
    expect(share(6, [4, 3], [3, 3], [0, 0])).toBeNull()
  })
})

describe('판', () => {
  it('빈 판에 넣으면 판 전체', () => {
    const b = insertBlock([], mk('a', 'bullets'), { at: null, side: 'below' }, fit)!
    expect(b[0].at).toEqual({ x: 0, y: 0, w: BOARD_COLS, h: BOARD_ROWS })
  })

  it('옆에 넣으면 둘이 보기 좋은 너비의 비율로 나눈다', () => {
    const one = insertBlock([], mk('a', 'bullets'), { at: null, side: 'below' }, fit)!
    const two = insertBlock(one, mk('s', 'stat'), { at: 'a', side: 'right' }, fit)!
    // 목록 6, 숫자 한 줄 3을 바라니 12칸을 2 : 1로
    expect(areas(two)).toEqual({ a: { x: 0, y: 0, w: 8, h: 12 }, s: { x: 8, y: 0, w: 4, h: 12 } })
    expect(tiles(two)).toBe(true)
  })

  it('아래에 넣으면 그 너비에서 가장 낮은 높이를 받는다', () => {
    const one = insertBlock([], mk('a', 'bullets'), { at: null, side: 'below' }, fit)!
    const two = insertBlock(one, mk('t', 'trend'), { at: 'a', side: 'below' }, fit)!
    // 목록은 12칸 너비에서 4칸 높이면 되고, 남는 높이는 커지는 추이가 받는다
    expect(areas(two)).toEqual({ a: { x: 0, y: 0, w: 12, h: 4 }, t: { x: 0, y: 4, w: 12, h: 8 } })
  })

  it('넣으면 누군가 잘리는 자리는 null', () => {
    const one = insertBlock([], mk('a', 'table'), { at: null, side: 'below' }, fit)!
    // 표는 12칸이 있어야 해서 옆에는 아무것도 둘 수 없다
    expect(insertBlock(one, mk('s', 'stat'), { at: 'a', side: 'right' }, fit)).toBeNull()
    expect(insertBlock(one, mk('s', 'stat'), { at: 'a', side: 'below' }, fit)).not.toBeNull()
  })

  it('묶음 옆에 넣기(up): 쌓은 칸 전체의 옆', () => {
    let b = insertBlock([], mk('a', 'trend'), { at: null, side: 'below' }, fit)!
    b = insertBlock(b, mk('n', 'number'), { at: 'a', side: 'right' }, fit)!
    b = insertBlock(b, mk('m', 'number'), { at: 'n', side: 'below' }, fit)!
    // n과 m을 쌓은 칸 아래가 아니라, 추이와 쌓은 칸이 든 줄 전체 아래에 새 줄
    const c = insertBlock(b, mk('x', 'text'), { at: 'n', side: 'below', up: 2 }, fit)!
    expect(c.find((x) => x.id === 'x')!.at).toMatchObject({ x: 0, w: 12 })
    expect(tiles(c)).toBe(true)
  })

  it('빼면 옆 부품이 그 자리를 덮는다', () => {
    let b = insertBlock([], mk('a', 'bullets'), { at: null, side: 'below' }, fit)!
    b = insertBlock(b, mk('s', 'stat'), { at: 'a', side: 'right' }, fit)!
    b = insertBlock(b, mk('t', 'trend'), { at: 'a', side: 'below', up: 1 }, fit)!
    const r = removeFromBoard(b, 's', fit)
    expect(areas(r)).toMatchObject({ a: { x: 0, w: 12 } })
    expect(tiles(r)).toBe(true)
  })

  it('옮기기는 빼고 다시 넣기', () => {
    let b = insertBlock([], mk('a', 'bullets'), { at: null, side: 'below' }, fit)!
    b = insertBlock(b, mk('s', 'stat'), { at: 'a', side: 'right' }, fit)!
    const m = moveBlock(b, 's', { at: 'a', side: 'left' }, fit)!
    expect(m.find((x) => x.id === 's')!.at).toMatchObject({ x: 0 })
    expect(tiles(m)).toBe(true)
  })

  it('맞바꾸기', () => {
    let b = insertBlock([], mk('a', 'text'), { at: null, side: 'below' }, fit)!
    b = insertBlock(b, mk('c', 'text'), { at: 'a', side: 'right' }, fit)!
    const s = swapBlocks(b, 'a', 'c', fit)!
    expect(s.find((x) => x.id === 'a')!.at!.x).toBeGreaterThan(0)
    expect(s.find((x) => x.id === 'c')!.at!.x).toBe(0)
  })

  it('선을 끌면 두 쪽이 크기를 주고받고, 잘리는 데서 멈춘다', () => {
    let b = insertBlock([], mk('a', 'text'), { at: null, side: 'below' }, fit)!
    b = insertBlock(b, mk('c', 'text'), { at: 'a', side: 'right' }, fit)!
    const g = guttersOf(b)
    expect(g).toHaveLength(1)
    expect(g[0].at).toBe(6)
    const moved = moveGutter(b, g[0], 7, fit)!
    expect(areas(moved)).toEqual({ a: { x: 0, y: 0, w: 7, h: 12 }, c: { x: 7, y: 0, w: 5, h: 12 } })
    // 글은 4칸까지라 11로 끌어도 8에서 멈추고, 그대로인 자리로는 null
    expect(moveGutter(b, g[0], 11, fit)!.find((x) => x.id === 'a')!.at!.w).toBe(8)
    expect(moveGutter(b, g[0], 6, fit)).toBeNull()
  })

  it('부품이 커지면 옆에서 받고, 안 되면 null', () => {
    let b = insertBlock([], mk('a', 'text'), { at: null, side: 'below' }, fit)!
    b = insertBlock(b, mk('t', 'trend'), { at: 'a', side: 'below' }, fit)!
    expect(settle(b, fit)).toEqual(b)
    // 글을 표로 바꾼 것처럼 위 부품이 높이 6을 바라면 아래 추이(6)와 합쳐 12라 들어간다
    const grown = settle(
      b.map((x) => (x.id === 'a' ? { ...x, type: 'table' as const } : x)),
      fit,
    )!
    expect(grown.find((x) => x.id === 'a')!.at!.h).toBe(6)
    // 둘 다 표면 높이 6 + 6에 더해 하나 더는 들어가지 않는다
    expect(settle([...grown, mk('z', 'table', { x: 0, y: 0, w: 1, h: 1 })], fit)).toBeNull()
  })

  it('넓으면 더 높아지는 부품(글자 단계가 칸 너비로도 커진다)도 들어가는 너비를 찾아 놓는다', () => {
    // 숫자 카드: 3칸에서는 4줄, 4~7칸에서는 5줄, 8칸부터 3줄. 위에 6줄짜리 표가 있으면 아래 줄은 높이 6까지
    const wide: Fit = { ...fit, minH: (b, w) => (b.type === 'number' ? (w < 3 ? Infinity : w === 3 ? 4 : w < 8 ? 5 : 3) : fit.minH(b, w)) }
    const b = [mk('t', 'table', { x: 0, y: 0, w: 12, h: 8 }), mk('n', 'number', { x: 0, y: 8, w: 4, h: 4 }), mk('m', 'number', { x: 4, y: 8, w: 8, h: 4 })]
    expect(needRows(b, wide)).toBe(10)
    const out = settle(b, wide)!
    expect(out).not.toBeNull()
    expect(tiles(out)).toBe(true)
    for (const x of out) expect(wide.minH(x, x.at!.w)).toBeLessThanOrEqual(x.at!.h)
  })

  it('넓을수록 더 높아지는 부품 하나만 든 줄은 판 너비에서 드는 높이를 받는다', () => {
    // 구성비 띠처럼 6~8칸에서 7줄, 9칸부터 8줄. 혼자 든 줄은 12칸을 다 써야 해서 7줄로는 놓을 수 없다
    const wide: Fit = { ...fit, minW: (b) => (b.type === 'trend' ? 6 : fit.minW(b)), minH: (b, w) => (b.type === 'trend' ? (w < 6 ? Infinity : w < 9 ? 7 : 8) : fit.minH(b, w)) }
    const t = split('v', [split('h', [leaf(mk('m', 'text'), 12)], 99), split('h', [leaf(mk('s', 'trend'), 12)], 1)])
    const out = layTree(t, wide)!
    expect(out).not.toBeNull()
    expect(out.find((b) => b.id === 's')!.at).toMatchObject({ w: 12, h: 8 })
    expect(tiles(out)).toBe(true)
  })

  it('자리가 엉킨 파일도 판을 덮게 다시 짠다', () => {
    const messy = [mk('a', 'text', { x: 0, y: 0, w: 12, h: 12 }), mk('c', 'text', { x: 0, y: 0, w: 6, h: 3 })]
    expect(treeOf(messy)).toBeNull()
    const fixed = normalize(messy, fit)
    expect(tiles(fixed)).toBe(true)
    expect(fixed.map((b) => b.id)).toEqual(['a', 'c'])
  })

  it('눌러서 넣으면 마지막 줄 끝, 자리가 모자라면 새 줄', () => {
    let b: Block[] = []
    for (const [id, type] of [
      ['n1', 'number'],
      ['n2', 'number'],
      ['n3', 'number'],
    ] as const)
      b = autoInsert(b, mk(id, type), fit)!
    expect(b.map((x) => x.at!.w)).toEqual([4, 4, 4])
    b = autoInsert(b, mk('t', 'trend'), fit)!
    expect(b.find((x) => x.id === 't')!.at).toMatchObject({ x: 0, w: 12 })
    expect(tiles(b)).toBe(true)
  })

  it('넣을 수 있는 자리 목록에는 판의 네 쪽이 있다', () => {
    const b = insertBlock([], mk('a', 'text'), { at: null, side: 'below' }, fit)!
    expect(allSpots(b).filter((s) => s.at === null)).toHaveLength(4)
  })

  it('차트 옆에 글을 눌러 넣으면 옆이 아니라 아래 새 줄 (옆에 두면 글 위아래가 빈다)', () => {
    let b = autoInsert([], mk('t', 'trend'), fit)!
    b = autoInsert(b, mk('n', 'number'), fit)!
    expect(b.find((x) => x.id === 'n')!.at).toMatchObject({ x: 0, w: 12 })
    // 숫자를 하나 더 넣으면 숫자 줄의 옆에
    b = autoInsert(b, mk('m', 'number'), fit)!
    expect(b.find((x) => x.id === 'm')!.at!.y).toBe(b.find((x) => x.id === 'n')!.at!.y)
  })

  it('나란한 묶음과 쌓인 부품', () => {
    let b = insertBlock([], mk('a', 'trend'), { at: null, side: 'below' }, fit)!
    b = insertBlock(b, mk('n', 'number'), { at: 'a', side: 'right' }, fit)!
    b = insertBlock(b, mk('m', 'number'), { at: 'n', side: 'below' }, fit)!
    b = insertBlock(b, mk('x', 'text'), { at: null, side: 'below' }, fit)!
    expect(bandOf(b, 'a').map((x) => x.id)).toEqual(['a', 'n', 'm'])
    expect(bandOf(b, 'x').map((x) => x.id)).toEqual(['x'])
    expect(isStacked(b, 'n')).toBe(true)
    expect(isStacked(b, 'a')).toBe(false)
  })

  it('묶음 넣기: 묶음 안의 짜임은 그대로', () => {
    const group = [mk('p', 'number', { x: 0, y: 0, w: 6, h: 4 }), mk('q', 'number', { x: 6, y: 0, w: 6, h: 4 })]
    const one = insertBlock([], mk('t', 'trend'), { at: null, side: 'below' }, fit)!
    const two = insertGroup(one, group, { at: null, side: 'above' }, fit)!
    expect(tiles(two)).toBe(true)
    const p = two.find((x) => x.id === 'p')!.at!
    const q = two.find((x) => x.id === 'q')!.at!
    expect(p.y).toBe(0)
    expect(q.y).toBe(0)
    expect(p.x).toBeLessThan(q.x)
  })

  it('드는 높이', () => {
    let b = insertBlock([], mk('a', 'text'), { at: null, side: 'below' }, fit)!
    b = insertBlock(b, mk('t', 'trend'), { at: 'a', side: 'below' }, fit)!
    expect(needRows(b, fit)).toBe(9)
  })
})
