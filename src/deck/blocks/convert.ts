// 장을 부품 장으로, 부품 장을 다시 장으로. 사람이 적은 글은 하나도 버리지 않는다

import { uid } from '../generate'
import type { Block, BlockRow, BlockType, Item, LayoutBlockType, LayoutId, Slide } from '../types'
import { HEAD_KEYS } from './catalog'
import { allBlocks } from './cells'

/** 표지와 단락 장은 색 면과 자리가 정해진 장이라 부품 장으로 바꾸지 않는다 */
export const canCompose = (layout: LayoutId) => layout !== 'cover' && layout !== 'section' && layout !== 'compose'

const pick = (fields: Record<string, string>, keys: string[]) => Object.fromEntries(keys.filter((k) => fields[k]?.trim()).map((k) => [k, fields[k]]))
const newBlock = (type: BlockType, fields: Record<string, string> = {}, items: Item[] = [], extra: Partial<Block> = {}): Block => ({ id: uid(), type, fields, items, ...extra })
const newRow = (...blocks: (Block | null)[]): BlockRow => ({ id: uid(), blocks: blocks.filter((b): b is Block => !!b) })

/**
 * 지금 장을 같은 내용의 부품 장으로. 사람이 적은 글은 하나도 버리지 않는다: 제목, 부제, 출처는 장의 머리로,
 * 나머지 칸과 항목은 부품으로 옮긴다. 대부분은 같은 레이아웃의 부품 하나가 되어 모습도 그대로다.
 */
export function composeFrom(slide: Slide): Slide {
  if (!canCompose(slide.layout)) return slide
  const f = slide.fields
  const hintsOf = (keep: (k: string) => boolean) => Object.fromEntries(Object.entries(slide.hints).filter(([k]) => keep(k)))
  const headHints = hintsOf((k) => HEAD_KEYS.includes(k))
  let fields: Record<string, string>
  let rows: BlockRow[]
  switch (slide.layout) {
    case 'statement':
      fields = {}
      rows = [newRow(newBlock('message', { ...(f.title?.trim() ? { text: f.title } : {}), ...(f.lead?.trim() ? { sub: f.lead } : {}) }))]
      break
    case 'imageText': {
      fields = pick(f, ['title'])
      const img = newBlock('image', pick(f, ['image']), [], slide.options.contain ? { variant: 'contain' } : {})
      const txt = newBlock('text', pick(f, ['body']))
      rows = [slide.options.flip ? newRow(txt, img) : newRow(img, txt)]
      break
    }
    case 'case': {
      fields = pick(f, ['title'])
      const text = newBlock('text', { ...(f.client ? { label: f.client } : {}), ...pick(f, ['body']) })
      const image = f.image ? newBlock('image', { image: f.image }, [], { variant: 'contain' }) : null
      const numbers = slide.items.length ? newBlock('kpi', {}, slide.items, { variant: 'cards' }) : null
      const quote = f.quote?.trim() ? newBlock('quote', { quote: f.quote }) : null
      rows = [newRow(text, image), newRow(numbers, quote)].filter((r) => r.blocks.length > 0)
      break
    }
    case 'closing':
      fields = pick(f, ['title'])
      rows = slide.items.length ? [newRow(newBlock('bullets', {}, slide.items))] : []
      break
    default: {
      fields = pick(f, HEAD_KEYS)
      const rest = Object.fromEntries(Object.entries(f).filter(([k]) => !HEAD_KEYS.includes(k)))
      const hints = hintsOf((k) => !HEAD_KEYS.includes(k))
      rows = [
        newRow(
          newBlock(slide.layout as LayoutBlockType, rest, slide.items, {
            ...(slide.variant ? { variant: slide.variant } : {}),
            ...(slide.options.highlight !== undefined ? { highlight: slide.options.highlight } : {}),
            ...(Object.keys(hints).length ? { hints } : {}),
          }),
        ),
      ]
    }
  }
  const { tone, motion } = slide.options
  return {
    ...slide,
    layout: 'compose',
    fields,
    items: [],
    hints: headHints,
    variant: undefined,
    options: { ...(tone ? { tone } : {}), ...(motion ? { motion } : {}) },
    rows,
  }
}

/**
 * 장을 부품 장으로 바꾼다. 편집기(레이아웃 바꾸기, 부품 장으로 바꾸기, 부품 끌어 넣기)와 AI 제안(set_layout)이 모두 이것을 쓴다.
 * 예전에 부품 장이었던 장은 다른 레이아웃으로 바꿔도 줄을 장에 남겨 두는데, 따로 composeFrom을 부르던 곳은 그 줄을 새 줄로
 * 덮어써서 그 안의 글이 지워졌다. 남겨 둔 줄이 있으면 그 줄을 다시 보여 주고(지금 레이아웃의 글은 장에 그대로 남는다),
 * 표지와 단락 장은 빈 부품 장으로, 나머지는 지금 내용을 부품으로 옮긴다
 */
export function asCompose(slide: Slide): Slide {
  if (slide.layout === 'compose') return slide
  if (slide.rows?.length || !canCompose(slide.layout)) return { ...slide, layout: 'compose', rows: slide.rows ?? [], variant: undefined }
  return composeFrom(slide)
}

/** 레이아웃 부품 하나뿐인 부품 장을 그 레이아웃의 장으로 되돌린다. 그럴 수 없으면 null */
export function unwrapCompose(slide: Slide, layout: LayoutId): Slide | null {
  const blocks = allBlocks(slide.rows ?? [])
  if (slide.layout !== 'compose' || blocks.length !== 1 || blocks[0].type !== layout) return null
  const b = blocks[0]
  return {
    ...slide,
    layout,
    fields: { ...pick(slide.fields, HEAD_KEYS), ...b.fields },
    items: b.items,
    hints: { ...slide.hints, ...b.hints },
    variant: b.variant,
    options: { ...slide.options, ...(b.highlight !== undefined ? { highlight: b.highlight } : {}) },
    rows: undefined,
  }
}
