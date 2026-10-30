import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react'

/**
 * 쓸 때 크게 보기: 장의 글 칸에 들어가 쓰기 시작하면 장 전체를 키워 그 칸 둘레를 크게 보이고, 쓰기를 끝내면 제 크기로 돌린다.
 * 1280×600 창에서는 장을 0.35배쯤으로 줄여 그려서 본문 글자가 화면에서 9~11px였고, 쓰는 칸의 테가 글에 바짝 붙어 좁아 보였다.
 * 칸만 떼어 큰 입력 상자로 띄우지 않고 장째 키운다: 쓰면서 그 칸의 실제 자리와 줄바꿈, 넘침을 그대로 본다.
 * 키우는 것은 장 틀 안의 transform뿐이라 장 아래 도구 줄, 노트, 옆 칸의 자리와 장 안의 배치는 그대로다(SlideCanvas의 FitSlide).
 */

/** 확대: z는 장을 장 틀에 맞춘 크기의 몇 배인지, x와 y는 장 틀 가운데에 둘 점(캔버스 px) */
export interface Zoom {
  z: number
  x: number
  y: number
}

/** 배율 규칙의 값 */
export const ZOOM = {
  /** 장의 대표 글자(그 장의 글 칸에 가장 많이 쓰인 크기)가 화면에서 이 크기(px)쯤 되게 키운다 (본문 글을 읽기 편한 16~20px의 가운데) */
  read: 18,
  /**
   * 본문의 가장 작은 글자 단계(base.css: 22는 하단 표시와 출처, 26부터 본문). 이 글자가 화면에서 ZOOM.read px가 되는 데 ZOOM.min배가
   * 안 들면 창이 이미 충분히 크다고 보고 어느 장에서도 키우지 않는다(1920×1080 모니터). 장마다 따로 보면 같은 창에서 어떤 장은 커지고
   * 어떤 장은 안 커져 놀랐다
   */
  body: 26,
  /**
   * 키우면 적어도 이만큼, 많아도 이만큼. 덜 키울 거라면 움직임이 도움 없이 어지럽기만 하다. 많아도 장 너비의 70%는 보이게(1 / 0.7):
   * 2배에서는 장 제목이 반쯤 잘리고 비교 장의 오른쪽 글이 밖으로 나갔고, 1.6배에서는 부품 장의 제목, 오른쪽 단, 아래 숫자가 다 잘렸다
   */
  min: 1.3,
  max: Math.min(1.6, 1 / 0.7),
  /** 쓰는 칸(테까지)과 장 틀 끝 사이에 남길 여백 (화면 px) */
  margin: 24,
} as const

/**
 * 장의 대표 글자 크기: 글 칸(하단 표시 빼고)에 가장 많이 쓰인 크기, 같은 수면 작은 쪽. 가장 작은 칸으로 보면 부품 장의 작은 덧붙임
 * 하나 때문에 장 전체를 너무 키웠다
 */
export function typicalSize(sizes: readonly number[]): number {
  const count = new Map<number, number>()
  for (const v of sizes) if (v > 0) count.set(v, (count.get(v) ?? 0) + 1)
  let best = Number.NaN
  for (const [v, n] of count) if (Number.isNaN(best) || n > count.get(best)! || (n === count.get(best) && v < best)) best = v
  return best
}

/**
 * 장 하나의 배율. fs는 그 장의 대표 글자 크기(typicalSize, 캔버스 px), base는 장을 장 틀에 맞춘 배율.
 * 쓰는 칸마다 정하지 않고 장마다 하나로 정해 쓰기를 끝낼 때까지 둔다: 칸을 옮길 때마다(이름 36, 덧붙임 26) 글자가 커졌다 작아졌다 하면 어지럽다.
 * 창이 충분히 크면(ZOOM.body) 1, 아니면 대표 글자가 ZOOM.read px가 되는 배율을 ZOOM.min~ZOOM.max로 자른다
 */
export function zoomFor(fs: number, base: number): number {
  if (!(base > 0) || ZOOM.read / (ZOOM.body * base) < ZOOM.min) return 1
  const z = fs > 0 && Number.isFinite(fs) ? ZOOM.read / (fs * base) : ZOOM.min
  return Math.max(ZOOM.min, Math.min(ZOOM.max, z))
}

/** 한 축의 구간 [a, b] (캔버스 px) */
export type Span = readonly [number, number]

/**
 * 한 축에서 키운 장의 보이는 구간(길이 v)의 시작. must(쓰는 칸, 여백까지)는 꼭 들게 하고, 그 안에서 want의 구간들(앞의 것이 먼저:
 * 칸이 든 항목, 장 제목)이 되도록 함께 들게 치우친다. 들 수 있는 것만 넣고, 남는 자리에서는 prefer(없으면 쓰는 칸을 가운데에)에 가장 가깝게.
 * must가 v보다 길면 must의 앞쪽(글의 시작)을 보인다. 장(0~size) 밖은 보이지 않게
 */
export function viewStart(must: Span, want: readonly Span[], v: number, size: number, prefer?: number): number {
  const clampTo = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))
  let lo = Math.max(0, must[1] - v)
  let hi = Math.min(size - v, must[0])
  if (lo > hi) return clampTo(must[0], 0, Math.max(0, size - v))
  for (const [a, b] of want) {
    const l = Math.max(lo, b - v)
    const h = Math.min(hi, a)
    if (l <= h) {
      lo = l
      hi = h
    }
  }
  return clampTo(prefer ?? (must[0] + must[1]) / 2 - v / 2, lo, hi)
}

// ---------- 켬/끔 (이 브라우저에 남긴다) ----------

const KEY = 'html-maker:zoom-typing'
const subs = new Set<() => void>()

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

let on = read()

export function setZoomTyping(v: boolean) {
  on = v
  try {
    localStorage.setItem(KEY, v ? 'on' : 'off')
  } catch {
    /* 저장이 안 되면 이번에만 */
  }
  subs.forEach((f) => f())
}

/** 쓸 때 크게 보기를 켜 두었는지 (처음에는 켠다) */
export function useZoomTyping(): boolean {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => on,
  )
}

// ---------- 쓰는 칸 따라가기 ----------

/**
 * 손으로 누른 칸을 키울 때 누른 점이 손 아래에 그대로 있지 못하고(제목이나 항목을 함께 보이느라) 이만큼(화면 px) 넘게 옮겨 가면,
 * 두 번 누르기가 끝날 만큼(DOUBLE_WAIT ms) 기다렸다 키운다. 그대로 있으면 손을 떼자마자 키운다: 누른 점을 중심으로 커져서
 * 둘째 누름도 같은 글자에 닿는다
 */
const ANCHOR_SLIP = 6
/** 손으로 눌러 키울 때 장 제목을 함께 보이려고 누른 점을 비켜 가게 해도 되는 거리 (화면 px) */
const HEAD_SLIP = 40
const DOUBLE_WAIT = 220
/** 쓰는 칸에서 초점이 나간 뒤 돌아가기까지 기다리는 시간(ms): '다음 빈칸'처럼 장 밖의 단추를 거쳐 다른 칸으로 가면 줄었다 커지지 않게 */
const RETURN_WAIT = 90

/**
 * 장 틀(canvasRef 안의 .slide-frame) 안에서 지금 쓰는 칸을 따라갈 확대. 쓰는 칸이 없거나 on이 아니면 null.
 * 처음 칸에 들어가면 장의 배율을 정하고(zoomFor), 쓰기를 끝낼 때까지 배율은 두고 자리만 옮긴다.
 * - 손으로 누르면 누른 점을 중심으로 커진다: 커서와 누른 글자가 손 아래에 그대로 있다. 커서는 누르는 순간 서고, 커지는 동안에도 바로 친다
 *   (입력은 확대를 기다리지 않는다. 움직이는 것은 장 틀 안의 transform뿐이다).
 * - 키보드로 들어오면(Tab, Enter, 넘친 칸 보기) 칸을 가운데 가깝게, 되도록 그 칸이 든 항목과 장 제목이 함께 보이게(viewStart).
 * - 키운 채로 다른 칸에 가면 그 칸이 보이는 곳 안이면 움직이지 않고, 아니면 들어올 만큼만 미끄러져 간다.
 * 항목 손잡이로 끄는 동안은 그대로 두고 손을 떼면 돌아간다. 장 밖으로 초점이 나가면(Esc, 바깥 누르기, 다른 장) 돌아간다
 */
export function useTypingZoom(canvasRef: RefObject<HTMLElement | null>, on: boolean, slideId: string): Zoom | null {
  const [zoom, setZoom] = useState<Zoom | null>(null)
  useEffect(() => {
    setZoom(null)
    const root = canvasRef.current
    if (!on || !root) return
    /** 지금 따라가는 칸(.ed), 이 장에서 정한 배율(0은 아직), 지금 확대 */
    let field: HTMLElement | null = null
    let z = 0
    let cur: Zoom | null = null
    /** 손으로 누른 점 (화면 px). 그 누름으로 들어간 칸을 처음 키울 때 쓴다 */
    let anchor: { x: number; y: number } | null = null
    let pressing = false
    let wait = 0
    let raf = 0
    const ro = new ResizeObserver(() => follow())
    // 장이 커지거나 줄어든 뒤에도 손을 움직이기 전까지는 손 아래로 온 칸의 테와 도구 막대를 걷는다 (useTypingStill)
    const hush = () => hushTyping(root)
    const put = (next: Zoom | null) => {
      if (next && cur && next.z === cur.z && Math.abs(next.x - cur.x) < 1 && Math.abs(next.y - cur.y) < 1) return
      if (!next && !cur) return
      hush()
      cur = next
      setZoom(next)
    }

    const slideEl = () => root.querySelector<HTMLElement>('.slide-frame .slide.m-edit')
    /** 지금 쓰는 칸 (장 안의 글 칸에 초점이 있을 때만) */
    const typing = () => {
      const a = document.activeElement
      const slide = slideEl()
      return a instanceof HTMLElement && a.classList.contains('ed-input') && slide?.contains(a) ? a : null
    }

    const release = () => {
      field = null
      z = 0
      anchor = null
      ro.disconnect()
      put(null)
    }

    /** 쓰는 칸에 맞춘 확대와, 손으로 누른 점이 그 확대에서 손 아래를 벗어나는 거리(화면 px). 배율은 이 장에서 처음 잴 때 한 번만 */
    const target = (): { zoom: Zoom | null; slip: number } | undefined => {
      const input = typing()
      const slide = slideEl()
      const frame = slide?.closest<HTMLElement>('.slide-frame')
      if (!input || !slide || !frame) return undefined
      const ed = input.closest<HTMLElement>('.ed') ?? input
      const s = slide.getBoundingClientRect()
      const fr = frame.getBoundingClientRect()
      // 지금(움직이는 중이어도) 장의 배율로 캔버스 px로 바꾼다
      const k = s.width / slide.offsetWidth
      if (!k) return undefined
      const base = frame.offsetWidth / slide.offsetWidth
      if (!z) {
        // 이 장의 글 칸(하단 표시의 출처 빼고)의 대표 글자로
        const sizes = [...slide.querySelectorAll<HTMLElement>('.ed-input')]
          .filter((el) => !el.closest('.s-foot') && el.getClientRects().length)
          .map((el) => Number.parseFloat(getComputedStyle(el).fontSize))
          .filter((v) => v > 0)
        z = zoomFor(typicalSize(sizes), base)
      }
      if (ed !== field) {
        field = ed
        ro.disconnect()
        ro.observe(ed)
      }
      if (z === 1) return { zoom: null, slip: 0 }
      const box = (r: DOMRect) => ({ l: (r.left - s.left) / k, t: (r.top - s.top) / k, r: (r.right - s.left) / k, b: (r.bottom - s.top) / k })
      const f = box((ed.querySelector(':scope > .ed-halo') ?? ed).getBoundingClientRect())
      const S = base * z
      // 손으로 누른 칸은 여백을 덜 챙긴다: 여백을 맞추느라 누른 글자가 손 아래에서 비켜 갔다
      const a = !cur && anchor
      const m = (a ? ZOOM.margin / 2 : ZOOM.margin) / S
      const vw = frame.offsetWidth / S
      const vh = frame.offsetHeight / S
      // 쓰는 칸이 보이는 곳보다 넓거나 높으면(긴 글) 칸 전체 대신 쓰는 자리(커서) 둘레를
      const sel = getSelection()
      const caretR = sel?.rangeCount && input.contains(sel.anchorNode) ? sel.getRangeAt(0).getClientRects()[0] : undefined
      const caret = caretR ? box(caretR) : null
      const fs = Number.parseFloat(getComputedStyle(input).fontSize) || 30
      let mx: Span = [f.l - m, f.r + m]
      let my: Span = [f.t - m, f.b + m]
      if (mx[1] - mx[0] > vw && caret) {
        const from = Math.max(f.l, caret.l - fs * 6)
        mx = [from - m, from + vw - 2 * m]
      }
      if (my[1] - my[0] > vh && caret) my = [caret.t - fs - m, caret.b + fs + m]
      // 함께 보이면 좋은 것: 칸이 든 항목(줄, 카드), 장 제목의 첫 줄. 제목은 옆으로는 시작 쪽만 본다
      const item = ed.parentElement?.closest('.it, .bk')
      const head = slide.querySelector('.s-title') ?? slide.querySelector(':scope > .s-head')
      const ib = item && box(item.getBoundingClientRect())
      const hb = head && box(head.getBoundingClientRect())
      const headLine = hb && head ? Math.min(hb.b, hb.t + (Number.parseFloat(getComputedStyle(head).lineHeight) || 80)) : 0
      // 이미 키운 채로 옮겨 가면 지금 자리에서 가장 덜 움직이게, 항목만 함께 (제목까지 챙기면 칸을 옮길 때마다 위아래로 오갔다)
      const was = cur && { x: cur.x - vw / 2, y: cur.y - vh / 2 }
      // 손으로 눌러 처음 키우면 누른 점이 손 아래에 그대로 있게
      const prefer = was || (a ? { x: (a.x - s.left) / k - (a.x - fr.left) / S, y: (a.y - s.top) / k - (a.y - fr.top) / S } : undefined)
      const place = (head: boolean) => {
        const wantX: Span[] = [...(ib ? [[ib.l, ib.r] as Span] : []), ...(hb && head ? [[hb.l, hb.l + 1] as Span] : [])]
        const wantY: Span[] = [...(ib ? [[ib.t, ib.b] as Span] : []), ...(hb && head ? [[hb.t, headLine] as Span] : [])]
        const x = viewStart(mx, wantX, vw, slide.offsetWidth, prefer?.x)
        const y = viewStart(my, wantY, vh, slide.offsetHeight, prefer?.y)
        return { x, y, slip: a && prefer ? Math.hypot(x - prefer.x, y - prefer.y) * S : 0 }
      }
      // 장 제목까지 함께 보이려면 누른 글자가 손 아래에서 HEAD_SLIP px 넘게 비켜 가야 하면 제목은 챙기지 않는다 (손 아래가 먼저)
      let at = place(!was)
      if (!was && at.slip > HEAD_SLIP) at = place(false)
      return { zoom: { z, x: at.x + vw / 2, y: at.y + vh / 2 }, slip: at.slip }
    }

    const measure = () => {
      raf = 0
      const t = target()
      anchor = null
      if (t) return put(t.zoom)
      // 장 안의 다른 것(항목 손잡이를 키보드로)에 초점이 있으면 둔다. 장 밖이면 돌아간다
      if (!slideEl()?.contains(document.activeElement)) release()
    }
    const follow = () => {
      if (!pressing && field && !raf) raf = requestAnimationFrame(measure)
    }

    const onFocusIn = () => {
      window.clearTimeout(wait)
      if (pressing) return
      // 키보드로 들어오면 바로
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    const onFocusOut = () => {
      // 다음 칸으로 옮겨 가는 중일 수 있어서 초점이 자리 잡은 뒤에 본다
      window.clearTimeout(wait)
      wait = window.setTimeout(() => {
        if (!typing() && !slideEl()?.contains(document.activeElement)) release()
      }, RETURN_WAIT)
    }
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      pressing = true
      anchor = { x: e.clientX, y: e.clientY }
      window.clearTimeout(wait)
    }
    const onUp = (e: PointerEvent) => {
      if (!pressing) return
      pressing = false
      window.clearTimeout(wait)
      // 글 칸이 아닌 것(항목 손잡이로 끌기를 마친 뒤 같은)을 누르고 떼면 돌아간다
      if (!typing()) {
        wait = window.setTimeout(release, RETURN_WAIT)
        return
      }
      // 끌어서 글을 골랐으면 뗀 자리를 중심으로
      if (anchor && Math.hypot(e.clientX - anchor.x, e.clientY - anchor.y) > 4) anchor = { x: e.clientX, y: e.clientY }
      const t = target()
      if (t && t.slip > ANCHOR_SLIP) {
        const keep = anchor
        wait = window.setTimeout(() => {
          anchor = keep
          measure()
        }, DOUBLE_WAIT)
      } else measure()
    }
    // 창 크기가 바뀌면 배율부터 다시. 장 틀이 새 크기로 그려진 뒤에 잰다 (FitSlide가 ResizeObserver로 다시 그린다)
    let resized = 0
    const onResize = () => {
      window.clearTimeout(resized)
      resized = window.setTimeout(() => {
        if (!field) return
        field = null
        z = 0
        cur = null
        measure()
      }, 120)
    }

    const off = new AbortController()
    const { signal } = off
    root.addEventListener('focusin', onFocusIn, { signal })
    root.addEventListener('focusout', onFocusOut, { signal })
    root.addEventListener('pointerdown', onDown, { capture: true, signal })
    window.addEventListener('pointerup', onUp, { capture: true, signal })
    window.addEventListener('pointercancel', onUp, { capture: true, signal })
    window.addEventListener('resize', onResize, { signal })
    // 긴 글에서 쓰는 줄이 바뀌면 따라간다
    root.addEventListener('input', follow, { signal })
    // 이미 쓰는 중에 켰으면 바로
    if (typing()) raf = requestAnimationFrame(measure)
    return () => {
      off.abort()
      ro.disconnect()
      window.clearTimeout(wait)
      window.clearTimeout(resized)
      cancelAnimationFrame(raf)
    }
  }, [canvasRef, on, slideId])
  return zoom
}

// ---------- 쓰는 동안 손을 움직이기 전까지 ----------

/** 마지막으로 본 손의 자리(화면 px)와, 걷기 시작할 때의 손의 자리 */
let lastPt = { x: -1, y: -1 }
const stillFrom = new WeakMap<HTMLElement, { x: number; y: number }>()

/** 손을 움직일 때까지 장 위의 컴포넌트 도구 막대와 손 아래 칸의 테를 걷는다 (useTypingStill) */
export function hushTyping(root: HTMLElement) {
  stillFrom.set(root, lastPt)
  root.classList.add('is-typing-still')
}

/**
 * 장의 글 칸에 쓰는 동안 손을 움직이기 전까지: 장 위의 컴포넌트 도구 막대를 흐리게 숨기고(blocks.css), 가만히 있는 손 아래 칸에 손을 올린 테를
 * 두르지 않는다(edit.css). 막대가 쓰는 줄 바로 위나 이웃 글을 덮었고, 손 아래 칸의 테가 쓰는 칸의 테처럼 보였다. 손을 4px 넘게 움직이면 다시 보인다.
 * 쓸 때 크게 보기를 꺼도 한다
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
