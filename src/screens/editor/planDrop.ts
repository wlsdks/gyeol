import { asCompose, autoTarget, canCompose, dropTarget, placeIssue, pointerTarget, sameTarget, whyNot, type DropTarget, type NoRoom } from '../../deck/blocks'
import type { Block, BlockRow, Slide } from '../../deck/types'

// 컴포넌트를 어디에 놓을지 정하는 일: 끌어 놓기, 눌러 넣기, 고르기 카드의 '넣을 수 없음', 장 아래 빈자리.
// 화면을 재는 일(본문 상자의 자리와 크기)은 부르는 쪽(useBlockEditing)이 하고 여기서는 잰 값만 받아 정한다.
// 예전에는 '부품 장이면 그 줄, 아니면 부품 장으로 바꾼 모습의 줄'을 고르는 일이 곳곳에 따로 적혀 있었다

/** 놓으면 할 일: 이 장에 넣기, 이 장을 부품 장으로 바꿔 넣기, 다음 장에 새로 만들기 */
export type DropPlanKind = 'place' | 'convert' | 'next' | null

/**
 * 컴포넌트를 놓을 줄: 부품 장이면 그 줄, 부품 장으로 바꿀 수 있는 장이면 바꾼 모습(composed)의 줄.
 * 표지, 섹션처럼 바꿀 수 없는 장이면 null. composed를 주면 이미 바꿔 둔 모습을 그대로 쓴다 (끄는 동안 같은 모습을 기준으로)
 */
export function dropRows(s: Slide, composed?: Slide | null): { rows: BlockRow[]; composed: Slide | null } | null {
  if (s.layout === 'compose') return { rows: s.rows ?? [], composed: null }
  if (!canCompose(s.layout)) return null
  const c = composed ?? asCompose(s)
  return { rows: c.rows ?? [], composed: c }
}

/** 끌거나 넣는 중인 컴포넌트에서 자리와 관계된 것 (useBlockEditing의 Drag가 이 꼴을 갖는다) */
export interface DropState {
  kind: 'move' | 'new'
  block: Block
  /** 부품 장에서 자리를 찾는 줄 (옮기는 중이면 옮기는 컴포넌트를 뺀 줄) */
  base: BlockRow[]
  /** 부품 장이 아닌 장에 놓을 때: 같은 내용으로 바꾼 부품 장 */
  composed: Slide | null
  /** 지금 보이는 놓일 자리 */
  target: DropTarget | null
  /** 자리를 고를 때 잰 본문 높이 */
  room?: number
}

export interface DropPlan {
  plan: DropPlanKind
  target: DropTarget | null
  /** 손 아래 자리(또는 이 장)에 놓을 수 없는 까닭 (그래서 다른 자리에 놓이거나, 다음 장에 들어간다) */
  blocked: NoRoom | null
  composed: Slide | null
  /** 자리를 찾은 줄 */
  base: BlockRow[]
  /** 자리를 고를 때 쓴 본문 높이 (캔버스 px) */
  room?: number
}

/** 어디에 놓으려는지 */
export type DropAt =
  | {
      /** 끌어 놓기: 손 아래 */
      by: 'pointer'
      /** 손이 장 위에 있는지 */
      over: boolean
      /** 본문 상자 안에서 손의 자리와 본문 상자 크기 (캔버스 px). 잴 수 없으면 null */
      at: { p: { x: number; y: number }; size: { w: number; h: number } } | null
    }
  | {
      /** 눌러 넣기: 알아서 고른 자리 */
      by: 'auto'
      /** 본문 높이 (부품 장이 아닌 장은 부품 장으로 바꿨을 때의 어림) */
      h: number | undefined
      /** 맨 아래 새 줄에 먼저 (장 아래 빈자리의 '여기에 컴포넌트 넣기'로 고를 때) */
      bottom?: boolean
    }

/** 이 장(s)에서 컴포넌트(d)를 놓을 자리와 할 일 */
export function planDrop(s: Slide, d: DropState, where: DropAt): DropPlan {
  const compose = s.layout === 'compose'
  if (where.by === 'auto') {
    if (compose) {
      const target = autoTarget(d.base, d.block, where.h)
      return { plan: target ? 'place' : 'next', target, blocked: target ? null : placeIssue(d.base, d.block, where.h), composed: null, base: d.base, room: where.h }
    }
    const at = dropRows(s)
    if (!at) return { plan: 'next', target: null, blocked: null, composed: null, base: d.base, room: where.h }
    const bottom: DropTarget = { kind: 'row', index: at.rows.length }
    const target = where.bottom && !whyNot(at.rows, bottom, d.block, where.h) ? bottom : autoTarget(at.rows, d.block, where.h)
    return { plan: target ? 'convert' : 'next', target, blocked: target ? null : placeIssue(at.rows, d.block, where.h), composed: at.composed, base: at.rows, room: where.h }
  }

  let plan: DropPlanKind = null
  let target: DropTarget | null = null
  let blocked: NoRoom | null = null
  let room = d.room
  let composed = d.composed
  if (where.over) {
    // 옮기기는 부품 장 안에서만. 새 컴포넌트는 바꿀 수 있는 장이면 바꾼 모습에, 아니면 다음 장에
    const rows = compose ? { rows: d.base, composed } : d.kind === 'new' ? dropRows(s, composed) : null
    if (rows) {
      composed = rows.composed
      const base = rows.rows
      if (where.at) {
        const { p, size } = where.at
        room = size.h
        target = dropTarget(base, d.block, p, size, undefined, d.target)
        // 경계에서 떨리지 않게: 조금 옆에서 봐도 지금 자리면 그대로 둔다
        if (target && d.target && !sameTarget(target, d.target)) {
          const near = [-30, 30].flatMap((o) => [dropTarget(base, d.block, { x: p.x + o, y: p.y }, size), dropTarget(base, d.block, { x: p.x, y: p.y + o }, size)])
          if (near.some((t) => sameTarget(t, d.target))) target = d.target
        }
        // 손 아래 자리에 놓을 수 없으면 그 까닭. 어디에도 놓을 수 없으면 이 장의 까닭
        const wanted = pointerTarget(base, p, size)
        blocked = !target ? placeIssue(base, d.block, size.h) : sameTarget(wanted, target) ? null : whyNot(base, wanted, d.block, size.h)
      }
      plan = target ? (compose ? 'place' : 'convert') : d.kind === 'new' ? 'next' : null
    } else if (d.kind === 'new') plan = 'next'
  }
  return { plan, target, blocked, composed, base: compose ? d.base : (composed?.rows ?? d.base), room }
}
