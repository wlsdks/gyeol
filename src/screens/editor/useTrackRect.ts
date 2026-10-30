import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * 장 위에 띄운 것(고른 것의 도구와 테, 장 아래 빈자리)을 장 안의 무엇에 맞춰 둔다. 매 프레임 재지 않고 자리가 바뀔 만한
 * 때만, 한 프레임에 한 번 measure를 부른다: 다시 그릴 때마다, root(무대)의 크기, root 안의 글과 모양, 그림을 다 받았을 때,
 * transition이 끝날 때, 스크롤, 창 크기, 글꼴을 다 받았을 때.
 * measure가 true를 돌려주면 다음 프레임에 한 번 더 잰다 (고른 것이 움직이는 동안 따라가거나, 그린 뒤의 너비로 다시 잴 때).
 * (예전에는 고른 것이 있는 동안 매 프레임 쟀다. 가만히 있어도 CPU를 써서 느린 노트북의 배터리를 닳게 했다)
 */
export function useTrackRect(root: () => HTMLElement | null, measure: () => boolean | void) {
  const fn = useRef(measure)
  fn.current = measure
  const [frame] = useState(() => {
    let raf = 0
    let live = false
    const run = () => {
      raf = 0
      if (live && fn.current()) schedule()
    }
    const schedule = () => {
      if (live && !raf) raf = requestAnimationFrame(run)
    }
    return {
      schedule,
      start: () => {
        live = true
      },
      stop: () => {
        live = false
        cancelAnimationFrame(raf)
        raf = 0
      },
    }
  })
  // 다시 그릴 때마다(덱이나 고른 것이 바뀌면) 바로 잰다
  useLayoutEffect(() => {
    if (fn.current()) frame.schedule()
  })
  // 그 밖에는 바뀔 때만
  useEffect(() => {
    frame.start()
    const el = root()
    const off = new AbortController()
    const { signal } = off
    const ro = new ResizeObserver(frame.schedule)
    // 띄운 것이 root 안에 있으면 여기서 고친 style도 걸린다. 한 번 더 재도 값이 같으면 다시 그리지 않으니 거기서 멈춘다
    const mo = new MutationObserver(frame.schedule)
    if (el) {
      ro.observe(el)
      mo.observe(el, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] })
      el.addEventListener('load', frame.schedule, { capture: true, signal })
      el.addEventListener('transitionend', frame.schedule, { capture: true, signal })
    }
    window.addEventListener('resize', frame.schedule, { signal })
    window.addEventListener('scroll', frame.schedule, { capture: true, signal })
    void document.fonts?.ready.then(frame.schedule)
    // 처음 그릴 때는 무대의 ref가 아직 붙기 전일 수 있다
    frame.schedule()
    return () => {
      frame.stop()
      off.abort()
      ro.disconnect()
      mo.disconnect()
    }
    // root는 처음 붙을 때 한 번만 읽는다 (무대는 편집기가 있는 동안 그대로다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame])
}

/**
 * el이 든 장에서 움직임(옮긴 뒤 제자리로 가는 것, 발표 움직임 미리 보기)이 도는 중인지. 도는 동안은 프레임마다 따라간다.
 * 장을 키우거나 돌리는 중(쓸 때 크게 보기, zoom.ts)도: 장 바깥의 틀(.slide-scale)에서 움직여서 장 안만 보면 놓친다
 */
export function moving(el: Element): boolean {
  const slide = el.closest('.slide') ?? el
  const run = (a: Animation) => a.playState === 'running' || a.pending
  return slide.getAnimations({ subtree: true }).some(run) || !!slide.closest('.slide-scale')?.getAnimations().some(run)
}

/**
 * el이 든 장에서 화면에 보이는 곳. 장을 키우면(쓸 때 크게 보기) 장의 네모가 장 틀보다 커지고 틀 밖은 잘려 보이지 않는다.
 * 장 위에 띄우는 것(고른 것의 면, 도구 막대)은 이 안에서 자리를 잡는다
 */
export function shownRect(el: Element): DOMRect | undefined {
  const s = el.closest('.slide')?.getBoundingClientRect()
  const f = el.closest('.slide-frame')?.getBoundingClientRect()
  if (!s || !f) return s
  const left = Math.max(s.left, f.left)
  const top = Math.max(s.top, f.top)
  return new DOMRect(left, top, Math.max(0, Math.min(s.right, f.right) - left), Math.max(0, Math.min(s.bottom, f.bottom) - top))
}
