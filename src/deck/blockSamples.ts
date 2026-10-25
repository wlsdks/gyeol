import { composeFrom, isLayoutBlock } from './blocks'
import { nativeSample, showcaseSlides } from './showcase'
import type { Block, BlockType, LayoutBlockType } from './types'

// 부품마다 지어낸 예시 내용. 부품 고르기 카드와 장 모음이 쓴다.
// 레이아웃 부품은 장 모음의 예시 장을 부품 장으로 바꿔서 그 부품을 꺼낸다(같은 예시를 두 번 쓰지 않게).

let fromLayouts: Map<LayoutBlockType, Block> | null = null

export function sampleBlock(type: BlockType): Block {
  if (!isLayoutBlock(type)) return nativeSample(type)
  if (!fromLayouts) {
    fromLayouts = new Map()
    for (const s of showcaseSlides()) {
      if (!isLayoutBlock(s.layout) || fromLayouts.has(s.layout)) continue
      const b = composeFrom(s).blocks?.[0]
      if (b) fromLayouts.set(s.layout, { ...b, id: `sample-${s.layout}` })
    }
  }
  return fromLayouts.get(type)!
}
