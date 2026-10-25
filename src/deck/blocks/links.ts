// 부품 사이의 이음표(화살표, 더하기, 결과, 견주기)와, 발표할 때 빈 부품을 빼고 그리는 판.
// 이음표는 부품의 오른쪽 선(link)이나 아래 선(linkBelow) 위, 그 부품의 가운데에 선다

import type { Block, BlockLink, BlockType } from '../types'
import { BOARD_COLS, BOARD_ROWS, type Fit, LOOSE, removeFromBoard } from './board'
import { BLOCKS } from './catalog'

export const BLOCK_LINKS: { id: BlockLink; name: string; description: string }[] = [
  { id: 'arrow', name: '화살표', description: '앞의 것이 뒤의 것으로 이어지거나 바뀌어요' },
  { id: 'plus', name: '더하기', description: '두 가지를 함께 해요' },
  { id: 'equals', name: '결과', description: '앞의 것이 모여 뒤의 것이 돼요' },
  { id: 'versus', name: '견주기', description: '두 가지를 맞대어 견줘요' },
]
export const BLOCK_LINK_IDS = BLOCK_LINKS.map((l) => l.id)

/** 이음표가 선 선 양쪽에서 부품이 비켜 주는 너비 (캔버스 px). 위아래는 칸 사이(48)와 합쳐 96px에 이음표(44)가 혼자 선다 */
export const LINK_PAD = 24

export const isLink = (v: unknown): v is BlockLink => typeof v === 'string' && (BLOCK_LINK_IDS as string[]).includes(v)

/** 이음표 자리: 부품(id)의 오른쪽 선(h) 또는 아래 선(v) */
export type LinkTarget = { id: string; dir: 'h' | 'v' }

export const sameLinkTarget = (a: LinkTarget | null | undefined, b: LinkTarget | null | undefined) => !!a && !!b && a.id === b.id && a.dir === b.dir

/** 부품의 그 쪽 선이 판 안쪽인지 (오른쪽 끝, 맨 아래 부품의 바깥 선에는 이음표가 서지 않는다) */
const inner = (b: Block, dir: 'h' | 'v') => !!b.at && (dir === 'h' ? b.at.x + b.at.w < BOARD_COLS : b.at.y + b.at.h < BOARD_ROWS)

/** 선 건너편에서 맞닿은 부품들 (오른쪽 선이면 오른쪽 이웃, 아래 선이면 아래 이웃) */
export function across(blocks: readonly Block[], b: Block, dir: 'h' | 'v'): Block[] {
  const a = b.at
  if (!a) return []
  return blocks.filter((o) => {
    const c = o.at
    if (!c || o.id === b.id) return false
    return dir === 'h' ? c.x === a.x + a.w && c.y < a.y + a.h && a.y < c.y + c.h : c.y === a.y + a.h && c.x < a.x + a.w && a.x < c.x + c.w
  })
}

/** 선 이쪽에서 맞닿은 부품들 (across의 거꾸로: 이 부품의 왼쪽이나 위에 있는 이웃) */
export function behind(blocks: readonly Block[], b: Block, dir: 'h' | 'v'): Block[] {
  return blocks.filter((o) => o.id !== b.id && across(blocks, o, dir).some((x) => x.id === b.id))
}

/** 그 자리의 이음표. 판 바깥 선에는 없다 */
export function linkAt(blocks: readonly Block[], t: LinkTarget): BlockLink | null {
  const b = blocks.find((x) => x.id === t.id)
  if (!b || !inner(b, t.dir)) return null
  const v = t.dir === 'h' ? b.link : b.linkBelow
  return isLink(v) ? v : null
}

/** 이음표를 놓을 수 있는 모든 자리 (읽는 차례대로): 부품마다 오른쪽 선과 아래 선 가운데 판 안쪽인 것 */
export function linkTargets(blocks: readonly Block[]): LinkTarget[] {
  const out: LinkTarget[] = []
  for (const b of [...blocks].sort((p, q) => (p.at?.y ?? 0) - (q.at?.y ?? 0) || (p.at?.x ?? 0) - (q.at?.x ?? 0))) {
    if (inner(b, 'h')) out.push({ id: b.id, dir: 'h' })
    if (inner(b, 'v')) out.push({ id: b.id, dir: 'v' })
  }
  return out
}

/** 그 자리에 이음표를 놓은(link가 null이면 뺀) 판 */
export function withLink(blocks: Block[], t: LinkTarget, link: BlockLink | null): Block[] {
  const key = t.dir === 'h' ? 'link' : 'linkBelow'
  return blocks.map((b) => {
    if (b.id !== t.id) return b
    const { [key]: _, ...rest } = b
    return link ? { ...rest, [key]: link } : rest
  })
}

/** 설 자리가 없어진 이음표(판 바깥 선 위)를 뺀다. 부품을 옮기거나 빼면 생긴다. 바뀐 것이 없으면 그대로 */
export function tidyLinks(blocks: Block[]): Block[] {
  if (!blocks.some((b) => (b.link && !inner(b, 'h')) || (b.linkBelow && !inner(b, 'v')))) return blocks
  return blocks.map((b) => {
    let out = b
    if (b.link && !inner(b, 'h')) {
      const { link: _, ...rest } = out
      out = rest
    }
    if (b.linkBelow && !inner(b, 'v')) {
      const { linkBelow: _, ...rest } = out
      out = rest
    }
    return out
  })
}

/**
 * 이음표마다 뜻이 서는 짝. 화살표(이어진다, 바뀐다)와 견주기, 더하기는 같은 갈래의 것끼리:
 * 숫자에서 숫자로, 목록과 목록, 차트와 차트. 결과(=)는 무엇이든 모여 숫자나 한마디가 된다.
 * 진행 막대와 시장 원을 견주거나, 와플에서 화면 캡처로 화살표를 그으면 무엇을 말하는지 알 수 없다
 */
type Kind = 'number' | 'words' | 'list' | 'chart' | 'flow' | 'table' | 'image'
const KINDS: Record<Kind, BlockType[]> = {
  number: ['number', 'delta', 'goal', 'ring', 'ratio', 'spark', 'stat', 'meter', 'range', 'tiles', 'kpi'],
  words: ['message', 'text', 'callout', 'quote', 'heading', 'note', 'summary'],
  list: ['bullets', 'points', 'facts', 'risks', 'faq', 'checks', 'people', 'status', 'date', 'agenda'],
  chart: ['bars', 'bridge', 'trend', 'versus', 'share', 'funnel', 'pareto', 'attain', 'diverge', 'stack', 'heat', 'sparks', 'market', 'split', 'merge', 'scorecard', 'progress'],
  flow: ['flow', 'network', 'process', 'timeline', 'gantt', 'steps'],
  table: ['table', 'compare', 'pricing', 'rating', 'matrix', 'position', 'swot'],
  image: ['image', 'logos'],
}
export const kindOf = (type: BlockType): Kind | null => (Object.keys(KINDS) as Kind[]).find((k) => KINDS[k].includes(type)) ?? null

/** 이 이음표로 이 두 부품(앞 → 뒤)을 이을 수 있는지. 숫자와 한마디는 결과(=)와 화살표로 무엇이든 받는다 */
export function linkFits(link: BlockLink, from: BlockType, to: BlockType): boolean {
  const a = kindOf(from)
  const b = kindOf(to)
  const result = b === 'number' || b === 'words'
  if (link === 'equals') return result
  if (link === 'arrow') return a === b || result
  return a === b
}

/** 그 자리에 이 이음표를 놓을 수 없는 까닭: 선 건너편의 어떤 부품과도 뜻이 서지 않으면 그 둘. 놓을 수 있으면 null */
export function linkIssue(blocks: readonly Block[], t: LinkTarget, link: BlockLink): { from: BlockType; to: BlockType } | null {
  const b = blocks.find((x) => x.id === t.id)
  if (!b || !BLOCKS[b.type]) return null
  const next = across(blocks, b, t.dir)
  if (!next.length || next.some((o) => linkFits(link, b.type, o.type))) return null
  return { from: b.type, to: next[0].type }
}

/** 사람이 아무것도 적지 않은 부품: 칸의 글, 항목의 글, 그림이 모두 비었다 */
export function blockIsBlank(b: Block): boolean {
  const blank = (v: unknown) => typeof v !== 'string' || !v.trim()
  return Object.values(b.fields).every(blank) && b.items.every((it) => (['title', 'body', 'value', 'meta', 'image'] as const).every((k) => blank(it[k])))
}

/**
 * 부품을 뺀 판(removeFromBoard)에 이음표 정리까지: 뺀 부품에 닿아 있던 이음표는 뗀다.
 * 그대로 두면 옆 부품이 넓어져 다른 두 부품 사이에 서서 뜻이 바뀐다
 */
export function dropBlock(blocks: Block[], id: string, fit: Fit): Block[] {
  const gone = blocks.find((b) => b.id === id)
  if (!gone) return blocks
  const unlinkH = new Set(behind(blocks, gone, 'h').map((b) => b.id))
  const unlinkV = new Set(behind(blocks, gone, 'v').map((b) => b.id))
  const cut = blocks.map((b) => {
    let out = b
    if (unlinkH.has(b.id) && b.link) {
      const { link: _, ...rest } = out
      out = rest
    }
    if (unlinkV.has(b.id) && b.linkBelow) {
      const { linkBelow: _, ...rest } = out
      out = rest
    }
    return out
  })
  return tidyLinks(removeFromBoard(cut, id, fit))
}

/**
 * 발표할 때 그리는 판: 비워 둔 부품은 빼고, 옆 부품이 그 자리를 넓혀 덮는다. 편집할 때 옆에 둔 빈 부품이
 * 발표 화면에 구멍으로 남지 않게. 자리만 넓히므로(남은 부품은 커지기만 한다) 크기 규칙 없이 나눈다
 */
export function shownBlocks(blocks: Block[]): Block[] {
  if (!blocks.some(blockIsBlank)) return blocks
  let out = blocks
  for (const b of blocks) if (blockIsBlank(b)) out = dropBlock(out, b.id, LOOSE)
  return out
}
