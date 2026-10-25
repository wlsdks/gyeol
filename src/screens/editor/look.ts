import { useEffect, useMemo, useRef, useState } from 'react'
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

/** 그림을 고치는 가장 짧은 사이(ms). 이어 치는 동안에는 이만큼에 한 번만 그림을 고친다 */
const PAINT_GAP = 300

/**
 * 화면에 그려진 다음에야 바뀌는 값. 고치는 장 말고 같은 장을 한 번 더 그리는 그림(왼쪽 목록, 오른쪽 칸의 장 그림)에 쓴다.
 * 글자 하나 칠 때마다 그 그림까지 같이 그리면(컴포넌트 장은 넘치는 컴포넌트 맞추기까지) 친 글자가 그만큼 늦게 보인다.
 * React의 useDeferredValue는 늦춘 그리기를 바로 다음 일로 해서 화면에 그려지기 전에 끝나 버려, 글자가 보이는 때는 그대로였다.
 * 그래서 다음 화면이 그려진 뒤(requestAnimationFrame 다음의 setTimeout)에 바꾼다. 이어 치는 동안에는 PAINT_GAP에 한 번만
 * (느린 PC에서 글자마다 그림까지 그리면 다음 글자가 그만큼 늦게 받아진다). 한 번 누르는 바꾸기는 그려진 뒤 바로 보인다
 */
export function useAfterPaint<T>(value: T): T {
  const [shown, setShown] = useState(value)
  const last = useRef(0)
  useEffect(() => {
    if (Object.is(value, shown)) return
    let t = 0
    const f = requestAnimationFrame(() => {
      t = window.setTimeout(
        () => {
          last.current = performance.now()
          setShown(() => value)
        },
        Math.max(0, last.current + PAINT_GAP - performance.now()),
      )
    })
    return () => {
      cancelAnimationFrame(f)
      window.clearTimeout(t)
    }
  }, [value, shown])
  return shown
}
