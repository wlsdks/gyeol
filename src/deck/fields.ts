import { LAYOUTS } from './layouts'
import type { Deck, DeckMeta, ItemKey, MetaKey, Slide } from './types'

export function isMetaKey(key: string): boolean {
  return key.startsWith('$')
}

export function readField(slide: Slide, meta: DeckMeta, key: string): string {
  if (isMetaKey(key)) return meta[key.slice(1) as MetaKey] ?? ''
  return slide.fields[key] ?? ''
}

/** 레이아웃이 보여주는 항목만. 최대 개수를 넘는 항목은 지우지 않고 숨긴다. */
export function visibleItems(slide: Slide) {
  const max = LAYOUTS[slide.layout].items?.max ?? 0
  return slide.items.slice(0, max)
}

export interface Missing {
  key: string
  item?: number
  itemKey?: ItemKey
  label: string
}

export function missingFields(slide: Slide, meta: DeckMeta): Missing[] {
  const spec = LAYOUTS[slide.layout]
  const out: Missing[] = []
  for (const f of spec.fields) {
    if (f.optional) continue
    if (!readField(slide, meta, f.key).trim()) out.push({ key: f.key, label: f.label })
  }
  if (spec.items) {
    visibleItems(slide).forEach((item, i) => {
      for (const f of spec.items!.fields) {
        if (f.optional) continue
        if (!item[f.key].trim()) {
          out.push({ key: f.key, item: i, itemKey: f.key, label: `${spec.items!.label} ${i + 1}의 ${f.label}` })
        }
      }
    })
  }
  return out
}

export function deckMissingCount(deck: Deck): number {
  return deck.slides.filter((s) => !s.hidden).reduce((n, s) => n + missingFields(s, deck.meta).length, 0)
}

export interface PageInfo {
  /** 숨긴 장을 뺀 쪽 번호 (1부터). 숨긴 장은 없다. */
  page: Map<string, number>
  /** 섹션 구분 장의 번호 */
  section: Map<string, number>
  total: number
}

export function pageInfo(slides: Slide[]): PageInfo {
  const page = new Map<string, number>()
  const section = new Map<string, number>()
  let n = 0
  let sections = 0
  for (const s of slides) {
    if (s.hidden) continue
    page.set(s.id, ++n)
    if (s.layout === 'section') section.set(s.id, ++sections)
  }
  return { page, section, total: n }
}
