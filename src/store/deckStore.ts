import { create } from 'zustand'
import { emptyItem, makeSlide, uid, withDefaultOptions } from '../deck/generate'
import { isMetaKey } from '../deck/fields'
import { LAYOUTS } from '../deck/layouts'
import type { Deck, ItemKey, LayoutId, MetaKey, Slide, SlideOptions, ThemeId } from '../deck/types'

const HISTORY_LIMIT = 100
/** 같은 칸을 이 시간 안에 이어서 고치면 되돌리기 한 단계로 묶는다 */
const COALESCE_MS = 1200

interface DeckState {
  deck: Deck | null
  selectedId: string | null
  past: Deck[]
  future: Deck[]
  lastKey: string | null
  lastTime: number

  open(deck: Deck): void
  close(): void
  select(id: string): void
  undo(): void
  redo(): void

  setTitle(title: string): void
  setMeta(key: MetaKey, value: string): void
  setTheme(id: ThemeId): void
  setAccent(accent: string | undefined): void

  setField(slideId: string, key: string, value: string): void
  setItem(slideId: string, index: number, key: ItemKey, value: string): void
  addItem(slideId: string): void
  removeItem(slideId: string, index: number): void
  setNotes(slideId: string, notes: string): void
  setOptions(slideId: string, options: SlideOptions): void
  setHidden(slideId: string, hidden: boolean): void
  changeLayout(slideId: string, layout: LayoutId): void

  addSlide(layout: LayoutId, afterId?: string): void
  duplicateSlide(slideId: string): void
  removeSlide(slideId: string): void
  moveSlide(from: number, to: number): void
}

function mapSlide(deck: Deck, slideId: string, fn: (s: Slide) => Slide): Deck {
  return { ...deck, slides: deck.slides.map((s) => (s.id === slideId ? fn(s) : s)) }
}

export const useDeck = create<DeckState>((set, get) => {
  /** 덱을 바꾸고 되돌리기 기록을 남긴다 */
  function commit(fn: (deck: Deck) => Deck, key?: string) {
    const { deck, past, lastKey, lastTime } = get()
    if (!deck) return
    const next = { ...fn(deck), updatedAt: Date.now() }
    const now = Date.now()
    const coalesce = key !== undefined && key === lastKey && now - lastTime < COALESCE_MS
    set({
      deck: next,
      past: coalesce ? past : [...past, deck].slice(-HISTORY_LIMIT),
      future: [],
      lastKey: key ?? null,
      lastTime: now,
    })
  }

  return {
    deck: null,
    selectedId: null,
    past: [],
    future: [],
    lastKey: null,
    lastTime: 0,

    open(deck) {
      set({ deck, selectedId: deck.slides[0]?.id ?? null, past: [], future: [], lastKey: null })
    },
    close() {
      set({ deck: null, selectedId: null, past: [], future: [] })
    },
    select(id) {
      set({ selectedId: id, lastKey: null })
    },
    undo() {
      const { deck, past, future } = get()
      if (!deck || !past.length) return
      const prev = past[past.length - 1]
      const selectedId = prev.slides.some((s) => s.id === get().selectedId) ? get().selectedId : prev.slides[0]?.id
      set({ deck: prev, past: past.slice(0, -1), future: [deck, ...future], lastKey: null, selectedId })
    },
    redo() {
      const { deck, past, future } = get()
      if (!deck || !future.length) return
      const next = future[0]
      const selectedId = next.slides.some((s) => s.id === get().selectedId) ? get().selectedId : next.slides[0]?.id
      set({ deck: next, past: [...past, deck], future: future.slice(1), lastKey: null, selectedId })
    },

    setTitle(title) {
      commit((d) => ({ ...d, title }), 'deck.title')
    },
    setMeta(key, value) {
      commit((d) => ({ ...d, meta: { ...d.meta, [key]: value } }), `meta.${key}`)
    },
    setTheme(id) {
      commit((d) => ({ ...d, theme: { ...d.theme, id } }))
    },
    setAccent(accent) {
      commit((d) => ({ ...d, theme: { ...d.theme, accent } }))
    },

    setField(slideId, key, value) {
      if (isMetaKey(key)) return get().setMeta(key.slice(1) as MetaKey, value)
      commit((d) => mapSlide(d, slideId, (s) => ({ ...s, fields: { ...s.fields, [key]: value } })), `${slideId}.${key}`)
    },
    setItem(slideId, index, key, value) {
      commit(
        (d) =>
          mapSlide(d, slideId, (s) => ({
            ...s,
            items: s.items.map((it, i) => (i === index ? { ...it, [key]: value } : it)),
          })),
        `${slideId}.${index}.${key}`,
      )
    },
    addItem(slideId) {
      commit((d) =>
        mapSlide(d, slideId, (s) => {
          const max = LAYOUTS[s.layout].items?.max ?? 0
          const visible = Math.min(s.items.length, max)
          if (visible >= max) return s
          // 보이는 항목 바로 뒤에 넣는다. 레이아웃 때문에 숨겨진 항목은 뒤로 밀린다.
          const items = [...s.items]
          items.splice(visible, 0, emptyItem())
          return { ...s, items }
        }),
      )
    },
    removeItem(slideId, index) {
      commit((d) => mapSlide(d, slideId, (s) => ({ ...s, items: s.items.filter((_, i) => i !== index) })))
    },
    setNotes(slideId, notes) {
      commit((d) => mapSlide(d, slideId, (s) => ({ ...s, notes })), `${slideId}.notes`)
    },
    setOptions(slideId, options) {
      commit((d) => mapSlide(d, slideId, (s) => ({ ...s, options: { ...s.options, ...options } })))
    },
    setHidden(slideId, hidden) {
      commit((d) => mapSlide(d, slideId, (s) => ({ ...s, hidden })))
    },
    changeLayout(slideId, layout) {
      commit((d) =>
        mapSlide(d, slideId, (s) => {
          const spec = LAYOUTS[layout].items
          const items = [...s.items]
          // 내용은 지우지 않는다. 최소 개수보다 적으면 빈 항목만 더한다.
          if (spec) while (items.length < spec.min) items.push(emptyItem())
          return { ...s, layout, items, options: withDefaultOptions(layout, s.options, items.length) }
        }),
      )
    },

    addSlide(layout, afterId) {
      const slide = makeSlide(layout)
      commit((d) => {
        const at = afterId ? d.slides.findIndex((s) => s.id === afterId) + 1 : d.slides.length
        const prev = d.slides[at - 1]
        if (prev) slide.section = prev.section
        const slides = [...d.slides]
        slides.splice(at, 0, slide)
        return { ...d, slides }
      })
      set({ selectedId: slide.id })
    },
    duplicateSlide(slideId) {
      const { deck } = get()
      const source = deck?.slides.find((s) => s.id === slideId)
      if (!source) return
      const copy: Slide = {
        ...structuredClone(source),
        id: uid(),
        items: source.items.map((it) => ({ ...it, id: uid() })),
      }
      commit((d) => {
        const slides = [...d.slides]
        slides.splice(slides.findIndex((s) => s.id === slideId) + 1, 0, copy)
        return { ...d, slides }
      })
      set({ selectedId: copy.id })
    },
    removeSlide(slideId) {
      const { deck, selectedId } = get()
      if (!deck || deck.slides.length <= 1) return
      const index = deck.slides.findIndex((s) => s.id === slideId)
      commit((d) => ({ ...d, slides: d.slides.filter((s) => s.id !== slideId) }))
      if (selectedId === slideId) {
        const rest = get().deck!.slides
        set({ selectedId: rest[Math.min(index, rest.length - 1)]?.id ?? null })
      }
    },
    moveSlide(from, to) {
      commit((d) => {
        const slides = [...d.slides]
        const [moved] = slides.splice(from, 1)
        slides.splice(to, 0, moved)
        return { ...d, slides }
      })
    },
  }
})

export function useSelectedSlide(): Slide | null {
  return useDeck((s) => s.deck?.slides.find((x) => x.id === s.selectedId) ?? null)
}
