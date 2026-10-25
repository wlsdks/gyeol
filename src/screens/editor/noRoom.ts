import { BLOCKS, MAX_BLOCKS, MAX_LARGE, type NoRoom, type SpanLimit } from '../../deck/blocks'
import type { BlockType } from '../../deck/types'
import { josa } from '../../lib/josa'

// 부품을 넣을 수 없는 까닭(deck/blocks.ts의 NoRoom)을 쓰는 사람이 읽는 말로.
// 무엇이 안 되는지(why)와 어떻게 하면 되는지(fix)를 나눠서, 끄는 동안에는 짧게, 눌러서 볼 때는 둘 다 보인다.

/** 12칸 가운데 몇 칸인지를 장 너비의 몫으로 (딱 떨어지지 않으면 가까운 쪽보다 조금 넓게 읽히는 말) */
function widthText(span: number): string {
  const named: Record<number, string> = { 3: '4분의 1', 4: '3분의 1', 6: '절반', 8: '3분의 2', 9: '4분의 3', 12: '전체' }
  return named[span] ?? (span < 6 ? '3분의 1' : span < 8 ? '절반' : span < 12 ? '3분의 2' : '전체')
}

/** 판의 선을 더 끌 수 없을 때 (deck/blocks/place.ts의 gutterLimit) */
export function narrowText(limit: SpanLimit): string {
  const name = josa(BLOCKS[limit.type].name, '은', '는')
  return limit.minSpan
    ? `${name} 장 너비의 ${widthText(limit.minSpan)} 이상이 있어야 해서 더 좁힐 수 없어요.`
    : `${name} 더 낮으면 글이 잘려서 더 줄일 수 없어요.`
}

export interface NoRoomText {
  /** 무엇이 안 되는지 */
  why: string
  /** 어떻게 하면 되는지 */
  fix: string
}

/**
 * where: 'here'는 끌고 있는 그 자리, 'slide'는 이 장 어디에도, 'change'는 고른 부품을 바꿀 때(항목 더하기, 모양, 바탕)
 */
export function noRoomText(r: NoRoom, type: BlockType, where: 'here' | 'slide' | 'change'): NoRoomText {
  const name = BLOCKS[type].name
  switch (r.kind) {
    case 'full':
      return { why: `한 장에는 컴포넌트를 ${MAX_BLOCKS}개까지 넣어요.`, fix: '컴포넌트를 하나 빼거나 다음 장에 넣어 주세요.' }
    case 'large':
      return {
        why: `작은 컴포넌트가 아닌 것은 한 장에 ${MAX_LARGE}개까지 넣어요. 더 많으면 어디를 봐야 할지 흐려져요.`,
        fix: '컴포넌트를 하나 빼거나 다음 장에 넣어 주세요. 소제목, 숫자 한 줄 같은 작은 컴포넌트는 더 넣을 수 있어요.',
      }
    case 'narrow':
      return {
        why: `${josa(name, '은', '는')} 장 너비의 ${widthText(r.span)} 이상이 있어야 해서, 여기에 끼우면 너무 좁아져요.`,
        fix: '위나 아래에 새 줄로 놓아 보세요.',
      }
    case 'solo': {
      const solo = BLOCKS[r.type].name
      return {
        why: `${josa(solo, '은', '는')} 장 너비를 혼자 써요. 옆에 다른 컴포넌트를 두면 둘 다 좁아져 읽기 어려워요.`,
        fix: '위나 아래에 새 줄로 놓아 보세요.',
      }
    }
    case 'look':
      return r.why === 'one-bold'
        ? { why: '진한 면은 한 장에 하나만 써요. 둘이면 어느 쪽이 결론인지 흐려져요.', fix: '다른 컴포넌트의 진한 면을 먼저 바꿔 주세요.' }
        : r.why === 'mix'
          ? { why: '옅은 면과 진한 면은 한 장에 같이 쓰지 않아요. 상자 두 종류가 눈길을 나눠 가져요.', fix: '이 장의 다른 컴포넌트와 같은 면을 골라 주세요.' }
          : r.why === 'alone'
            ? { why: '장 너비를 혼자 다 쓰는 컴포넌트는 면 없이 써요. 넓은 면 안에 글이 한쪽에만 있어 비어 보여요.', fix: '옆에 컴포넌트를 하나 더 놓으면 둘 다 면을 깔 수 있어요.' }
            : r.why === 'no-bold'
              ? { why: '진한 면은 숫자나 강조할 말 하나에만 써요. 목록이나 그림을 검게 칠하면 장이 무거워 보여요.', fix: '옅은 면을 골라 보세요.' }
              : { why: '이 컴포넌트는 면 없이 써요. 안에 이미 상자와 줄이 있어서 면을 깔면 상자 안에 상자가 돼요.', fix: '강조할 것은 큰 숫자나 강조 상자에 면을 깔아 보세요.' }
    case 'height': {
      // 몇 %인지는 쓰는 사람에게 뜻이 없다. 조금 넘치는지만 알려 주면 항목 하나만 빼도 되는지 가늠한다
      const over = r.need / Math.max(1, r.room) <= 1.1 ? '장 높이를 조금 넘어서' : '장 높이를 넘어서'
      return {
        why:
          where === 'change'
            ? `이렇게 바꾸면 이 장의 컴포넌트들이 ${over} 글이 잘려요.`
            : `${josa(name, '을', '를')} 넣으면 이 장의 컴포넌트들이 ${over} 글이 잘려요.`,
        fix: where === 'change' ? '다른 컴포넌트를 빼거나 항목을 줄이면 바꿀 수 있어요.' : '다른 컴포넌트를 빼거나 항목을 줄이면 들어가요.',
      }
    }
  }
}
