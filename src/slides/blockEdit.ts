import { createContext, type PointerEvent, type ReactNode } from 'react'
import type { LinkTarget } from '../deck/blocks'
import type { Block, BlockLink, BlockRow } from '../deck/types'

/**
 * 편집기가 부품 장에 넣어 주는 것. 슬라이드 그리기는 이것이 있을 때만 (편집 화면에서만) 끌기 손잡이,
 * 고른 부품의 테두리, 칸 사이 손잡이, 놓일 자리를 그린다. 발표와 내보낸 파일에는 없다.
 */
export interface BlockEdit {
  /** 끌고 있는 동안 보여 줄 줄들 (놓일 자리를 넣은 모습). 없으면 장에 저장된 줄 */
  rows: BlockRow[] | null
  /** 끌고 있는 부품. 그 칸은 놓일 자리로 그린다 */
  dragId: string | null
  selected: string | null
  /** '칸 더하기'로 연 칸: '부품id 칸키'. 비어 있어도 그린다 */
  opened: ReadonlySet<string>
  /** 장 밖에서 끌어 온 부품이 장 위에 있을 때: 놓으면 이 장이 부품 장으로 바뀐다는 안내를 띄운다 */
  incoming: boolean
  onCellPointerDown(e: PointerEvent<HTMLElement>, block: Block): void
  onGutterPointerDown(e: PointerEvent<HTMLElement>, rowId: string, gutter: number): void
  /** between째 줄과 그 아래 줄 사이를 끌어 두 줄의 높이를 나눈다. 두 번 누르면 똑같이 되돌린다 */
  onRowGapPointerDown(e: PointerEvent<HTMLElement>, between: number): void
  onRowGapReset(): void
  /** 고른 이음표의 자리 */
  selectedLink: LinkTarget | null
  /** 이음표를 끄는 동안 놓일 자리와 모양. 그 자리에 흐리게 미리 세운다 */
  linkPreview: { target: LinkTarget; link: BlockLink } | null
  onLinkPointerDown(e: PointerEvent<HTMLElement>, target: LinkTarget): void
  /** 부품이 하나도 없을 때 가운데에 보이는 것 */
  empty(): ReactNode
  areaRef(el: HTMLDivElement | null): void
}

export const BlockEditContext = createContext<BlockEdit | null>(null)
