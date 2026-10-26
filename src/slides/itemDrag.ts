import { flushSync } from 'react-dom'
import { gestureKey } from '../lib/pointerSession'

/**
 * 항목(카드, 줄, 단계, 막대)을 손잡이로 끌어 순서를 바꾼다.
 *
 * 끄는 동안 순서를 바로 바꿔 그린다(되돌리기는 한 번으로 묶는다). 그래서 이웃 항목이 비켜 나는 자리와
 * 크기가 실제로 놓였을 때와 같다: 카드 격자든, 높이가 다른 줄이든, 가로로 놓인 단계든 같은 방법으로 된다.
 * 순서가 바뀔 때마다 이웃은 옛 자리에서 새 자리로 미끄러지고(FLIP), 끄는 항목은 손 아래에 붙어 있는다.
 *
 * 자리는 transform이 걸리지 않은 상자(offsetLeft, offsetTop)로 잰다. 미끄러지는 중인 이웃을 재면
 * 놓을 자리가 떨린다.
 */

const SLIDE_MS = 220
const SETTLE =
  'linear(0, 0.0861, 0.2602, 0.4453, 0.6081, 0.7349, 0.8271, 0.8923, 0.9373, 0.9673, 0.9862, 0.9973, 1.0029, 1.005, 1.0049, 1.0036, 1.002, 1.0007, 1)'
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

interface Box {
  x: number
  y: number
  w: number
  h: number
}

const boxOf = (el: HTMLElement): Box => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight })

/** 같은 목록의 항목들 (손잡이에 적힌 번호 순서) */
function siblingsOf(item: HTMLElement): HTMLElement[] {
  const list = item.parentElement
  if (!list) return [item]
  return [...list.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains('it') && !!c.querySelector(':scope > .it-grip'))
}

/**
 * 끄는 항목의 가운데가 어느 항목 자리에 들어갔는지. 들어간 상자가 없으면 지금 자리 그대로.
 * 상자 안에 들어가야 바꾸므로, 크기가 다른 이웃 사이에서 왔다 갔다 하지 않는다
 */
function slotAt(boxes: Box[], cx: number, cy: number, current: number): number {
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]
    if (i !== current && cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) return i
  }
  return current
}

export function startItemDrag(e: PointerEvent, grip: HTMLElement, from: number, move: (from: number, to: number, key: string) => void) {
  const item = grip.closest<HTMLElement>('.it')
  const slide = grip.closest<HTMLElement>('.slide')
  if (!item || !slide || siblingsOf(item).length < 2) return
  const sx = e.clientX
  const sy = e.clientY
  // 한 번 끄는 동안의 순서 바꾸기는 되돌리기 한 단계로 (손을 멈췄다 움직여도). Esc나 제자리로 돌아오면 단계를 남기지 않는다
  const key = gestureKey('items.move')
  let started = false
  let cur = from
  let k = 1
  let grab = { x: 0, y: 0 }
  let tx = 0
  let ty = 0
  let pointer = { x: sx, y: sy }

  /** 끄는 항목을 손 아래로: 그려진 자리(이동 없이)에서 손까지 */
  const follow = () => {
    const r = item.getBoundingClientRect()
    const lx = r.left - tx * k
    const ly = r.top - ty * k
    tx = (pointer.x - grab.x - lx) / k
    ty = (pointer.y - grab.y - ly) / k
    item.style.translate = `${tx}px ${ty}px`
  }

  const reorder = (to: number) => {
    if (to === cur) return
    const others = siblingsOf(item).filter((s) => s !== item)
    const before = new Map(others.map((s) => [s, s.getBoundingClientRect()]))
    flushSync(() => move(cur, to, key))
    cur = to
    follow()
    if (reduced()) return
    for (const s of others) {
      const a = before.get(s)
      if (!a || !s.isConnected) continue
      const b = s.getBoundingClientRect()
      const dx = (a.left - b.left) / k
      const dy = (a.top - b.top) / k
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
      s.getAnimations().forEach((x) => x.cancel())
      s.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: SLIDE_MS, easing: 'cubic-bezier(0.2, 0, 0, 1)' })
    }
  }

  const begin = () => {
    started = true
    const r = item.getBoundingClientRect()
    k = slide.offsetWidth ? slide.getBoundingClientRect().width / slide.offsetWidth : 1
    grab = { x: sx - r.left, y: sy - r.top }
    item.classList.add('is-lifted')
    document.body.classList.add('is-item-dragging')
  }

  const onMove = (ev: PointerEvent) => {
    pointer = { x: ev.clientX, y: ev.clientY }
    if (!started) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return
      begin()
    }
    follow()
    const sibs = siblingsOf(item)
    const at = sibs.indexOf(item)
    if (at >= 0) cur = at
    const b = boxOf(item)
    const to = slotAt(sibs.map(boxOf), b.x + tx + b.w / 2, b.y + ty + b.h / 2, cur)
    reorder(to)
  }

  const end = (cancel: boolean) => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKey, true)
    if (!started) return
    if (cancel) reorder(from)
    document.body.classList.remove('is-item-dragging')
    // 손을 떼면 제자리로 살짝 튀어 앉는다
    const land = () => {
      item.style.translate = ''
      item.classList.remove('is-lifted')
    }
    if (reduced() || (Math.abs(tx) < 1 && Math.abs(ty) < 1)) {
      land()
      return
    }
    const a = item.animate([{ translate: `${tx}px ${ty}px` }, { translate: '0px 0px' }], { duration: 320, easing: SETTLE })
    item.style.translate = ''
    a.finished.then(
      () => item.classList.remove('is-lifted'),
      () => item.classList.remove('is-lifted'),
    )
  }
  const onUp = () => end(false)
  const onCancel = () => end(true)
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape') return
    ev.preventDefault()
    ev.stopPropagation()
    end(true)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKey, true)
}
