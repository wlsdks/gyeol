// 사람이 부를 이름: 부품마다(같은 부품이 둘이면 자리를 붙여), 장마다(장 목록, 버전 기록, 제안 미리 보기)

import { LAYOUTS } from '../layouts'
import type { Block, Slide } from '../types'
import { BOARD_COLS, BOARD_ROWS } from './board'
import { BLOCKS } from './catalog'
import { allBlocks } from './cells'

/**
 * 부품마다 사람이 부를 이름. 같은 장에 같은 부품이 둘 이상이면 자리를 붙인다('왼쪽 예상 질문', '아래 숫자 강조').
 * 빈칸 목록에 '예상 질문 1의 질문'이 두 번 나오면 어느 부품의 칸인지 알 수 없다
 */
export function blockNames(blocks: Block[]): Map<string, string> {
  // 판을 셋으로 나눠 부품 가운데가 드는 곳으로 부른다 (위아래로 둘이면 위·아래, 셋이면 가운데 줄까지)
  const row = (b: Block) => {
    const c = (b.at!.y + b.at!.h / 2) / BOARD_ROWS
    return c < 1 / 3 ? '위' : c > 2 / 3 ? '아래' : '가운데 줄'
  }
  const col = (b: Block) => {
    const c = (b.at!.x + b.at!.w / 2) / BOARD_COLS
    return c < 1 / 3 ? '왼쪽' : c > 2 / 3 ? '오른쪽' : '가운데'
  }
  const overlapY = (a: Block, b: Block) => a.at!.y < b.at!.y + b.at!.h && b.at!.y < a.at!.y + a.at!.h
  const out = new Map<string, string>()
  for (const b of blocks) {
    const name = BLOCKS[b.type]?.name ?? b.type
    const same = blocks.filter((o) => o !== b && o.type === b.type && o.at)
    if (!b.at || !same.length) {
      out.set(b.id, name)
      continue
    }
    const where = [same.some((o) => !overlapY(o, b)) && row(b), same.some((o) => overlapY(o, b)) && col(b)].filter(Boolean)
    out.set(b.id, where.length ? `${where.join(' ')} ${name}` : name)
  }
  return out
}

/**
 * 장 목록, 버전 기록, 제안 미리 보기에 쓰는 장 이름. 보고 종류가 정해 준 이름(주요 숫자, 다음 할 일)은 그대로 두고,
 * '장 추가'로 만든 컴포넌트 장은 모두 '컴포넌트로 꾸미기'라 서로 구별되지 않아서 넣은 컴포넌트의 이름으로 부른다
 */
export function slideName(slide: Slide): string {
  if (slide.layout !== 'compose' || slide.purpose !== LAYOUTS.compose.name) return slide.purpose
  const names = [...new Set(allBlocks(slide.blocks ?? []).map((b) => BLOCKS[b.type].name))]
  if (!names.length) return slide.purpose
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} 외 ${names.length - 2}` : names.join(', ')
}
