import { useMemo } from 'react'
import type { Deck } from '../../deck/types'

/** 장을 그리는 데 필요한 발표 전체의 설정: 발표 정보, 테마, 발표 이름(아래 표시), 움직임. SlideCanvas의 deck에 넘긴다 */
export type Look = Pick<Deck, 'meta' | 'theme' | 'title' | 'motion'>

/**
 * 발표의 Look. 칸의 글을 고칠 때마다 발표는 새로 만들어지지만 이 넷은 그대로라서, 넷 가운데 하나가 바뀔 때만 새로 만든다.
 * 그래야 memo로 감싼 그림(컴포넌트 카드, 레이아웃 그림)과 넘침 확인(useOverflow)이 글자 하나 칠 때마다 다시 돌지 않는다
 */
export function useLook(deck: Deck): Look {
  const { meta, theme, title, motion } = deck
  return useMemo(() => ({ meta, theme, title, motion }), [meta, theme, title, motion])
}
