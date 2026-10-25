// 자리 규칙(줄 셋, 한 줄에 칸 셋, 큰 부품 여섯, 한 칸에 셋까지 쌓기)과 칸 너비 비율, 면(옅은 면, 짙은 면)의 규칙

import type { Block, BlockLook, BlockRow, BlockType } from '../types'
import { BLOCK_LOOK_IDS, BLOCKS } from './catalog'
import { allBlocks, mapMembers, membersOf } from './cells'
import type { NoRoom } from './place'

export const MAX_ROWS = 3
export const MAX_IN_ROW = 3
/** 작은 부품만 든 칸은 한 줄에 넷까지 (3칸씩) */
export const MAX_SMALL_IN_ROW = 4
/** 한 장의 모든 부품 (쌓은 것과 작은 것까지) */
export const MAX_BLOCKS = 10
/** 한 장의 큰 부품 (작은 부품이 아닌 것). 이보다 많으면 장이 빽빽해져 어디를 봐야 할지 흐려진다 */
export const MAX_LARGE = 6
/** 한 칸에 쌓는 부품 수 */
export const MAX_STACK = 3
/** 줄 사이 간격 (1920 기준 px). CSS의 --bk-gap과 같다. 한 칸 안에 쌓은 부품 사이도 같은 간격이라 쌓은 칸이 옆 줄과 맞는다.
 *  제목 아래 간격(--body-gap, 72)보다 좁아야 제목과 본문, 본문 안의 줄이 다른 사이로 읽힌다 */
export const BLOCK_GAP = 48
/** 옆 칸 사이 간격 (1920 기준 px). CSS의 --bk-col-gap과 같다. 줄 사이와 같은 48이면 나란한 두 부품이 붙어 보였다:
 *  오른쪽 끝에 붙은 숫자 바로 옆에서 다음 칸의 글이 시작했다. 장의 큰 사이(--body-gap)와 같은 값이다 */
export const BLOCK_COL_GAP = 72

export const isSmall = (type: BlockType) => !!BLOCKS[type].small

/** 한 장의 큰 부품 수 */
export const largeCount = (rows: BlockRow[]) => allBlocks(rows).filter((b) => !isSmall(b.type)).length

/**
 * 짧게 끝나는 부품: 큰 숫자, 전과 후, 강조 상자처럼 서로 쌓아도 칸마다 한 가지 말이 되는 것.
 * 작은 부품과 이것은 한 칸에 몇이든(셋까지) 쌓는다. 목록, 차트, 표 같은 큰 부품은 한 칸에 하나만
 */
const COMPACT: BlockType[] = ['number', 'delta', 'goal', 'ring', 'ratio', 'spark', 'callout', 'text', 'message', 'quote']

/**
 * 한 칸에 쌓을 때의 몫: small(작은 부품), compact(짧게 끝나는 부품), large(칸에 하나), none(쌓지 않는다).
 * 이미지는 쌓지 않는다: 칸 너비를 이미지 비율에 맞추는데(images.ts), 쌓으면 칸 높이를 나눠 써서 비율이 맞지 않는다
 */
export function stackRole(type: BlockType): 'small' | 'compact' | 'large' | 'none' {
  if (type === 'image') return 'none'
  if (isSmall(type)) return 'small'
  return COMPACT.includes(type) ? 'compact' : 'large'
}

/** 이 부품들을 (위에서부터) 한 칸에 쌓을 수 없는 까닭. 쌓을 수 있으면(하나뿐이어도) null */
export function stackIssue(members: Pick<Block, 'type'>[]): 'full' | 'large' | 'none' | null {
  if (members.length <= 1) return null
  if (members.length > MAX_STACK) return 'full'
  const roles = members.map((b) => stackRole(b.type))
  if (roles.includes('none')) return 'none'
  return roles.filter((r) => r === 'large').length > 1 ? 'large' : null
}

/** 칸들(맨 위 부품들)을 한 줄에 나란히 둘 수 있는 수: 칸마다 작은 부품만 들었으면 넷, 아니면 셋 */
export const maxInRow = (cells: Block[]) => (cells.length && cells.every((c) => membersOf(c).every((b) => isSmall(b.type))) ? MAX_SMALL_IN_ROW : MAX_IN_ROW)

/** 한 줄의 부품 수마다 고를 수 있는 칸 너비 */
export const COMBOS: Record<number, number[][]> = {
  1: [[12]],
  2: [
    [6, 6],
    [8, 4],
    [4, 8],
  ],
  3: [
    [4, 4, 4],
    [6, 3, 3],
    [3, 6, 3],
    [3, 3, 6],
  ],
  // 작은 부품만 든 칸 넷 (maxInRow)
  4: [[3, 3, 3, 3]],
}

// 가져온 파일에는 아무 값이나 있을 수 있어서 정해진 값이 아니면 기본값으로 읽는다
export const lookOf = (b: Pick<Block, 'type' | 'look'>): BlockLook => (b.look && BLOCK_LOOK_IDS.includes(b.look) ? b.look : (BLOCKS[b.type].look ?? 'plain'))

/** 한 줄을 혼자 쓰는 부품 (minSpan 12) */
export const isSolo = (type: BlockType) => BLOCKS[type].minSpan >= 12

/**
 * 안에 이미 칸이나 면이 있는 부품. 면을 깔면 상자 안에 상자가 된다.
 * 소제목도 면 없이만: 묶음의 이름인데 면을 깔면 그 자체가 칸 하나로 읽혀 묶는 힘이 사라진다.
 * 주석도: 본문보다 물러나 있어야 하는 글이라, 면을 깔면 위의 표나 그림보다 먼저 눈에 띈다
 */
const FLAT: BlockType[] = ['logos', 'compare', 'pricing', 'matrix', 'agenda', 'image', 'flow', 'network', 'heading', 'note']
/** 진한 면을 깔 수 있는 부품: 한 장의 결론이 되는 숫자와 말. 목록이나 그림을 검게 칠하면 장이 무겁고 어디가 결론인지 흐려진다 */
const BOLD_OK: BlockType[] = ['callout', 'number', 'delta', 'goal', 'ring', 'ratio', 'spark', 'quote', 'text', 'message']

/** 이 부품에 고를 수 있는 면. 한 줄을 혼자 쓰는 부품(표, 일정 같은)과 안에 칸이 있는 부품은 면 없이만 */
export function looksFor(type: BlockType): BlockLook[] {
  if (isSolo(type) || FLAT.includes(type)) return ['plain']
  return BOLD_OK.includes(type) ? ['plain', 'card', 'bold'] : ['plain', 'card']
}

/**
 * 면을 깔면 상자만 커 보이는 자리: 혼자 한 줄을 다 쓰는 부품. 넓은 면 안에 글이 한쪽에만 있어 비어 보이고, 면이 없어도 줄이 이미 한 덩어리로 읽힌다.
 * 면은 같은 줄에 나란한 부품들이 같은 꼴의 칸(타일)으로 읽힐 때 쓴다. 강조 상자는 띠처럼 길게 써도 된다
 */
const looksEmptyAlone = (b: Pick<Block, 'type'>, inRow: number) => inRow === 1 && b.type !== 'callout'

/** 그려지는 면. 혼자 한 줄을 다 쓰는 부품과 그 면을 쓸 수 없는 부품(예전 파일)은 고른 면이 있어도 바탕 없이 (옆에 부품을 놓으면 다시 보인다) */
export const shownLook = (b: Pick<Block, 'type' | 'look'>, inRow: number): BlockLook =>
  looksEmptyAlone(b, inRow) || !looksFor(b.type).includes(lookOf(b)) ? 'plain' : lookOf(b)

/**
 * 이 부품의 면을 이것으로 바꿀 수 없는 까닭. 한 장에는 면 한 가지만 쓴다: 옅은 면끼리, 또는 진한 면 하나와 바탕 없는 부품들.
 * 진한 면과 옅은 면이 섞이면 상자 두 종류가 눈길을 나눠 갖고, 진한 면이 둘이면 어느 쪽이 결론인지 흐려진다
 */
export function lookIssue(rows: BlockRow[], blockId: string, look: BlockLook): NoRoom | null {
  if (look === 'plain') return null
  const self = allBlocks(rows).find((b) => b.id === blockId)
  if (self && !looksFor(self.type).includes(look)) return { kind: 'look', why: look === 'bold' && looksFor(self.type).includes('card') ? 'no-bold' : 'flat' }
  const others = allBlocks(rows)
    .filter((b) => b.id !== blockId)
    .map(lookOf)
  if (look === 'bold' && others.includes('bold')) return { kind: 'look', why: 'one-bold' }
  if (others.includes(look === 'bold' ? 'card' : 'bold')) return { kind: 'look', why: 'mix' }
  const row = rows.find((r) => r.blocks.some((c) => membersOf(c).some((b) => b.id === blockId)))
  const block = row && allBlocks([row]).find((b) => b.id === blockId)
  if (row && block && looksEmptyAlone(block, row.blocks.length)) return { kind: 'look', why: 'alone' }
  return null
}

/**
 * 부품의 면을 바꾼 줄들. 옅은 면과 바탕 없음은 같은 줄의 부품이 함께 바뀐다: 한 줄에 면이 있는 칸과 없는 칸이
 * 섞이면 칸 높이와 여백이 달라 보여 한쪽이 덜 된 것처럼 보인다. 진한 면은 그 부품 하나만(한 장의 결론 하나)
 */
export function withLook(rows: BlockRow[], blockId: string, look: BlockLook): BlockRow[] {
  const row = rows.find((r) => r.blocks.some((c) => membersOf(c).some((b) => b.id === blockId)))
  // 같은 줄이면 쌓은 부품도 함께: 한 칸 안에서 면이 있는 것과 없는 것이 섞이면 칸 너비가 다른 둘로 보인다
  const together = (b: Block) => b.id === blockId || (look !== 'bold' && lookOf(b) !== 'bold' && looksFor(b.type).includes(look))
  return rows.map((r) => (r === row ? { ...r, blocks: r.blocks.map((c) => mapMembers(c, (b) => (together(b) ? { ...b, look } : b))) } : r))
}

/** 넣은 부품의 면이 장의 다른 면과 어긋나면(진한 면이 둘, 진한 면과 옅은 면) 바탕 없이. 강조 상자는 처음에 진한 면이라 흔하다 */
export function settleLook(rows: BlockRow[], block: Block): BlockRow[] {
  const why = lookIssue(rows, block.id, lookOf(block))
  // 혼자 한 줄을 쓰는 자리는 고른 면을 그대로 둔다: 그릴 때만 바탕 없이, 옆에 부품이 오면 다시 보인다
  if (!why || why.kind !== 'look' || why.why === 'alone') return rows
  // id로 찾는다: 쌓을 때는 칸을 새로 짜면서(asCell) 부품이 새 객체가 된다
  return rows.map((r) => (allBlocks([r]).some((b) => b.id === block.id) ? { ...r, blocks: r.blocks.map((c) => mapMembers(c, (b) => (b.id === block.id ? { ...b, look: 'plain' as const } : b))) } : r))
}
