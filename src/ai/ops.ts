// AI가 보내는 변경 요청. 모양만 바꿀 수 있고, 사람이 적은 글은 쓰지도 지우지도 못한다.
//
// - 칸의 글(fields, items의 글)을 쓰는 동작은 아예 없다.
// - 지우는 동작은 빈 장, 빈 항목, 빈 부품만. 내용이 있는 장은 '발표에서 빼기'(숨기기)만 된다.
// - 부품 장도 모양은 바꿀 수 있다: 빈 부품 넣기, 부품 옮기기, 너비, 모양, 바탕, 움직임, 항목 수. 부품 안의 글은 그대로 따라간다.
// - AI가 적을 수 있는 글은 세 가지뿐이고 모두 사람에게 보이는 안내다: 제안 설명, 장 안내, 칸 안내 문구.

import {
  autoTarget,
  BLOCK_EFFECT_IDS,
  BLOCK_LOOK_IDS,
  BLOCK_TYPES,
  BLOCKS,
  blockItems,
  canCompose,
  changeRows,
  COMBOS,
  composeAreaH,
  composeFrom,
  effectOf,
  fitsHeight,
  insertAt,
  isGrow,
  isLink,
  linkAt,
  lookIssue,
  lookOf,
  makeBlock,
  MAX_ROWS,
  needH,
  removeBlock,
  sameTarget,
  spanChoices,
  spansOf,
  targetOf,
  unweighted,
  unwrapCompose,
  variantOfBlock,
  weighted,
  whyNot,
  withLink,
  withLook,
  type DropTarget,
  type LinkTarget,
} from '../deck/blocks'
import { BLUEPRINTS } from '../deck/blueprints'
import { emptyItem, makeSlide, withDefaultOptions } from '../deck/generate'
import { BOLD_LAYOUTS, LAYOUTS, LAYOUT_ORDER, variantIds, variantOf } from '../deck/layouts'
import { FONTS, FOOTERS, MOTIONS, TEXT_SIZES, THEME_ORDER, TONES, TRANSITIONS } from '../deck/themes'
import type { Block, BlockEffect, BlockLink, BlockLook, BlockRow, BlockType, Deck, FontId, FooterMode, Item, ItemKey, LayoutId, Motion, Slide, TextSize, ThemeId, Tone, Transition } from '../deck/types'
import { shapeBlockId, shapeDeckId, shapeSlideId } from './share'

export const REQUEST_FORMAT = 'html-maker/request'
export const MAX_OPS = 40
export const NOTE_MAX = 300
export const GUIDE_MAX = 200
export const HINT_MAX = 80
export const ROLE_MAX = 24

/** 장을 가리키는 값: 모양 파일의 장 id(s로 시작) 또는 같은 요청에서 새로 만든 장의 이름(n1, n2...) */
type SlideRef = string
/** 부품을 가리키는 값: 모양 파일의 부품 id(b로 시작) 또는 같은 요청에서 새로 넣은 부품의 이름(p1, p2...) */
type BlockRef = string

/**
 * 부품을 놓을 자리. row만 있으면 그 차례에 새 줄(0이 맨 위), beside가 있으면 그 부품의 줄에서 앞(before)이나 뒤(after).
 * 둘 다 없으면 편집기에서 '넣기'를 누를 때처럼 알아서 (마지막 줄 옆이나 아래)
 */
interface Place {
  row?: number
  beside?: BlockRef
  side?: 'before' | 'after'
}

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
  /** block이 있으면 부품 장의 그 부품 칸 */
  | { op: 'set_hint'; slide: SlideRef; block?: BlockRef; field: string; item?: number; text: string }
  /** 부품 장에 빈 부품 넣기 */
  | ({ op: 'add_block'; slide: SlideRef; type: BlockType; variant?: string; look?: BlockLook; effect?: BlockEffect; as?: string } & Place)
  /** 빈 부품만 뺀다 */
  | { op: 'remove_block'; slide: SlideRef; block: BlockRef }
  /** row나 beside 중 하나. row는 옮기는 부품을 뺀 뒤의 줄 차례로 센다 */
  | ({ op: 'move_block'; slide: SlideRef; block: BlockRef } & Place)
  /** count는 항목 수(줄일 때는 끝의 빈 항목만), highlight는 강조할 항목(-1은 없음) */
  | { op: 'set_block'; slide: SlideRef; block: BlockRef; variant?: string; look?: BlockLook; effect?: BlockEffect; count?: number; highlight?: number }
  /** 그 부품이 있는 줄의 칸 너비 (12 기준, 카탈로그 blockRules.spans 중 하나) */
  | { op: 'set_spans'; slide: SlideRef; block: BlockRef; spans: number[] }
  /** 부품 장의 줄 높이 비중 (1~100, 줄 수만큼 위에서부터). 빈 배열이면 똑같이 나눈다 */
  | { op: 'set_row_grow'; slide: SlideRef; grow: number[] }
  /**
   * 이음표(카탈로그 blockLinks): right는 그 부품과 같은 줄의 오른쪽 부품 사이, below는 그 부품의 줄과 아래 줄 사이.
   * link가 null이면 뺀다. 이음표는 글이 아니라 표시라서 사람이 적은 것을 바꾸지 않는다
   */
  | { op: 'set_link'; slide: SlideRef; block: BlockRef; side: 'right' | 'below'; link: BlockLink | null }

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
  'add_block',
  'remove_block',
  'move_block',
  'set_block',
  'set_spans',
  'set_row_grow',
  'set_link',
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
  | 'no_block'
  | 'no_room'
  /** 한 장에는 면 한 가지만: 진한 면은 하나, 진한 면과 옅은 면은 섞지 않고, 혼자 한 줄을 다 쓰는 작은 부품은 면 없이 */
  | 'look_clash'

export interface OpResult {
  ok: boolean
  code: OpCode
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const REF = /^(s[0-9a-f]{8}|n[0-9]{1,2})$/
const NEW_REF = /^n[0-9]{1,2}$/
const BLOCK_REF = /^(b[0-9a-f]{8}|p[0-9]{1,2})$/
const NEW_BLOCK = /^p[0-9]{1,2}$/
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
const isLayout = (v: unknown): v is LayoutId => typeof v === 'string' && LAYOUT_ORDER.includes(v as LayoutId)
const blockRef = (v: unknown): BlockRef | undefined => (typeof v === 'string' && BLOCK_REF.test(v) ? v : undefined)
const isInt = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max

/** 놓을 자리. 꼴이 틀리면 null, 없으면 빈 자리({}) */
function parsePlace(v: Record<string, unknown>): Place | null {
  if (v.row !== undefined && !isInt(v.row, 0, 3)) return null
  if (v.beside !== undefined && !blockRef(v.beside)) return null
  if (v.side !== undefined && v.side !== 'before' && v.side !== 'after') return null
  if (v.row !== undefined && v.beside !== undefined) return null
  if (v.side !== undefined && v.beside === undefined) return null
  return { row: v.row as number | undefined, beside: v.beside as string | undefined, side: v.side as Place['side'] }
}

/** 부품의 모양 값 (variant는 부품 종류를 알아야 확인할 수 있어서 적용할 때 본다) */
function parseLooks(v: Record<string, unknown>): boolean {
  if (v.variant !== undefined && !(typeof v.variant === 'string' && /^[a-z][a-zA-Z0-9]{0,23}$/.test(v.variant))) return false
  if (v.look !== undefined && !BLOCK_LOOK_IDS.includes(v.look as BlockLook)) return false
  if (v.effect !== undefined && !BLOCK_EFFECT_IDS.includes(v.effect as BlockEffect)) return false
  return true
}

function parseBlockOp(v: Record<string, unknown>): Op | null {
  const slide = refOrNull(v.slide)
  if (!slide) return null
  switch (v.op) {
    case 'add_block': {
      if (!only(v, ['op', 'slide', 'type', 'variant', 'look', 'effect', 'as', 'row', 'beside', 'side'])) return null
      if (!BLOCK_TYPES.includes(v.type as BlockType) || !parseLooks(v)) return null
      if (v.as !== undefined && !(typeof v.as === 'string' && NEW_BLOCK.test(v.as))) return null
      const place = parsePlace(v)
      if (!place) return null
      return {
        op: 'add_block',
        slide,
        type: v.type as BlockType,
        variant: v.variant as string | undefined,
        look: v.look as BlockLook | undefined,
        effect: v.effect as BlockEffect | undefined,
        as: v.as as string | undefined,
        ...place,
      }
    }
    case 'remove_block': {
      const block = blockRef(v.block)
      return only(v, ['op', 'slide', 'block']) && block ? { op: 'remove_block', slide, block } : null
    }
    case 'move_block': {
      const block = blockRef(v.block)
      if (!only(v, ['op', 'slide', 'block', 'row', 'beside', 'side']) || !block) return null
      const place = parsePlace(v)
      if (!place || (place.row === undefined && place.beside === undefined)) return null
      return { op: 'move_block', slide, block, ...place }
    }
    case 'set_block': {
      const block = blockRef(v.block)
      if (!only(v, ['op', 'slide', 'block', 'variant', 'look', 'effect', 'count', 'highlight']) || !block || !parseLooks(v)) return null
      if (v.count !== undefined && !isInt(v.count, 0, 20)) return null
      if (v.highlight !== undefined && !isInt(v.highlight, -1, 19)) return null
      if ([v.variant, v.look, v.effect, v.count, v.highlight].every((x) => x === undefined)) return null
      return {
        op: 'set_block',
        slide,
        block,
        variant: v.variant as string | undefined,
        look: v.look as BlockLook | undefined,
        effect: v.effect as BlockEffect | undefined,
        count: v.count as number | undefined,
        highlight: v.highlight as number | undefined,
      }
    }
    case 'set_spans': {
      const block = blockRef(v.block)
      if (!only(v, ['op', 'slide', 'block', 'spans']) || !block) return null
      if (!Array.isArray(v.spans) || v.spans.length < 1 || v.spans.length > 3 || !v.spans.every((x) => isInt(x, 1, 12))) return null
      return { op: 'set_spans', slide, block, spans: v.spans as number[] }
    }
    case 'set_link': {
      const block = blockRef(v.block)
      if (!only(v, ['op', 'slide', 'block', 'side', 'link']) || !block) return null
      if (v.side !== 'right' && v.side !== 'below') return null
      if (v.link !== null && !isLink(v.link)) return null
      return { op: 'set_link', slide, block, side: v.side, link: v.link as BlockLink | null }
    }
  }
  return null
}

/** 정해진 꼴이 아니면 null. 모르는 키가 하나라도 있으면 받지 않는다. */
export function parseOp(v: unknown): Op | null {
  if (!isObj(v) || typeof v.op !== 'string') return null
  switch (v.op) {
    case 'add_block':
    case 'remove_block':
    case 'move_block':
    case 'set_block':
    case 'set_spans':
    case 'set_link':
      return parseBlockOp(v)
    case 'set_row_grow': {
      const slide = refOrNull(v.slide)
      if (!only(v, ['op', 'slide', 'grow']) || !slide) return null
      if (!Array.isArray(v.grow) || v.grow.length > MAX_ROWS || !v.grow.every(isGrow)) return null
      return { op: 'set_row_grow', slide, grow: v.grow as number[] }
    }
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
      if (!only(v, ['op', 'slide', 'block', 'field', 'item', 'text'])) return null
      const text = cleanText(v.text, HINT_MAX)
      if (!text || typeof v.field !== 'string' || !/^[a-zA-Z]{1,20}$/.test(v.field)) return null
      if (v.item !== undefined && !(Number.isInteger(v.item) && (v.item as number) >= 0 && (v.item as number) < 20)) return null
      if (v.block !== undefined && !blockRef(v.block)) return null
      return { op: 'set_hint', slide, ...(v.block !== undefined ? { block: v.block as string } : {}), field: v.field, item: v.item as number | undefined, text }
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
/** 사람이 적은 것이 하나도 없는 부품인지. 숨은 항목(최대 개수 뒤)도 본다 */
const blockEmpty = (b: Block) => Object.values(b.fields).every(blank) && b.items.every(itemEmpty)
const blockVariantIds = (type: BlockType) => (BLOCKS[type].variants ?? [{ id: 'base' }]).map((v) => v.id)
const sameSpans = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i])
/** 바꾼 줄들이 장에 들어가지 않는데 바꾸기 전보다 높아지면 (이미 넘치던 장을 줄이는 것은 받는다) */
const grows = (before: BlockRow[], after: BlockRow[], areaH: number) => !fitsHeight(after, areaH) && needH(after) > needH(before)

/** 사람이 적은 것이 하나도 없는 장인지. 노트도 내용이다. */
export function slideEmpty(slide: Slide): boolean {
  // 부품 장의 부품에 적은 글도 사람이 적은 글이다. 부품이 하나라도 있으면 빈 장이 아니다
  const blocks = (slide.rows ?? []).flatMap((r) => r.blocks)
  return Object.values(slide.fields).every(blank) && slide.items.every(itemEmpty) && !slide.notes.trim() && !blocks.length
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
  /** add_block의 as 이름 → 새 부품의 id */
  const blockNamed = new Map<string, string>()

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
  /** 장 안의 부품. 모양 파일의 id가 둘 이상 맞으면 찾지 못한 것으로 친다 */
  const findBlock = (s: Slide, ref: BlockRef): Block | undefined => {
    const blocks = (s.rows ?? []).flatMap((r) => r.blocks)
    if (NEW_BLOCK.test(ref)) return blocks.find((b) => b.id === blockNamed.get(ref))
    const hits = blocks.filter((b) => shapeBlockId(b) === ref)
    return hits.length === 1 ? hits[0] : undefined
  }
  /** 놓을 자리. 알아서 고르면 null, 옆에 둘 부품이 없으면 'no_block' */
  const placeOf = (s: Slide, rows: BlockRow[], p: Place): DropTarget | null | 'no_block' => {
    if (p.row !== undefined) return { kind: 'row', index: p.row }
    if (p.beside === undefined) return null
    const next = findBlock(s, p.beside)
    for (let r = 0; next && r < rows.length; r++) {
      const c = rows[r].blocks.findIndex((b) => b.id === next.id)
      if (c >= 0) return { kind: 'cell', row: r, index: c + (p.side === 'before' ? 0 : 1) }
    }
    return 'no_block'
  }
  // 부품 장의 본문 높이: 잴 수 없으니 제목, 부제 길이와 발표 설정(글자 크기, 보내는 자료)으로 어림한다
  const areaOf = (s: Slide) => composeAreaH(s, { meta: deck.meta, theme })

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
        if (s.layout === 'compose' || op.layout === 'compose') {
          if (s.layout === op.layout) return fail('no_change')
          // 부품 장으로: 글을 하나도 버리지 않고 같은 모습의 부품으로 옮긴다 (표지, 단락 장은 안 된다)
          if (op.layout === 'compose') {
            if (!canCompose(s.layout)) return fail('not_for_layout')
            put(i, composeFrom(s))
            return done
          }
          // 부품 장에서: 그 레이아웃의 부품 하나뿐일 때만. 다른 부품이 있으면 되돌리면서 버리게 된다
          const back = unwrapCompose(s, op.layout)
          if (!back) return fail('not_for_layout')
          const variant = op.variant ?? variantOf(back)
          put(i, { ...back, variant: variant === variantIds(op.layout)[0] ? undefined : variant })
          return done
        }
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
      case 'add_block':
      case 'move_block': {
        if (s.layout !== 'compose') return fail('not_for_layout')
        const rows = s.rows ?? []
        const moving = op.op === 'move_block' ? findBlock(s, op.block) : undefined
        if (op.op === 'move_block' && !moving) return fail('no_block')
        let block: Block
        if (op.op === 'add_block') {
          if (op.variant !== undefined && !blockVariantIds(op.type).includes(op.variant)) return fail('not_for_layout')
          const variant = op.variant === blockVariantIds(op.type)[0] ? undefined : op.variant
          block = { ...makeBlock(op.type), ...(variant ? { variant } : {}), ...(op.look ? { look: op.look } : {}), ...(op.effect ? { effect: op.effect } : {}) }
        } else {
          // 옆 부품과 잇던 이음표는 두고 간다 (편집기에서 끌어 옮길 때와 같다)
          const { link: _, ...bare } = moving!
          block = bare
        }
        // 옮길 때는 편집기에서 끌 때처럼 부품을 뺀 줄들을 기준으로 자리를 센다
        const base = moving ? removeBlock(rows, moving.id) : rows
        const place = placeOf(s, base, op)
        if (place === 'no_block') return fail('no_block')
        if (place?.kind === 'row' && place.index > base.length) return fail('out_of_range')
        const area = areaOf(s)
        const target = place ?? autoTarget(base, block, area)
        if (!target) return fail('no_room')
        if (moving && sameTarget(targetOf(rows, moving.id), target)) return fail('no_change')
        if (whyNot(base, target, block, area)) return fail('no_room')
        const placed = insertAt(base, target, block)!
        // 장의 다른 면과 어긋나는 면은 넣을 때 바탕 없이 바뀐다. AI가 그 면을 골랐으면 알린다
        if (op.op === 'add_block' && op.look && placed.flatMap((r) => r.blocks).some((b) => b.id === block.id && lookOf(b) !== op.look)) return fail('look_clash')
        put(i, { ...s, rows: placed })
        if (op.op === 'add_block' && op.as) blockNamed.set(op.as, block.id)
        return done
      }
      case 'remove_block': {
        if (s.layout !== 'compose') return fail('not_for_layout')
        const b = findBlock(s, op.block)
        if (!b) return fail('no_block')
        if (!blockEmpty(b)) return fail('has_content')
        put(i, { ...s, rows: removeBlock(s.rows ?? [], b.id) })
        return done
      }
      case 'set_block': {
        if (s.layout !== 'compose') return fail('not_for_layout')
        const b = findBlock(s, op.block)
        if (!b) return fail('no_block')
        const bs = BLOCKS[b.type]
        const next: Block = { ...b }
        if (op.variant !== undefined) {
          const ids = blockVariantIds(b.type)
          if (!ids.includes(op.variant)) return fail('not_for_layout')
          next.variant = op.variant === ids[0] ? undefined : op.variant
        }
        if (op.look) {
          if (lookIssue(s.rows ?? [], b.id, op.look)) return fail('look_clash')
          next.look = op.look
        }
        if (op.effect) next.effect = op.effect
        if (op.count !== undefined) {
          if (!bs.items) return fail('not_for_layout')
          if (op.count < bs.items.min || op.count > bs.items.max) return fail('out_of_range')
          const visible = blockItems(b).length
          const items = [...b.items]
          if (op.count > visible) items.splice(visible, 0, ...Array.from({ length: op.count - visible }, emptyItem))
          else if (op.count < visible) {
            if (!items.slice(op.count, visible).every(itemEmpty)) return fail('has_content')
            items.splice(op.count, visible - op.count)
          }
          next.items = items
        }
        if (op.highlight !== undefined) {
          if (!bs.layout || !LAYOUTS[bs.layout].highlight) return fail('not_for_layout')
          if (op.highlight >= blockItems(next).length) return fail('out_of_range')
          next.highlight = op.highlight
        }
        const same =
          variantOfBlock(next) === variantOfBlock(b) && lookOf(next) === lookOf(b) && effectOf(next) === effectOf(b) && next.items.length === b.items.length && next.highlight === b.highlight
        if (same) return fail('no_change')
        const rows = s.rows ?? []
        const changed = changeRows(rows, b.id, () => next)
        // 옅은 면과 바탕 없음은 같은 줄의 부품이 함께 바뀐다 (편집기와 같은 규칙)
        const after = op.look ? withLook(changed, b.id, op.look) : changed
        if (grows(rows, after, areaOf(s))) return fail('no_room')
        put(i, { ...s, rows: after })
        return done
      }
      case 'set_spans': {
        if (s.layout !== 'compose') return fail('not_for_layout')
        const b = findBlock(s, op.block)
        if (!b) return fail('no_block')
        const rows = s.rows ?? []
        const r = rows.findIndex((x) => x.blocks.some((y) => y.id === b.id))
        const row = rows[r]
        if (!(COMBOS[row.blocks.length] ?? []).some((c) => sameSpans(c, op.spans))) return fail('out_of_range')
        if (sameSpans(spansOf(row), op.spans)) return fail('no_change')
        // 정해진 비율이라도 부품마다 가장 좁은 너비보다 좁아지면 넣을 수 없다
        if (!spanChoices(row).some((c) => sameSpans(c, op.spans))) return fail('no_room')
        const after = rows.map((x, j) => (j === r ? { ...x, spans: op.spans } : x))
        if (grows(rows, after, areaOf(s))) return fail('no_room')
        put(i, { ...s, rows: after })
        return done
      }
      case 'set_link': {
        if (s.layout !== 'compose') return fail('not_for_layout')
        const b = findBlock(s, op.block)
        if (!b) return fail('no_block')
        const rows = s.rows ?? []
        const row = rows.findIndex((x) => x.blocks.some((y) => y.id === b.id))
        const col = rows[row].blocks.findIndex((y) => y.id === b.id)
        const t: LinkTarget = op.side === 'right' ? { dir: 'h', row, col } : { dir: 'v', row }
        // 줄의 마지막 부품의 오른쪽, 마지막 줄의 아래에는 이음표가 설 데가 없다
        if (op.side === 'right' ? col >= rows[row].blocks.length - 1 : row >= rows.length - 1) return fail('out_of_range')
        if (linkAt(rows, t) === op.link) return fail('no_change')
        const after = withLink(rows, t, op.link)
        // 줄 사이의 이음표는 위아래 줄이 비켜 나는 만큼 높이가 더 든다
        if (grows(rows, after, areaOf(s))) return fail('no_room')
        put(i, { ...s, rows: after })
        return done
      }
      case 'set_row_grow': {
        if (s.layout !== 'compose') return fail('not_for_layout')
        const rows = s.rows ?? []
        if (!op.grow.length) {
          if (!weighted(rows)) return fail('no_change')
          put(i, { ...s, rows: unweighted(rows) })
          return done
        }
        if (rows.length < 2 || op.grow.length !== rows.length) return fail('out_of_range')
        if (weighted(rows) && rows.every((r, j) => r.grow === op.grow[j])) return fail('no_change')
        // 비중대로면 잘리는 줄은 격자가 잘리지 않을 높이로 묶는다. 그래서 글이 잘리지 않는다
        put(i, { ...s, rows: rows.map((r, j) => ({ ...r, grow: op.grow[j] })) })
        return done
      }
      case 'set_hint': {
        if (op.block !== undefined) {
          if (s.layout !== 'compose') return fail('not_for_layout')
          const b = findBlock(s, op.block)
          if (!b) return fail('no_block')
          const bs = BLOCKS[b.type]
          let key = op.field
          if (op.item !== undefined || !bs.fields.some((f) => f.key === op.field && !f.key.startsWith('$') && !f.image)) {
            if (!bs.items?.fields.some((f) => f.key === op.field && !f.image)) return fail('not_for_layout')
            if (op.item !== undefined && op.item >= blockItems(b).length) return fail('out_of_range')
            key = op.item === undefined ? `items.${op.field}` : `items.${op.item}.${op.field}`
          }
          put(i, { ...s, rows: changeRows(s.rows ?? [], b.id, (x) => ({ ...x, hints: { ...x.hints, [key]: op.text } })) })
          return done
        }
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
