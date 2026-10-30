import { useEffect, type RefObject } from 'react'

// ---------- 쓰는 동안 손을 움직이기 전까지 ----------

/** 마지막으로 본 손의 자리(화면 px)와, 걷기 시작할 때의 손의 자리 */
let lastPt = { x: -1, y: -1 }
const stillFrom = new WeakMap<HTMLElement, { x: number; y: number }>()

/** 손을 움직일 때까지 손 아래 칸의 테를 걷는다 (useTypingStill) */
function hushTyping(root: HTMLElement) {
  stillFrom.set(root, lastPt)
  root.classList.add('is-typing-still')
}

/**
 * 장의 글 칸에 쓰는 동안 손을 움직이기 전까지: 가만히 있는 손 아래 칸에 손을 올린 테를 두르지 않는다(edit.css).
 * 손 아래 칸의 테가 쓰는 칸의 테처럼 보였다. 손을 4px 넘게 움직이면 다시 보인다
 */
export function useTypingStill(canvasRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = canvasRef.current
    if (!root) return
    const inSlide = (t: EventTarget | null) => t instanceof HTMLElement && t.classList.contains('ed-input') && !!t.closest('.slide-frame .slide.m-edit')
    const off = new AbortController()
    const { signal } = off
    root.addEventListener('focusin', (e) => inSlide(e.target) && hushTyping(root), { signal })
    root.addEventListener('input', (e) => inSlide(e.target) && hushTyping(root), { signal })
    window.addEventListener(
      'pointermove',
      (e) => {
        lastPt = { x: e.clientX, y: e.clientY }
        const from = stillFrom.get(root)
        if (from && Math.hypot(lastPt.x - from.x, lastPt.y - from.y) > 4) {
          stillFrom.delete(root)
          root.classList.remove('is-typing-still')
        }
      },
      { passive: true, signal },
    )
    return () => {
      off.abort()
      root.classList.remove('is-typing-still')
    }
  }, [canvasRef])
}
