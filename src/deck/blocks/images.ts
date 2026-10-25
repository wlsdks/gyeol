// 이미지 부품: 이미지 비율에 맞는 칸 너비와 자리

import { imageSize, isPhoto } from '../../lib/image'
import { FRAME } from '../frame'
import type { Block, BlockRow } from '../types'
import { allBlocks, makeBlock } from './cells'
import { type DropTarget, insertAt, validTargets } from './place'
import { shownLook } from './rules'
import { cellRects, changeRows, fitsHeight, spanChoices } from './sizing'

/** 부품 장 본문 상자의 너비 (장 너비에서 좌우 틀을 뺀 것) */
export const AREA_W = 1920 - 2 * FRAME.x

/** 이미지 부품에 든 이미지의 가로 ÷ 세로. 이미지가 없거나 모르는 형식이면 null */
export function aspectOf(b: Block): number | null {
  if (b.type !== 'image') return null
  const size = imageSize(b.fields.image ?? '')
  return size ? size.w / size.h : null
}

/**
 * 이 줄들에서 이미지 부품의 이미지가 그려지는 상자(캔버스 px): 칸에서 면의 안쪽 여백(blocks.css의 44px 52px)과
 * 설명 한 줄을 뺀다. 장에 들어가지 않는 줄이면 null
 */
function imageBox(rows: BlockRow[], blockId: string, areaH: number): { w: number; h: number } | null {
  if (!fitsHeight(rows, areaH)) return null
  const row = rows.find((r) => r.blocks.some((b) => b.id === blockId))
  const block = row?.blocks.find((b) => b.id === blockId)
  const box = cellRects(rows, { w: AREA_W, h: areaH }).get(blockId)
  if (!row || !block || !box) return null
  const card = shownLook(block, row.blocks.length) !== 'plain'
  const w = box.w - (card ? 104 : 0)
  const h = box.h - (card ? 88 : 0) - (block.fields.caption?.trim() ? 56 : 0)
  return w > 0 && h > 0 ? { w, h } : null
}

/** 이미지 비율과 그려지는 상자 비율이 얼마나 다른지 (0이면 꼭 맞는다). 상자가 없으면 Infinity */
function misfit(rows: BlockRow[], blockId: string, aspect: number, areaH: number): number {
  const box = imageBox(rows, blockId, areaH)
  return box ? Math.abs(Math.log(box.w / box.h / aspect)) : Infinity
}

/**
 * 이미지를 넣은 뒤의 줄: 이미지 칸의 가로세로 비율이 이미지의 비율에 가장 가깝도록 그 줄의 칸 너비를 고른다
 * (장에 들어가고 이웃이 잘리지 않는 너비 가운데). 화면 캡처(16:10)를 반 칸에 넣으면 위아래가 잘리거나 비고,
 * 세로 사진을 넓은 칸에 넣으면 양옆이 비었다. 이미지 칸이 지금 너비와 거의 같게 맞으면 그대로 둔다.
 * 줄에 이미지 하나뿐이면 고를 너비가 없어 그대로. aspect는 가로 ÷ 세로
 */
export function fitImage(rows: BlockRow[], blockId: string, aspect: number, areaH: number): BlockRow[] {
  const r = rows.findIndex((row) => row.blocks.some((b) => b.id === blockId))
  if (r < 0 || !(aspect > 0) || rows[r].blocks.length < 2) return rows
  const row = rows[r]
  // 한 줄에 이미지가 여럿이면(사진과 화면 캡처) 모두 함께 맞춘다: 새 이미지에만 맞추면 옆의 이미지가 좁은 칸에 눌렸다
  const images = row.blocks.map((b) => [b.id, b.id === blockId ? aspect : aspectOf(b)] as const).filter((x): x is readonly [string, number] => !!x[1])
  const off = (next: BlockRow[]) => images.reduce((a, [id, ar]) => a + misfit(next, id, ar, areaH), 0)
  const withSpans = (spans: number[]) => rows.map((x, i) => (i === r ? { ...x, spans } : x))
  let best: number[] | null = null
  let bestOff = Infinity
  for (const c of spanChoices(row)) {
    const o = off(withSpans(c))
    if (o < bestOff) {
      best = c
      bestOff = o
    }
  }
  // 조금 나은 정도(비율 차이 5% 안쪽)로는 사람이 정한 너비를 바꾸지 않는다
  if (!best || bestOff > off(rows) - 0.05) return rows
  return withSpans(best)
}

/** 사진을 꽉 채우기로 둘 만큼 칸과 비율이 비슷한지: 잘려 나가는 몫이 3분의 1을 넘지 않을 때 (가로세로 1.5배 안쪽) */
const COVER_MISFIT = Math.log(1.5)

/**
 * 넣은 이미지의 보이는 법: 사진(JPEG)은 칸과 비율이 비슷하면 꽉 채우기, 화면 캡처·도면·로고(PNG, SVG 같은)와
 * 칸과 비율이 크게 다른 사진은 잘리지 않게 전체 보이기. 화면 캡처를 꽉 채우기로 넣으면 위아래 메뉴와 표가 잘려
 * 무엇을 보여 주려는지 알 수 없었고, 세로 사진을 넓고 낮은 칸에 꽉 채우면 가운데 띠만 남았다
 */
function settleImage(rows: BlockRow[], blockId: string, areaH: number): BlockRow[] {
  const block = allBlocks(rows).find((b) => b.id === blockId)
  const aspect = block && aspectOf(block)
  if (!block || !aspect) return rows
  const variant = isPhoto(block.fields.image ?? '') && misfit(rows, blockId, aspect, areaH) <= COVER_MISFIT ? 'cover' : 'contain'
  return block.variant === variant ? rows : changeRows(rows, blockId, (b) => ({ ...b, variant }))
}

/**
 * 이미지 부품에 이미지를 넣은 줄들: 그 줄의 칸 너비를 이미지 비율에 맞추고(fitImage), 보이는 법을 고른다(settleImage).
 * 사람이 고른 보이는 법은 이미지를 바꿀 때마다 다시 고른다. 바꾼 뒤에 다시 고르면 그대로 남는다
 */
export function withImage(rows: BlockRow[], blockId: string, url: string, areaH: number): BlockRow[] {
  const next = changeRows(rows, blockId, (b) => ({ ...b, fields: { ...b.fields, image: url } }))
  const block = allBlocks(next).find((b) => b.id === blockId)
  const aspect = block && aspectOf(block)
  return settleImage(aspect ? fitImage(next, blockId, aspect, areaH) : next, blockId, areaH)
}

/** 이미지가 든 새 이미지 부품 (붙여 넣거나 끌어다 놓은 이미지). 보이는 법은 놓은 자리에서 고른다(fitPlaced) */
export function imageBlock(url: string): Block {
  return { ...makeBlock('image'), fields: { image: url }, variant: isPhoto(url) ? 'cover' : 'contain' }
}

/**
 * 부품을 넣은 뒤: 그 줄에 이미지가 든 이미지 부품이 있으면 그 줄의 칸 너비를 이미지에 맞춘다. 이미지를 붙여 넣었을 때도,
 * 이미지 옆에 설명을 넣었을 때도 같다(똑같이 나누면 넓은 화면 캡처가 반 칸에 눌려 위아래가 빈다). 다른 줄은 건드리지 않는다.
 * 넣은 것이 이미지 자신이면 보이는 법도 고른다. 이웃을 넣을 때는 사람이 고른 보이는 법을 그대로 둔다
 */
export function fitPlaced(rows: BlockRow[], block: Block, areaH?: number): BlockRow[] {
  if (areaH === undefined) return rows
  const row = rows.find((r) => r.blocks.some((b) => b.id === block.id))
  const img = row?.blocks.find((b) => aspectOf(b))
  if (!img) return rows
  const fitted = fitImage(rows, img.id, aspectOf(img)!, areaH)
  return img.id === block.id ? settleImage(fitted, img.id, areaH) : fitted
}

/**
 * 이미지가 든 이미지 부품을 넣을 자리: 넣을 수 있는 자리마다 칸 너비를 이미지에 맞춰 본 뒤 이미지 비율에 가장 잘 맞는 곳.
 * 세로 사진은 옆 칸으로, 넓은 화면 캡처는 넓은 줄로 간다. 위치를 받으면(끌어다 놓은 자리) 비슷하게 맞는 자리 가운데 가까운 곳.
 * 아래 새 줄에 놓아 세로 사진이 장 너비의 낮은 띠가 되면 가운데만 남거나 양옆이 크게 비었다
 */
export function imageTarget(rows: BlockRow[], block: Block, areaH: number, near?: { x: number; y: number }): DropTarget | null {
  const aspect = aspectOf(block)
  if (!aspect) return null
  let best: DropTarget | null = null
  let bestScore = Infinity
  const valid = validTargets(rows, block, areaH)
  for (const [k, t] of valid.entries()) {
    const placed = insertAt(rows, t, block, 'x', areaH)
    if (!placed) continue
    const fitted = fitImage(placed, block.id, aspect, areaH)
    // 장의 다른 이미지도 함께 본다: 새 이미지가 잘 맞아도 옆의 화면 캡처가 좁은 칸에 눌리거나 새 줄 때문에 낮아지면 좋은 자리가 아니다
    const off = allBlocks(fitted).reduce((a, b) => {
      const ar = b.id === block.id ? aspect : aspectOf(b)
      return ar ? a + misfit(fitted, b.id, ar, areaH) : a
    }, 0)
    if (!Number.isFinite(off)) continue
    // 비율이 거의 같으면(로그 차 0.1은 10%쯤) 놓은 자리에 가까운 곳. 거리는 장 너비에 견준 몫
    const at = near && cellRects(fitted, { w: AREA_W, h: areaH }).get(block.id)
    const far = at ? Math.hypot(at.x + at.w / 2 - near.x, at.y + at.h / 2 - near.y) / AREA_W : 0
    // 놓은 자리가 없으면(붙여 넣기) 비슷하게 맞는 자리끼리는 읽는 차례에서 뒤쪽: 앞에 끼우면 이미 쓴 내용의 차례가 밀린다
    const score = off + far * 0.25 + (near ? 0 : (valid.length - 1 - k) * 0.01)
    if (score < bestScore) {
      best = t
      bestScore = score
    }
  }
  return best
}
