// 자리 규칙(줄 셋, 한 줄에 칸 셋, 부품 여섯)과 칸 너비 비율, 면(옅은 면, 짙은 면)의 규칙

import type { Block, BlockLook, BlockRow, BlockType } from '../types'
import { BLOCK_LOOK_IDS, BLOCKS } from './catalog'
import { allBlocks } from './cells'
import type { NoRoom } from './place'

export const MAX_ROWS = 3
export const MAX_IN_ROW = 3
export const MAX_BLOCKS = 6
/** 칸 사이 간격 (1920 기준 px). CSS의 --bk-gap과 같다 */
export const BLOCK_GAP = 48

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
}

// 가져온 파일에는 아무 값이나 있을 수 있어서 정해진 값이 아니면 기본값으로 읽는다
export const lookOf = (b: Pick<Block, 'type' | 'look'>): BlockLook => (b.look && BLOCK_LOOK_IDS.includes(b.look) ? b.look : (BLOCKS[b.type].look ?? 'plain'))

/** 한 줄을 혼자 쓰는 부품 (minSpan 12) */
export const isSolo = (type: BlockType) => BLOCKS[type].minSpan >= 12

/** 안에 이미 칸이나 면이 있는 부품. 면을 깔면 상자 안에 상자가 된다 */
const FLAT: BlockType[] = ['logos', 'compare', 'pricing', 'matrix', 'agenda', 'image']
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
  const row = rows.find((r) => r.blocks.some((b) => b.id === blockId))
  const block = row?.blocks.find((b) => b.id === blockId)
  if (row && block && looksEmptyAlone(block, row.blocks.length)) return { kind: 'look', why: 'alone' }
  return null
}

/**
 * 부품의 면을 바꾼 줄들. 옅은 면과 바탕 없음은 같은 줄의 부품이 함께 바뀐다: 한 줄에 면이 있는 칸과 없는 칸이
 * 섞이면 칸 높이와 여백이 달라 보여 한쪽이 덜 된 것처럼 보인다. 진한 면은 그 부품 하나만(한 장의 결론 하나)
 */
export function withLook(rows: BlockRow[], blockId: string, look: BlockLook): BlockRow[] {
  const row = rows.find((r) => r.blocks.some((b) => b.id === blockId))
  const together = (b: Block) =>
    b.id === blockId || (look !== 'bold' && lookOf(b) !== 'bold' && looksFor(b.type).includes(look) && !!row?.blocks.includes(b))
  return rows.map((r) => (r === row ? { ...r, blocks: r.blocks.map((b) => (together(b) ? { ...b, look } : b)) } : r))
}

/** 넣은 부품의 면이 장의 다른 면과 어긋나면(진한 면이 둘, 진한 면과 옅은 면) 바탕 없이. 강조 상자는 처음에 진한 면이라 흔하다 */
export function settleLook(rows: BlockRow[], block: Block): BlockRow[] {
  const why = lookIssue(rows, block.id, lookOf(block))
  // 혼자 한 줄을 쓰는 자리는 고른 면을 그대로 둔다: 그릴 때만 바탕 없이, 옆에 부품이 오면 다시 보인다
  if (!why || why.kind !== 'look' || why.why === 'alone') return rows
  return rows.map((r) => (r.blocks.some((b) => b === block) ? { ...r, blocks: r.blocks.map((b) => (b === block ? { ...b, look: 'plain' as const } : b)) } : r))
}
