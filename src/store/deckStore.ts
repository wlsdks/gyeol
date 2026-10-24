import { create } from 'zustand'
import { canCompose, cleanDeckRows, composeFrom, copyBlock, unwrapCompose } from '../deck/blocks'
import { unknownParts } from '../deck/compat'
import { plainTheme } from '../deck/themes'
import { emptyItem, makeSlide, uid, withDefaultOptions } from '../deck/generate'
import { isMetaKey } from '../deck/fields'
import { LAYOUTS } from '../deck/layouts'
import type { Block, BlockRow, Deck, DeckTheme, ItemKey, LayoutId, MetaKey, Motion, Slide, SlideOptions, ThemeId } from '../deck/types'

const HISTORY_LIMIT = 100
/** 같은 칸을 이 시간 안에 이어서 고치면 되돌리기 한 단계로 묶는다 */
const COALESCE_MS = 1200

interface DeckState {
  deck: Deck | null
  /** 새 버전에서 만든 발표라 열지 않고 들고만 있는 것 (compat.ts). 편집기가 알림을 보인다 */
  newer: Deck | null
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
  setMotion(motion: Motion): void
  /** 글꼴, 글자 크기, 아래 표시, 장 넘기기 */
  setLook(patch: Partial<Pick<DeckTheme, 'font' | 'size' | 'footer' | 'transition'>>): void

  setField(slideId: string, key: string, value: string): void
  setItem(slideId: string, index: number, key: ItemKey, value: string): void
  addItem(slideId: string): void
  removeItem(slideId: string, index: number): void
  setNotes(slideId: string, notes: string): void
  setOptions(slideId: string, options: SlideOptions): void
  setHidden(slideId: string, hidden: boolean): void
  changeLayout(slideId: string, layout: LayoutId): void
  setVariant(slideId: string, variant: string): void

  /** 되돌리기 기록에 남기지 않는 설정 */
  setAiShare(on: boolean): void
  /** 덱을 통째로 바꾼다 (AI 제안 적용). 되돌리기 한 번으로 돌아온다. */
  replaceDeck(next: Deck): void

  /** 부품 장: 줄과 칸을 통째로 (끌어다 놓기, 칸 너비). key가 같으면 되돌리기 한 단계로 묶는다 */
  setRows(slideId: string, rows: BlockRow[], key?: string): void
  /** 부품 장: 부품 하나를 고친다 (칸의 글, 바탕, 움직임) */
  updateBlock(slideId: string, blockId: string, fn: (b: Block) => Block, key?: string): void
  /** 이 장을 같은 내용의 부품 장으로. 이미 부품 장이거나 바꿀 수 없는 장이면 그대로 */
  toCompose(slideId: string): void
  /** 장 하나를 통째로 바꾼다 (부품 장으로 바꾸면서 부품을 넣을 때처럼 되돌리기 한 번으로 묶을 일) */
  replaceSlide(slideId: string, slide: Slide): void
  /** 부품을 넣은 부품 장을 새로 만들어 이 장 뒤에 */
  addComposeSlide(rows: BlockRow[], afterId?: string): void

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
    newer: null,
    selectedId: null,
    past: [],
    future: [],
    lastKey: null,
    lastTime: 0,

    open(raw) {
      // 새 버전에서 만든 발표: 이 버전이 모르는 부품이 있어서, 열어 고치면 그 부품과 안의 글을 빼고 저장하게 된다. 열지 않는다
      if (unknownParts(raw)) {
        set({ deck: null, newer: raw, selectedId: null, past: [], future: [], lastKey: null })
        return
      }
      // 가져온 파일이나 예전 저장본: 부품 장의 줄을 정해진 꼴로 맞추고, 예전 세리프 테마는 화이트에 명조 제목으로.
      // 화면에서 '부품'을 '컴포넌트'로 부르기 전에 만든 장은 역할 이름도 지금 이름으로
      const slides = raw.slides.map((s) => (s.purpose === '부품으로 꾸미기' ? { ...s, purpose: LAYOUTS.compose.name } : s))
      const deck = cleanDeckRows({ ...raw, slides, theme: plainTheme(raw.theme) })
      set({ deck, newer: null, selectedId: deck.slides[0]?.id ?? null, past: [], future: [], lastKey: null })
    },
    close() {
      set({ deck: null, newer: null, selectedId: null, past: [], future: [] })
    },
    select(id) {
      set({ selectedId: id, lastKey: null })
    },
    undo() {
      const { deck, past, future } = get()
      if (!deck || !past.length) return
      // AI 공유는 되돌리기 기록에 없는 설정이라 지금 값을 그대로 둔다. 끈 공유가 되돌리기로 다시 켜지면 모양이 몰래 다시 올라간다
      const prev = { ...past[past.length - 1], aiShare: deck.aiShare }
      const selectedId = prev.slides.some((s) => s.id === get().selectedId) ? get().selectedId : prev.slides[0]?.id
      set({ deck: prev, past: past.slice(0, -1), future: [deck, ...future], lastKey: null, selectedId })
    },
    redo() {
      const { deck, past, future } = get()
      if (!deck || !future.length) return
      const next = { ...future[0], aiShare: deck.aiShare }
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
      // 색 고르기 창은 끄는 동안 값을 계속 보낸다. 한 단계로 묶어야 되돌리기 기록(100개)이 색 하나로 다 차지 않는다
      commit((d) => ({ ...d, theme: { ...d.theme, accent } }), 'theme.accent')
    },
    setMotion(motion) {
      commit((d) => ({ ...d, motion }))
    },
    setLook(patch) {
      commit((d) => ({ ...d, theme: { ...d.theme, ...patch } }))
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
          // 부품 장으로 바꿀 때는 내용을 부품으로 옮긴다. 레이아웃 부품 하나뿐인 부품 장은 그 레이아웃으로 되돌린다
          // 예전에 부품 장이었던 장은 남겨 둔 부품을 다시 보여 준다
          if (layout === 'compose')
            return s.rows?.length || !canCompose(s.layout) ? { ...s, layout, rows: s.rows ?? [], variant: undefined } : composeFrom(s)
          const unwrapped = unwrapCompose(s, layout)
          if (unwrapped) return unwrapped
          const spec = LAYOUTS[layout].items
          const items = [...s.items]
          // 내용은 지우지 않는다. 최소 개수보다 적으면 빈 항목만 더한다.
          if (spec) while (items.length < spec.min) items.push(emptyItem())
          // 모양은 레이아웃마다 따로라서 기본 모양으로
          return { ...s, layout, items, variant: undefined, options: withDefaultOptions(layout, s.options, items.length) }
        }),
      )
    },
    setVariant(slideId, variant) {
      commit((d) => mapSlide(d, slideId, (s) => ({ ...s, variant })))
    },

    setRows(slideId, rows, key) {
      commit((d) => mapSlide(d, slideId, (s) => ({ ...s, rows })), key)
    },
    updateBlock(slideId, blockId, fn, key) {
      commit(
        (d) =>
          mapSlide(d, slideId, (s) => ({
            ...s,
            rows: (s.rows ?? []).map((r) => (r.blocks.some((b) => b.id === blockId) ? { ...r, blocks: r.blocks.map((b) => (b.id === blockId ? fn(b) : b)) } : r)),
          })),
        key,
      )
    },
    toCompose(slideId) {
      commit((d) => mapSlide(d, slideId, (s) => composeFrom(s)))
    },
    replaceSlide(slideId, slide) {
      commit((d) => mapSlide(d, slideId, () => ({ ...slide, id: slideId })))
    },
    addComposeSlide(rows, afterId) {
      const slide = { ...makeSlide('compose'), rows }
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

    setAiShare(on) {
      const { deck } = get()
      if (deck) set({ deck: { ...deck, aiShare: on, updatedAt: Date.now() } })
    },
    replaceDeck(next) {
      commit(() => cleanDeckRows(next))
      const { deck, selectedId } = get()
      if (deck && !deck.slides.some((s) => s.id === selectedId)) set({ selectedId: deck.slides[0]?.id ?? null })
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
        ...(source.rows ? { rows: source.rows.map((r) => ({ ...r, id: uid(), blocks: r.blocks.map(copyBlock) })) } : {}),
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
