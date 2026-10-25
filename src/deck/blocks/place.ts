// 넣기, 빼기, 옮기기, 놓을 자리(이미지는 비율에 맞는 자리)와 놓을 수 없는 까닭, 칸 너비 끌기

import { uid } from '../generate'
import type { Block, BlockRow, BlockType } from '../types'
import { BLOCKS } from './catalog'
import { allBlocks, asCell, blockCount, membersOf, placeOf } from './cells'
import { AREA_W, aspectOf, fitImage, misfit } from './images'
import { tidyLinks } from './links'
import { BLOCK_GAP, COMBOS, isSmall, isSolo, largeCount, MAX_BLOCKS, MAX_LARGE, MAX_ROWS, maxInRow, settleLook, stackIssue, stackRole } from './rules'
import { boxRects, cellBlocker, cellBoxes, cellMinH, cellPrefSpan, cellRects, fitsHeight, fitSpans, minSpanOf, needH, type Rect, rowMinH, spanChoices, spansOf } from './sizing'

/**
 * 놓을 자리. row: index째 자리에 새 줄, cell: row째 줄의 index째 자리에 새 칸,
 * stack: row째 줄 index째 칸 안의 at째 자리(0은 맨 위)에 쌓기
 */
export type DropTarget = { kind: 'row'; index: number } | { kind: 'cell'; row: number; index: number } | { kind: 'stack'; row: number; index: number; at: number }

export const sameTarget = (a: DropTarget | null, b: DropTarget | null) => {
  if (!a || !b || a.kind !== b.kind) return false
  if (a.kind === 'row') return a.index === b.index
  const c = b as Exclude<DropTarget, { kind: 'row' }>
  return a.row === c.row && a.index === c.index && (a.kind !== 'stack' || a.at === (c as typeof a).at)
}

/** 부품 수가 넘치는지: 모든 부품(MAX_BLOCKS), 작은 부품이 아니면 큰 부품(MAX_LARGE)도 */
const crowded = (rows: BlockRow[], adding: Block[]) =>
  blockCount(rows) + adding.length > MAX_BLOCKS || largeCount(rows) + adding.filter((b) => !isSmall(b.type)).length > MAX_LARGE

/**
 * 그 자리에 부품을 넣은 줄들. 넣을 수 없는 자리면 null.
 * 본문 높이(areaH)를 주면, 넣고 나서 장보다 높아질 때 다른 줄의 칸 너비를 다시 나눠 높이를 줄인다(roomyRows).
 * 놓을 수 있는지 따질 때(whyNot)와 끄는 동안 보이는 모습, 놓은 뒤가 같은 높이를 주어야 서로 맞는다
 */
export function insertAt(rows: BlockRow[], target: DropTarget, block: Block, rowId = uid(), areaH?: number): BlockRow[] | null {
  if (crowded(rows, [block])) return null
  if (target.kind === 'row') {
    if (rows.length >= MAX_ROWS || target.index < 0 || target.index > rows.length) return null
    return roomyRows(settleLook([...rows.slice(0, target.index), { id: rowId, blocks: [block] }, ...rows.slice(target.index)], block), areaH)
  }
  const row = rows[target.row]
  if (target.kind === 'stack') {
    const cell = row?.blocks[target.index]
    if (!cell) return null
    const members = membersOf(cell)
    if (target.at < 0 || target.at > members.length) return null
    const next = [...members]
    next.splice(target.at, 0, block)
    if (stackIssue(next)) return null
    // 칸의 이음표(오른쪽 칸과 잇는 것)는 맨 위가 바뀌어도 칸에 남는다
    const blocks = row.blocks.map((c, i) => (i === target.index ? asCell(next, cell.link) : c))
    const spans = fitSpans(blocks, row.spans) ?? fitSpans(blocks)
    if (!spans) return null
    return roomyRows(
      settleLook(
        rows.map((r, i) => (i === target.row ? { ...r, blocks, spans } : r)),
        block,
      ),
      areaH,
    )
  }
  if (!row || target.index < 0 || target.index > row.blocks.length) return null
  const blocks = [...row.blocks]
  blocks.splice(target.index, 0, block)
  if (blocks.length > maxInRow(blocks)) return null
  const spans = fitSpans(blocks)
  if (!spans) return null
  return roomyRows(
    settleLook(
      rows.map((r, i) => (i === target.row ? { ...r, blocks, spans } : r)),
      block,
    ),
    areaH,
  )
}

/**
 * 장보다 높은 줄들을 칸 너비만 다시 나눠 들어가게 한다. 이미 들어가면 그대로, 들어가면 그 줄들,
 * 어떻게 해도 안 되면 가장 낮게 나눈 줄들(넣을 수 없다고 알릴 때 '장 높이를 조금 넘는지'를 가장 덜 모자란 값으로 가늠하려고).
 * 전과 후처럼 좁으면 위아래로 쌓여 높아지는 부품은 넓은 칸에서 낮아진다. 그래서 짧은 글 옆의 전과 후가 4칸이면
 * 아래에 차트 한 줄이 들어갈 높이가 없지만, 8칸으로 넓히면 들어간다. 예전에는 장이 반쯤 비어 보여도 차트를 모두 막았다.
 * 줄이는 폭이 큰 줄부터 하나씩 바꾸고, 들어가는 순간 멈춘다(사람이 고른 비율은 될 수 있는 한 그대로 둔다).
 * 한 줄 안에서는 가장 낮아지는 비율, 같으면 지금 비율에 가까운 것
 */
function roomyRows(rows: BlockRow[], areaH?: number): BlockRow[] {
  if (areaH === undefined || fitsHeight(rows, areaH)) return rows
  const lowest = rows.map((r) => {
    const now = spansOf(r)
    let best = now
    let bestH = rowMinH(r)
    for (const c of spanChoices(r)) {
      const h = Math.max(0, ...r.blocks.map((b, i) => cellMinH(b, c[i])))
      const off = (x: number[]) => x.reduce((n, v, i) => n + Math.abs(v - now[i]), 0)
      if (h < bestH || (h === bestH && off(c) < off(best))) {
        best = c
        bestH = h
      }
    }
    return { spans: best, saves: rowMinH(r) - bestH }
  })
  const order = lowest.map((_, i) => i).filter((i) => lowest[i].saves > 0).sort((a, b) => lowest[b].saves - lowest[a].saves)
  let out = rows
  for (const i of order) {
    out = out.map((r, j) => (j === i ? { ...r, spans: lowest[i].spans } : r))
    if (fitsHeight(out, areaH)) return out
  }
  return out
}

/**
 * 줄 여럿(내 컴포넌트의 한 줄이나 장 하나)을 index 자리에 새 줄로 넣은 줄들. 줄 수나 부품 수가 넘치면 null.
 * 넣는 부품의 면이 장의 면과 어긋나면 바탕 없이(settleLook), 장보다 높으면 칸 너비를 다시 나눠 본다(insertAt과 같게).
 * 들어가는지(높이)는 rowsIssue가 본다
 */
export function insertRows(rows: BlockRow[], index: number, add: BlockRow[], areaH?: number): BlockRow[] | null {
  if (!add.length || index < 0 || index > rows.length) return null
  if (rows.length + add.length > MAX_ROWS || crowded(rows, allBlocks(add))) return null
  // 넣는 줄의 높이 비중은 버린다: 장의 다른 줄과 함께 다시 똑같이 나눈다
  let next = [...rows.slice(0, index), ...add.map(({ grow: _, ...r }) => r), ...rows.slice(index)]
  for (const b of allBlocks(add)) next = settleLook(next, b)
  return roomyRows(tidyLinks(next), areaH)
}

/** 줄 여럿을 이 장 맨 아래에 넣을 수 없는 까닭. 넣을 수 있으면 null */
export function rowsIssue(rows: BlockRow[], add: BlockRow[], areaH?: number): NoRoom | null {
  if (blockCount(rows) + blockCount(add) > MAX_BLOCKS) return { kind: 'full' }
  if (crowded(rows, allBlocks(add))) return { kind: 'large' }
  if (rows.length + add.length > MAX_ROWS) return { kind: 'rows' }
  const next = insertRows(rows, rows.length, add, areaH)
  if (!next) return { kind: 'rows' }
  if (areaH !== undefined && !fitsHeight(next, areaH)) return { kind: 'height', need: Math.round(needH(next)), room: Math.round(areaH) }
  return null
}

/**
 * 부품을 뺀 줄들. 빈 줄은 없애고, 남은 칸은 너비를 다시 고른다. 설 자리가 없어진 이음표도 뺀다.
 * 쌓은 칸에서 빼면 칸은 남고(맨 위를 빼면 그 아래 부품이 맨 위가 되어 칸의 이음표를 받는다) 칸 너비는 그대로
 */
export function removeBlock(rows: BlockRow[], blockId: string, areaH?: number): BlockRow[] {
  const next = tidyLinks(
    rows.flatMap((r) => {
      const c = r.blocks.findIndex((cell) => membersOf(cell).some((b) => b.id === blockId))
      if (c < 0) return [r]
      const left = membersOf(r.blocks[c]).filter((b) => b.id !== blockId)
      if (left.length) {
        const blocks = r.blocks.map((cell, i) => (i === c ? asCell(left, cell.link) : cell))
        return [{ ...r, blocks, spans: fitSpans(blocks, r.spans) ?? fitSpans(blocks) ?? undefined }]
      }
      const blocks = r.blocks.filter((_, i) => i !== c)
      return blocks.length ? [{ ...r, blocks, spans: fitSpans(blocks) ?? undefined }] : []
    }),
  )
  // 빼고 남은 줄에 이미지가 있으면 그 이미지에 다시 맞춘다(장 높이를 알 때): 똑같이 나눈 너비로 돌아가면 화면 캡처가 반 칸에 눌렸다
  const left = next.find((r) => rows.some((o) => o.id === r.id && allBlocks([o]).some((b) => b.id === blockId)))
  const img = left?.blocks.find((b) => aspectOf(b))
  return areaH !== undefined && img ? fitImage(next, img.id, aspectOf(img)!, areaH) : next
}

/** 부품이 지금 있는 자리 (옮기기를 시작할 때 처음 자리). 뺀 줄들(removeBlock)에 이 자리로 다시 넣으면 처음 모습이 된다 */
export function targetOf(rows: BlockRow[], blockId: string): DropTarget | null {
  const at = placeOf(rows, blockId)
  if (!at) return null
  if (membersOf(rows[at.row].blocks[at.col]).length > 1) return { kind: 'stack', row: at.row, index: at.col, at: at.at }
  return rows[at.row].blocks.length === 1 ? { kind: 'row', index: at.row } : { kind: 'cell', row: at.row, index: at.col }
}

/** 놓을 수 있을지 따져 볼 모든 자리 (읽는 차례대로): 줄 사이마다 새 줄, 줄마다 부품 사이, 칸마다 쌓은 부품 사이 */
function allTargets(rows: BlockRow[]): DropTarget[] {
  const out: DropTarget[] = []
  for (let r = 0; r <= rows.length; r++) {
    out.push({ kind: 'row', index: r })
    if (r === rows.length) break
    for (let c = 0; c <= rows[r].blocks.length; c++) {
      out.push({ kind: 'cell', row: r, index: c })
      if (c < rows[r].blocks.length) for (let k = 0; k <= membersOf(rows[r].blocks[c]).length; k++) out.push({ kind: 'stack', row: r, index: c, at: k })
    }
  }
  return out
}

/**
 * 그 자리에 넣을 수 없는 까닭. 화면에 보이는 문구는 편집기가 이것으로 만든다 (screens/editor/noRoom.ts).
 * full: 한 장의 부품 수, rows: 줄 수, row-full: 한 줄의 부품 수, narrow: 그 줄에 끼우면 칸이 너무 좁아진다,
 * height: 넣으면 줄들이 장보다 높아진다 (need: 잘리지 않는 데 드는 높이, room: 본문 높이)
 */
export type NoRoom =
  | { kind: 'full' }
  | { kind: 'rows' }
  | { kind: 'row-full' }
  | { kind: 'narrow'; span: number }
  | { kind: 'height'; need: number; room: number }
  /** 한 줄을 혼자 쓰는 부품(type)과 나란히 놓으려 할 때 */
  | { kind: 'solo'; type: BlockType }
  /** 면을 바꿀 수 없을 때: 진한 면은 하나만, 진한 면과 옅은 면은 섞지 않고, 혼자 한 줄을 다 쓰는 작은 부품은 면 없이 */
  | { kind: 'look'; why: 'one-bold' | 'mix' | 'alone' | 'flat' | 'no-bold' }
  /** 한 칸에 쌓을 수 없을 때: full은 셋이 찼다, large는 큰 부품(목록, 차트, 표)이 이미 있다(type), none은 쌓지 않는 부품(이미지) */
  | { kind: 'stack'; why: 'full' | 'large' | 'none'; type: BlockType }
  /** 작은 부품이 아닌 부품이 장에 MAX_LARGE개 찼다 */
  | { kind: 'large' }

/** 그 자리에 넣을 수 없는 까닭. 넣을 수 있으면 null */
export function whyNot(rows: BlockRow[], target: DropTarget, block: Block, areaH?: number): NoRoom | null {
  if (blockCount(rows) >= MAX_BLOCKS) return { kind: 'full' }
  if (!isSmall(block.type) && largeCount(rows) >= MAX_LARGE) return { kind: 'large' }
  if (target.kind === 'row' && rows.length >= MAX_ROWS) return { kind: 'rows' }
  if (target.kind === 'cell') {
    const cells = rows[target.row]?.blocks ?? []
    if (cells.length >= maxInRow([...cells, block])) return { kind: 'row-full' }
    const solo = [block, ...cells].find((b) => isSolo(b.type))
    if (solo) return { kind: 'solo', type: solo.type }
  }
  if (target.kind === 'stack') {
    const cell = rows[target.row]?.blocks[target.index]
    const members = cell ? membersOf(cell) : []
    const why = stackIssue([...members, block])
    // 무엇 때문인지: 큰 부품이 둘이면 칸에 이미 있는 큰 부품, 쌓지 않는 부품이면 그 부품(이미지)
    if (why === 'large') return { kind: 'stack', why, type: (members.find((b) => stackRole(b.type) === 'large') ?? block).type }
    if (why === 'none') return { kind: 'stack', why, type: ([block, ...members].find((b) => stackRole(b.type) === 'none') ?? block).type }
    if (why) return { kind: 'stack', why, type: block.type }
  }
  const next = insertAt(rows, target, block, 'x', areaH)
  if (!next) return { kind: 'narrow', span: minSpanOf(block) }
  if (areaH !== undefined && !fitsHeight(next, areaH)) return { kind: 'height', need: Math.round(needH(next)), room: Math.round(areaH) }
  return null
}

/** 넣을 수 있는 모든 자리 (읽는 차례대로). 본문 높이를 주면 넣고 나서도 잘리지 않는 자리만 */
export function validTargets(rows: BlockRow[], block: Block, areaH?: number): DropTarget[] {
  return allTargets(rows).filter((t) => !whyNot(rows, t, block, areaH))
}

/**
 * 이 장 어디에도 넣을 수 없을 때 그 까닭 하나. 넣을 수 있으면 null.
 * 높이만 모자란 자리가 있으면 그 가운데 가장 덜 모자란 것(무엇을 줄이면 되는지 알려 줄 수 있어서), 아니면 칸 수
 */
export function placeIssue(rows: BlockRow[], block: Block, areaH?: number): NoRoom | null {
  const why = allTargets(rows).map((t) => whyNot(rows, t, block, areaH))
  if (why.some((w) => !w)) return null
  const all = why.filter((w): w is NoRoom => !!w)
  const tall = all.filter((w) => w.kind === 'height').sort((a, b) => a.need - b.need)[0]
  return all.find((w) => w.kind === 'full' || w.kind === 'large') ?? tall ?? all.find((w) => w.kind === 'narrow') ?? { kind: 'rows' }
}

/**
 * 눌러서 넣을 때 알아서 고르는 자리: 마지막 줄 끝에 놓아도 모두 보기 좋은 너비가 되면 그 옆에,
 * 아니면 새 줄. 새 줄이 들어가지 않으면 마지막 줄 끝. 다 안 되면 넣을 수 있는 첫 자리.
 * 이미지가 든 이미지 부품(붙여 넣은 이미지)은 이미지 비율에 가장 잘 맞는 자리(imageTarget)
 */
export function autoTarget(rows: BlockRow[], block: Block, areaH?: number): DropTarget | null {
  if (areaH !== undefined && aspectOf(block)) return imageTarget(rows, block, areaH)
  const valid = validTargets(rows, block, areaH)
  const ok = (t: DropTarget) => valid.some((v) => sameTarget(v, t))
  if (!rows.length) return valid[0] ?? null
  const last = rows.length - 1
  const beside: DropTarget = { kind: 'cell', row: last, index: rows[last].blocks.length }
  const placed = insertAt(rows, beside, block, 'x', areaH)
  if (placed && ok(beside)) {
    const row = placed[last]
    const spans = spansOf(row)
    if (row.blocks.every((b, i) => spans[i] >= cellPrefSpan(b))) return beside
    // 작은 컴포넌트(큰 숫자, 원 같은)를 잇달아 넣으면 보기 좋은 너비가 아니어도 앞의 것 옆에 둔다.
    // 새 줄로 내리면 넓은 줄 한쪽에 숫자 하나만 남고, 나란히 견줄 숫자가 위아래로 갈라진다
    if (BLOCKS[block.type].prefSpan <= 4 && rows[last].blocks.at(-1)?.type === block.type) return beside
  }
  // 작은 부품을 같은 작은 부품 다음에 넣으면 그 칸 아래에 쌓는다 (숫자 한 줄을 잇달아 넣으면 한 칸에 목록처럼).
  // 옆에 둘 자리가 없을 때만: 옆에 둘 수 있으면 위에서 이미 골랐다
  const lastCell = rows[last].blocks.at(-1)
  if (isSmall(block.type) && lastCell && membersOf(lastCell).at(-1)?.type === block.type) {
    const under: DropTarget = { kind: 'stack', row: last, index: rows[last].blocks.length - 1, at: membersOf(lastCell).length }
    if (ok(under)) return under
  }
  const below: DropTarget = { kind: 'row', index: rows.length }
  if (ok(below)) return below
  // 새 줄이 들어가지 않으면 보기 좋은 너비가 아니어도 마지막 줄 끝에 (앞에 끼워 넣으면 읽는 차례가 뒤바뀐다)
  if (placed && ok(beside)) return beside
  // 그래도 안 되면 읽는 차례에서 가장 뒤의 자리(받는 줄이 보기 좋은 너비가 되는 곳 먼저). 예전에는 맨 앞 자리를 골라서
  // 핵심 한 줄 아래 숫자와 막대가 있는 장에 강조 상자를 누르면 핵심 한 줄 앞(왼쪽 위)에 들어갔다
  const roomy = (t: DropTarget) => {
    if (t.kind === 'row') return true
    const row = insertAt(rows, t, block, 'x', areaH)?.[t.row]
    return !!row && row.blocks.every((b, i) => spansOf(row)[i] >= cellPrefSpan(b))
  }
  return valid.findLast(roomy) ?? valid.at(-1) ?? null
}

/**
 * 끌고 있는 곳에서 놓을 자리. 부품을 뺀 채로 고정해 둔 자리(base)를 기준으로 본다.
 * 칸의 왼쪽·오른쪽 끝이면 그 옆 칸, 가운데의 위·아래면 같은 칸에 쌓기, 줄 사이 틈이면 새 줄(wantedTargets). 그 자리에 넣을 수 없으면 다른 쪽으로,
 * 그래도 안 되면 넣을 수 있는 자리 가운데 가장 가까운 곳. 그래서 대충 놓아도 늘 정해진 자리에 들어간다.
 */
export function dropTarget(
  base: BlockRow[],
  block: Block,
  p: { x: number; y: number },
  size: { w: number; h: number },
  gap = BLOCK_GAP,
  current?: DropTarget | null,
): DropTarget | null {
  const valid = validTargets(base, block, size.h)
  if (!valid.length) return null
  const ok = (t: DropTarget) => valid.some((v) => sameTarget(v, t))
  if (!base.length) return valid[0]
  // 끄는 동안 화면에는 놓일 자리를 넣은 모습이 보이는데, 아래의 자리 찾기는 끄는 부품을 뺀 모습으로 잰다.
  // 손이 지금 보이는 자리 안에 있으면 바꾸지 않는다(보이는 칸 안에서 손을 움직였는데 자리가 다른 데로 튀지 않게)
  if (current && ok(current)) {
    const r = slotRect(base, current, block, size, gap)
    if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return current
  }
  for (const t of wantedTargets(base, p, size, gap)) if (ok(t)) return t

  // 그 둘레에 자리가 없으면 넣을 수 있는 자리 가운데 놓일 칸이 가장 가까운 곳
  let best: DropTarget | null = null
  let bestD = Infinity
  for (const t of valid) {
    const pr = cellRects(insertAt(base, t, block, 'x', size.h)!, size, gap).get(block.id)!
    const d = Math.hypot(p.x - (pr.x + pr.w / 2), p.y - (pr.y + pr.h / 2))
    if (d < bestD) {
      best = t
      bestD = d
    }
  }
  return best
}

/** 이 자리에 놓으면 끄는 부품이 들어갈 칸 (장 본문 px) */
export function slotRect(base: BlockRow[], t: DropTarget, block: Block, size: { w: number; h: number }, gap = BLOCK_GAP): Rect | null {
  const rows = insertAt(base, t, block, 'x', size.h)
  return rows ? (cellRects(rows, size, gap).get(block.id) ?? null) : null
}

/** 손 아래의 자리 (넣을 수 있는지와 상관없이). 끄는 동안 '여기는 왜 안 되는지'를 알려 줄 때 */
export function pointerTarget(base: BlockRow[], p: { x: number; y: number }, size: { w: number; h: number }, gap = BLOCK_GAP): DropTarget {
  return base.length ? wantedTargets(base, p, size, gap)[0] : { kind: 'row', index: 0 }
}

/** 줄 경계에서 칸 안쪽으로 이만큼(본문 px)까지는 새 줄: 줄 사이 틈(--bk-gap)만으로는 손으로 맞히기 어렵다 */
const ROW_EDGE = 40

/**
 * 손 아래에서 바라는 자리들 (먼저 바라는 차례대로). 가로 자리는 옆 칸, 세로 자리는 같은 칸에 쌓기:
 * 칸의 왼쪽·오른쪽 4분의 1이면 그 옆 칸, 가운데면 손 아래 부품의 위나 아래(위 반, 아래 반)에 쌓기.
 * 새 줄은 줄 사이 틈과 그 둘레(ROW_EDGE), 첫 줄 위, 마지막 줄 아래. 칸 하나가 줄을 다 쓰면 쌓아도 줄과 같아 보여서 위나 아래 새 줄로.
 * 쌓을 수 없는 조합이면(큰 부품이 둘) 다음으로 바라는 새 줄이 된다
 */
function wantedTargets(base: BlockRow[], p: { x: number; y: number }, size: { w: number; h: number }, gap: number): DropTarget[] {
  const rects = cellRects(base, size, gap)
  const boxes = boxRects(base, size, gap)
  const cells = cellBoxes(base)
  const spans = base.map((_, ri) => {
    const rs = cells.filter((c) => c.row === ri).map((c) => boxes.get(c.block.id)!)
    return { top: Math.min(...rs.map((r) => r.y)), bottom: Math.max(...rs.map((r) => r.y + r.h)) }
  })
  const n = base.length
  if (p.y < spans[0].top + ROW_EDGE) return [{ kind: 'row', index: 0 }]
  if (p.y > spans[n - 1].bottom - ROW_EDGE) return [{ kind: 'row', index: n }]
  for (let i = 1; i < n; i++) if (p.y > spans[i - 1].bottom - ROW_EDGE && p.y < spans[i].top + ROW_EDGE) return [{ kind: 'row', index: i }]
  // 손이 든 줄, 그 줄에서 손이 든(없으면 가까운) 칸
  const ri = Math.max(0, spans.findIndex((s) => p.y < s.bottom + gap / 2))
  const inRow = cells.filter((c) => c.row === ri)
  let box = inRow[0]
  let bestD = Infinity
  for (const c of inRow) {
    const r = boxes.get(c.block.id)!
    const d = Math.max(r.x - p.x, 0, p.x - (r.x + r.w))
    if (d < bestD) {
      box = c
      bestD = d
    }
  }
  const cell = boxes.get(box.block.id)!
  const u = (p.x - cell.x) / cell.w
  const left: DropTarget = { kind: 'cell', row: ri, index: box.col }
  const right: DropTarget = { kind: 'cell', row: ri, index: box.col + 1 }
  // 손 아래(없으면 가까운) 쌓은 부품과 그 부품 안의 세로 자리
  let at = 0
  let r = rects.get(box.members[0].id)!
  box.members.forEach((m, i) => {
    const mr = rects.get(m.id)!
    if (p.y >= mr.y - gap / 2) {
      at = i
      r = mr
    }
  })
  const upper = (p.y - r.y) / r.h < 0.5
  const above: DropTarget = { kind: 'row', index: ri }
  const below: DropTarget = { kind: 'row', index: ri + 1 }
  const row = upper ? above : below
  const stack: DropTarget = { kind: 'stack', row: ri, index: box.col, at: upper ? at : at + 1 }
  const side = u < 0.5 ? left : right
  if (u < 0.25 || u > 0.75) return [side, stack, row]
  // 칸 하나가 줄을 다 쓰고 쌓은 부품이 없으면 쌓기 대신 새 줄
  if (inRow.length === 1 && box.members.length === 1) return [row, side]
  return [stack, row, side]
}

/** 칸 사이를 끌어 놓은 곳(줄 너비에 대한 몫)에 가장 가까운 비율 */
export function spansAt(row: BlockRow, gutter: number, frac: number): number[] {
  const choices = spanChoices(row)
  let best = spansOf(row)
  let bestD = Infinity
  for (const c of choices) {
    const edge = c.slice(0, gutter + 1).reduce((a, b) => a + b, 0) / 12
    const d = Math.abs(edge - frac)
    if (d < bestD - 1e-6) {
      best = c
      bestD = d
    }
  }
  return best
}

/** 칸 사이 손잡이를 더 끌 수 없는 까닭 (spanLimit) */
export type SpanLimit =
  /** 손에 더 가까운 비율에서는 이 부품이 너무 좁아진다. minSpan은 그 부품의 가장 좁은 너비, null이면 그 너비로는 글이 잘린다 */
  | { kind: 'block'; type: BlockType; minSpan: number | null }
  /** 손 쪽으로 더 벌어진 비율이 아예 없다: 줄어드는 쪽 부품(type)이 이 줄에서 가장 좁은 칸(span)에 이미 있다 */
  | { kind: 'end'; type: BlockType; span: number }

/**
 * 칸 사이 손잡이를 frac까지 끌었는데 붙은 비율이 손에서 한 칸 넘게 떨어져 있으면 그 까닭. 가까이 있으면 null.
 * 손에 더 가까운 비율이 있으면 그것을 막는 부품, 없으면(8:4 줄에서 오른쪽으로) 손 쪽에서 줄어드는 부품.
 * 예전에는 뒤의 경우에 null을 돌려줘서, 고를 비율이 하나뿐인 줄(핵심 포인트와 비율 원)의 손잡이를 오른쪽으로 끌면
 * 왼쪽으로 끌 때와 달리 꿈쩍도 않고 아무 말이 없었다
 */
export function spanLimit(row: BlockRow, gutter: number, frac: number): SpanLimit | null {
  const edge = (c: number[]) => c.slice(0, gutter + 1).reduce((a, b) => a + b, 0) / 12
  const now = spansAt(row, gutter, frac)
  const got = Math.abs(edge(now) - frac)
  if (got <= 1 / 12) return null
  const closer = (COMBOS[row.blocks.length] ?? [])
    .filter((c) => Math.abs(edge(c) - frac) < got - 1e-6)
    .sort((a, b) => Math.abs(edge(a) - frac) - Math.abs(edge(b) - frac))[0]
  if (!closer) {
    const k = frac > edge(now) ? gutter + 1 : gutter
    const b = row.blocks[k]
    return b ? { kind: 'end', type: b.type, span: now[k] } : null
  }
  // 쌓은 칸이면 그 너비를 막는 부품 (가장 넓어야 하는 것, 그 너비로는 잘리는 것)
  const i = closer.findIndex((s, k) => !!cellBlocker(row.blocks[k], s))
  if (i < 0) return null
  const b = cellBlocker(row.blocks[i], closer[i])!
  return { kind: 'block', type: b.type, minSpan: closer[i] < minSpanOf(b) ? minSpanOf(b) : null }
}

/**
 * 읽는 차례대로 한 칸 앞이나 뒤로 (끌기 어려울 때). 쌓은 칸 안에서는 위아래로, 칸 끝에서는 옆 칸으로 넘어간다.
 * 바꾼 뒤에 쌓을 수 없는 칸(큰 부품이 둘)이 생기면 그대로 둔다
 */
export function shiftBlock(rows: BlockRow[], blockId: string, dir: -1 | 1): BlockRow[] {
  const flat = allBlocks(rows)
  const i = flat.findIndex((b) => b.id === blockId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= flat.length) return rows
  const swapped = [...flat]
  ;[swapped[i], swapped[j]] = [swapped[j], swapped[i]]
  // 줄과 칸의 모양은 그대로 두고 부품만 자리를 바꾼다. 이음표는 부품을 따라가고(맨 위 자리에 갈 때만 남는다),
  // 넓이가 맞지 않으면 칸 너비를 다시 고른다
  let k = 0
  const next = rows.map((r) => {
    const blocks = r.blocks.map((cell) => {
      const members = membersOf(cell).map(() => swapped[k++])
      return asCell(members)
    })
    return { ...r, blocks, spans: fitSpans(blocks, r.spans) ?? fitSpans(blocks) ?? undefined }
  })
  return next.some((r) => r.blocks.some((c) => stackIssue(membersOf(c)))) ? rows : next
}

/**
 * 이미지가 든 이미지 부품을 넣을 자리: 넣을 수 있는 자리마다 칸 너비를 이미지에 맞춰 본 뒤 이미지 비율에 가장 잘 맞는 곳.
 * 세로 사진은 옆 칸으로, 넓은 화면 캡처는 넓은 줄로 간다. 위치를 받으면(끌어다 놓은 자리) 비슷하게 맞는 자리 가운데 가까운 곳.
 * 아래 새 줄에 놓아 세로 사진이 장 너비의 낮은 띠가 되면 가운데만 남거나 양옆이 크게 비었다
 */
export function imageTarget(rows: BlockRow[], block: Block, areaH: number, near?: { x: number; y: number }): DropTarget | null {
  const aspect = aspectOf(block)
  if (!aspect) return null
  let best: DropTarget | null = null
  let bestScore = Infinity
  const valid = validTargets(rows, block, areaH)
  for (const [k, t] of valid.entries()) {
    const placed = insertAt(rows, t, block, 'x', areaH)
    if (!placed) continue
    const fitted = fitImage(placed, block.id, aspect, areaH)
    // 장의 다른 이미지도 함께 본다: 새 이미지가 잘 맞아도 옆의 화면 캡처가 좁은 칸에 눌리거나 새 줄 때문에 낮아지면 좋은 자리가 아니다
    const off = allBlocks(fitted).reduce((a, b) => {
      const ar = b.id === block.id ? aspect : aspectOf(b)
      return ar ? a + misfit(fitted, b.id, ar, areaH) : a
    }, 0)
    if (!Number.isFinite(off)) continue
    // 비율이 거의 같으면(로그 차 0.1은 10%쯤) 놓은 자리에 가까운 곳. 거리는 장 너비에 견준 몫
    const at = near && cellRects(fitted, { w: AREA_W, h: areaH }).get(block.id)
    const far = at ? Math.hypot(at.x + at.w / 2 - near.x, at.y + at.h / 2 - near.y) / AREA_W : 0
    // 놓은 자리가 없으면(붙여 넣기) 비슷하게 맞는 자리끼리는 읽는 차례에서 뒤쪽: 앞에 끼우면 이미 쓴 내용의 차례가 밀린다
    const score = off + far * 0.25 + (near ? 0 : (valid.length - 1 - k) * 0.01)
    if (score < bestScore) {
      best = t
      bestScore = score
    }
  }
  return best
}
