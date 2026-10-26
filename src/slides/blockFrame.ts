/*
 * 편집 화면에서 부품의 테두리(올렸을 때, 골랐을 때)를 그 부품이 실제로 그린 것에 맞춘다.
 * 칸은 격자가 나눈 자리라서 차트 옆의 짧은 글, 가운데로 내린 숫자처럼 내용이 칸보다 작으면 테두리만 크게 떠 보였다.
 * 그래서 칸 안의 글자 줄, 그림, 면과 선이 그려진 자리를 모아 그 둘레에 테두리를 두른다(--fr-t, --fr-r, --fr-b, --fr-l: 칸에서 안쪽으로의 거리,
 * 캔버스 px, 음수면 칸 밖). 면이 있는 바탕(옅은 면, 진한 면)은 면이 곧 부품이라 칸 그대로.
 * 발표 화면과 내보낸 파일에는 테두리가 없어서 쓰지 않는다 (fitBlocks가 맞춘 뒤에 편집 화면만).
 */

/** 테두리를 내용에서 띄우는 너비 (캔버스 px). 예전 outline-offset(14)과 비슷하게 */
const PAD = 14

/** 칸 안의 그린 것을 모을 때 건너뛰는 편집 표시 (칸 밖으로 나온 단추, 올렸을 때만 깔리는 빈칸의 면) */
const SKIP = '.it-remove, .it-grip, .img-tools, .ed-halo, .bk-handle'

const painted = (el: Element) => {
  const s = getComputedStyle(el)
  if (s.visibility === 'hidden' || Number(s.opacity) === 0) return false
  const bg = s.backgroundColor
  const hasBg = (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) || s.backgroundImage !== 'none'
  const hasLine = ['Top', 'Right', 'Bottom', 'Left'].some((k) => parseFloat(s.getPropertyValue(`border-${k.toLowerCase()}-width`)) > 0 && s.getPropertyValue(`border-${k.toLowerCase()}-style`) !== 'none')
  return hasBg || hasLine
}

/**
 * ::before, ::after가 글자로 그리는 것(점 목록의 01, 02 같은 번호, 따옴표). 글 마디가 아니라서 글자 줄로는 잡히지 않아,
 * 점 목록을 고르면 테두리가 번호를 빼고 요점 글에만 둘러졌다
 */
const generated = (el: Element) =>
  ['::before', '::after'].some((w) => {
    const s = getComputedStyle(el, w)
    return s.content !== 'none' && s.content !== 'normal' && s.content !== '""' && s.display !== 'none' && s.visibility !== 'hidden'
  })

/** 칸 안에 그려진 것(글자 줄, 그림, 면과 선)을 모두 덮는 네모 (화면 px). 그린 것이 없으면 null */
export function inkBox(cell: HTMLElement): { left: number; top: number; right: number; bottom: number } | null {
  const inner = cell.querySelector<HTMLElement>(':scope > .bk-in')
  if (!inner) return null
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  const add = (r: DOMRect) => {
    if (!r.width || !r.height) return
    left = Math.min(left, r.left)
    top = Math.min(top, r.top)
    right = Math.max(right, r.right)
    bottom = Math.max(bottom, r.bottom)
  }
  const range = document.createRange()
  const walk = document.createTreeWalker(inner, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.nodeValue?.trim() || n.parentElement?.closest(SKIP)) continue
    range.selectNodeContents(n)
    for (const r of range.getClientRects()) add(r)
  }
  for (const el of inner.querySelectorAll<HTMLElement | SVGElement>('*')) {
    if (el.closest(SKIP)) continue
    // 그림은 통째로, 그 안의 도형은 보지 않는다 (svg의 네모가 곧 그림의 자리)
    if (el instanceof SVGElement && el.ownerSVGElement) continue
    if (el.matches('svg, img, canvas') || painted(el) || generated(el)) add(el.getBoundingClientRect())
  }
  return Number.isFinite(left) ? { left, top, right, bottom } : null
}

/** 이 부품 장의 칸마다 테두리 자리를 정한다. 편집 화면(.is-live)이 아니면 아무것도 하지 않는다 */
export function frameCells(area: HTMLElement): void {
  if (!area.classList.contains('is-live')) return
  for (const cell of area.querySelectorAll<HTMLElement>(':scope > .bk, :scope > .bk-stack > .bk')) {
    const box = cell.getBoundingClientRect()
    const k = cell.offsetWidth ? box.width / cell.offsetWidth : 1
    const ink = cell.matches('.bk-look-card, .bk-look-bold') || !k ? null : inkBox(cell)
    // 면이 있거나 그린 것이 없으면(빈 이미지 칸 같은) 칸 그대로
    const at = (inside: number) => `${Math.round(inside - PAD)}px`
    const t = ink ? Math.max(0, (ink.top - box.top) / k) : 0
    const b = ink ? Math.max(0, (box.bottom - ink.bottom) / k) : 0
    const l = ink ? Math.max(0, (ink.left - box.left) / k) : 0
    const r = ink ? Math.max(0, (box.right - ink.right) / k) : 0
    cell.style.setProperty('--fr-t', at(t))
    cell.style.setProperty('--fr-b', at(b))
    cell.style.setProperty('--fr-l', at(l))
    cell.style.setProperty('--fr-r', at(r))
  }
}

/** 칸의 테두리가 그려진 네모 (화면 px). 고른 부품 위에 도구를 띄울 때 테두리 바로 위에 두려고 */
export function frameRect(cell: HTMLElement): DOMRect {
  const box = cell.getBoundingClientRect()
  const k = cell.offsetWidth ? box.width / cell.offsetWidth : 1
  const v = (name: string) => (parseFloat(cell.style.getPropertyValue(name)) || -PAD) * k
  const left = box.left + v('--fr-l')
  const top = box.top + v('--fr-t')
  return new DOMRect(left, top, box.right - v('--fr-r') - left, box.bottom - v('--fr-b') - top)
}
