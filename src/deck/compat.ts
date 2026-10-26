import { boardFromRows, cleanBlocks, cleanList, LOOSE } from './blocks'
import { LAYOUTS } from './layouts'
import { THEMES } from './themes'
import type { Deck } from './types'

/*
 * 새 버전에서 만든 발표를 예전 버전에서 열 때.
 * 이 버전은 모르는 부품, 레이아웃, 모양을 그리지 못하고, 고치는 순간 그것과 안에 적은 글을 빼고 저장한다.
 * 그래서 그런 발표는 편집기가 열지 않고 알린다. 원래 발표는 그대로 두고, 아는 것만 남긴 사본은 만들 수 있다.
 * 앞으로 부품, 레이아웃, 모양을 더해도 이 검사가 알아서 잡는다. 저장 형식을 바꿀 때는 Deck.version을 올린다.
 */

/** 이 버전이 모르는 것(새 버전에서 생긴 장, 부품, 부품의 모양과 움직임, 칸)의 개수. 0이면 그대로 열어도 잃는 것이 없다 */
export function unknownParts(deck: Deck): number {
  const lost = { n: 0 }
  // 1은 판 전(0.4까지)의 발표: 열 때 판으로 바꾼다(migrate.ts)
  if ((deck.version as number) !== 1 && deck.version !== 2) lost.n++
  if (!Object.hasOwn(THEMES, deck.theme.id)) lost.n++
  for (const s of deck.slides) {
    if (!Object.hasOwn(LAYOUTS, s.layout)) lost.n++
    // 모르는 장면은 세지 않는다: 장면은 글이 없는 id 하나라 잃을 것이 없다. 이 버전은 값을 그대로 둔 채 장면 없이 움직이고
    // (sceneOf), 고쳐 저장해도 값이 남아 새 버전에서 다시 열면 그 장면으로 돌아온다. 예전에는 이것 하나로 발표 전체를 막았다
    const rows = (s as typeof s & { rows?: unknown }).rows
    if (rows !== undefined) boardFromRows(rows, LOOSE, lost)
    else if (s.layout === 'compose' || s.blocks !== undefined) cleanList(s.blocks, lost)
  }
  return lost.n
}

/** 이 버전이 아는 것만 남긴 발표. 모르는 장은 빼고, 부품 장은 아는 부품만 */
export function knownOnly(deck: Deck): Deck {
  const slides = deck.slides
    .filter((s) => Object.hasOwn(LAYOUTS, s.layout))
    .map((s) => (s.layout === 'compose' || s.blocks !== undefined ? { ...s, blocks: cleanBlocks(s.blocks) } : s))
  const theme = Object.hasOwn(THEMES, deck.theme.id) ? deck.theme : { ...deck.theme, id: 'white' as const }
  return { ...deck, version: 2, theme, slides }
}
