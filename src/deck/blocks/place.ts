// 넣기, 빼기, 옮기기, 맞바꾸기, 놓을 자리(이미지는 비율에 맞는 자리)와 놓을 수 없는 까닭, 판의 선 끌기.
// 자리 계산은 판(board.ts)이 하고, 여기서는 장의 규칙(부품 수, 면, 이음표, 이미지)과 손으로 끄는 곳을 판의 자리로 읽는 일을 한다

import type { Block, BlockType } from '../types'
import {
  allSpots,
  autoInsert,
  BOARD_COLS,
  BOARD_ROWS,
  byReading,
  type Fit,
  type Gutter,
  gutterRange,
  guttersOf,
  insertBlock,
  insertGroup,
  LOOSE,
  moveGutter,
  needWith,
  sameSpot,
  type Spot,
  spotBlocks,
  swapBlocks,
} from './board'
import { aspectOf, fitImage, fitPlaced, misfit } from './images'
import { dropBlock, tidyLinks } from './links'
import { BLOCK_COL_GAP, BLOCK_GAP, isSmall, isSolo, largeCount, MAX_BLOCKS, MAX_LARGE, settleLook } from './rules'
import { AREA_W, atRect, boardFit, needRowsPx, type Rect } from './sizing'

/** 놓을 자리: 판의 한 자리(spot)에 넣기, 또는 옮기는 부품을 다른 부품(with)과 맞바꾸기 */
export type DropTarget = { kind: 'spot'; spot: Spot } | { kind: 'swap'; with: string }

export const sameTarget = (a: DropTarget | null | undefined, b: DropTarget | null | undefined) => {
  if (!a || !b || a.kind !== b.kind) return false
  return a.kind === 'swap' ? a.with === (b as typeof a).with : sameSpot(a.spot, (b as typeof a).spot)
}

/** 판의 자리 하나를 놓을 자리로 */
export const spotTarget = (spot: Spot): DropTarget => ({ kind: 'spot', spot })
/** 맨 아래 새 줄 */
export const BOTTOM: DropTarget = spotTarget({ at: null, side: 'below' })

/**
 * 그 자리에 넣을 수 없는 까닭. 화면에 보이는 문구는 편집기가 이것으로 만든다 (screens/editor/noRoom.ts).
 * full: 한 장의 부품 수, large: 큰 부품 수, narrow: 그 자리에 끼우면 누군가 너무 좁아진다(span: 넣는 부품의 가장 좁은 너비),
 * height: 넣으면 판이 장보다 높아진다 (need: 잘리지 않는 데 드는 높이, room: 본문 높이)
 */
export type NoRoom =
  | { kind: 'full' }
  | { kind: 'narrow'; span: number }
  | { kind: 'height'; need: number; room: number }
  /** 판 너비를 혼자 쓰는 부품(type)과 나란히 놓으려 할 때 */
  | { kind: 'solo'; type: BlockType }
  /** 면을 바꿀 수 없을 때: 진한 면은 하나만, 진한 면과 옅은 면은 섞지 않고, 혼자 판 너비를 다 쓰는 작은 부품은 면 없이 */
  | { kind: 'look'; why: 'one-bold' | 'mix' | 'alone' | 'flat' | 'no-bold' }
  /** 작은 부품이 아닌 부품이 장에 MAX_LARGE개 찼다 */
  | { kind: 'large' }

/** 부품 수가 넘치는지: 모든 부품(MAX_BLOCKS), 작은 부품이 아니면 큰 부품(MAX_LARGE)도 */
function crowdIssue(blocks: readonly Block[], adding: readonly Block[]): NoRoom | null {
  if (blocks.length + adding.length > MAX_BLOCKS) return { kind: 'full' }
  if (largeCount(blocks) + adding.filter((b) => !isSmall(b.type)).length > MAX_LARGE) return { kind: 'large' }
  return null
}

/**
 * 판의 크기 규칙. 본문 높이를 모르면(문서 보기, 시험) 높이는 따지지 않고 너비만 지킨다:
 * 표 옆에 목록을 두거나 로고 열 개를 좁은 칸에 넣는 것은 높이와 상관없이 안 된다
 */
const fitFor = (blocks: readonly Block[], areaH?: number): Fit => (areaH === undefined ? { ...boardFit(WIDTH_ONLY_H, blocks), minH: LOOSE.minH } : boardFit(areaH, blocks))
/** 너비만 따질 때 너비 규칙을 읽어 오는 높이 (너비 규칙은 높이와 상관없다) */
const WIDTH_ONLY_H = 1000

/** 부품을 넣은 뒤의 판 정리: 설 자리가 없어진 이음표를 빼고, 넣은 부품의 면을 장에 맞추고, 이미지는 비율에 맞춘다 */
const settled = (blocks: Block[], added: readonly Block[], areaH?: number): Block[] => {
  let out = tidyLinks(blocks)
  for (const b of added) out = settleLook(out, out.find((x) => x.id === b.id) ?? b)
  return added.length === 1 ? fitPlaced(out, added[0], areaH) : out
}

/**
 * 그 자리에 부품을 넣은 판. 넣을 수 없는 자리면 null.
 * 본문 높이(areaH)를 주면 부품마다 잘리지 않는 크기를 지킨다. 놓을 수 있는지 따질 때(whyNot)와 끄는 동안 보이는 모습,
 * 놓은 뒤가 같은 판을 주어야 서로 맞는다
 */
export function insertAt(blocks: Block[], spot: Spot, block: Block, areaH?: number): Block[] | null {
  return remember(INSERTED, blocks, block, spot, areaH, () => {
    if (crowdIssue(blocks, [block])) return null
    const next = insertBlock(blocks, block, spot, fitFor([...blocks, block], areaH))
    return next && settled(next, [block], areaH)
  })
}

/**
 * 판(blocks)과 넣는 부품(block) 객체마다 자리별 결과를 기억한다. 끄는 동안 판과 끄는 부품은 같은 객체인데, 손을 움직일 때마다
 * 놓을 수 있는 자리(validTargets), 놓을 수 없는 까닭(whyNot, placeIssue), 손 아래 자리(dropTarget)가 같은 자리를 몇 번씩
 * 다시 넣어 봤다. 자리가 하나도 없는 장에서는 손을 움직일 때마다 10ms 넘게 들었다.
 * 판과 부품은 고치지 않고 새로 만들기 때문에(불변) 객체가 같으면 결과도 같다. 판이 바뀌면 예전 판의 기억은 저절로 버려진다(WeakMap)
 */
type Memo<T> = WeakMap<Block[], WeakMap<Block, Map<string, T>>>
const INSERTED: Memo<Block[] | null> = new WeakMap()
const WHY_NOT: Memo<NoRoom | null> = new WeakMap()

function remember<T>(memo: Memo<T>, blocks: Block[], block: Block, spot: Spot, areaH: number | undefined, make: () => T): T {
  let byBlock = memo.get(blocks)
  if (!byBlock) memo.set(blocks, (byBlock = new WeakMap()))
  let bySpot = byBlock.get(block)
  if (!bySpot) byBlock.set(block, (bySpot = new Map()))
  const key = `${spot.at ?? ''}|${spot.side}|${spot.up ?? 0}|${areaH ?? ''}`
  if (bySpot.has(key)) return bySpot.get(key) as T
  const out = make()
  bySpot.set(key, out)
  return out
}

/**
 * 부품 묶음(내 컴포넌트)을 그 자리에 넣은 판. 묶음 안의 짜임(나란한 것, 쌓은 것)은 그대로다.
 * 부품 수가 넘치거나 장에 들어가지 않으면 null (까닭은 groupIssue)
 */
export function insertParts(blocks: Block[], spot: Spot, add: Block[], areaH?: number): Block[] | null {
  if (!add.length || crowdIssue(blocks, add)) return null
  const next = insertGroup(blocks, add, spot, fitFor([...blocks, ...add], areaH))
  return next && settled(next, add, areaH)
}

/** 부품 묶음을 이 장 맨 아래에 넣을 수 없는 까닭. 넣을 수 있으면 null */
export function groupIssue(blocks: Block[], add: Block[], areaH?: number): NoRoom | null {
  const crowd = crowdIssue(blocks, add)
  if (crowd) return crowd
  if (insertParts(blocks, { at: null, side: 'below' }, add, areaH)) return null
  return areaH === undefined ? { kind: 'full' } : { kind: 'height', need: Math.round(needRowsPx([...blocks, ...add], areaH)), room: Math.round(areaH) }
}

/**
 * 부품을 뺀 판. 옆 부품들이 그 자리를 넓혀 덮고, 뺀 부품에 닿아 있던 이음표는 뗀다.
 * 판에 이미지가 있으면 그 이미지에 다시 맞춘다(장 높이를 알 때): 똑같이 나눈 너비로 돌아가면 화면 캡처가 반 칸에 눌렸다
 */
export function removeBlock(blocks: Block[], blockId: string, areaH?: number): Block[] {
  const next = dropBlock(blocks, blockId, fitFor(blocks, areaH))
  if (areaH === undefined) return next
  let out = next
  for (const img of next.filter((b) => aspectOf(b))) out = fitImage(out, img.id, aspectOf(img)!, areaH)
  return out
}

/** 판 너비를 혼자 쓰는 부품이 그 자리에서 옆에 서게 되는지: 넣는 부품이 그런 부품이거나, 옆에 서는 묶음에 그런 부품이 있으면 그 부품 */
function soloBeside(blocks: Block[], spot: Spot, block: Block): BlockType | null {
  if (spot.side !== 'left' && spot.side !== 'right') return null
  if (isSolo(block.type)) return block.type
  return spotBlocks(blocks, spot).find((b) => isSolo(b.type))?.type ?? null
}

/** 그 자리에 넣을 수 없는 까닭. 넣을 수 있으면 null */
export function whyNot(blocks: Block[], target: DropTarget, block: Block, areaH?: number): NoRoom | null {
  if (target.kind === 'swap') return null
  return remember(WHY_NOT, blocks, block, target.spot, areaH, () => spotIssue(blocks, target.spot, block, areaH))
}

function spotIssue(blocks: Block[], spot: Spot, block: Block, areaH?: number): NoRoom | null {
  const crowd = crowdIssue(blocks, [block])
  if (crowd) return crowd
  if (insertAt(blocks, spot, block, areaH)) return null
  const solo = blocks.length ? soloBeside(blocks, spot, block) : null
  if (solo) return { kind: 'solo', type: solo }
  if (areaH === undefined) return { kind: 'narrow', span: boardFit(1000).minW(block) }
  const fit = boardFit(areaH, [...blocks, block])
  const need = needWith(blocks, block, spot, fit)
  if (need === null || !Number.isFinite(need)) return { kind: 'narrow', span: fit.minW(block) }
  return { kind: 'height', need: Math.round(rowsPx(need, areaH)), room: Math.round(areaH) }
}

/** 판의 칸 수를 px 높이로 (칸 사이를 뺀 것) */
const rowsPx = (rows: number, areaH: number) => atRect({ x: 0, y: 0, w: 1, h: rows }, { w: AREA_W, h: areaH }).h

/** 넣을 수 있는 모든 자리 (읽는 차례대로). 본문 높이를 주면 넣고 나서도 잘리지 않는 자리만 */
export function validTargets(blocks: Block[], block: Block, areaH?: number): DropTarget[] {
  return allSpots(blocks)
    .map(spotTarget)
    .filter((t) => !whyNot(blocks, t, block, areaH))
}

/**
 * 이 장 어디에도 넣을 수 없을 때 그 까닭 하나. 넣을 수 있으면 null.
 * 높이만 모자란 자리가 있으면 그 가운데 가장 덜 모자란 것(무엇을 줄이면 되는지 알려 줄 수 있어서), 아니면 너비
 */
export function placeIssue(blocks: Block[], block: Block, areaH?: number): NoRoom | null {
  const crowd = crowdIssue(blocks, [block])
  if (crowd) return crowd
  // 들어가는 자리를 하나 찾으면 나머지는 재지 않는다 (부품 고르기는 카드마다 이것을 재서, 거의 모든 카드가 들어가는 장이 가장 흔하다)
  const all: NoRoom[] = []
  for (const s of allSpots(blocks)) {
    const w = whyNot(blocks, spotTarget(s), block, areaH)
    if (!w) return null
    all.push(w)
  }
  const tall = all.filter((w) => w.kind === 'height').sort((a, b) => a.need - b.need)[0]
  return tall ?? all.find((w) => w.kind === 'narrow') ?? all[0] ?? { kind: 'full' }
}

/**
 * 눌러서 넣은 판: 판이 알아서 고른 자리(board.ts의 autoInsert)에. 이미지가 든 이미지 부품(붙여 넣은 이미지)은
 * 이미지 비율에 가장 잘 맞는 자리(imagePlace). 넣을 수 없으면 null (까닭은 placeIssue)
 */
export function autoPlace(blocks: Block[], block: Block, areaH?: number): Block[] | null {
  if (crowdIssue(blocks, [block])) return null
  if (areaH !== undefined && aspectOf(block)) {
    const t = imagePlace(blocks, block, areaH)
    return t?.kind === 'spot' ? insertAt(blocks, t.spot, block, areaH) : null
  }
  const fit = fitFor([...blocks, block], areaH)
  // 소제목 바로 다음에 넣는 부품은 그 소제목 아래에: 소제목은 아래 부품들의 이름이다. 판이 알아서 고르면(autoInsert) 마지막 줄의
  // 옆이나 판 오른쪽에 들어가, 소제목이 묶을 것 없이 맨 아래에 혼자 남았다(소제목, 목록, 소제목, 할 일 차례로 넣은 장)
  // 마지막에 넣은 부품 (blocks는 넣은 차례다. 읽는 차례로는 나란한 묶음에서 왼쪽 단의 아래 부품이 마지막이 된다)
  const last = blocks.at(-1)
  if (last?.type === 'heading' && block.type !== 'heading') {
    const under = insertBlock(blocks, block, { at: last.id, side: 'below' }, fit)
    if (under) return settled(under, [block], areaH)
  }
  // 소제목 묶음(소제목과 그 아래 부품들) 다음에 넣는 소제목은 그 묶음 옆에 나란히: 두 묶음이 같은 꼴로 서서 견주어 읽힌다.
  // 판이 알아서 고르면 맨 아래 새 줄에 들어가 다음 부품이 그 아래에 들어갈 높이가 없어, 소제목만 아래에 혼자 남았다
  if (block.type === 'heading' && last && last.type !== 'heading') {
    const head = [...blocks].reverse().find((b) => b.type === 'heading')
    const from = head ? blocks.indexOf(head) : -1
    const group = new Set(blocks.slice(from).map((b) => b.id))
    if (head)
      for (const spot of [{ at: head.id, side: 'right', up: 1 }, { at: null, side: 'right' }] as Spot[]) {
        const covers = spotBlocks(blocks, spot)
        if (!covers.length || !covers.every((b) => group.has(b.id))) continue
        const beside = insertBlock(blocks, block, spot, fit)
        if (beside) return settled(beside, [block], areaH)
      }
  }
  // 결론을 말하는 부품(핵심 한 줄, 강조 상자)은 근거 위에: 보고는 결론부터라, 숫자나 목록을 넣은 뒤에 결론을 눌러 넣으면
  // 판이 알아서 고른 맨 아래에 들어가 결론이 근거 밑에 깔려 차례가 뒤집혀 보였다. 이미 결론 부품이 있으면 그 장은 사람이 짠
  // 차례가 있는 것이라 판에 맡긴다. 알아서 고를 때(눌러 넣기, AI가 자리 없이 넣기)만이고, 끌어 놓은 자리는 그대로 둔다
  // 맨 위 새 줄에 들어갈 높이가 없으면 맨 처음 읽는 부품의 왼쪽에(그래도 가장 먼저 읽힌다)
  if (LEADS.has(block.type) && blocks.length && !blocks.some((b) => LEADS.has(b.type))) {
    const first = byReading(blocks)[0]
    for (const spot of [{ at: null, side: 'above' }, { at: first.id, side: 'left' }] as Spot[]) {
      const top = insertBlock(blocks, block, spot, fit)
      if (top) return settled(top, [block], areaH)
    }
  }
  const next = autoInsert(blocks, block, fit)
  return next && settled(next, [block], areaH)
}

/** 결론을 말하는 부품: 알아서 넣으면 근거보다 위에 (autoPlace) */
const LEADS = new Set<BlockType>(['message', 'callout'])

/**
 * 부품을 옮긴 판. 자리(spot)면 빼고 그 자리에 다시 넣고, 맞바꾸기(swap)면 두 부품의 자리를 바꾼다.
 * 차례(발표할 때 나오는 차례를 따로 정하지 않았을 때 읽는 차례가 된다)는 그대로. 옮길 수 없으면 null
 */
export function moveAt(blocks: Block[], blockId: string, target: DropTarget, areaH?: number): Block[] | null {
  const fit = fitFor(blocks, areaH)
  const self = blocks.find((b) => b.id === blockId)
  if (!self) return null
  let next: Block[] | null
  if (target.kind === 'swap') {
    // 이음표는 자리에 남는다: 맞바꾼 두 부품이 서로의 이음표를 갖는다 ('앞 → 뒤'를 맞바꿔도 화살표는 그 사이에)
    const other = blocks.find((b) => b.id === target.with)
    if (!other) return null
    const links = (b: Block) => ({ link: b.link, linkBelow: b.linkBelow })
    const bare = ({ link: _, linkBelow: __, ...b }: Block) => b
    const traded = blocks.map((b) => (b.id === blockId ? { ...bare(b), ...clean(links(other)) } : b.id === other.id ? { ...bare(b), ...clean(links(self)) } : b))
    next = swapBlocks(traded, blockId, other.id, fit)
  } else {
    // 옆 부품과 잇던 이음표는 두고 간다 (새 자리의 옆 부품과는 이어지지 않는다)
    const { link: _, linkBelow: __, ...bare } = self
    const placed = insertBlock(dropBlock(blocks, blockId, fit), bare, target.spot, fit)
    const byId = placed && new Map(placed.map((b) => [b.id, b]))
    next = byId ? blocks.map((b) => byId.get(b.id)).filter((b): b is Block => !!b) : null
  }
  return next && settled(next, [], areaH)
}

/** 값이 없는 키는 빼고 (이음표를 옮길 때) */
const clean = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>

/** 판 둘레에서 이만큼(본문 px) 안쪽까지는 판의 그 쪽 끝 (맨 위·아래 새 줄, 맨 왼쪽·오른쪽 새 칸) */
const BOARD_EDGE = 32
/** 선(칸 사이) 둘레로 이만큼(본문 px)까지는 그 선 위에 넣기: 칸 사이만으로는 손으로 맞히기 어렵다 */
const LINE_EDGE = 20
/** 옮길 때 부품 가운데의 이 몫(가로, 세로 저마다)은 맞바꾸기 */
const SWAP_CORE = 0.5

/**
 * 손 아래에서 바라는 자리들 (먼저 바라는 차례대로).
 * 판 둘레는 판의 그 쪽 끝, 선 둘레는 그 선 위, 부품 안이면 가장 가까운 변 쪽(그 부품 옆, 그다음 그 부품이 든 묶음 옆).
 * 옮기는 중이면(moving) 부품 가운데는 그 부품과 맞바꾸기
 */
function wantedTargets(blocks: Block[], p: { x: number; y: number }, size: { w: number; h: number }, moving?: string): DropTarget[] {
  if (!blocks.length) return [BOTTOM]
  const edge: DropTarget[] = []
  if (p.y < BOARD_EDGE) edge.push(spotTarget({ at: null, side: 'above' }))
  if (p.y > size.h - BOARD_EDGE) edge.push(spotTarget({ at: null, side: 'below' }))
  if (p.x < BOARD_EDGE) edge.push(spotTarget({ at: null, side: 'left' }))
  if (p.x > size.w - BOARD_EDGE) edge.push(spotTarget({ at: null, side: 'right' }))
  // 선 위: 선(칸 사이의 가운데)에서 가장 가까운 것
  const lines = guttersOf(blocks)
    .map((g) => ({ g, d: lineDistance(g, p, size) }))
    .filter((x) => x.d !== null && x.d <= LINE_EDGE)
    .sort((a, b) => a.d! - b.d! || b.g.depth - a.g.depth)
    .map((x) => spotTarget(x.g.spot))
  // 손 아래의 부품 (칸 사이에 있으면 가장 가까운 부품)
  let under: Block | null = null
  let r: Rect | null = null
  let best = Infinity
  for (const b of blocks) {
    const br = atRect(b.at!, size)
    const d = Math.hypot(Math.max(br.x - p.x, 0, p.x - (br.x + br.w)), Math.max(br.y - p.y, 0, p.y - (br.y + br.h)))
    if (d < best) {
      best = d
      under = b
      r = br
    }
  }
  const inside: DropTarget[] = []
  if (under && r) {
    const u = (p.x - r.x) / r.w
    const v = (p.y - r.y) / r.h
    const core = (1 - SWAP_CORE) / 2
    if (moving && under.id !== moving && u > core && u < 1 - core && v > core && v < 1 - core) inside.push({ kind: 'swap', with: under.id })
    // 변까지의 거리 (px). 가까운 변 차례로: 그 부품 옆, 그 부품이 든 묶음 옆
    const sides = (
      [
        ['left', p.x - r.x],
        ['right', r.x + r.w - p.x],
        ['above', p.y - r.y],
        ['below', r.y + r.h - p.y],
      ] as const
    )
      .slice()
      .sort((a, b) => a[1] - b[1])
    for (const [side] of sides.slice(0, 2)) for (let up = 0; up < 4; up++) inside.push(spotTarget({ at: under.id, side, ...(up ? { up } : {}) }))
  }
  return [...edge, ...lines, ...inside]
}

/** 손에서 선까지의 거리 (선이 그어진 범위 밖이면 null) */
function lineDistance(g: Gutter, p: { x: number; y: number }, size: { w: number; h: number }): number | null {
  const cp = (size.w + BLOCK_COL_GAP) / BOARD_COLS
  const rp = (size.h + BLOCK_GAP) / BOARD_ROWS
  if (g.dir === 'h') {
    const x = g.at * cp - BLOCK_COL_GAP / 2
    return p.y >= g.from * rp && p.y <= g.to * rp - BLOCK_GAP ? Math.abs(p.x - x) : null
  }
  const y = g.at * rp - BLOCK_GAP / 2
  return p.x >= g.from * cp && p.x <= g.to * cp - BLOCK_COL_GAP ? Math.abs(p.y - y) : null
}

/** 이 자리에 놓으면 그 부품이 들어갈 자리 (장 본문 px) */
export function slotRect(base: Block[], target: DropTarget, block: Block, size: { w: number; h: number }, moving?: Block[]): Rect | null {
  const next = target.kind === 'swap' ? (moving ? moveAt(moving, block.id, target, size.h) : null) : insertAt(base, target.spot, block, size.h)
  const at = next?.find((b) => b.id === block.id)?.at
  return at ? atRect(at, size) : null
}

/**
 * 끌고 있는 곳에서 놓을 자리. 새 부품이면 지금 판(base)에, 옮기는 부품이면(moving: 옮기기 전의 판) 그 부품을 뺀 판(base)에 넣는다.
 * 손 아래에서 바라는 자리가 안 되면 다음으로 바라는 자리, 그래도 안 되면 넣을 수 있는 자리 가운데 놓일 자리가 가장 가까운 곳.
 * 그래서 대충 놓아도 늘 정해진 자리에 들어간다. 지금 보이는 자리(current) 안에서 손을 움직이면 바꾸지 않는다
 */
export function dropTarget(
  base: Block[],
  block: Block,
  p: { x: number; y: number },
  size: { w: number; h: number },
  current?: DropTarget | null,
  moving?: Block[],
): DropTarget | null {
  const fits = (t: DropTarget) => (t.kind === 'swap' ? !!moving && !!moveAt(moving, block.id, t, size.h) : !!insertAt(base, t.spot, block, size.h))
  if (current && fits(current)) {
    const r = slotRect(base, current, block, size, moving)
    if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return current
  }
  // 손 아래는 옮기는 부품을 뺀 판(base)으로 본다: 끄는 동안 보이는 판은 놓일 자리마다 바뀌어서, 그것을 재면 자리가 떨린다
  const wanted = wantedTargets(base, p, size, moving ? block.id : undefined)
  for (const t of wanted) if (fits(t)) return t
  // 그 둘레에 자리가 없으면 넣을 수 있는 자리 가운데 놓일 자리가 가장 가까운 곳
  let found: DropTarget | null = null
  let bestD = Infinity
  for (const t of validTargets(base, block, size.h)) {
    const r = slotRect(base, t, block, size)
    if (!r) continue
    const d = Math.hypot(p.x - (r.x + r.w / 2), p.y - (r.y + r.h / 2))
    if (d < bestD) {
      found = t
      bestD = d
    }
  }
  return found
}

/** 손 아래의 자리 (넣을 수 있는지와 상관없이). 끄는 동안 '여기는 왜 안 되는지'를 알려 줄 때 */
export function pointerTarget(base: Block[], p: { x: number; y: number }, size: { w: number; h: number }): DropTarget {
  return wantedTargets(base, p, size).find((t) => t.kind === 'spot') ?? BOTTOM
}

/** 판의 선을 더 끌 수 없는 까닭: 줄어드는 쪽에서 가장 먼저 잘리는 부품(type). minSpan은 그 부품의 가장 좁은 너비(옆으로 끌 때), 위아래로 끌 때는 null */
export type SpanLimit = { kind: 'block'; type: BlockType; minSpan: number | null }

/** 판의 선을 to(칸 수)까지 끌었는데 끝까지 가지 못하면 그 까닭. 갈 수 있으면 null */
export function gutterLimit(blocks: Block[], g: Gutter, to: number, areaH: number): SpanLimit | null {
  const fit = boardFit(areaH, blocks)
  const range = gutterRange(blocks, g, fit)
  if (!range || (to >= range.lo && to <= range.hi)) return null
  // 줄어드는 쪽: 선 앞(왼쪽, 위)으로 끌면 앞쪽 부품들, 뒤로 끌면 뒤쪽 부품들
  const front = to < range.lo
  const side = blocks.filter((b) => {
    const a = b.at!
    const lo = g.dir === 'h' ? a.x : a.y
    const hi = lo + (g.dir === 'h' ? a.w : a.h)
    const cross = g.dir === 'h' ? [a.y, a.y + a.h] : [a.x, a.x + a.w]
    return cross[0] >= g.from && cross[1] <= g.to && (front ? hi <= g.at : lo >= g.at)
  })
  // 가장 먼저 잘리는 것: 옆으로 끌면 가장 좁은 너비가 가장 넓은 부품, 위아래면 지금 너비에서 가장 높아야 하는 부품
  const worst = [...side].sort((a, b) => (g.dir === 'h' ? fit.minW(b) - fit.minW(a) : fit.minH(b, b.at!.w) - fit.minH(a, a.at!.w)))[0]
  return worst ? { kind: 'block', type: worst.type, minSpan: g.dir === 'h' ? fit.minW(worst) : null } : null
}

/** 판의 선을 to(칸 수)로 옮긴 판. 이미지가 있으면 사람이 정한 크기를 그대로 둔다. 한 칸도 못 옮기면 null */
export function dragGutter(blocks: Block[], g: Gutter, to: number, areaH: number): Block[] | null {
  return moveGutter(blocks, g, to, boardFit(areaH, blocks))
}

/**
 * 부품의 너비(dir 'w')나 높이('h')를 size 칸으로 바꾼 판: 그 부품의 오른쪽(아래) 선, 판 끝이면 왼쪽(위) 선을 옮긴다.
 * 부품에 가장 가까운 선(그 부품과 바로 옆 묶음 사이)을 옮겨서 멀리 있는 부품은 그대로다.
 * 그 크기가 되지 않으면(이웃이 잘리거나 이 부품이 잘리면) null. AI 제안(set_size)이 쓴다
 */
export function resizeBlock(blocks: Block[], blockId: string, dir: 'w' | 'h', size: number, areaH?: number): Block[] | null {
  const self = blocks.find((b) => b.id === blockId)?.at
  if (!self) return null
  const fit = fitFor(blocks, areaH)
  const h = dir === 'w'
  const [lo, len, cross0, crossLen] = h ? [self.x, self.w, self.y, self.h] : [self.y, self.h, self.x, self.w]
  if (size === len) return blocks
  // 이 부품을 끼고 있는 선 가운데 범위가 가장 좁은 것 (가장 가까운 묶음 사이)
  const near = (at: number) =>
    guttersOf(blocks)
      .filter((g) => g.dir === (h ? 'h' : 'v') && g.at === at && g.from <= cross0 && g.to >= cross0 + crossLen)
      .sort((a, b) => a.to - a.from - (b.to - b.from))[0]
  const after = near(lo + len)
  const before = near(lo)
  const tries = [after && { g: after, to: lo + size }, before && { g: before, to: lo + len - size }].filter((t): t is { g: Gutter; to: number } => !!t)
  for (const { g, to } of tries) {
    const next = moveGutter(blocks, g, to, fit)
    const at = next?.find((b) => b.id === blockId)?.at
    if (next && at && (h ? at.w : at.h) === size) return settled(next, [], areaH)
  }
  return null
}

/** 읽는 차례대로 한 칸 앞이나 뒤의 부품과 자리를 바꾼다 (끌기 어려울 때). 바꿀 수 없으면(서로의 자리에 들어가지 않으면) 그대로 */
export function shiftBlock(blocks: Block[], blockId: string, dir: -1 | 1, areaH?: number): Block[] {
  const order = byReading(blocks)
  const i = order.findIndex((b) => b.id === blockId)
  const other = order[i + dir]
  if (i < 0 || !other) return blocks
  return moveAt(blocks, blockId, { kind: 'swap', with: other.id }, areaH) ?? blocks
}

/**
 * 이미지가 든 이미지 부품을 넣을 자리: 넣을 수 있는 자리마다 선을 이미지에 맞춰 본 뒤 이미지 비율에 가장 잘 맞는 곳.
 * 세로 사진은 옆 칸으로, 넓은 화면 캡처는 넓은 줄로 간다. 위치를 받으면(끌어다 놓은 자리) 비슷하게 맞는 자리 가운데 가까운 곳.
 * 아래 새 줄에 놓아 세로 사진이 장 너비의 낮은 띠가 되면 가운데만 남거나 양옆이 크게 비었다
 */
export function imagePlace(blocks: Block[], block: Block, areaH: number, near?: { x: number; y: number }): DropTarget | null {
  const aspect = aspectOf(block)
  if (!aspect) return null
  let best: DropTarget | null = null
  let bestScore = Infinity
  const valid = validTargets(blocks, block, areaH)
  for (const [k, t] of valid.entries()) {
    if (t.kind !== 'spot') continue
    const placed = insertAt(blocks, t.spot, block, areaH)
    if (!placed) continue
    // 판의 다른 이미지도 함께 본다: 새 이미지가 잘 맞아도 옆의 화면 캡처가 좁은 칸에 눌리면 좋은 자리가 아니다
    const off = placed.reduce((a, b) => {
      const ar = b.id === block.id ? aspect : aspectOf(b)
      return ar ? a + misfit(placed, b.id, ar, areaH) : a
    }, 0)
    if (!Number.isFinite(off)) continue
    // 비율이 거의 같으면(로그 차 0.1은 10%쯤) 놓은 자리에 가까운 곳. 거리는 장 너비에 견준 몫
    const at = placed.find((b) => b.id === block.id)?.at
    const r = near && at ? atRect(at, { w: AREA_W, h: areaH }) : null
    const far = r && near ? Math.hypot(r.x + r.w / 2 - near.x, r.y + r.h / 2 - near.y) / AREA_W : 0
    // 놓은 자리가 없으면(붙여 넣기) 비슷하게 맞는 자리끼리는 읽는 차례에서 뒤쪽: 앞에 끼우면 이미 쓴 내용의 차례가 밀린다
    const score = off + far * 0.25 + (near ? 0 : (valid.length - 1 - k) * 0.01)
    if (score < bestScore) {
      best = t
      bestScore = score
    }
  }
  return best
}
