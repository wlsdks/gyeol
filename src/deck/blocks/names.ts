// 사람이 부를 이름: 부품마다(같은 부품이 둘이면 자리를 붙여), 장마다(장 목록, 버전 기록, 제안 미리 보기)

import { LAYOUTS } from '../layouts'
import type { BlockRow, Slide } from '../types'
import { BLOCKS } from './catalog'
import { allBlocks } from './cells'
import { cellBoxes } from './sizing'

/**
 * 부품마다 사람이 부를 이름. 같은 장에 같은 부품이 둘 이상이면 자리를 붙인다('왼쪽 예상 질문', '아래 숫자 강조').
 * 빈칸 목록에 '예상 질문 1의 질문'이 두 번 나오면 어느 부품의 칸인지 알 수 없다
 */
export function blockNames(rows: BlockRow[]): Map<string, string> {
  const boxes = cellBoxes(rows)
  const ROW = (n: number) => (n === 2 ? ['위', '아래'] : ['위', '가운데 줄', '아래'])
  const COL = (n: number) => (n === 2 ? ['왼쪽', '오른쪽'] : ['왼쪽', '가운데', '오른쪽'])
  const out = new Map<string, string>()
  for (const b of boxes) {
    const name = BLOCKS[b.block.type].name
    const same = boxes.filter((o) => o !== b && o.block.type === b.block.type)
    const where = [same.some((o) => o.row !== b.row) && ROW(b.rows)[b.row], same.some((o) => o.row === b.row) && COL(b.cols)[b.col]].filter(Boolean)
    out.set(b.block.id, where.length ? `${where.join(' ')} ${name}` : name)
  }
  return out
}

/**
 * 장 목록, 버전 기록, 제안 미리 보기에 쓰는 장 이름. 보고 종류가 정해 준 이름(주요 숫자, 다음 할 일)은 그대로 두고,
 * '장 추가'로 만든 컴포넌트 장은 모두 '컴포넌트로 꾸미기'라 서로 구별되지 않아서 넣은 컴포넌트의 이름으로 부른다
 */
export function slideName(slide: Slide): string {
  if (slide.layout !== 'compose' || slide.purpose !== LAYOUTS.compose.name) return slide.purpose
  const names = [...new Set(allBlocks(slide.rows ?? []).map((b) => BLOCKS[b.type].name))]
  if (!names.length) return slide.purpose
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} 외 ${names.length - 2}` : names.join(', ')
}
