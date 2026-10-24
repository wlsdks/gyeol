import { BLOCKS, MAX_BLOCKS, MAX_IN_ROW, MAX_ROWS, type NoRoom } from '../../deck/blocks'
import type { BlockType } from '../../deck/types'

// 부품을 넣을 수 없는 까닭(deck/blocks.ts의 NoRoom)을 쓰는 사람이 읽는 말로.
// 무엇이 안 되는지(why)와 어떻게 하면 되는지(fix)를 나눠서, 끄는 동안에는 짧게, 눌러서 볼 때는 둘 다 보인다.

/** 받침이 있으면 앞의 조사, 없으면 뒤의 조사 ('표는', '막대 비교는') */
export function josa(word: string, withFinal: string, without: string): string {
  const c = word.trim().charCodeAt(word.trim().length - 1) - 0xac00
  const final = c >= 0 && c < 11172 ? c % 28 !== 0 : false
  return word + (final ? withFinal : without)
}

/** 12칸 가운데 몇 칸인지를 장 너비의 몫으로 */
const WIDTH: Record<number, string> = { 3: '4분의 1', 4: '3분의 1', 6: '절반', 8: '3분의 2', 12: '전체' }

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
      return { why: `한 장에는 부품을 ${MAX_BLOCKS}개까지 넣어요.`, fix: '부품을 하나 빼거나 다음 장에 넣어 주세요.' }
    case 'rows':
      return where === 'here'
        ? { why: `줄은 ${MAX_ROWS}개까지라 새 줄을 만들 수 없어요.`, fix: '다른 부품 옆에 놓아 보세요.' }
        : { why: `줄 ${MAX_ROWS}개가 다 찼고, 어느 줄에도 옆에 놓을 칸이 없어요.`, fix: '부품을 하나 빼거나 다음 장에 넣어 주세요.' }
    case 'row-full':
      return { why: `한 줄에는 ${MAX_IN_ROW}개까지 나란히 놓아요.`, fix: '위나 아래에 새 줄로 놓아 보세요.' }
    case 'narrow':
      return {
        why: `${josa(name, '은', '는')} 장 너비의 ${WIDTH[r.span] ?? '절반'} 이상이 있어야 해서, 이 줄에 끼우면 칸이 너무 좁아져요.`,
        fix: '위나 아래에 새 줄로 놓아 보세요.',
      }
    case 'height': {
      const pct = Math.round((r.need / Math.max(1, r.room)) * 100)
      return {
        why:
          where === 'change'
            ? `이렇게 바꾸면 이 장의 부품들이 장 높이의 ${pct}%를 차지해서 글이 잘려요.`
            : `${josa(name, '을', '를')} 넣으면 이 장의 부품들이 장 높이의 ${pct}%를 차지해서 글이 잘려요.`,
        fix: where === 'change' ? '다른 부품을 빼거나 항목을 줄이면 바꿀 수 있어요.' : '다른 부품을 빼거나 항목을 줄이면 들어가요.',
      }
    }
  }
}
