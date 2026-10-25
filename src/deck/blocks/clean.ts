// 파일에서 읽은 부품 장 바로잡기: 정해진 꼴로 맞추고, 모르는 부품은 빼되 글은 지우지 않는다

import { uid } from '../generate'
import type { Block, BlockEffect, BlockFrom, BlockLook, BlockRow, BlockSpeed, BlockType, BlockWhen, Item, Slide } from '../types'
import { BLOCK_EFFECT_IDS, BLOCK_FROM_IDS, BLOCK_LOOK_IDS, BLOCK_SPEED_IDS, BLOCK_TYPES, BLOCK_WHEN_IDS, BLOCKS } from './catalog'
import { isLink, tidyLinks } from './links'
import { MAX_BLOCKS, MAX_IN_ROW, MAX_ROWS } from './rules'
import { isGrow, spanChoices } from './sizing'

const ITEM_KEYS = ['title', 'body', 'value', 'meta', 'image'] as const
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const strings = (v: unknown): Record<string, string> =>
  isRecord(v) ? Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string')) : {}

/** 이 버전이 아는 줄과 부품의 값. 이 밖의 값은 새 버전에서 더한 것이라, 예전 버전이 고치면 빠진다 */
const ROW_KEYS = ['id', 'blocks', 'spans', 'grow', 'link']
const BLOCK_KEYS = ['id', 'type', 'fields', 'items', 'hints', 'look', 'effect', 'when', 'speed', 'from', 'variant', 'highlight', 'link']

/**
 * 가져온 파일이나 예전 저장본의 줄과 부품을 정해진 꼴로 맞춘다. 모르는 부품은 빼고, 개수는 정한 만큼만.
 * 글은 지우지 않는다: 꼴이 맞지 않는 값만 버린다. 그래서 몇 번을 거쳐도 결과가 같다.
 * lost를 주면 버린 것 중 사람이 넣었을 것(이 버전이 모르는 부품, 모양, 움직임, 칸과 정한 개수를 넘는 부품)을 센다.
 * 새 버전에서 만든 발표를 이 버전이 알아보는 데 쓴다 (compat.ts)
 */
export function cleanRows(rows: unknown, lost?: { n: number }): BlockRow[] {
  if (!Array.isArray(rows)) return []
  const drop = (n = 1) => lost && (lost.n += n)
  let left = MAX_BLOCKS
  const out: BlockRow[] = []
  for (const r of rows) {
    if (!isRecord(r) || !Array.isArray(r.blocks)) continue
    if (out.length >= MAX_ROWS) {
      drop(r.blocks.length)
      continue
    }
    const blocks: Block[] = []
    for (const b of r.blocks) {
      if (!isRecord(b) || typeof b.id !== 'string') continue
      if (blocks.length >= MAX_IN_ROW || left <= 0 || !(BLOCK_TYPES as unknown[]).includes(b.type)) {
        drop()
        continue
      }
      const type = b.type as BlockType
      const items = Array.isArray(b.items)
        ? b.items.filter(isRecord).map((it) => {
            const item = { id: typeof it.id === 'string' ? it.id : uid() } as Item
            for (const k of ITEM_KEYS) item[k] = typeof it[k] === 'string' ? (it[k] as string) : ''
            drop(Object.keys(it).filter((k) => k !== 'id' && !(ITEM_KEYS as readonly string[]).includes(k)).length)
            return item
          })
        : []
      const block: Block = { id: b.id, type, fields: strings(b.fields), items }
      if (isRecord(b.hints)) block.hints = strings(b.hints)
      if ((BLOCK_LOOK_IDS as unknown[]).includes(b.look)) block.look = b.look as BlockLook
      else if (b.look !== undefined) drop()
      if ((BLOCK_EFFECT_IDS as unknown[]).includes(b.effect)) block.effect = b.effect as BlockEffect
      else if (b.effect !== undefined) drop()
      if ((BLOCK_WHEN_IDS as unknown[]).includes(b.when)) block.when = b.when as BlockWhen
      else if (b.when !== undefined) drop()
      if ((BLOCK_SPEED_IDS as unknown[]).includes(b.speed)) block.speed = b.speed as BlockSpeed
      else if (b.speed !== undefined) drop()
      if ((BLOCK_FROM_IDS as unknown[]).includes(b.from)) block.from = b.from as BlockFrom
      else if (b.from !== undefined) drop()
      if (typeof b.variant === 'string' && BLOCKS[type].variants?.some((v) => v.id === b.variant)) block.variant = b.variant
      else if (b.variant !== undefined) drop()
      if (Number.isInteger(b.highlight)) block.highlight = b.highlight as number
      if (isLink(b.link)) block.link = b.link
      else if (b.link !== undefined) drop()
      drop(Object.keys(b).filter((k) => !BLOCK_KEYS.includes(k)).length)
      blocks.push(block)
      left--
    }
    if (!blocks.length) continue
    const row: BlockRow = { id: typeof r.id === 'string' ? r.id : uid(), blocks }
    if (Array.isArray(r.spans) && r.spans.length === blocks.length && r.spans.every((n) => Number.isInteger(n))) {
      // 정해진 비율이 아니면 버리고 기본 비율로
      if (spanChoices(row).some((c) => c.join() === (r.spans as number[]).join())) row.spans = r.spans as number[]
    }
    if (isGrow(r.grow)) row.grow = r.grow
    else if (typeof r.grow === 'number') drop()
    if (isLink(r.link)) row.link = r.link
    else if (r.link !== undefined) drop()
    drop(Object.keys(r).filter((k) => !ROW_KEYS.includes(k)).length)
    out.push(row)
  }
  return tidyLinks(out)
}

/**
 * 발표를 열 때: 부품 장의 줄을 바로잡는다. 부품 장에서 다른 레이아웃으로 바꾼 장도 줄을 남겨 둔다
 * (부품 장으로 되돌리면 다시 보이게. 사람이 적은 글을 버리지 않는다)
 */
export function cleanDeckRows<T extends { slides: Slide[] }>(deck: T): T {
  if (!deck.slides.some((s) => s.layout === 'compose' || s.rows !== undefined)) return deck
  return { ...deck, slides: deck.slides.map((s) => (s.layout === 'compose' || s.rows !== undefined ? { ...s, rows: cleanRows(s.rows) } : s)) }
}

/**
 * 그릴 수 있는 부품만. 새 버전에서 만든 발표의 모르는 부품은 그리지 않는다
 * (그런 발표는 편집기가 열지 않지만, 내 발표 목록의 작은 그림은 그린다)
 */
export function knownRows(rows: BlockRow[]): BlockRow[] {
  const known = (b: Block) => BLOCK_TYPES.includes(b.type)
  if (rows.every((r) => r.blocks.every(known))) return rows
  return rows.map((r) => ({ ...r, blocks: r.blocks.filter(known), spans: undefined })).filter((r) => r.blocks.length)
}
