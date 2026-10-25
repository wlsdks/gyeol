// 내 컴포넌트: 사람이 조립해 둔 컴포넌트 하나, 한 줄, 장 하나를 저장해 두고 다른 장, 다른 발표에 다시 넣는다.
// 저장한 것은 발표 밖(이 PC의 브라우저와 보관 폴더, store/saved.ts)에 두고 AI에게 보내지 않는다.
// 발표에 넣은 뒤에는 보통 부품이라, AI 공유 모양에도 다른 부품처럼 고른 값만 들어간다.

import { makeSlide, uid } from '../generate'
import { MOTIONS, TONES, TRANSITIONS } from '../themes'
import type { Block, BlockRow, Motion, Slide, SlideOptions, Tone, Transition } from '../types'
import { BLOCKS } from './catalog'
import { allBlocks, blockCount } from './cells'
import { cleanRows } from './clean'
import { tidyLinks } from './links'
import { MAX_BLOCKS, MAX_ROWS } from './rules'

/** 무엇을 저장했는지: 컴포넌트 하나, 한 줄, 장 하나(제목 칸과 장 설정까지) */
export type SavedKind = 'block' | 'row' | 'slide'

export interface SavedPart {
  id: string
  /** 목록에 보이는 이름. 처음에는 컴포넌트 이름으로 지어 두고 사람이 바꾼다 */
  name: string
  kind: SavedKind
  rows: BlockRow[]
  /** 장 하나를 저장했을 때: 제목 칸과 장 설정(바탕, 움직임, 장 넘기기, 나오는 차례) */
  slide?: { fields: Record<string, string>; options: SlideOptions }
  /**
   * 컴포넌트 하나, 한 줄: 저장할 때 장에서 차지한 크기(캔버스 px). 목록의 작은 그림을 그때의 비율로 그린다.
   * 칸이 높이에 따라 짜임을 바꾸는 컴포넌트(숫자 여럿 같은)가 다른 높이로 그려지면 저장한 모습과 달라 보여서
   */
  size?: { w: number; h: number }
  savedAt: number
}

/** 이름은 이만큼만 (목록 카드 한 줄, 파일 안의 값) */
export const SAVED_NAME_MAX = 40

/** 장에 따라 가는 설정 가운데 부품 장이 쓰는 것 */
const SLIDE_OPTION_KEYS = ['tone', 'motion', 'transition', 'order'] as const

/** 줄과 부품의 깊은 복사 (저장한 것과 장의 것이 서로 바뀌지 않게) */
const cloneRows = (rows: BlockRow[]): BlockRow[] => structuredClone(rows)

/** 처음에 지어 두는 이름: 컴포넌트 이름들 (셋이 넘으면 앞의 둘과 '외 n') */
export function savedName(rows: BlockRow[]): string {
  const names = allBlocks(rows).map((b) => BLOCKS[b.type].name)
  const text = names.length > 3 ? `${names.slice(0, 2).join(' + ')} 외 ${names.length - 2}` : names.join(' + ')
  return text.slice(0, SAVED_NAME_MAX)
}

/**
 * 장에서 저장할 것을 떼어 낸다. block과 row는 그 부품(blockId)이 있는 자리에서, slide는 장 전체.
 * 줄 밖으로 이어지던 이음표(마지막 칸 뒤, 마지막 줄 아래)는 뗀다. 없는 부품이거나 부품 장이 아니면 null
 */
export function partFrom(slide: Slide, kind: SavedKind, blockId: string | null, size?: { w: number; h: number }): SavedPart | null {
  const rows = slide.layout === 'compose' ? (slide.rows ?? []) : []
  let picked: BlockRow[]
  if (kind === 'slide') picked = cloneRows(rows)
  else {
    const row = rows.find((r) => r.blocks.some((b) => b.id === blockId))
    const block = row?.blocks.find((b) => b.id === blockId)
    if (!row || !block) return null
    const { link: _, grow: __, ...bare } = row
    picked = kind === 'block' ? [{ id: uid(), blocks: [structuredClone(block)] }] : cloneRows([bare])
  }
  picked = tidyLinks(picked.map(({ link, ...r }, i) => (i < picked.length - 1 && link ? { ...r, link } : r)))
  if (!blockCount(picked)) return null
  const part: SavedPart = { id: uid(), name: savedName(picked), kind, rows: picked, savedAt: Date.now() }
  if (kind !== 'slide' && size && isSize(size)) part.size = { w: Math.round(size.w), h: Math.round(size.h) }
  if (kind === 'slide') {
    const options: SlideOptions = {}
    for (const k of SLIDE_OPTION_KEYS) if (slide.options[k] !== undefined) (options as Record<string, unknown>)[k] = structuredClone(slide.options[k])
    part.slide = { fields: { ...slide.fields }, options }
  }
  return part
}

/** 넣을 때마다 새 id (같은 것을 두 번 넣어도, 다른 발표에 넣어도 겹치지 않게). 옛 id → 새 id */
export function freshRows(rows: BlockRow[]): { rows: BlockRow[]; ids: Map<string, string> } {
  const ids = new Map<string, string>()
  const fresh = (b: Block): Block => {
    const id = uid()
    ids.set(b.id, id)
    return { ...structuredClone(b), id, items: b.items.map((it) => ({ ...it, id: uid() })) }
  }
  return { rows: rows.map((r) => ({ ...structuredClone(r), id: uid(), blocks: r.blocks.map(fresh) })), ids }
}

/** 장 하나를 저장한 것으로 새 부품 장을 만든다 (제목 칸과 장 설정까지, 나오는 차례는 새 id로) */
export function slideFromPart(part: SavedPart): Slide {
  const { rows, ids } = freshRows(part.rows)
  const slide = { ...makeSlide('compose'), rows }
  if (!part.slide) return slide
  const { order, ...options } = part.slide.options
  const mapped = order?.map((id) => ids.get(id)).filter((id): id is string => !!id)
  return { ...slide, fields: { ...slide.fields, ...part.slide.fields }, options: { ...slide.options, ...options, ...(mapped?.length ? { order: mapped } : {}) } }
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
/** 장 안에 들어가는 크기인지 (파일에는 아무 값이나 있을 수 있다) */
const isSize = (v: unknown): v is { w: number; h: number } =>
  isRecord(v) && typeof v.w === 'number' && typeof v.h === 'number' && v.w >= 100 && v.w <= 1920 && v.h >= 50 && v.h <= 1080
const oneOf = <T extends string>(list: { id: T }[], v: unknown): v is T => typeof v === 'string' && list.some((x) => x.id === v)

/**
 * 파일에서 읽은 내 컴포넌트 하나를 정해진 꼴로 맞춘다. 줄과 부품은 발표 파일과 같은 규칙(cleanRows)으로,
 * 모르는 값은 버린다(lost에 센다). 부품이 하나도 남지 않으면 null
 */
export function cleanPart(v: unknown, lost?: { n: number }): SavedPart | null {
  if (!isRecord(v)) return null
  const kind: SavedKind = v.kind === 'block' || v.kind === 'row' || v.kind === 'slide' ? v.kind : 'row'
  let rows = cleanRows(v.rows, lost)
  // 컴포넌트 하나, 한 줄이라고 적혀 있는데 더 많으면 장 하나로 읽는다 (그래도 넣는 규칙은 같다)
  const shape: SavedKind = kind === 'block' && blockCount(rows) > 1 ? 'row' : kind === 'row' && rows.length > 1 ? 'slide' : kind
  rows = rows.slice(0, MAX_ROWS)
  if (!blockCount(rows) || blockCount(rows) > MAX_BLOCKS) return null
  const name = typeof v.name === 'string' && v.name.trim() ? v.name.trim().slice(0, SAVED_NAME_MAX) : savedName(rows)
  const part: SavedPart = { id: uid(), name, kind: shape, rows, savedAt: typeof v.savedAt === 'number' && Number.isFinite(v.savedAt) ? v.savedAt : Date.now() }
  if (shape === kind && shape !== 'slide' && isSize(v.size)) part.size = { w: Math.round(v.size.w), h: Math.round(v.size.h) }
  if (shape === 'slide' && isRecord(v.slide)) {
    const fields = isRecord(v.slide.fields) ? Object.fromEntries(Object.entries(v.slide.fields).filter((e): e is [string, string] => typeof e[1] === 'string')) : {}
    const o = isRecord(v.slide.options) ? v.slide.options : {}
    const known = new Set(allBlocks(rows).map((b) => b.id))
    const options: SlideOptions = {}
    if (oneOf<Tone>(TONES, o.tone)) options.tone = o.tone
    if (oneOf<Motion>(MOTIONS, o.motion)) options.motion = o.motion
    if (oneOf<Transition>(TRANSITIONS, o.transition)) options.transition = o.transition
    if (Array.isArray(o.order)) {
      const order = [...new Set(o.order.filter((id): id is string => typeof id === 'string' && known.has(id)))]
      if (order.length) options.order = order
    }
    part.slide = { fields, options }
  }
  return part
}
