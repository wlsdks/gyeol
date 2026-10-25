// 이미지 부품: 이미지 비율에 맞는 자리 크기와 보이는 법 (놓을 자리는 place.ts의 imagePlace)

import { imageSize, isPhoto } from '../../lib/image'
import type { Block } from '../types'
import { guttersOf, moveGutter, gutterRange } from './board'
import { makeBlock, mapBlock } from './cells'
import { isAlone, shownLook } from './rules'
import { AREA_W, atRect, boardFit } from './sizing'

/** 이미지 부품에 든 이미지의 가로 ÷ 세로. 이미지가 없거나 모르는 형식이면 null */
export function aspectOf(b: Block): number | null {
  if (b.type !== 'image') return null
  const size = imageSize(b.fields.image ?? '')
  return size ? size.w / size.h : null
}

/** 이 판에서 이미지 부품의 이미지가 그려지는 상자(캔버스 px): 칸에서 면의 안쪽 여백(blocks.css의 44px 52px)과 설명 한 줄을 뺀다 */
function imageBox(blocks: readonly Block[], blockId: string, areaH: number): { w: number; h: number } | null {
  const block = blocks.find((b) => b.id === blockId)
  if (!block?.at) return null
  const box = atRect(block.at, { w: AREA_W, h: areaH })
  const card = shownLook(block, isAlone(block)) !== 'plain'
  const w = box.w - (card ? 104 : 0)
  const h = box.h - (card ? 88 : 0) - (block.fields.caption?.trim() ? 56 : 0)
  return w > 0 && h > 0 ? { w, h } : null
}

/** 이미지 비율과 그려지는 상자 비율이 얼마나 다른지 (0이면 꼭 맞는다). 상자가 없으면 Infinity */
export function misfit(blocks: readonly Block[], blockId: string, aspect: number, areaH: number): number {
  const box = imageBox(blocks, blockId, areaH)
  return box ? Math.abs(Math.log(box.w / box.h / aspect)) : Infinity
}

/** 판의 모든 이미지가 얼마나 어긋나는지의 합 (aspect를 주면 그 부품은 그 비율로) */
function offAll(blocks: readonly Block[], areaH: number, id?: string, aspect?: number): number {
  return blocks.reduce((a, b) => {
    const ar = b.id === id ? aspect : aspectOf(b)
    return ar ? a + misfit(blocks, b.id, ar, areaH) : a
  }, 0)
}

/**
 * 이미지를 넣은 뒤의 판: 이미지 부품에 닿은 선을 옮겨 이미지 칸의 가로세로 비율이 이미지의 비율에 가장 가깝게 한다
 * (장에 들어가고 이웃이 잘리지 않는 데까지). 화면 캡처(16:10)를 좁은 칸에 넣으면 위아래가 비고, 세로 사진을 넓은 칸에 넣으면 양옆이 비었다.
 * 판에 다른 이미지가 있으면 함께 본다: 새 이미지만 맞추면 옆의 화면 캡처가 좁은 칸에 눌렸다.
 * 조금 나은 정도(비율 차이 5% 안쪽)로는 사람이 정한 크기를 바꾸지 않는다. aspect는 가로 ÷ 세로
 */
export function fitImage(blocks: Block[], blockId: string, aspect: number, areaH: number): Block[] {
  const self = blocks.find((b) => b.id === blockId)
  if (!self?.at || !(aspect > 0)) return blocks
  const fit = boardFit(areaH, blocks)
  let best = blocks
  let bestOff = offAll(blocks, areaH, blockId, aspect)
  const start = bestOff
  // 옆으로 나누는 선 하나, 위아래로 나누는 선 하나씩 차례로 맞춘다
  for (const dir of ['h', 'v'] as const) {
    const a = best.find((b) => b.id === blockId)!.at!
    const touching = guttersOf(best).filter(
      (g) => g.dir === dir && (dir === 'h' ? (g.at === a.x || g.at === a.x + a.w) && g.from < a.y + a.h && a.y < g.to : (g.at === a.y || g.at === a.y + a.h) && g.from < a.x + a.w && a.x < g.to),
    )
    for (const g of touching) {
      const range = gutterRange(best, g, fit)
      if (!range) continue
      for (let to = range.lo; to <= range.hi; to++) {
        const next = to === g.at ? null : moveGutter(best, g, to, fit)
        if (!next) continue
        const off = offAll(next, areaH, blockId, aspect)
        if (off < bestOff - 1e-6) {
          best = next
          bestOff = off
        }
      }
    }
  }
  return bestOff > start - 0.05 ? blocks : best
}

/** 사진을 꽉 채우기로 둘 만큼 칸과 비율이 비슷한지: 잘려 나가는 몫이 3분의 1을 넘지 않을 때 (가로세로 1.5배 안쪽) */
const COVER_MISFIT = Math.log(1.5)

/**
 * 넣은 이미지의 보이는 법: 사진(JPEG)은 칸과 비율이 비슷하면 꽉 채우기, 화면 캡처·도면·로고(PNG, SVG 같은)와
 * 칸과 비율이 크게 다른 사진은 잘리지 않게 전체 보이기. 화면 캡처를 꽉 채우기로 넣으면 위아래 메뉴와 표가 잘려
 * 무엇을 보여 주려는지 알 수 없었고, 세로 사진을 넓고 낮은 칸에 꽉 채우면 가운데 띠만 남았다
 */
function settleImage(blocks: Block[], blockId: string, areaH: number): Block[] {
  const block = blocks.find((b) => b.id === blockId)
  const aspect = block && aspectOf(block)
  if (!block || !aspect) return blocks
  const variant = isPhoto(block.fields.image ?? '') && misfit(blocks, blockId, aspect, areaH) <= COVER_MISFIT ? 'cover' : 'contain'
  return block.variant === variant ? blocks : mapBlock(blocks, blockId, (b) => ({ ...b, variant }))
}

/**
 * 이미지 부품에 이미지를 넣은 판: 이미지에 닿은 선을 이미지 비율에 맞추고(fitImage), 보이는 법을 고른다(settleImage).
 * 사람이 고른 보이는 법은 이미지를 바꿀 때마다 다시 고른다. 바꾼 뒤에 다시 고르면 그대로 남는다
 */
export function withImage(blocks: Block[], blockId: string, url: string, areaH: number): Block[] {
  const next = mapBlock(blocks, blockId, (b) => ({ ...b, fields: { ...b.fields, image: url } }))
  const block = next.find((b) => b.id === blockId)
  const aspect = block && aspectOf(block)
  return settleImage(aspect ? fitImage(next, blockId, aspect, areaH) : next, blockId, areaH)
}

/** 이미지가 든 새 이미지 부품 (붙여 넣거나 끌어다 놓은 이미지). 보이는 법은 놓은 자리에서 고른다(fitPlaced) */
export function imageBlock(url: string): Block {
  return { ...makeBlock('image'), fields: { image: url }, variant: isPhoto(url) ? 'cover' : 'contain' }
}

/**
 * 부품을 넣은 뒤: 판에 이미지가 든 이미지 부품이 있으면 그 이미지에 닿은 선을 이미지에 다시 맞춘다. 이미지를 붙여 넣었을 때도,
 * 이미지 옆에 설명을 넣었을 때도 같다(똑같이 나누면 넓은 화면 캡처가 반 칸에 눌려 위아래가 빈다).
 * 넣은 것이 이미지 자신이면 보이는 법도 고른다. 이웃을 넣을 때는 사람이 고른 보이는 법을 그대로 둔다
 */
export function fitPlaced(blocks: Block[], block: Block, areaH?: number): Block[] {
  if (areaH === undefined) return blocks
  let out = blocks
  for (const img of blocks.filter((b) => aspectOf(b))) out = fitImage(out, img.id, aspectOf(img)!, areaH)
  return aspectOf(block) ? settleImage(out, block.id, areaH) : out
}
