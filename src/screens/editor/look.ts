import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
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

/** 이어 치는 것으로 보는 사이(ms). 앞 고침에서 이만큼 안에 또 고치면 손을 쉴 때까지(이만큼 조용할 때까지) 그림을 미룬다 */
const QUIET = 400

/**
 * 화면에 그려진 다음에야 바뀌는 값. 고치는 장 말고 같은 장을 한 번 더 그리는 그림(왼쪽 목록, 오른쪽 칸의 장 그림)에 쓴다.
 * 글자 하나 칠 때마다 그 그림까지 같이 그리면(레이아웃 장은 채움 맞추기, 컴포넌트 장은 넘치는 컴포넌트 맞추기까지) 친 글자가 그만큼 늦게 보인다.
 * React의 useDeferredValue는 늦춘 그리기를 바로 다음 일로 해서 화면에 그려지기 전에 끝나 버려, 글자가 보이는 때는 그대로였다.
 * 한 번 누르는 바꾸기는 다음 화면이 그려진 뒤(requestAnimationFrame 다음의 setTimeout) 바로 보인다. 이어 치는 동안에는 그림을 고치지 않고,
 * 손을 쉬면(QUIET ms 조용하면) 브라우저가 한가할 때(requestIdleCallback) 한 번 고친다: 300ms마다 한 번씩 고치던 때는 느린 PC에서
 * 그 글자만 늦게 받아져 치는 중에 걸리는 느낌이 났다
 */
export function useAfterPaint<T>(value: T): T {
  const [shown, setShown] = useState(value)
  const changed = useRef(Number.NEGATIVE_INFINITY)
  useEffect(() => {
    if (Object.is(value, shown)) return
    const now = performance.now()
    const burst = now - changed.current < QUIET
    changed.current = now
    const apply = () => setShown(() => value)
    let f = 0
    let t = 0
    let idle = 0
    if (!burst) f = requestAnimationFrame(() => (t = window.setTimeout(apply)))
    else
      t = window.setTimeout(() => {
        if (typeof requestIdleCallback === 'function') idle = requestIdleCallback(apply, { timeout: 300 })
        else apply()
      }, QUIET)
    return () => {
      cancelAnimationFrame(f)
      window.clearTimeout(t)
      if (idle) cancelIdleCallback(idle)
    }
  }, [value, shown])
  return shown
}

/** 그림을 그릴 차례를 기다리는 것들 (먼저 온 것부터) */
const soon: (() => void)[] = []
let pumping = false
/** 한 일(task)에 그림을 그리는 시간의 끝(ms). 넘으면 나머지는 다음 일로 넘겨 화면이 그 사이에 그려지고 손을 받는다 */
const SLICE = 12

function pump() {
  const t0 = performance.now()
  while (soon.length && performance.now() - t0 < SLICE) flushSync(soon.shift()!)
  if (soon.length) window.setTimeout(pump)
  else pumping = false
}

/**
 * 작은 장 그림을 지금 그릴지. now면 처음부터 그린다. 아니면 화면이 한 번 그려진 뒤 차례대로, 한 일에 SLICE ms까지 그린다.
 * 장 그림 하나는 장을 그리고 글을 맞추느라(fitBlocks) 느린 PC에서 20~50ms가 든다. 새 슬라이드 창의 그림 아홉 장이나 새로 더한 장의
 * 목록 그림까지 누른 그 일에서 한꺼번에 그리면 창이 0.3초 동안 뜨지 않았다. 먼저 창과 고치는 장을 보이고 그림은 바로 뒤따라 채운다
 */
export function useDrawSoon(now = false): boolean {
  const [ready, setReady] = useState(now)
  useEffect(() => {
    if (ready) return
    const wake = () => setReady(true)
    soon.push(wake)
    if (!pumping) {
      pumping = true
      requestAnimationFrame(() => window.setTimeout(pump))
    }
    return () => {
      const i = soon.indexOf(wake)
      if (i >= 0) soon.splice(i, 1)
    }
  }, [ready])
  return ready
}
