import { boardFromRows, cleanBlocks, cleanList, LOOSE } from './blocks'
import { LAYOUTS } from './layouts'
import { isScene } from './scenes'
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
    // 새 버전의 장면은 이 버전이 다르게(장면 없이) 움직인다. 고친 장을 새 버전에서 다시 열면 장면이 맞게 남아 있어도,
    // 그동안 이 버전의 발표 화면은 만든 사람이 짠 컷과 다르게 보인다
    if (s.options?.scene !== undefined && !isScene(s.options.scene)) lost.n++
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
    .map((s) => {
      if (s.options?.scene === undefined || isScene(s.options.scene)) return s
      const { scene: _, ...options } = s.options
      return { ...s, options }
    })
  const theme = Object.hasOwn(THEMES, deck.theme.id) ? deck.theme : { ...deck.theme, id: 'white' as const }
  return { ...deck, version: 2, theme, slides }
}
