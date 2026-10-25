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

const ITEM_TEXT: ItemKey[] = ['title', 'body', 'value', 'meta', 'image']

/**
 * 발표 화면에 그릴 장: 칸을 하나도 채우지 않은 항목은 뺀다(레이아웃의 가장 적은 수까지만).
 * '빈칸이 남았어요'에서 그대로 발표하면 빈 요청이 번호 '3'과 줄 선만 남거나, 빈 숫자 칸이 장 한쪽을 비웠다.
 * 숨긴 항목(최대 수 너머)은 앞의 빈 항목이 빠져도 끌려 올라오지 않게 함께 뺀다. 강조는 같은 항목을 따라가고,
 * 빈 항목을 강조했으면 강조하지 않는다. 뺄 것이 없으면 받은 장 그대로(같은 객체).
 * 부품은 부품의 가짜 장(blockSlide)에 부품의 항목 수 규칙(spec)을 넘겨 같이 쓴다
 */
export function presentable(slide: Slide, spec = LAYOUTS[slide.layout].items): Slide {
  if (!spec) return slide
  const shown = slide.items.slice(0, spec.max)
  const keep = shown.map((it) => ITEM_TEXT.some((k) => it[k].trim()))
  let n = keep.filter(Boolean).length
  // 가장 적은 수보다 줄면 뒤에서부터 빈 항목을 되살린다
  for (let i = shown.length - 1; i >= 0 && n < spec.min; i--) {
    if (!keep[i]) {
      keep[i] = true
      n++
    }
  }
  if (n === slide.items.length) return slide
  const items = shown.filter((_, i) => keep[i])
  const hl = slide.options.highlight
  const highlight = hl === undefined || hl < 0 ? hl : keep[hl] ? keep.slice(0, hl).filter(Boolean).length : -1
  return { ...slide, items, options: hl === undefined ? slide.options : { ...slide.options, highlight } }
}

/** from째 항목을 to째 자리로 옮긴 목록 (사이의 항목은 한 칸씩 밀린다) */
export function moveIn<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list]
  if (from === to || from < 0 || from >= out.length) return out
  const [it] = out.splice(from, 1)
  out.splice(Math.max(0, Math.min(to, out.length)), 0, it)
  return out
}

/**
 * 항목을 옮긴 뒤 강조한 항목의 자리. 사람이 고른 강조(값이 있을 때)는 그 항목을 따라간다.
 * 고르지 않은 강조(없음)는 '마지막 점'처럼 자리로 정한 것이라 그대로 둔다
 */
export function followIndex(index: number | undefined, from: number, to: number): number | undefined {
  if (index === undefined || index < 0) return index
  if (index === from) return to
  if (from < index && to >= index) return index - 1
  if (from > index && to <= index) return index + 1
  return index
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
    const names = blockNames(slide.blocks ?? [])
    for (const b of allBlocks(slide.blocks ?? [])) for (const m of blockMissing(b, names.get(b.id))) out.push(m.item !== undefined ? { ...m, itemKey: m.key as ItemKey } : m)
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
      if (s.layout === 'section') sections.push(s.fields.title?.trim() || s.section || `섹션 ${sections.length + 1}`)
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
