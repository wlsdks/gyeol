import { createContext, useContext } from 'react'
import type { Block, DeckMeta, ItemKey, Slide } from '../deck/types'

/**
 * edit: 슬라이드 위에서 바로 입력
 * preview: 읽기 전용, 빈칸은 안내 문구를 흐리게 보여준다 (목록, 미리보기)
 * final: 발표와 내보내기, 빈칸은 비워 둔다
 */
export type SlideMode = 'edit' | 'preview' | 'final'

export interface SlideActions {
  setField(key: string, value: string): void
  setItem(index: number, key: ItemKey, value: string): void
  removeItem(index: number): void
  /** 부품 장: 부품 하나를 고친다. key가 같으면 되돌리기 한 단계로 묶는다 */
  updateBlock?(blockId: string, fn: (b: Block) => Block, key?: string): void
}

export interface SlideCtx {
  slide: Slide
  meta: DeckMeta
  mode: SlideMode
  actions?: SlideActions
  canRemoveItem: boolean
  /** 발표의 단락 이름들과 이 장이 속한 단락 (0부터, 없으면 -1) */
  sections: readonly string[]
  sectionIndex: number
  /** 부품 장의 부품 안: 칸 id(data-field) 앞머리. 같은 장의 다른 부품과 겹치지 않게 */
  fieldPrefix?: string
}

export const SlideContext = createContext<SlideCtx | null>(null)

export function useSlide(): SlideCtx {
  const ctx = useContext(SlideContext)
  if (!ctx) throw new Error('SlideContext가 없어요')
  return ctx
}
