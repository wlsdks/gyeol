import { createContext, useContext } from 'react'
import type { DeckMeta, ItemKey, Slide } from '../deck/types'

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
}

export interface SlideCtx {
  slide: Slide
  meta: DeckMeta
  mode: SlideMode
  actions?: SlideActions
  canRemoveItem: boolean
  sectionNumber?: number
}

export const SlideContext = createContext<SlideCtx | null>(null)

export function useSlide(): SlideCtx {
  const ctx = useContext(SlideContext)
  if (!ctx) throw new Error('SlideContext가 없어요')
  return ctx
}
