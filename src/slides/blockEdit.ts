import { createContext, type PointerEvent, type ReactNode } from 'react'
import type { Block, BlockRow } from '../deck/types'

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
  /** 장 밖에서 끌어 온 부품이 장 위에 있을 때: 놓으면 이 장이 부품 장으로 바뀐다는 안내를 띄운다 */
  incoming: boolean
  onCellPointerDown(e: PointerEvent<HTMLElement>, block: Block): void
  onGutterPointerDown(e: PointerEvent<HTMLElement>, rowId: string, gutter: number): void
  /** 부품이 하나도 없을 때 가운데에 보이는 것 */
  empty(): ReactNode
  areaRef(el: HTMLDivElement | null): void
}

export const BlockEditContext = createContext<BlockEdit | null>(null)
