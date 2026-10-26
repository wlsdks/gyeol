import { useLayoutEffect, type RefObject } from 'react'

/**
 * 편집할 때 칸마다 두르는 면과 점선(.ed-halo)의 넓이를 칸 사이 틈에 맞춘다.
 * 늘 같은 넓이(위아래, 옆 12px)로 두르면 제목과 설명처럼 바짝 붙은 칸끼리 면이 겹쳐서 어느 칸이 어느 칸인지 알 수 없다.
 * 그래서 이웃한 칸과의 틈을 재서, 틈의 절반에서 조금 뺀 만큼만 두른다 (틈이 넉넉하면 정한 넓이까지).
 */

/** 두르고 싶은 넓이(캔버스 px): 옆은 넉넉히, 위아래는 조금 */
const WANT = { x: 14, y: 10 }
/** 이웃한 두 칸의 면 사이에 남길 틈 */
const KEEP = 6
/**
 * 항목(.it)과 부품 칸(.bk) 밖으로 나가도 되는 넓이. 항목의 구분선 끝보다 면이 한참 삐져나오거나,
 * 부품을 고르면 칸 둘레 14px 밖에 생기는 테두리에 면이 닿지 않게. 0이면 글자가 면 끝에 붙어 답답해서 조금은 둔다
 */
const CELL_OUT = 7

interface Box {
  el: HTMLElement
  t: number
  r: number
  b: number
  l: number
  /** 두를 넓이: 위, 오른쪽, 아래, 왼쪽 */
  h: [number, number, number, number]
}

/** 이 안의 편집 칸(.ed)마다 --ed-t, --ed-r, --ed-b, --ed-l을 정한다. 다 정한 칸 상자를 돌려준다 (점검용) */
export function placeHalos(slide: HTMLElement): Box[] {
  const s = slide.getBoundingClientRect()
  // 편집 화면은 장을 줄여 그린다. 캔버스 px로 바꿔 잰다
  const k = slide.offsetWidth ? s.width / slide.offsetWidth : 1
  if (!k) return []
  const boxes: Box[] = []
  for (const el of slide.querySelectorAll<HTMLElement>('.ed')) {
    const q = el.getBoundingClientRect()
    if (!q.width && !q.height) continue
    const box: Box = { el, t: (q.top - s.top) / k, r: (q.right - s.left) / k, b: (q.bottom - s.top) / k, l: (q.left - s.left) / k, h: [WANT.y, WANT.x, WANT.y, WANT.x] }
    for (const wrap of [el.parentElement?.closest('.it'), el.closest('.bk')]) {
      const c = wrap?.getBoundingClientRect()
      if (!c) continue
      const room = (d: number) => Math.max(0, d / k + CELL_OUT)
      box.h = [
        Math.min(box.h[0], room(q.top - c.top)),
        Math.min(box.h[1], room(c.right - q.right)),
        Math.min(box.h[2], room(c.bottom - q.bottom)),
        Math.min(box.h[3], room(q.left - c.left)),
      ]
    }
    boxes.push(box)
    inkOut(el, q, k)
  }
  const room = (gap: number) => Math.max(0, (gap - KEEP) / 2)
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i]
    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j]
      // 가로 틈과 세로 틈 (겹치면 음수)
      const gx = Math.max(b.l - a.r, a.l - b.r)
      const gy = Math.max(b.t - a.b, a.t - b.b)
      // 면을 다 둘러도 닿지 않는 칸은 건너뛴다
      if (gx >= WANT.x * 2 + KEEP || gy >= WANT.y * 2 + KEEP) continue
      // 나란히 있으면 옆을, 위아래로 있으면 위아래를 줄인다. 비스듬히 있으면 틈이 넓은 쪽을 (덜 줄여도 된다).
      // 칸끼리 조금 겹치면(줄여 그린 글자의 반올림 같은) 덜 겹친 쪽을 0으로
      const side = gx < 0 && gy < 0 ? gx >= gy : gy < 0 || (gx >= 0 && gx >= gy)
      if (side) {
        const left = a.l + a.r <= b.l + b.r ? [a, b] : [b, a]
        left[0].h[1] = Math.min(left[0].h[1], room(gx))
        left[1].h[3] = Math.min(left[1].h[3], room(gx))
      } else {
        const top = a.t + a.b <= b.t + b.b ? [a, b] : [b, a]
        top[0].h[2] = Math.min(top[0].h[2], room(gy))
        top[1].h[0] = Math.min(top[1].h[0], room(gy))
      }
    }
  }
  for (const box of boxes) {
    const [t, r, b, l] = box.h.map((v) => `${Math.floor(v)}px`)
    const st = box.el.style
    if (st.getPropertyValue('--ed-t') !== t) st.setProperty('--ed-t', t)
    if (st.getPropertyValue('--ed-r') !== r) st.setProperty('--ed-r', r)
    if (st.getPropertyValue('--ed-b') !== b) st.setProperty('--ed-b', b)
    if (st.getPropertyValue('--ed-l') !== l) st.setProperty('--ed-l', l)
  }
  return boxes
}

/**
 * 글자가 칸 상자 위아래로 나왔으면 쓰는 중의 실선을 둘러야 할 넓이(나온 만큼과 글자에서 띄울 화면 4px, 캔버스 px)를 --ed-ink-t,
 * --ed-ink-b로 둔다. 줄 높이가 글자 높이보다 낮은 큰 숫자와 위아래 빈 키를 잘라 낸 숫자(text-box)는 글자가 칸 상자 밖으로 나와서,
 * 쓰는 중의 실선(edit.css)이 '억', '원' 같은 글자를 가로질렀다. 글자의 줄 상자(위아래 빈 키까지)로 재면 실선이 위 칸의 글까지
 * 내려가서, 그려지는 글자 모양으로 잰다. 빈 칸은 안내 글로 잰다. 나오지 않은 칸은 두지 않는다: 띄울 4px를 CSS에서 늘 더하면
 * 이웃 칸과 가까워 줄여 둔 넓이(--ed-t)를 넘어, 글자가 나오지도 않은 칸의 실선이 이웃 칸의 글에 닿았다
 */
function inkOut(el: HTMLElement, q: DOMRect, k: number) {
  const input = el.querySelector(':scope > .ed-input')
  const text = input?.textContent ? input : el.querySelector(':scope > .ed-hint')
  let t = 0
  let b = 0
  if (text?.textContent) {
    const r = document.createRange()
    r.selectNodeContents(text)
    const lines = [...r.getClientRects()].filter((x) => x.height)
    const top = Math.min(...lines.map((x) => x.top))
    const bottom = Math.max(...lines.map((x) => x.bottom))
    if (lines.length && (top < q.top || bottom > q.bottom)) {
      const ink = inkOf(text)
      t = (q.top - top) / k - ink.top
      b = (bottom - q.bottom) / k - ink.bottom
    }
  }
  for (const [name, v] of [['--ed-ink-t', t], ['--ed-ink-b', b]] as const) {
    const want = v > 0 ? `${Math.ceil(v + 4 / k)}px` : ''
    if (el.style.getPropertyValue(name) === want) continue
    if (want) el.style.setProperty(name, want)
    else el.style.removeProperty(name)
  }
}

let pen: CanvasRenderingContext2D | null | undefined
/** 줄 상자의 위아래 끝에서 그려지는 글자까지의 빈 키(캔버스 px) */
function inkOf(el: Element): { top: number; bottom: number } {
  pen ??= document.createElement('canvas').getContext('2d')
  if (!pen) return { top: 0, bottom: 0 }
  const cs = getComputedStyle(el)
  pen.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  const m = pen.measureText(el.textContent ?? '')
  return {
    top: Math.max(0, m.fontBoundingBoxAscent - m.actualBoundingBoxAscent),
    bottom: Math.max(0, m.fontBoundingBoxDescent - m.actualBoundingBoxDescent),
  }
}

/**
 * 편집하는 장의 칸 면을 그릴 때마다 맞춘다. 글을 쓰면 칸이 커지고, 부품을 옮기면 칸이 움직이고,
 * 글꼴이 늦게 오면 글 폭이 바뀌어서, 그리고 나서와 움직임이 끝날 즈음에 한 번 더 잰다
 */
export function useHalos(ref: RefObject<HTMLElement | null>, on: boolean) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!on || !el) return
    placeHalos(el)
    const later = setTimeout(() => placeHalos(el), 700)
    let alive = true
    if (document.fonts?.status === 'loading') document.fonts.ready.then(() => alive && placeHalos(el))
    const ro = new ResizeObserver(() => placeHalos(el))
    ro.observe(el)
    return () => {
      alive = false
      clearTimeout(later)
      ro.disconnect()
    }
  })
}
