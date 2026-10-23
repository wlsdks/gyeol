// AI(MCP)에게 보여 주는 발표의 '모양'. 사람이 적은 글은 한 글자도 넣지 않는다.
//
// 지키는 방법은 빼는 쪽이 아니라 고르는 쪽이다. 덱에서 필요한 값만 골라 새로 만들고,
// 글자는 카탈로그(레이아웃 이름, 장 역할 같은 이 앱에 원래 있는 말)에 있는 것만 넣는다.
// 그리고 앱, 로컬 서버, MCP 서버가 각각 checkShape로 다시 확인한다.

import { blockItems, cleanRows, BLOCK_EFFECTS, BLOCK_EFFECT_IDS, BLOCK_LOOKS, BLOCK_LOOK_IDS, BLOCK_TYPES, BLOCKS, effectOf, lookOf, MAX_IN_ROW, MAX_ROWS, spansOf, variantOfBlock } from '../deck/blocks'
import { AUDIENCES, BLUEPRINTS, DECK_TYPES, DURATIONS, METHODS } from '../deck/blueprints'
import { readField, visibleItems } from '../deck/fields'
import { LAYOUTS, LAYOUT_ORDER, variantIds, variantOf } from '../deck/layouts'
import { FONTS, FOOTERS, MOTIONS, TEXT_SIZES, THEMES, THEME_ORDER, TONES, TRANSITIONS } from '../deck/themes'
import type { Audience, Block, BlockEffect, BlockLook, BlockType, Deck, DeckType, FontId, FooterMode, LayoutId, Method, Motion, Slide, TextSize, ThemeId, Tone, Transition } from '../deck/types'

export const SHAPE_FORMAT = 'html-maker/shape'

/** 칸의 상태. 글자 수 대신 세 단계만 알려 준다. */
export type FieldState = 'empty' | 'filled' | 'long'

export interface ShapeSlide {
  /** 장의 원래 id가 아니라 그 해시. 원래 id는 가져온 파일에서 아무 글자나 될 수 있어서다. */
  id: string
  layout: LayoutId
  /** 이 장의 역할. 카탈로그에 있는 말이 아니면 null */
  role: string | null
  /** 단락 이름. 카탈로그에 있는 말이 아니면 null */
  section: string | null
  hidden: boolean
  /** 레이아웃 때문에 숨은 항목 수 (지우지 않고 남겨 둔 것) */
  hiddenItems: number
  fields: Record<string, FieldState>
  items: Record<string, FieldState>[]
  options: { highlight?: number; flip?: boolean; contain?: boolean; motion?: Motion; tone?: Tone }
  /** 레이아웃 안의 모양 id. 카탈로그 layouts[].variants 중 하나, 한 가지뿐이면 'base' */
  variant: string
  /** 부품 장(layout 'compose')만: 줄마다 부품. 부품의 종류, 너비, 바탕, 움직임과 칸이 찼는지만 */
  blocks?: ShapeBlock[][]
}

export interface ShapeBlock {
  type: BlockType
  /** 칸 너비 (12 기준) */
  span: number
  look: BlockLook
  effect: BlockEffect
  /** 카탈로그 blocks[].variants 중 하나, 한 가지뿐이면 'base' */
  variant: string
  fields: Record<string, FieldState>
  items: Record<string, FieldState>[]
}

export interface ShapeDeck {
  format: typeof SHAPE_FORMAT
  version: 1
  deck: string
  type: DeckType
  audience: Audience
  duration: number
  method: Method
  theme: ThemeId
  accent: string | null
  motion: Motion
  /** 아래 넷은 나중에 생겨서, 예전 앱이 쓴 모양 파일에는 없을 수 있다 */
  font?: FontId | null
  size?: TextSize
  footer?: FooterMode
  transition?: Transition
  updatedAt: number
  slides: ShapeSlide[]
}

const isOneOf = <T extends string>(list: { id: T }[], v: unknown): v is T => list.some((x) => x.id === v)

const OPAQUE_ID = /^[sd][0-9a-f]{8}$/
const HEX = /^#[0-9a-f]{6}$/i
const ALL_TYPES: DeckType[] = [...DECK_TYPES, 'blank']

/** FNV-1a 32비트. 원래 id를 드러내지 않고 다시 찾을 수 있게 한다. */
function fnv(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export const shapeSlideId = (slide: Pick<Slide, 'id'>) => `s${fnv(`slide:${slide.id}`)}`
export const shapeDeckId = (deck: Pick<Deck, 'id'>) => `d${fnv(`deck:${deck.id}`)}`

// ---------- 카탈로그: 앱에 원래 있는 말. AI에게 보여 줘도 되는 글자는 이것뿐이다. ----------

export function catalog() {
  return {
    layouts: LAYOUT_ORDER.map((id) => {
      const spec = LAYOUTS[id]
      return {
        id,
        name: spec.name,
        description: spec.description,
        variants: (spec.variants ?? [{ id: 'base', name: spec.name }]).map((v) => ({ id: v.id, name: v.name })),
        highlight: spec.highlight?.label ?? null,
        fields: spec.fields.map((f) => ({ key: f.key, label: f.label, optional: !!f.optional, image: !!f.image })),
        items: spec.items
          ? {
              label: spec.items.label,
              min: spec.items.min,
              max: spec.items.max,
              fields: spec.items.fields.map((f) => ({ key: f.key, label: f.label, optional: !!f.optional, image: !!f.image })),
            }
          : null,
      }
    }),
    deckTypes: ALL_TYPES.map((id) => {
      const bp = BLUEPRINTS[id]
      return {
        id,
        name: bp.name,
        description: bp.description,
        storyline: bp.storyline,
        roles: bp.recipes.map((r) => ({
          role: r.layout === 'section' ? (r.section ?? r.purpose) : r.purpose,
          layout: r.layout,
          section: r.section ?? null,
          priority: r.priority,
        })),
      }
    }),
    audiences: AUDIENCES.map((a) => ({ id: a.id, name: a.name, description: a.description })),
    durations: DURATIONS.map((d) => ({ minutes: d.minutes, name: d.name })),
    methods: METHODS.map((m) => ({ id: m.id, name: m.name, description: m.description })),
    themes: THEME_ORDER.map((id) => ({ id, name: THEMES[id].name, description: THEMES[id].description, accent: THEMES[id].accent })),
    motions: MOTIONS.map((m) => ({ id: m.id, name: m.name, description: m.description })),
    fonts: FONTS.map((m) => ({ id: m.id, name: m.name, description: m.description })),
    textSizes: TEXT_SIZES.map((m) => ({ id: m.id, name: m.name, description: m.description })),
    footers: FOOTERS.map((m) => ({ id: m.id, name: m.name, description: m.description })),
    transitions: TRANSITIONS.map((m) => ({ id: m.id, name: m.name, description: m.description })),
    tones: TONES.map((m) => ({ id: m.id, name: m.name, description: m.description })),
    blocks: BLOCK_TYPES.map((type) => {
      const spec = BLOCKS[type]
      return {
        type,
        name: spec.name,
        description: spec.description,
        motion: spec.motion,
        minSpan: spec.minSpan,
        variants: (spec.variants ?? [{ id: 'base', name: spec.name }]).map((v) => ({ id: v.id, name: v.name })),
        fields: blockFieldSpecs(type).map((f) => ({ key: f.key, label: f.label, optional: !!f.optional, image: !!f.image })),
        items: spec.items
          ? {
              label: spec.items.label,
              min: spec.items.min,
              max: spec.items.max,
              fields: spec.items.fields.map((f) => ({ key: f.key, label: f.label, optional: !!f.optional, image: !!f.image })),
            }
          : null,
      }
    }),
    blockLooks: BLOCK_LOOKS.map((m) => ({ id: m.id, name: m.name })),
    blockEffects: BLOCK_EFFECTS.map((m) => ({ id: m.id, name: m.name, description: m.description })),
  }
}

/** 부품의 칸 가운데 부품마다 적는 것 ($로 시작하는 발표 전체의 값은 빼고) */
const blockFieldSpecs = (type: BlockType) => BLOCKS[type].fields.filter((f) => !f.key.startsWith('$'))

function collectStrings(value: unknown, out: Set<string>) {
  if (typeof value === 'string') out.add(value)
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out))
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => (out.add(k), collectStrings(v, out)))
}

let catalogWords: Set<string> | null = null
/** 카탈로그에 나오는 모든 글자 (키 포함) */
export function catalogStrings(): Set<string> {
  if (!catalogWords) {
    catalogWords = new Set()
    collectStrings(catalog(), catalogWords)
    for (const bp of Object.values(BLUEPRINTS)) {
      for (const r of bp.recipes) {
        catalogWords.add(r.purpose)
        if (r.section) catalogWords.add(r.section)
      }
    }
  }
  return catalogWords
}

/** 장 역할이나 단락 이름으로 보여 줘도 되는 말: 보고 구성에 원래 있는 역할, 단락, 레이아웃 이름 */
let roleWords: Set<string> | null = null
function roleStrings(): Set<string> {
  if (!roleWords) {
    roleWords = new Set(Object.values(LAYOUTS).map((l) => l.name))
    for (const bp of Object.values(BLUEPRINTS)) {
      for (const r of bp.recipes) {
        roleWords.add(r.purpose)
        if (r.section) roleWords.add(r.section)
      }
    }
  }
  return roleWords
}

const fromCatalog = (text: string): string | null => (roleStrings().has(text) ? text : null)

// ---------- 덱에서 모양만 골라 만들기 ----------

/** 이 글자 수를 넘으면 'long'. 칸이 넘칠 수 있다는 정도만 알려 준다. */
function stateOf(text: string, multiline: boolean): FieldState {
  const n = text.trim().length
  if (!n) return 'empty'
  return n > (multiline ? 140 : 40) ? 'long' : 'filled'
}

export function toShape(deck: Deck): ShapeDeck {
  return {
    format: SHAPE_FORMAT,
    version: 1,
    deck: shapeDeckId(deck),
    type: ALL_TYPES.includes(deck.meta.type) ? deck.meta.type : 'blank',
    audience: AUDIENCES.some((a) => a.id === deck.meta.audience) ? deck.meta.audience : 'mixed',
    duration: Number.isFinite(deck.meta.duration) ? Math.max(0, Math.min(240, Math.round(deck.meta.duration))) : 0,
    method: METHODS.some((m) => m.id === deck.meta.method) ? deck.meta.method : 'live',
    theme: THEME_ORDER.includes(deck.theme.id) ? deck.theme.id : 'white',
    accent: deck.theme.accent && HEX.test(deck.theme.accent) ? deck.theme.accent.toLowerCase() : null,
    motion: MOTIONS.some((m) => m.id === deck.motion) ? deck.motion! : 'calm',
    font: isOneOf(FONTS, deck.theme.font) ? deck.theme.font : null,
    size: isOneOf(TEXT_SIZES, deck.theme.size) ? deck.theme.size : 'normal',
    footer: isOneOf(FOOTERS, deck.theme.footer) ? deck.theme.footer : 'all',
    transition: isOneOf(TRANSITIONS, deck.theme.transition) ? deck.theme.transition : 'auto',
    updatedAt: Math.round(deck.updatedAt) || 0,
    slides: deck.slides.filter((s) => s.layout in LAYOUTS).map((s) => shapeSlide(deck, s)),
  }
}

function shapeSlide(deck: Deck, slide: Slide): ShapeSlide {
  const spec = LAYOUTS[slide.layout]
  const fields: Record<string, FieldState> = {}
  for (const f of spec.fields) fields[f.key] = stateOf(readField(slide, deck.meta, f.key), !!f.multiline)
  const visible = visibleItems(slide)
  const items = spec.items
    ? visible.map((item) => {
        const out: Record<string, FieldState> = {}
        for (const f of spec.items!.fields) out[f.key] = stateOf(item[f.key] ?? '', !!f.multiline)
        return out
      })
    : []
  const options: ShapeSlide['options'] = {}
  const o = slide.options ?? {}
  if (spec.highlight && Number.isInteger(o.highlight)) options.highlight = o.highlight
  if (slide.layout === 'imageText') {
    options.flip = !!o.flip
    options.contain = !!o.contain
  }
  if (isOneOf(MOTIONS, o.motion)) options.motion = o.motion
  if (isOneOf(TONES, o.tone) && o.tone !== 'base') options.tone = o.tone
  const out: ShapeSlide = {
    id: shapeSlideId(slide),
    layout: slide.layout,
    role: fromCatalog(slide.purpose ?? ''),
    section: fromCatalog(slide.section ?? ''),
    hidden: !!slide.hidden,
    hiddenItems: Math.max(0, slide.items.length - visible.length),
    fields,
    items,
    options,
    variant: variantOf(slide),
  }
  if (slide.layout === 'compose') {
    // 가져온 파일일 수 있어서 꼴부터 맞춘다 (모르는 부품, 넘치는 개수는 뺀다)
    out.blocks = cleanRows(slide.rows)
      .map((r) => {
        const spans = spansOf(r)
        return r.blocks.map((b, i) => shapeBlock(b, spans[i]))
      })
  }
  return out
}

function shapeBlock(block: Block, span: number): ShapeBlock {
  const spec = BLOCKS[block.type]
  const fields: Record<string, FieldState> = {}
  for (const f of blockFieldSpecs(block.type)) fields[f.key] = stateOf(block.fields[f.key] ?? '', !!f.multiline)
  const items = spec.items
    ? blockItems(block).map((item) => {
        const o: Record<string, FieldState> = {}
        for (const f of spec.items!.fields) o[f.key] = stateOf(item[f.key] ?? '', !!f.multiline)
        return o
      })
    : []
  return { type: block.type, span, look: lookOf(block), effect: effectOf(block), variant: variantOfBlock(block), fields, items }
}

// ---------- 확인: 모양 파일이 정해진 꼴 그대로인지. 하나라도 어긋나면 통째로 버린다. ----------

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const keysIn = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every((k) => allowed.includes(k))
const isInt = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max
const STATES: FieldState[] = ['empty', 'filled', 'long']

function checkStates(v: unknown, keys: string[]): boolean {
  return isObj(v) && Object.keys(v).length === keys.length && keys.every((k) => STATES.includes(v[k] as FieldState))
}

function checkBlock(v: unknown): boolean {
  if (!isObj(v) || !keysIn(v, ['type', 'span', 'look', 'effect', 'variant', 'fields', 'items'])) return false
  if (!BLOCK_TYPES.includes(v.type as BlockType)) return false
  const spec = BLOCKS[v.type as BlockType]
  if (!isInt(v.span, 1, 12)) return false
  if (!BLOCK_LOOK_IDS.includes(v.look as BlockLook) || !BLOCK_EFFECT_IDS.includes(v.effect as BlockEffect)) return false
  if (!(spec.variants ?? [{ id: 'base' }]).some((x) => x.id === v.variant)) return false
  if (!checkStates(v.fields, blockFieldSpecs(v.type as BlockType).map((f) => f.key))) return false
  if (!Array.isArray(v.items) || v.items.length > (spec.items?.max ?? 0)) return false
  const itemKeys = spec.items?.fields.map((f) => f.key) ?? []
  return v.items.every((it) => checkStates(it, itemKeys))
}

function checkSlide(v: unknown): boolean {
  if (!isObj(v)) return false
  if (!keysIn(v, ['id', 'layout', 'role', 'section', 'hidden', 'hiddenItems', 'fields', 'items', 'options', 'variant', 'blocks'])) return false
  if (v.blocks !== undefined) {
    if (v.layout !== 'compose' || !Array.isArray(v.blocks) || v.blocks.length > MAX_ROWS) return false
    if (!v.blocks.every((r) => Array.isArray(r) && r.length >= 1 && r.length <= MAX_IN_ROW && r.every(checkBlock))) return false
  }
  if (typeof v.id !== 'string' || !OPAQUE_ID.test(v.id) || v.id[0] !== 's') return false
  if (typeof v.layout !== 'string' || !(v.layout in LAYOUTS)) return false
  const spec = LAYOUTS[v.layout as LayoutId]
  if (!variantIds(v.layout as LayoutId).includes(v.variant as string)) return false
  if (v.role !== null && !(typeof v.role === 'string' && roleStrings().has(v.role))) return false
  if (v.section !== null && !(typeof v.section === 'string' && roleStrings().has(v.section))) return false
  if (typeof v.hidden !== 'boolean' || !isInt(v.hiddenItems, 0, 1000)) return false
  if (!checkStates(v.fields, spec.fields.map((f) => f.key))) return false
  if (!Array.isArray(v.items) || v.items.length > (spec.items?.max ?? 0)) return false
  const itemKeys = spec.items?.fields.map((f) => f.key) ?? []
  if (!v.items.every((it) => checkStates(it, itemKeys))) return false
  const o = v.options
  if (!isObj(o) || !keysIn(o, ['highlight', 'flip', 'contain', 'motion', 'tone'])) return false
  if (o.highlight !== undefined && !isInt(o.highlight, -1, 20)) return false
  if (o.motion !== undefined && !isOneOf(MOTIONS, o.motion)) return false
  if (o.tone !== undefined && !isOneOf(TONES, o.tone)) return false
  if (o.flip !== undefined && typeof o.flip !== 'boolean') return false
  if (o.contain !== undefined && typeof o.contain !== 'boolean') return false
  return true
}

export function checkShape(v: unknown): v is ShapeDeck {
  if (!isObj(v)) return false
  if (!keysIn(v, ['format', 'version', 'deck', 'type', 'audience', 'duration', 'method', 'theme', 'accent', 'motion', 'font', 'size', 'footer', 'transition', 'updatedAt', 'slides']))
    return false
  if (v.format !== SHAPE_FORMAT || v.version !== 1) return false
  if (typeof v.deck !== 'string' || !OPAQUE_ID.test(v.deck) || v.deck[0] !== 'd') return false
  if (!ALL_TYPES.includes(v.type as DeckType)) return false
  if (!AUDIENCES.some((a) => a.id === v.audience)) return false
  if (!METHODS.some((m) => m.id === v.method)) return false
  if (!isInt(v.duration, 0, 240) || !isInt(v.updatedAt, 0, Number.MAX_SAFE_INTEGER)) return false
  if (!THEME_ORDER.includes(v.theme as ThemeId)) return false
  if (v.accent !== null && !(typeof v.accent === 'string' && HEX.test(v.accent))) return false
  if (!MOTIONS.some((m) => m.id === v.motion)) return false
  if (v.font !== undefined && v.font !== null && !isOneOf(FONTS, v.font)) return false
  if (v.size !== undefined && !isOneOf(TEXT_SIZES, v.size)) return false
  if (v.footer !== undefined && !isOneOf(FOOTERS, v.footer)) return false
  if (v.transition !== undefined && !isOneOf(TRANSITIONS, v.transition)) return false
  if (!Array.isArray(v.slides) || v.slides.length > 300 || !v.slides.every(checkSlide)) return false
  return new Set((v.slides as ShapeSlide[]).map((s) => s.id)).size === v.slides.length
}

/**
 * 마지막 그물: 값 안의 모든 글자가 카탈로그, 정해진 말(extra), 해시 id, 색 코드 중 하나인지.
 * MCP 서버가 응답을 내보내기 직전에 쓴다. 키도 확인한다.
 */
export function onlyKnownStrings(value: unknown, extra: Iterable<string> = []): boolean {
  const known = catalogStrings()
  const more = new Set(extra)
  const ok = (s: string) => known.has(s) || more.has(s) || OPAQUE_ID.test(s) || HEX.test(s) || /^r[0-9a-f]{12}$/.test(s)
  const walk = (v: unknown): boolean => {
    if (typeof v === 'string') return ok(v)
    if (v === null || typeof v === 'number' || typeof v === 'boolean') return true
    if (Array.isArray(v)) return v.every(walk)
    if (isObj(v)) return Object.entries(v).every(([k, x]) => ok(k) && walk(x))
    return false
  }
  return walk(value)
}
