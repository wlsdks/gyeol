import { allBlocks, blockMissing, blockNames } from './blocks'
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
  /** 부품 장의 부품 안 칸이면 그 부품 id */
  block?: string
}

export function missingFields(slide: Slide, meta: DeckMeta): Missing[] {
  const spec = LAYOUTS[slide.layout]
  const out: Missing[] = []
  for (const f of spec.fields) {
    if (f.optional) continue
    if (!readField(slide, meta, f.key).trim()) out.push({ key: f.key, label: f.label })
  }
  if (slide.layout === 'compose') {
    const names = blockNames(slide.rows ?? [])
    for (const b of allBlocks(slide.rows ?? [])) for (const m of blockMissing(b, names.get(b.id))) out.push(m.item !== undefined ? { ...m, itemKey: m.key as ItemKey } : m)
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
  total: number
  /** 발표의 큰 단락 이름. 섹션 구분 장이 있으면 그 제목들, 없으면 장마다 적힌 단락 이름 */
  sections: string[]
  /** 장마다 속한 단락 순번 (0부터). 첫 단락 앞의 표지, 목차 같은 장은 없다. */
  sectionOf: Map<string, number>
}

export function pageInfo(slides: Slide[]): PageInfo {
  const visible = slides.filter((s) => !s.hidden)
  const page = new Map<string, number>()
  visible.forEach((s, i) => page.set(s.id, i + 1))

  const sections: string[] = []
  const sectionOf = new Map<string, number>()
  if (visible.some((s) => s.layout === 'section')) {
    // 섹션 구분 장부터 다음 구분 장 전까지가 한 단락이다.
    for (const s of visible) {
      if (s.layout === 'section') sections.push(s.fields.title?.trim() || s.section || `${sections.length + 1}단락`)
      if (sections.length) sectionOf.set(s.id, sections.length - 1)
    }
  } else {
    for (const s of visible) {
      const name = s.section.trim()
      if (!name) continue
      let i = sections.indexOf(name)
      if (i < 0) i = sections.push(name) - 1
      sectionOf.set(s.id, i)
    }
  }
  return { page, total: visible.length, sections, sectionOf }
}
