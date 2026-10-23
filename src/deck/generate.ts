import { BLUEPRINTS, type Recipe } from './blueprints'
import { LAYOUTS } from './layouts'
import type { Audience, Deck, DeckType, Item, LayoutId, Method, Slide, SlideOptions, ThemeId } from './types'

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function emptyItem(): Item {
  return { id: uid(), title: '', body: '', value: '', meta: '', image: '' }
}

/** 발표 시간에 맞는 목표 장 수. 보고는 질문과 토론 시간이 길어서 한 장에 2분 남짓. */
export function targetCount(minutes: number): number {
  if (minutes <= 5) return 5
  if (minutes <= 10) return 7
  if (minutes <= 20) return 11
  return 15
}

/** 청중과 시간에 맞춰 blueprint에서 장을 고른다. 순서는 유지한다. */
export function planRecipes(type: DeckType, audience: Audience, minutes: number): Recipe[] {
  let list = BLUEPRINTS[type].recipes.filter((r) => !r.audience || r.audience.includes(audience))
  const target = targetCount(minutes)

  while (list.length > target) {
    // 묶음(group)은 한 단위로 다룬다
    const units = new Map<string, { priority: number; pos: number; recipes: Recipe[] }>()
    list.forEach((r, pos) => {
      if (r.priority === 1) return
      const key = r.group ?? `#${pos}`
      const unit = units.get(key)
      if (unit) unit.recipes.push(r)
      else units.set(key, { priority: r.priority, pos, recipes: [r] })
    })
    const victim = [...units.values()].sort((a, b) => b.priority - a.priority || b.pos - a.pos)[0]
    if (!victim) break
    list = list.filter((r) => !victim.recipes.includes(r))
  }
  return list
}

export function makeSlide(layout: LayoutId, recipe?: Partial<Recipe>): Slide {
  const spec = LAYOUTS[layout]
  const count = recipe?.items ?? spec.items?.default ?? 0
  return {
    id: uid(),
    layout,
    purpose: recipe?.purpose ?? spec.name,
    section: recipe?.section ?? '',
    fields: { ...(recipe?.fields ?? {}) },
    items: Array.from({ length: count }, (_, i) => ({ ...emptyItem(), ...recipe?.prefill?.[i] })),
    hints: { ...(recipe?.hints ?? {}) },
    guide: recipe?.guide ?? spec.description,
    notes: '',
    options: withDefaultOptions(layout, { ...recipe?.options }, count),
    ...(recipe?.variant ? { variant: recipe.variant } : {}),
    ...(layout === 'compose' ? { rows: [] } : {}),
  }
}

/** 레이아웃마다 처음 정해 두는 옵션. 이미 고른 값은 그대로 둔다. */
export function withDefaultOptions(layout: LayoutId, options: SlideOptions, itemCount: number): SlideOptions {
  if (layout === 'pricing' && options.highlight === undefined) return { ...options, highlight: itemCount >= 3 ? 1 : -1 }
  // 제품 화면 캡처가 대부분이라 잘리지 않게 전체를 보여 주는 쪽이 기본이다.
  if (layout === 'imageText' && options.contain === undefined) return { ...options, contain: true }
  return options
}

export interface DeckInput {
  type: DeckType
  audience: Audience
  minutes: number
  method: Method
  title: string
  org: string
  presenter: string
  /** 표지에 적는 결정 요청 한 줄 */
  ask?: string
  theme: ThemeId
}

export function formatDate(date = new Date()): string {
  return new Intl.DateTimeFormat('ko-KR').format(date)
}

export function createDeck(input: DeckInput): Deck {
  const blueprint = BLUEPRINTS[input.type]
  const recipes = planRecipes(input.type, input.audience, input.minutes)
  const sectionTitles = blueprint.recipes.filter((r) => r.layout === 'section').map((r) => r.section ?? '')
  const title = input.title.trim() || blueprint.defaultTitle

  const slides = recipes.map((recipe) => {
    const slide = makeSlide(recipe.layout, recipe)
    if (recipe.layout === 'cover') {
      slide.fields.title = title
      if (input.ask?.trim()) slide.fields.ask = input.ask.trim()
    }
    if (recipe.layout === 'agenda' && sectionTitles.length) {
      slide.items = sectionTitles.map((t) => ({ ...emptyItem(), title: t }))
    } else if (recipe.layout === 'agenda' && blueprint.storyline.length) {
      // 단락이 없는 보고(진행·실적)는 이야기 흐름을 목차의 예시로 보여 준다. 내용이 아니라 안내라서 칸은 비워 둔다.
      slide.items = blueprint.storyline.map(() => emptyItem())
      blueprint.storyline.forEach((t, i) => (slide.hints[`items.${i}.title`] = t))
    }
    return slide
  })

  const now = Date.now()
  return {
    id: uid(),
    version: 1,
    title,
    createdAt: now,
    updatedAt: now,
    meta: {
      type: input.type,
      audience: input.audience,
      duration: input.minutes,
      method: input.method,
      org: input.org.trim(),
      presenter: input.presenter.trim(),
      date: formatDate(),
      contact: '',
      logo: '',
    },
    theme: { id: input.theme },
    slides,
  }
}
