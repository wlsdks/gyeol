// AI가 보내는 변경 요청. 모양만 바꿀 수 있고, 사람이 적은 글은 쓰지도 지우지도 못한다.
//
// - 칸의 글(fields, items의 글)을 쓰는 동작은 아예 없다.
// - 지우는 동작은 빈 장, 빈 항목만. 내용이 있는 장은 '발표에서 빼기'(숨기기)만 된다.
// - AI가 적을 수 있는 글은 세 가지뿐이고 모두 사람에게 보이는 안내다: 제안 설명, 장 안내, 칸 안내 문구.

import { BLUEPRINTS } from '../deck/blueprints'
import { emptyItem, makeSlide, withDefaultOptions } from '../deck/generate'
import { BOLD_LAYOUTS, LAYOUTS, variantIds, variantOf } from '../deck/layouts'
import { FONTS, FOOTERS, MOTIONS, TEXT_SIZES, THEME_ORDER, TONES, TRANSITIONS } from '../deck/themes'
import type { Deck, FontId, FooterMode, Item, ItemKey, LayoutId, Motion, Slide, TextSize, ThemeId, Tone, Transition } from '../deck/types'
import { shapeDeckId, shapeSlideId } from './share'

export const REQUEST_FORMAT = 'html-maker/request'
export const MAX_OPS = 40
export const NOTE_MAX = 300
export const GUIDE_MAX = 200
export const HINT_MAX = 80
export const ROLE_MAX = 24

/** 장을 가리키는 값: 모양 파일의 장 id(s로 시작) 또는 같은 요청에서 새로 만든 장의 이름(n1, n2...) */
type SlideRef = string

export type Op =
  | { op: 'add_slide'; after: SlideRef | null; layout?: LayoutId; role?: string; as?: string }
  | { op: 'remove_slide'; slide: SlideRef }
  | { op: 'move_slide'; slide: SlideRef; after: SlideRef | null }
  | { op: 'set_layout'; slide: SlideRef; layout: LayoutId; variant?: string }
  | { op: 'set_hidden'; slide: SlideRef; hidden: boolean }
  | { op: 'set_item_count'; slide: SlideRef; count: number }
  /** motion: null이면 발표 전체 설정을 따르게 되돌린다 */
  | { op: 'set_options'; slide: SlideRef; highlight?: number; flip?: boolean; contain?: boolean; motion?: Motion | null; tone?: Tone }
  /** font: null이면 테마의 글꼴로 */
  | {
      op: 'set_theme'
      theme?: ThemeId
      accent?: string | null
      motion?: Motion
      font?: FontId | null
      size?: TextSize
      footer?: FooterMode
      transition?: Transition
    }
  | { op: 'set_guide'; slide: SlideRef; text: string }
  | { op: 'set_hint'; slide: SlideRef; field: string; item?: number; text: string }

export type OpName = Op['op']
export const OP_NAMES: OpName[] = [
  'add_slide',
  'remove_slide',
  'move_slide',
  'set_layout',
  'set_hidden',
  'set_item_count',
  'set_options',
  'set_theme',
  'set_guide',
  'set_hint',
]

export interface ChangeRequest {
  format: typeof REQUEST_FORMAT
  version: 1
  id: string
  deck: string
  createdAt: number
  note: string
  ops: Op[]
}

/** 요청 하나하나의 결과. AI에게 돌려주는 말은 이 코드뿐이다. */
export type OpCode =
  | 'applied'
  | 'no_slide'
  | 'has_content'
  | 'out_of_range'
  | 'not_for_layout'
  | 'last_slide'
  | 'unknown_role'
  | 'no_change'
  | 'not_reviewed'

export interface OpResult {
  ok: boolean
  code: OpCode
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const REF = /^(s[0-9a-f]{8}|n[0-9]{1,2})$/
const NEW_REF = /^n[0-9]{1,2}$/
const HEX = /^#[0-9a-f]{6}$/i
const oneOf = (list: { id: string }[], v: unknown) => list.some((x) => x.id === v)
export const REQUEST_ID = /^r[0-9a-f]{12}$/

/** 한 줄 안내 글. 줄바꿈과 보이지 않는 제어 문자는 받지 않는다. */
function cleanText(v: unknown, max: number, multiline = false): string | null {
  if (typeof v !== 'string') return null
  const text = v.replace(/\r\n?/g, '\n').trim()
  if (!text || text.length > max) return null
  if (/[\u0000-\u0008\u000b-\u001f\u007f‪-‮⁦-⁩]/.test(text)) return null
  if (!multiline && text.includes('\n')) return null
  return text
}

function refOrNull(v: unknown): SlideRef | null | undefined {
  if (v === null) return null
  return typeof v === 'string' && REF.test(v) ? v : undefined
}

const only = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).every((k) => keys.includes(k))
const isLayout = (v: unknown): v is LayoutId => typeof v === 'string' && v in LAYOUTS

/** 정해진 꼴이 아니면 null. 모르는 키가 하나라도 있으면 받지 않는다. */
export function parseOp(v: unknown): Op | null {
  if (!isObj(v) || typeof v.op !== 'string') return null
  switch (v.op) {
    case 'add_slide': {
      if (!only(v, ['op', 'after', 'layout', 'role', 'as'])) return null
      const after = refOrNull(v.after ?? null)
      if (after === undefined) return null
      if (v.layout !== undefined && !isLayout(v.layout)) return null
      const role = v.role === undefined ? undefined : cleanText(v.role, ROLE_MAX)
      if (role === null) return null
      if (v.layout === undefined && role === undefined) return null
      if (v.as !== undefined && !(typeof v.as === 'string' && NEW_REF.test(v.as))) return null
      return { op: 'add_slide', after, layout: v.layout as LayoutId | undefined, role, as: v.as as string | undefined }
    }
    case 'remove_slide':
    case 'set_layout':
    case 'set_hidden':
    case 'set_item_count':
    case 'set_guide':
    case 'move_slide':
    case 'set_options':
    case 'set_hint': {
      const slide = refOrNull(v.slide)
      if (!slide) return null
      if (v.op === 'remove_slide') return only(v, ['op', 'slide']) ? { op: v.op, slide } : null
      if (v.op === 'set_layout') {
        if (!only(v, ['op', 'slide', 'layout', 'variant']) || !isLayout(v.layout)) return null
        if (v.variant !== undefined && !variantIds(v.layout).includes(v.variant as string)) return null
        return { op: v.op, slide, layout: v.layout, variant: v.variant as string | undefined }
      }
      if (v.op === 'set_hidden') {
        return only(v, ['op', 'slide', 'hidden']) && typeof v.hidden === 'boolean' ? { op: v.op, slide, hidden: v.hidden } : null
      }
      if (v.op === 'set_item_count') {
        return only(v, ['op', 'slide', 'count']) && Number.isInteger(v.count) && (v.count as number) >= 0 && (v.count as number) <= 20
          ? { op: v.op, slide, count: v.count as number }
          : null
      }
      if (v.op === 'set_guide') {
        const text = cleanText(v.text, GUIDE_MAX, true)
        return only(v, ['op', 'slide', 'text']) && text ? { op: v.op, slide, text } : null
      }
      if (v.op === 'move_slide') {
        const after = refOrNull(v.after ?? null)
        return only(v, ['op', 'slide', 'after']) && after !== undefined ? { op: v.op, slide, after } : null
      }
      if (v.op === 'set_options') {
        if (!only(v, ['op', 'slide', 'highlight', 'flip', 'contain', 'motion', 'tone'])) return null
        if (v.highlight !== undefined && !(Number.isInteger(v.highlight) && (v.highlight as number) >= -1 && (v.highlight as number) < 20)) return null
        if (v.flip !== undefined && typeof v.flip !== 'boolean') return null
        if (v.contain !== undefined && typeof v.contain !== 'boolean') return null
        if (v.motion !== undefined && v.motion !== null && !oneOf(MOTIONS, v.motion)) return null
        if (v.tone !== undefined && !oneOf(TONES, v.tone)) return null
        if ([v.highlight, v.flip, v.contain, v.motion, v.tone].every((x) => x === undefined)) return null
        return {
          op: v.op,
          slide,
          highlight: v.highlight as number | undefined,
          flip: v.flip as boolean | undefined,
          contain: v.contain as boolean | undefined,
          motion: v.motion as Motion | null | undefined,
          tone: v.tone as Tone | undefined,
        }
      }
      // set_hint
      if (!only(v, ['op', 'slide', 'field', 'item', 'text'])) return null
      const text = cleanText(v.text, HINT_MAX)
      if (!text || typeof v.field !== 'string' || !/^[a-zA-Z]{1,20}$/.test(v.field)) return null
      if (v.item !== undefined && !(Number.isInteger(v.item) && (v.item as number) >= 0 && (v.item as number) < 20)) return null
      return { op: 'set_hint', slide, field: v.field, item: v.item as number | undefined, text }
    }
    case 'set_theme': {
      if (!only(v, ['op', 'theme', 'accent', 'motion', 'font', 'size', 'footer', 'transition'])) return null
      if (v.theme !== undefined && !THEME_ORDER.includes(v.theme as ThemeId)) return null
      if (v.accent !== undefined && v.accent !== null && !(typeof v.accent === 'string' && HEX.test(v.accent))) return null
      if (v.motion !== undefined && !oneOf(MOTIONS, v.motion)) return null
      if (v.font !== undefined && v.font !== null && !oneOf(FONTS, v.font)) return null
      if (v.size !== undefined && !oneOf(TEXT_SIZES, v.size)) return null
      if (v.footer !== undefined && !oneOf(FOOTERS, v.footer)) return null
      if (v.transition !== undefined && !oneOf(TRANSITIONS, v.transition)) return null
      if ([v.theme, v.accent, v.motion, v.font, v.size, v.footer, v.transition].every((x) => x === undefined)) return null
      return {
        op: 'set_theme',
        theme: v.theme as ThemeId | undefined,
        accent: v.accent as string | null | undefined,
        motion: v.motion as Motion | undefined,
        font: v.font as FontId | null | undefined,
        size: v.size as TextSize | undefined,
        footer: v.footer as FooterMode | undefined,
        transition: v.transition as Transition | undefined,
      }
    }
    default:
      return null
  }
}

/** 요청 파일 전체를 확인한다. 하나라도 어긋나면 요청을 통째로 받지 않는다. */
export function parseRequest(v: unknown): ChangeRequest | null {
  if (!isObj(v) || !only(v, ['format', 'version', 'id', 'deck', 'createdAt', 'note', 'ops'])) return null
  if (v.format !== REQUEST_FORMAT || v.version !== 1) return null
  if (typeof v.id !== 'string' || !REQUEST_ID.test(v.id)) return null
  if (typeof v.deck !== 'string' || !/^d[0-9a-f]{8}$/.test(v.deck)) return null
  if (!Number.isInteger(v.createdAt)) return null
  const note = v.note === '' ? '' : cleanText(v.note, NOTE_MAX, true)
  if (note === null) return null
  if (!Array.isArray(v.ops) || !v.ops.length || v.ops.length > MAX_OPS) return null
  const ops = v.ops.map(parseOp)
  if (ops.some((o) => !o)) return null
  return { format: REQUEST_FORMAT, version: 1, id: v.id, deck: v.deck, createdAt: v.createdAt as number, note, ops: ops as Op[] }
}

// ---------- 적용 ----------

/** 보고 구성이 미리 넣는 이름표 (예상 위험, A안, 배경...). 사람이 적은 글로 치지 않는다. */
let prefilled: Set<string> | null = null
function prefilledWords(): Set<string> {
  if (!prefilled) {
    prefilled = new Set()
    for (const r of Object.values(BLUEPRINTS).flatMap((b) => b.recipes)) {
      Object.values(r.fields ?? {}).forEach((v) => prefilled!.add(v))
      r.prefill?.forEach((p) => Object.values(p).forEach((v) => v && prefilled!.add(v)))
    }
  }
  return prefilled
}

const blank = (v: string | undefined) => !(v ?? '').trim() || prefilledWords().has(v!.trim())
const itemEmpty = (it: Item) => (['title', 'body', 'value', 'meta', 'image'] as ItemKey[]).every((k) => blank(it[k]))

/** 사람이 적은 것이 하나도 없는 장인지. 노트도 내용이다. */
export function slideEmpty(slide: Slide): boolean {
  return Object.values(slide.fields).every(blank) && slide.items.every(itemEmpty) && !slide.notes.trim()
}

/** 보고 구성에 있는 역할이면 그 장의 안내와 미리 넣는 이름표까지 같이 쓴다. */
function recipeFor(deck: Deck, role: string) {
  const own = BLUEPRINTS[deck.meta.type]?.recipes ?? []
  const all = Object.values(BLUEPRINTS).flatMap((b) => b.recipes)
  return own.find((r) => r.purpose === role) ?? all.find((r) => r.purpose === role)
}

export interface Applied {
  deck: Deck
  results: OpResult[]
  /** 새로 생기거나 바뀐 장 (원래 id) */
  touched: Set<string>
  /** add_slide의 as 이름 → 새 장의 id */
  named: Map<string, string>
}

/** 요청을 차례로 덱에 적용한다. 되지 않는 것은 건너뛰고 이유를 남긴다. 덱은 고치지 않고 새로 만든다. */
export function applyOps(deck: Deck, ops: Op[]): Applied {
  let slides = deck.slides.map((s) => s)
  let theme = { ...deck.theme }
  let motion = deck.motion
  const named = new Map<string, string>()
  const touched = new Set<string>()

  const find = (ref: SlideRef): number => {
    const id = NEW_REF.test(ref) ? named.get(ref) : undefined
    if (id) return slides.findIndex((s) => s.id === id)
    const hits = slides.flatMap((s, i) => (shapeSlideId(s) === ref ? [i] : []))
    return hits.length === 1 ? hits[0] : -1
  }
  const put = (i: number, s: Slide) => {
    slides = slides.map((x, j) => (j === i ? s : x))
    touched.add(s.id)
  }

  const results = ops.map((op): OpResult => {
    const fail = (code: OpCode): OpResult => ({ ok: false, code })
    const done: OpResult = { ok: true, code: 'applied' }

    if (op.op === 'set_theme') {
      const next = { ...theme }
      if (op.theme) next.id = op.theme
      if (op.accent !== undefined) next.accent = op.accent === null ? undefined : op.accent.toLowerCase()
      if (op.font !== undefined) next.font = op.font ?? undefined
      if (op.size) next.size = op.size
      if (op.footer) next.footer = op.footer
      if (op.transition) next.transition = op.transition
      const nextMotion = op.motion ?? motion
      const same = (Object.keys({ ...theme, ...next }) as (keyof typeof next)[]).every((k) => theme[k] === next[k])
      if (same && (nextMotion ?? 'calm') === (motion ?? 'calm')) return fail('no_change')
      theme = next
      motion = nextMotion
      return done
    }

    if (op.op === 'add_slide') {
      let at = 0
      if (op.after !== null) {
        const i = find(op.after)
        if (i < 0) return fail('no_slide')
        at = i + 1
      }
      const recipe = op.role ? recipeFor(deck, op.role) : undefined
      const layout = op.layout ?? recipe?.layout
      if (!layout) return fail('unknown_role')
      const slide = makeSlide(layout, recipe && recipe.layout === layout ? recipe : { purpose: op.role ?? LAYOUTS[layout].name })
      const prev = slides[at - 1]
      if (prev && !recipe?.section) slide.section = prev.section
      slides = [...slides.slice(0, at), slide, ...slides.slice(at)]
      if (op.as) named.set(op.as, slide.id)
      touched.add(slide.id)
      return done
    }

    const i = find(op.slide)
    if (i < 0) return fail('no_slide')
    const s = slides[i]
    const spec = LAYOUTS[s.layout]

    switch (op.op) {
      case 'remove_slide':
        if (!slideEmpty(s)) return fail('has_content')
        if (slides.length <= 1) return fail('last_slide')
        slides = slides.filter((_, j) => j !== i)
        return done
      case 'move_slide': {
        const rest = slides.filter((_, j) => j !== i)
        let at = 0
        if (op.after !== null) {
          const target = rest.findIndex((x) => x.id === slides[find(op.after!)]?.id)
          if (target < 0) return fail('no_slide')
          at = target + 1
        }
        slides = [...rest.slice(0, at), s, ...rest.slice(at)]
        return done
      }
      case 'set_layout': {
        const variant = op.variant ?? (op.layout === s.layout ? variantOf(s) : variantIds(op.layout)[0])
        if (op.layout === s.layout && variant === variantOf(s)) return fail('no_change')
        const items = [...s.items]
        const next = LAYOUTS[op.layout].items
        if (next) while (items.length < next.min) items.push(emptyItem())
        const keep = variant === variantIds(op.layout)[0] ? undefined : variant
        put(i, { ...s, layout: op.layout, items, variant: keep, options: withDefaultOptions(op.layout, s.options, items.length) })
        return done
      }
      case 'set_hidden':
        if (!!s.hidden === op.hidden) return fail('no_change')
        put(i, { ...s, hidden: op.hidden })
        return done
      case 'set_item_count': {
        if (!spec.items) return fail('not_for_layout')
        if (op.count < spec.items.min || op.count > spec.items.max) return fail('out_of_range')
        const visible = Math.min(s.items.length, spec.items.max)
        if (op.count === visible) return fail('no_change')
        const items = [...s.items]
        if (op.count > visible) {
          items.splice(visible, 0, ...Array.from({ length: op.count - visible }, emptyItem))
        } else {
          const cut = items.slice(op.count, visible)
          if (!cut.every(itemEmpty)) return fail('has_content')
          items.splice(op.count, visible - op.count)
        }
        put(i, { ...s, items })
        return done
      }
      case 'set_options': {
        const options = { ...s.options }
        if (op.highlight !== undefined) {
          if (!spec.highlight) return fail('not_for_layout')
          if (op.highlight >= Math.min(s.items.length, spec.items?.max ?? 0)) return fail('out_of_range')
          options.highlight = op.highlight
        }
        if (op.flip !== undefined || op.contain !== undefined) {
          if (s.layout !== 'imageText') return fail('not_for_layout')
          if (op.flip !== undefined) options.flip = op.flip
          if (op.contain !== undefined) options.contain = op.contain
        }
        if (op.motion !== undefined) options.motion = op.motion ?? undefined
        if (op.tone !== undefined) {
          // 색 면 장(표지, 섹션, 마지막 장)은 바탕을 바꾸지 않는다
          if (BOLD_LAYOUTS.includes(s.layout)) return fail('not_for_layout')
          options.tone = op.tone === 'base' ? undefined : op.tone
        }
        put(i, { ...s, options })
        return done
      }
      case 'set_guide':
        put(i, { ...s, guide: op.text })
        return done
      case 'set_hint': {
        if (op.item === undefined && spec.fields.some((f) => f.key === op.field && !f.key.startsWith('$') && !f.image)) {
          put(i, { ...s, hints: { ...s.hints, [op.field]: op.text } })
          return done
        }
        const itemField = spec.items?.fields.find((f) => f.key === op.field && !f.image)
        if (!itemField) return fail('not_for_layout')
        if (op.item !== undefined && op.item >= Math.min(s.items.length, spec.items!.max)) return fail('out_of_range')
        const key = op.item === undefined ? `items.${op.field}` : `items.${op.item}.${op.field}`
        put(i, { ...s, hints: { ...s.hints, [key]: op.text } })
        return done
      }
    }
  })

  return { deck: { ...deck, theme, motion, slides }, results, touched, named }
}

/** 요청이 이 덱을 향한 것인지 */
export const requestFor = (deck: Deck, request: Pick<ChangeRequest, 'deck'>) => request.deck === shapeDeckId(deck)

/** 다음 요청 id */
export function requestId(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return `r${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}
