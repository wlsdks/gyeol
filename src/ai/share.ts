// AI(MCP)에게 보여 주는 발표의 '모양'. 사람이 적은 글은 한 글자도 넣지 않는다.
//
// 지키는 방법은 빼는 쪽이 아니라 고르는 쪽이다. 덱에서 필요한 값만 골라 새로 만들고,
// 글자는 카탈로그(레이아웃 이름, 장 역할 같은 이 앱에 원래 있는 말)에 있는 것만 넣는다.
// 그리고 앱, 로컬 서버, MCP 서버가 각각 checkShape로 다시 확인한다.

import { blockItems, cleanRows, COMBOS, MAX_BLOCKS, BLOCK_EFFECTS, BLOCK_EFFECT_IDS, BLOCK_LINKS, BLOCK_LOOKS, BLOCK_LOOK_IDS, BLOCK_TYPES, BLOCKS, effectOf, isGrow, isLink, linkAt, lookOf, looksFor, MAX_IN_ROW, MAX_ROWS, spansOf, variantOfBlock, weighted } from '../deck/blocks'
import { AUDIENCES, BLUEPRINTS, DECK_TYPES, DURATIONS, METHODS } from '../deck/blueprints'
import { readField, visibleItems } from '../deck/fields'
import { LAYOUTS, LAYOUT_ORDER, variantIds, variantOf } from '../deck/layouts'
import { ACCENT_COMBOS, FONTS, FOOTERS, footerOf, MOTIONS, TEXT_SIZES, THEMES, THEME_ORDER, TONES, TRANSITIONS } from '../deck/themes'
import type { Audience, Block, BlockEffect, BlockLink, BlockLook, BlockType, Deck, DeckType, FontId, FooterMode, LayoutId, Method, Motion, Slide, TextSize, ThemeId, Tone, Transition } from '../deck/types'

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
  options: { highlight?: number; flip?: boolean; pane?: number; contain?: boolean; motion?: Motion; tone?: Tone }
  /** 레이아웃 안의 모양 id. 카탈로그 layouts[].variants 중 하나, 한 가지뿐이면 'base' */
  variant: string
  /** 부품 장(layout 'compose')만: 줄마다 부품. 부품의 종류, 너비, 바탕, 움직임과 칸이 찼는지만 */
  blocks?: ShapeBlock[][]
  /** 부품 장에서 사람이 줄 높이를 정했으면 줄마다의 비중(1~100, 위에서부터). 없으면 똑같이 나눈다 */
  rowGrow?: number[]
  /** 부품 장의 줄 사이 이음표(카탈로그 blockLinks). 줄 수보다 하나 적고, 없는 곳은 null. 하나도 없으면 빠진다 */
  rowLinks?: (BlockLink | null)[]
}

export interface ShapeBlock {
  /** 부품을 가리키는 해시 id (b로 시작). 예전 앱이 쓴 모양 파일에는 없다 */
  id?: string
  type: BlockType
  /** 칸 너비 (12 기준) */
  span: number
  look: BlockLook
  effect: BlockEffect
  /** 카탈로그 blocks[].variants 중 하나, 한 가지뿐이면 'base' */
  variant: string
  /** 강조할 항목을 고를 수 있는 부품만 (카탈로그 blocks[].highlight) */
  highlight?: number
  /** 같은 줄의 오른쪽 부품과의 사이에 선 이음표 (카탈로그 blockLinks). 없으면 빠진다 */
  link?: BlockLink
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

const OPAQUE_ID = /^[sdb][0-9a-f]{8}$/
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
export const shapeBlockId = (block: Pick<Block, 'id'>) => `b${fnv(`block:${block.id}`)}`

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
        // 두 판으로 나뉜 장: 옆 판의 이름, 고를 수 있는 너비(장 너비를 12로 나눈 칸 수), 기본 너비, 고를 수 있는 모양
        panes: spec.panes ? { name: spec.panes.name, sides: spec.panes.sides, base: spec.panes.base, variants: spec.panes.variants ?? null } : null,
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
    // 강조색을 바꾸자고 할 때는 여기서 고른다. 짝으로 맞춰 본 색이라 아무 색보다 잘 어울린다
    accents: ACCENT_COMBOS.map((c) => ({ name: c.name, accent: c.accent.toLowerCase() })),
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
        looks: looksFor(type),
        variants: (spec.variants ?? [{ id: 'base', name: spec.name }]).map((v) => ({ id: v.id, name: v.name })),
        highlight: (spec.layout && LAYOUTS[spec.layout].highlight?.label) || null,
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
    // 부품 장의 짜임: 줄 수, 한 줄의 부품 수, 한 장의 부품 수, 한 줄에 고를 수 있는 너비 (12 기준)
    blockRules: { maxRows: MAX_ROWS, maxInRow: MAX_IN_ROW, maxBlocks: MAX_BLOCKS, spans: [1, 2, 3].map((n) => COMBOS[n]) },
    blockLooks: BLOCK_LOOKS.map((m) => ({ id: m.id, name: m.name })),
    blockEffects: BLOCK_EFFECTS.map((m) => ({ id: m.id, name: m.name, description: m.description })),
    // 부품 사이에 끼우는 표시: 같은 줄의 두 부품 사이(link) 또는 두 줄 사이(rowLinks)
    blockLinks: BLOCK_LINKS.map((m) => ({ id: m.id, name: m.name, description: m.description })),
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
    footer: footerOf(deck),
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
  // 두 판으로 나뉜 장: 옆 판의 자리와 너비 (고를 수 있는 값일 때만)
  const panes = LAYOUTS[slide.layout].panes
  if (panes) {
    options.flip = !!o.flip
    if (Number.isInteger(o.pane) && panes.sides.includes(o.pane as number)) options.pane = o.pane
  }
  if (slide.layout === 'imageText') options.contain = !!o.contain
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
    const rows = cleanRows(slide.rows)
    out.blocks = rows.map((r, ri) => {
      const spans = spansOf(r)
      return r.blocks.map((b, i) => {
        const sb = shapeBlock(b, spans[i])
        const link = linkAt(rows, { dir: 'h', row: ri, col: i })
        return link ? { ...sb, link } : sb
      })
    })
    if (weighted(rows)) out.rowGrow = rows.map((r) => r.grow!)
    const rowLinks = rows.slice(0, -1).map((_, i) => linkAt(rows, { dir: 'v', row: i }))
    if (rowLinks.some(Boolean)) out.rowLinks = rowLinks
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
  const out: ShapeBlock = { id: shapeBlockId(block), type: block.type, span, look: lookOf(block), effect: effectOf(block), variant: variantOfBlock(block), fields, items }
  if (spec.layout && LAYOUTS[spec.layout].highlight && Number.isInteger(block.highlight)) out.highlight = block.highlight
  return out
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
  if (!isObj(v) || !keysIn(v, ['id', 'type', 'span', 'look', 'effect', 'variant', 'highlight', 'link', 'fields', 'items'])) return false
  if (v.link !== undefined && !isLink(v.link)) return false
  if (v.id !== undefined && !(typeof v.id === 'string' && OPAQUE_ID.test(v.id) && v.id[0] === 'b')) return false
  if (v.highlight !== undefined && !isInt(v.highlight, -1, 20)) return false
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
  if (!keysIn(v, ['id', 'layout', 'role', 'section', 'hidden', 'hiddenItems', 'fields', 'items', 'options', 'variant', 'blocks', 'rowGrow', 'rowLinks'])) return false
  if (v.blocks !== undefined) {
    if (v.layout !== 'compose' || !Array.isArray(v.blocks) || v.blocks.length > MAX_ROWS) return false
    if (!v.blocks.every((r) => Array.isArray(r) && r.length >= 1 && r.length <= MAX_IN_ROW && r.every(checkBlock))) return false
    // 줄의 마지막 부품에는 오른쪽 이음표가 없다
    if (!v.blocks.every((r) => !(r as Record<string, unknown>[])[r.length - 1].link)) return false
  }
  if (v.rowLinks !== undefined) {
    if (!Array.isArray(v.blocks) || !Array.isArray(v.rowLinks) || v.rowLinks.length !== v.blocks.length - 1) return false
    if (!v.rowLinks.every((x) => x === null || isLink(x)) || !v.rowLinks.some(Boolean)) return false
  }
  if (v.rowGrow !== undefined) {
    if (!Array.isArray(v.blocks) || !Array.isArray(v.rowGrow) || v.rowGrow.length !== v.blocks.length || v.rowGrow.length < 2 || !v.rowGrow.every(isGrow)) return false
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
  if (!isObj(o) || !keysIn(o, ['highlight', 'flip', 'pane', 'contain', 'motion', 'tone'])) return false
  if (o.pane !== undefined && !isInt(o.pane, 1, 12)) return false
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
