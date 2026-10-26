import { asCompose, atRect, autoPlace, canCompose, dropTarget, insertAt, moveAt, placeIssue, pointerTarget, sameTarget, whyNot, type DropTarget, type NoRoom } from '../../deck/blocks'
import type { Block, Slide } from '../../deck/types'

// 컴포넌트를 어디에 놓을지 정하는 일: 끌어 놓기, 눌러 넣기, 고르기 카드의 '넣을 수 없음', 장 아래 빈자리.
// 화면을 재는 일(본문 상자의 자리와 크기)은 부르는 쪽(useBlockEditing)이 하고 여기서는 잰 값만 받아 정한다.
// 놓을 자리와 함께 놓은 뒤의 판(result)도 여기서 만든다: 끄는 동안 보이는 모습과 놓은 뒤가 늘 같다

/** 놓으면 할 일: 이 장에 넣기, 이 장을 부품 장으로 바꿔 넣기, 넣지 않기(next: 까닭과 '새 장에 넣기'를 알린다. 새 장은 쓰는 사람이 고를 때만) */
export type DropPlanKind = 'place' | 'convert' | 'next' | null

/** 놓을 자리. 판의 자리와 맞바꾸기에 더해, 옮기는 중에 처음 자리 둘레에 있으면 그대로 두기(stay) */
export type EditTarget = DropTarget | { kind: 'stay' }

export const sameEditTarget = (a: EditTarget | null | undefined, b: EditTarget | null | undefined) =>
  !!a && !!b && (a.kind === 'stay' ? b.kind === 'stay' : b.kind !== 'stay' && sameTarget(a, b))

/**
 * 컴포넌트를 놓을 판: 부품 장이면 그 판, 부품 장으로 바꿀 수 있는 장이면 바꾼 모습(composed)의 판.
 * 표지, 섹션처럼 바꿀 수 없는 장이면 null. composed를 주면 이미 바꿔 둔 모습을 그대로 쓴다 (끄는 동안 같은 모습을 기준으로)
 */
export function dropBlocks(s: Slide, composed?: Slide | null): { blocks: Block[]; composed: Slide | null } | null {
  if (s.layout === 'compose') return { blocks: s.blocks ?? [], composed: null }
  if (!canCompose(s.layout)) return null
  const c = composed ?? composedOf(s)
  return { blocks: c.blocks ?? [], composed: c }
}

// 장은 고칠 때마다 새 객체라 장마다 한 번만 바꾼다: 부품 고르기가 카드마다 물어서, 카드 수만큼 장을 부품 장으로 바꿨다.
// 같은 판이라 자리 재기를 적어 둔 것(place.ts)도 카드 사이에 같이 쓴다
const COMPOSED = new WeakMap<Slide, Slide>()
function composedOf(s: Slide): Slide {
  let c = COMPOSED.get(s)
  if (!c) COMPOSED.set(s, (c = asCompose(s)))
  return c
}

/** 끌거나 넣는 중인 컴포넌트에서 자리와 관계된 것 (useBlockEditing의 Drag가 이 꼴을 갖는다) */
export interface DropState {
  kind: 'move' | 'new'
  block: Block
  /** 자리를 찾는 판 (옮기는 중이면 옮기는 컴포넌트를 뺀 판: 옆 부품이 그 자리를 덮는다) */
  base: Block[]
  /** 옮기는 중이면 옮기기 전의 판 (맞바꾸기와 그대로 두기는 이것으로) */
  moving: Block[] | null
  /** 부품 장이 아닌 장에 놓을 때: 같은 내용으로 바꾼 부품 장 */
  composed: Slide | null
  /** 지금 보이는 놓일 자리 */
  target: EditTarget | null
  /** 자리를 고를 때 잰 본문 높이 */
  room?: number
}

export interface DropPlan {
  plan: DropPlanKind
  target: EditTarget | null
  /** 놓은 뒤의 판 (place, convert). 끄는 동안 이 모습을 미리 보여 준다 */
  result: Block[] | null
  /** 손 아래 자리(또는 이 장)에 놓을 수 없는 까닭 (그래서 다른 자리에 놓이거나, 넣지 않고 이 까닭을 알린다) */
  blocked: NoRoom | null
  composed: Slide | null
  /** 자리를 찾은 판 */
  base: Block[]
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

/** 그 자리에 놓은 뒤의 판. 놓을 수 없으면 null */
export function dropResult(d: Pick<DropState, 'kind' | 'block' | 'moving'>, base: Block[], target: EditTarget, room?: number): Block[] | null {
  if (target.kind === 'stay') return d.moving
  if (d.kind === 'move' && d.moving) return moveAt(d.moving, d.block.id, target, room)
  return target.kind === 'spot' ? insertAt(base, target.spot, d.block, room) : null
}

const BOTTOM = { at: null, side: 'below' } as const

/** 이 장(s)에서 컴포넌트(d)를 놓을 자리와 할 일 */
export function planDrop(s: Slide, d: DropState, where: DropAt): DropPlan {
  const compose = s.layout === 'compose'
  if (where.by === 'auto') {
    const at = compose ? { blocks: d.base, composed: null } : dropBlocks(s)
    if (!at) return { plan: 'next', target: null, result: null, blocked: null, composed: null, base: d.base, room: where.h }
    // 장 아래 빈자리에서 고르면 맨 아래 새 줄에 먼저
    const result = (where.bottom && insertAt(at.blocks, BOTTOM, d.block, where.h)) || autoPlace(at.blocks, d.block, where.h)
    return {
      plan: result ? (compose ? 'place' : 'convert') : 'next',
      target: null,
      result,
      blocked: result ? null : placeIssue(at.blocks, d.block, where.h),
      composed: at.composed,
      base: at.blocks,
      room: where.h,
    }
  }

  let plan: DropPlanKind = null
  let target: EditTarget | null = null
  let result: Block[] | null = null
  let blocked: NoRoom | null = null
  let room = d.room
  let composed = d.composed
  let base = d.base
  if (where.over) {
    // 옮기기는 부품 장 안에서만. 새 컴포넌트는 바꿀 수 있는 장이면 바꾼 모습에, 아니면 다음 장에
    const at = compose ? { blocks: d.base, composed } : d.kind === 'new' ? dropBlocks(s, composed) : null
    if (at) {
      composed = at.composed
      base = at.blocks
      if (where.at) {
        const { p, size } = where.at
        room = size.h
        const self = d.moving?.find((b) => b.id === d.block.id)?.at
        const home = self && atRect(self, size)
        // 옮기는 중에 처음 자리 안에 있으면 그대로 (조금 끌었다고 옆 부품과 자리가 바뀌지 않게)
        if (home && p.x >= home.x && p.x <= home.x + home.w && p.y >= home.y && p.y <= home.y + home.h) target = { kind: 'stay' }
        else {
          const current = d.target && d.target.kind !== 'stay' ? d.target : null
          const found = dropTarget(base, d.block, p, size, current, d.moving ?? undefined)
          target = found
          // 경계에서 떨리지 않게: 조금 옆에서 봐도 지금 자리면 그대로 둔다
          if (found && current && !sameTarget(found, current)) {
            const near = [-30, 30].flatMap((o) => [dropTarget(base, d.block, { x: p.x + o, y: p.y }, size, null, d.moving ?? undefined), dropTarget(base, d.block, { x: p.x, y: p.y + o }, size, null, d.moving ?? undefined)])
            if (near.some((t) => sameTarget(t, current))) target = current
          }
          // 손 아래 자리에 놓을 수 없으면 그 까닭. 어디에도 놓을 수 없으면 이 장의 까닭
          const wanted = pointerTarget(base, p, size)
          blocked = !target ? placeIssue(base, d.block, size.h) : sameTarget(wanted, target) || target.kind === 'swap' ? null : whyNot(base, wanted, d.block, size.h)
        }
        result = target ? dropResult(d, base, target, room) : null
        if (!result) target = null
      }
      plan = target ? (compose ? 'place' : 'convert') : d.kind === 'new' ? 'next' : null
    } else if (d.kind === 'new') plan = 'next'
  }
  return { plan, target, result, blocked, composed, base: compose ? d.base : (composed?.blocks ?? base), room }
}
