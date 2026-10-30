import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react'

/**
 * 쓸 때 크게 보기: 장의 글 칸에 들어가 쓰기 시작하면 장 전체를 그 칸이 장 틀 가운데 오게 키우고, 쓰기를 끝내면 제 크기로 돌린다.
 * 1280×600 창에서는 장을 0.35배쯤으로 줄여 그려서 본문 글자가 화면에서 9~11px였고, 쓰는 칸의 테가 글에 바짝 붙어 좁아 보였다.
 * 칸만 떼어 큰 입력 상자로 띄우지 않고 장째 키운다: 쓰면서 그 칸의 실제 자리와 줄바꿈, 넘침을 그대로 본다.
 * 키우는 것은 장 틀 안의 transform뿐이라 장 아래 도구 줄, 노트, 옆 칸의 자리는 그대로다(SlideCanvas의 FitSlide).
 */

/** 확대: z는 장을 장 틀에 맞춘 크기의 몇 배인지, x와 y는 장 틀 가운데에 둘 점(캔버스 px) */
export interface Zoom {
  z: number
  x: number
  y: number
}

/** 배율 규칙의 값 */
export const ZOOM = {
  /** 쓰는 칸의 글자가 화면에서 이 크기(px)쯤 되게 키운다 (본문 글을 읽기 편한 16~20px의 가운데) */
  read: 18,
  /** 이보다 덜 키울 거라면 키우지 않는다: 큰 창이나 큰 글자(제목)에서 조금 움직이는 것은 도움 없이 어지럽기만 하다 */
  min: 1.2,
  /** 가장 크게 (장의 한 귀퉁이만 보여 어디인지 잃지 않게) */
  max: 3,
  /** 키운 칸(테까지)과 장 틀 끝 사이에 남길 여백 (화면 px) */
  margin: 28,
  /** 칸이 이 줄 수보다 높으면 높이로는 막지 않는다: 긴 글은 칸 전체 대신 쓰는 줄을 따라간다 */
  lines: 3,
  /**
   * 키운 채로 다른 칸에 가면(Tab), 그 칸의 글자가 지금 배율에서 이 사이(화면 px)이고 틀에 들면 배율을 그대로 둔다. 칸마다 글자 크기가
   * 조금씩 달라(이름 36, 덧붙임 26) 칸을 옮길 때마다 장이 커졌다 작아졌다 하면 어지럽다
   */
  keep: [15, 24],
} as const

/**
 * 배율. fs는 칸의 글자 크기, box는 칸(테까지)의 크기(둘 다 캔버스 px), base는 장을 장 틀에 맞춘 배율, view는 장 틀의 크기(화면 px).
 * 글자가 ZOOM.read px가 되는 배율과, 칸의 너비(와 세 줄까지의 높이)가 장 틀 안에 드는 배율 가운데 작은 쪽. ZOOM.min보다 작으면 1
 */
export function zoomFor(fs: number, box: { w: number; h: number }, base: number, view: { w: number; h: number }, lineH = fs * 1.4, prev = 1): number {
  if (!(fs > 0 && base > 0 && box.w > 0)) return 1
  const want = ZOOM.read / (fs * base)
  const fitW = (view.w - ZOOM.margin * 2) / (box.w * base)
  const fitH = (view.h - ZOOM.margin * 2) / (Math.min(box.h, lineH * ZOOM.lines) * base)
  const fit = Math.min(fitW, fitH, ZOOM.max)
  // 지금 배율로도 읽기 좋고 틀에 들면 그대로 (ZOOM.keep)
  const shown = fs * base * prev
  if (prev > 1 && prev <= fit && shown >= ZOOM.keep[0] && shown <= ZOOM.keep[1]) return prev
  const z = Math.min(want, fit)
  return z >= ZOOM.min ? z : 1
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

/** 손으로 누른 뒤 키우기까지 기다리는 시간(ms): 두 번 눌러 낱말 고르기, 끌어서 글 고르기를 하는 동안 장이 손 아래에서 움직이지 않게 */
const PRESS_WAIT = 260

/**
 * 장 틀(canvasRef 안의 .slide-frame) 안에서 지금 쓰는 칸을 따라갈 확대. 쓰는 칸이 없거나 on이 아니면 null.
 * 칸에 들어가면 그 칸으로 배율을 정하고, 같은 칸에서 쓰는 동안은 배율을 두고 자리만 따라간다(글자가 커졌다 작아졌다 하지 않게).
 * Tab, Enter로 다른 칸에 가면 그 칸의 배율로 옮겨 간다. 장 안의 단추(항목 손잡이)로 초점이 옮겨 가면 그대로 둔다: 끄는 동안
 * 장이 손 아래에서 줄어들지 않게. 장 밖으로 초점이 나가면(Esc, 바깥 누르기, 다른 장) 돌아간다
 */
export function useTypingZoom(canvasRef: RefObject<HTMLElement | null>, on: boolean, slideId: string): Zoom | null {
  const [zoom, setZoom] = useState<Zoom | null>(null)
  useEffect(() => {
    setZoom(null)
    const root = canvasRef.current
    if (!on || !root) return
    /** 지금 따라가는 칸(.ed)과 그 칸에서 정한 배율 */
    let field: HTMLElement | null = null
    let z = 1
    let pressing = false
    let wait = 0
    let raf = 0
    const ro = new ResizeObserver(() => follow())
    // 장이 커지거나 줄면 가만히 있는 손 아래로 다른 칸이 와서, 그 칸에 손을 올린 테가 쓰는 칸의 테처럼 보였다. 손을 움직일 때까지 걷는다(edit.css)
    let still: { x: number; y: number } | null = null
    let pt = { x: -1, y: -1 }
    const hush = () => {
      still = pt
      root.classList.add('is-zoom-still')
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
      z = 1
      ro.disconnect()
      setZoom((p) => (p && hush(), null))
    }

    /** 쓰는 칸에 맞춰 잰다. 같은 칸이면 배율은 그대로 */
    const measure = () => {
      raf = 0
      const input = typing()
      const slide = slideEl()
      const frame = slide?.closest<HTMLElement>('.slide-frame')
      if (!input || !slide || !frame) {
        // 장 안의 다른 것(항목 손잡이, 빼기)에 초점이 있으면 둔다. 장 밖이면 돌아간다
        if (!slide?.contains(document.activeElement)) release()
        return
      }
      const ed = input.closest<HTMLElement>('.ed') ?? input
      const s = slide.getBoundingClientRect()
      // 지금(움직이는 중이어도) 장의 배율로 캔버스 px로 바꾼다
      const k = s.width / slide.offsetWidth
      if (!k) return
      const base = frame.offsetWidth / slide.offsetWidth
      const halo = ed.querySelector<HTMLElement>(':scope > .ed-halo')
      const r = (halo ?? ed).getBoundingClientRect()
      const box = { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k }
      const cs = getComputedStyle(input)
      const fs = Number.parseFloat(cs.fontSize) || 30
      const lineH = Number.parseFloat(cs.lineHeight) || fs * 1.4
      if (ed !== field) {
        field = ed
        ro.disconnect()
        ro.observe(ed)
        z = zoomFor(fs, box, base, { w: frame.offsetWidth, h: frame.offsetHeight }, lineH, z)
      }
      if (z === 1) return setZoom(null)
      // 칸이 키운 틀보다 높으면(긴 글) 칸 가운데 대신 쓰는 줄을 가운데에
      let y = box.y + box.h / 2
      if (box.h * base * z > frame.offsetHeight - ZOOM.margin * 2) {
        const caret = getSelection()?.rangeCount ? getSelection()!.getRangeAt(0).getClientRects()[0] : undefined
        y = caret ? (caret.top + caret.height / 2 - s.top) / k : box.y + lineH / 2
      }
      const next = { z, x: Math.round(box.x + box.w / 2), y: Math.round(y) }
      setZoom((p) => {
        if (p && p.z === next.z && Math.abs(p.x - next.x) < 2 && Math.abs(p.y - next.y) < 2) return p
        hush()
        return next
      })
    }
    const follow = () => {
      if (!pressing && field && !raf) raf = requestAnimationFrame(measure)
    }

    const onFocusIn = () => {
      window.clearTimeout(wait)
      if (pressing) return
      // 키보드로 들어오면(Tab, Enter, 넘친 칸 보기) 바로. 손은 앞 칸 위에 남아 있으니 그 칸의 손 올린 테도 걷는다
      hush()
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    const onFocusOut = () => {
      // 다음 칸으로 옮겨 가는 중일 수 있어서 초점이 자리 잡은 뒤에 본다
      window.clearTimeout(wait)
      wait = window.setTimeout(() => {
        if (!typing() && !slideEl()?.contains(document.activeElement)) release()
      }, 0)
    }
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      pressing = true
      window.clearTimeout(wait)
    }
    const onUp = () => {
      if (!pressing) return
      pressing = false
      window.clearTimeout(wait)
      wait = window.setTimeout(() => {
        if (typing()) measure()
        else if (!slideEl()?.contains(document.activeElement)) release()
      }, PRESS_WAIT)
    }
    // 창 크기가 바뀌면 배율부터 다시. 장 틀이 새 크기로 그려진 뒤에 잰다 (FitSlide가 ResizeObserver로 다시 그린다)
    let resized = 0
    const onResize = () => {
      window.clearTimeout(resized)
      resized = window.setTimeout(() => {
        if (!field) return
        field = null
        z = 1
        measure()
      }, 120)
    }

    const onMove = (e: PointerEvent) => {
      pt = { x: e.clientX, y: e.clientY }
      if (still && Math.hypot(pt.x - still.x, pt.y - still.y) > 4) {
        still = null
        root.classList.remove('is-zoom-still')
      }
    }

    const off = new AbortController()
    const { signal } = off
    window.addEventListener('pointermove', onMove, { passive: true, signal })
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
      root.classList.remove('is-zoom-still')
    }
  }, [canvasRef, on, slideId])
  return zoom
}
