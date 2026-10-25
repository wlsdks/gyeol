// 부품 사이의 이음표(화살표, 같다, vs)와, 발표할 때 빈 부품을 빼고 그리는 줄

import type { Block, BlockLink, BlockRow } from '../types'
import { asCell, membersOf } from './cells'

export const BLOCK_LINKS: { id: BlockLink; name: string; description: string }[] = [
  { id: 'arrow', name: '화살표', description: '앞의 것이 뒤의 것으로 이어지거나 바뀌어요' },
  { id: 'plus', name: '더하기', description: '두 가지를 함께 해요' },
  { id: 'equals', name: '결과', description: '앞의 것이 모여 뒤의 것이 돼요' },
  { id: 'versus', name: '견주기', description: '두 가지를 맞대어 견줘요' },
]
export const BLOCK_LINK_IDS = BLOCK_LINKS.map((l) => l.id)

/** 이음표가 선 칸 사이에서 양쪽 칸이 비켜 주는 너비 (캔버스 px). 칸 사이(48)와 합쳐 96px에 이음표(44)가 혼자 선다 */
export const LINK_PAD = 24

export const isLink = (v: unknown): v is BlockLink => typeof v === 'string' && (BLOCK_LINK_IDS as string[]).includes(v)

/** 이음표 자리: h는 row째 줄의 col째 칸과 그 오른쪽 칸 사이, v는 row째 줄과 그 아래 줄 사이 */
export type LinkTarget = { dir: 'h'; row: number; col: number } | { dir: 'v'; row: number }

export const sameLinkTarget = (a: LinkTarget | null, b: LinkTarget | null) =>
  !!a && !!b && a.dir === b.dir && a.row === b.row && (a.dir === 'v' || (b.dir === 'h' && a.col === b.col))

/** 그 자리의 이음표. 줄의 마지막 칸 뒤, 마지막 줄 아래에는 없다 */
export function linkAt(rows: BlockRow[], t: LinkTarget): BlockLink | null {
  const row = rows[t.row]
  if (!row) return null
  if (t.dir === 'v') return t.row < rows.length - 1 && isLink(row.link) ? row.link : null
  const b = row.blocks[t.col]
  return b && t.col < row.blocks.length - 1 && isLink(b.link) ? b.link : null
}

/** 이음표를 놓을 수 있는 모든 자리: 한 줄 안의 칸 사이, 줄 사이 */
export function linkTargets(rows: BlockRow[]): LinkTarget[] {
  const out: LinkTarget[] = []
  rows.forEach((r, i) => {
    for (let c = 0; c < r.blocks.length - 1; c++) out.push({ dir: 'h', row: i, col: c })
    if (i < rows.length - 1) out.push({ dir: 'v', row: i })
  })
  return out
}

/** 그 자리에 이음표를 놓은(link가 null이면 뺀) 줄들 */
export function withLink(rows: BlockRow[], t: LinkTarget, link: BlockLink | null): BlockRow[] {
  return rows.map((r, i) => {
    if (i !== t.row) return r
    if (t.dir === 'v') {
      const { link: _, ...rest } = r
      return link ? { ...rest, link } : rest
    }
    return {
      ...r,
      blocks: r.blocks.map((b, c) => {
        if (c !== t.col) return b
        const { link: _, ...rest } = b
        return link ? { ...rest, link } : rest
      }),
    }
  })
}

/**
 * 설 자리가 없어진 이음표(줄의 마지막 칸 뒤, 마지막 줄 아래, 칸 아래에 쌓은 부품)를 뺀다. 부품을 옮기거나 빼면 생긴다.
 * 바뀐 것이 없으면 그대로
 */
export function tidyLinks(rows: BlockRow[]): BlockRow[] {
  const stacked = rows.some((r) => r.blocks.some((b) => b.stack?.some((m) => m.link || m.stack)))
  if (stacked) rows = rows.map((r) => ({ ...r, blocks: r.blocks.map((b) => (b.stack ? asCell(membersOf(b), b.link) : b)) }))
  const stray = rows.some((r, i) => (r.link && i === rows.length - 1) || r.blocks.some((b, c) => b.link && c === r.blocks.length - 1))
  if (!stray) return rows
  return rows.map((r, i) => {
    const { link, ...rest } = r
    const blocks = r.blocks.map((b, c) => {
      if (!b.link || c < r.blocks.length - 1) return b
      const { link: _, ...bare } = b
      return bare
    })
    return { ...(link && i < rows.length - 1 ? { ...rest, link } : rest), blocks }
  })
}

/** 사람이 아무것도 적지 않은 부품: 칸의 글, 항목의 글, 그림이 모두 비었다 (그 부품 하나만. 쌓은 부품은 따로 본다) */
export function blockIsBlank(b: Block): boolean {
  const blank = (v: unknown) => typeof v !== 'string' || !v.trim()
  return Object.values(b.fields).every(blank) && b.items.every((it) => (['title', 'body', 'value', 'meta', 'image'] as const).every((k) => blank(it[k])))
}

/** 칸에 쌓은 부품이 모두 비었다 */
const cellIsBlank = (cell: Block) => membersOf(cell).every(blockIsBlank)

/**
 * 발표할 때 그리는 줄: 비워 둔 부품은 빼고, 남은 부품이 그 줄을 나눠 쓴다(고른 칸 너비는 부품 수가 바뀌면 다시 고른다).
 * 편집할 때 옆에 둔 빈 부품이 발표 화면에 구멍으로 남지 않게. 뺀 부품에 닿아 있던 이음표도 뗀다:
 * 그대로 두면 다른 두 부품 사이에 서서 뜻이 바뀐다
 */
export function shownRows(rows: BlockRow[]): BlockRow[] {
  if (!rows.some((r) => r.blocks.some((c) => membersOf(c).some(blockIsBlank)))) return rows
  const unlink = <T extends { link?: BlockLink }>(x: T): T => {
    const { link: _, ...bare } = x
    return bare as T
  }
  const out: BlockRow[] = []
  for (const r of rows) {
    const blocks: Block[] = []
    let changed = false
    for (const b of r.blocks) {
      // 빈 칸의 이음표(오른쪽과 잇던 것)는 칸과 함께 빠지고, 왼쪽 칸이 이 칸과 잇던 이음표는 뗀다
      if (cellIsBlank(b)) {
        if (blocks.length) blocks[blocks.length - 1] = unlink(blocks[blocks.length - 1])
        changed = true
        continue
      }
      // 쌓은 칸은 빈 부품만 빼고 남은 부품이 칸을 나눠 쓴다 (맨 위가 비면 그 아래가 맨 위가 되어 이음표를 받는다)
      const left = membersOf(b).filter((m) => !blockIsBlank(m))
      if (left.length === membersOf(b).length) blocks.push(b)
      else {
        blocks.push(asCell(left, b.link))
        changed = true
      }
    }
    if (!blocks.length) {
      // 줄이 통째로 빠지면 위 줄이 이 줄과 잇던 이음표도
      if (out.length) out[out.length - 1] = unlink(out[out.length - 1])
      continue
    }
    if (!changed) out.push(r)
    else if (blocks.length === r.blocks.length) out.push({ ...r, blocks })
    else {
      const { spans: _, ...rest } = r
      out.push({ ...rest, blocks })
    }
  }
  return tidyLinks(out)
}
