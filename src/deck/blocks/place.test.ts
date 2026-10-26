import { describe, expect, it } from 'vitest'
import { autoPlace, dropTarget, insertAt, makeBlock, moveAt, movingBase, pointerTarget, type Shown, type ShownCell } from '../blocks'
import type { Block } from '../types'

// 끄는 동안 손 아래 자리는 화면에 보이는 판(shown: 맞춘 뒤의 칸과 그린 것의 테두리)으로 잰다

const block = (type: Block['type'], id: string = type): Block => ({ ...makeBlock(type), id })
const H = 705
const SIZE = { w: 1680, h: H }
const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h })
const cellOf = (cell: ReturnType<typeof rect>, ink: ReturnType<typeof rect>): ShownCell => ({ cell, ink })

/** 핵심 한 줄(위, 짧은 글) 아래에 큰 숫자와 막대 비교가 나란한 장: 편집기에서 본 모습 그대로의 자리 */
function scene() {
  let bs = autoPlace([], block('message', 'm'), H)!
  bs = autoPlace(bs, block('number', 'n'), H)!
  bs = autoPlace(bs, block('bars', 'b'), H)!
  // 짧은 글 한 줄은 칸 왼쪽에 작게 그려지고, 아래 줄은 그 글 바로 아래로 올라와 있다
  const cells = new Map<string, ShownCell>([
    ['m', cellOf(rect(0, 100, 1680, 203), rect(-14, 117, 359, 81))],
    ['n', cellOf(rect(0, 270, 366, 435), rect(-14, 256, 264, 221))],
    ['b', cellOf(rect(438, 270, 1242, 435), rect(424, 256, 1270, 280))],
  ])
  return { bs, cells }
}

/** 끄는 컴포넌트(id)를 뺀 보이는 판. 놓일 자리는 그 컴포넌트의 지금 자리 */
const shownWithout = (cells: Map<string, ShownCell>, id: string): Shown => ({
  cells: new Map(Array.from(cells).filter(([k]) => k !== id)),
  slot: cells.get(id) ?? null,
})

describe('끄는 동안 손 아래 자리 (보이는 판으로)', () => {
  it('짧은 글의 오른쪽 빈 곳에 놓으면 그 글 옆에 (칸의 위 변이 가깝다고 그 위로 가지 않는다)', () => {
    const { bs, cells } = scene()
    const base = movingBase(bs, 'n', H)
    const shown = shownWithout(cells, 'n')
    const p = { x: 700, y: 150 }
    const t = dropTarget(base, bs.find((b) => b.id === 'n')!, p, SIZE, null, bs, shown)
    expect(t).toEqual({ kind: 'spot', spot: { at: 'm', side: 'right' } })
    expect(pointerTarget(base, p, SIZE, shown)).toEqual(t)
    const after = moveAt(bs, 'n', t!, H)!
    const at = (id: string) => after.find((b) => b.id === id)!.at!
    expect(at('n').y).toBe(at('m').y)
    expect(at('n').x).toBeGreaterThan(at('m').x)
  })

  it('보이는 내용 전체보다 위면 맨 위 새 줄, 두 줄 사이 빈 띠의 가운데면 그 줄 사이', () => {
    const { bs, cells } = scene()
    const base = movingBase(bs, 'n', H)
    const shown = shownWithout(cells, 'n')
    expect(pointerTarget(base, { x: 800, y: 60 }, SIZE, shown)).toEqual({ kind: 'spot', spot: { at: null, side: 'above' } })
    // 위 줄 글의 아래 끝(198)과 아래 줄 그린 것의 위 끝(256) 사이
    const between = pointerTarget(base, { x: 900, y: 227 }, SIZE, shown)
    expect(between.kind === 'spot' && between.spot.side).toBe('below')
    expect(between.kind === 'spot' && between.spot.at).toBe('m')
  })

  it('옮길 때 다른 컴포넌트의 그린 것 가운데에 놓으면 맞바꾼다', () => {
    const { bs, cells } = scene()
    const shown = shownWithout(cells, 'n')
    const b = cells.get('b')!.ink
    const t = dropTarget(movingBase(bs, 'n', H), bs.find((x) => x.id === 'n')!, { x: b.x + b.w / 2, y: b.y + b.h / 2 }, SIZE, null, bs, shown)
    expect(t).toEqual({ kind: 'swap', with: 'b' })
  })

  it('옮길 때 고른 자리는 늘 옮기기로 들어간다 (넣기로는 되는데 옮기기로는 안 되는 자리를 고르지 않는다)', () => {
    const { bs, cells } = scene()
    const base = movingBase(bs, 'b', H)
    const shown = shownWithout(cells, 'b')
    for (let x = -40; x <= SIZE.w + 40; x += 120)
      for (let y = -40; y <= SIZE.h + 40; y += 60) {
        const t = dropTarget(base, bs.find((b) => b.id === 'b')!, { x, y }, SIZE, null, bs, shown)
        if (t) expect(moveAt(bs, 'b', t, H)).toBeTruthy()
      }
  })

  it('손이 흐리게 미리 보인 자리 위에 있으면 지금 자리 그대로', () => {
    const { bs, cells } = scene()
    const base = movingBase(bs, 'n', H)
    const current = { kind: 'spot' as const, spot: { at: 'm', side: 'right' as const } }
    const moved = moveAt(bs, 'n', current, H)!
    expect(moved).toBeTruthy()
    // 미리 보인 판: 큰 숫자가 위 줄 오른쪽에
    const shown: Shown = { cells: shownWithout(cells, 'n').cells, slot: cellOf(rect(1300, 100, 380, 203), rect(1290, 110, 240, 190)) }
    expect(dropTarget(base, bs.find((b) => b.id === 'n')!, { x: 1400, y: 200 }, SIZE, current, bs, shown)).toEqual(current)
    // 새 컴포넌트는 넣기 그대로: 넣을 수 있는 자리만 고른다
    const fresh = block('callout', 'c')
    const t = dropTarget(bs, fresh, { x: 700, y: 150 }, SIZE, null, undefined, { cells, slot: null })
    if (t?.kind === 'spot') expect(insertAt(bs, t.spot, fresh, H)).toBeTruthy()
  })
})
