import { isLink, linkFits } from '../deck/blocks'
import type { BlockType } from '../deck/types'
import { blockDrawn, blockTextLines } from '../slides/fitBlocks'

/*
 * 개발용: 부품 장이 '사람이 짠 것처럼' 보이는지 보는 검사. checkCombos(combos.ts)는 잘리거나 겹치는 것만 봐서,
 * 하나도 잘리지 않았는데 어색한 장을 놓쳤다(예시 발표의 '사업 기회'에 핵심 한 줄과 인용을 더한 장: 제목, 핵심 한 줄, 인용이
 * 모두 굵은 검정에 비슷한 크기라 제목이 셋으로 읽혔고, 부제 아래와 부품 사이가 200px 넘게 비었고, 인용 한 줄이 1630px였다).
 * 그려진 장마다(발표 화면 모습, mode=final) 셋을 본다. 길이는 모두 캔버스 px(1920×1080 기준).
 * - 위계: 장 제목이 있으면, 부품 장만의 부품의 글이 제목만 하거나(같은 크기 이상) 제목과 같은 색, 굵기로 한 단계 안쪽이면(제목 ÷ 1.2 이상)
 *   제목과 다투는 것으로 본다. 강조색이나 버금 글자색의 글은 답이나 딸린 글이라,
 *   숫자와 단위는 답이라 제목과 다투지 않는다. 핵심 한 줄이 있으면 다른 부품의 문장이 그보다 크지 않아야 한다(결론이 넘어간다)
 * - 빈 띠: 장 머리 아래와 부품 내용 사이에 위아래로 빈 띠가 GAP_MAX보다 넓은 곳. 남는 높이는 묶음 사이를 조금 벌린 뒤 맨 아래에 모인다.
 *   거꾸로 아래가 3분의 1 넘게 비었는데 묶음 사이를 벌리지 않은 장(위가 무겁다)도 잡는다.
 *   내용은 칸이 아니라 그려진 것으로 잰다: 바탕 없는 칸은 글과 그림, 칠한 상자가 그려진 범위, 면이 있는 칸은 면 전체
 *   그려진 것끼리 겹치는 것, 이음표가 그려진 것에 걸치는 것, 소제목 아래(같은 단)에 묶을 부품이 없는 것도 본다
 * - 짜임 안의 빈 곳: 면 안에서 내용이 위에 붙고 아래 안쪽만 크게 빈 것, 면이 내용과 나란한 칸보다 훨씬 큰 것, 여러 단으로 흘린 목록의 단 사이가 지나치게 넓거나 단이 고르지 않은 것
 * - 이음표: 앞 부품과 선 건너편 부품이 뜻이 서는 짝인지 (links.ts의 linkFits)
 * - 짜임: 높이가 넉넉한데 단을 나눈 목록, 내용이 적은데 본문의 왼쪽 위에 몰린 장(너비의 절반도 안 쓰고 아래 3분의 1 넘게 빈)
 * - 글 폭: 글 부품(TEXT_TYPES)의 한 줄이 MEASURE_EM(그 글자 크기의 배수)보다 긴 것, 여러 줄 글의 끝 줄에 낱말 하나만 남은 것
 * #/gallery?set=combos&seed=1&n=60 (또는 set=review) → 콘솔에서 await checkAssembly()
 */

/** 위아래로 빈 띠의 허용 폭. 장에서 가장 큰 사이(--body-gap, 72)에 칸 한 줄 몫의 끝수(판의 칸이 내용보다 조금 높다)를 더한 것 */
const GAP_MAX = 72 * 1.5
/** 남는 높이를 나눌 때 묶음 사이를 벌리는 가장 큰 폭(--bk-gap의 두 배, fitBlocks.ts의 pack)에서 끝수를 뺀 것 */
const GAP_SPREAD = 48 * 2 - 8
/** 한 줄의 가장 긴 폭 (글자 크기의 배수). 글 칸은 24em(한글로 34자 남짓)에서 꺾는다(blocks/base.css의 --measure). 글꼴 차이 몫을 더한 값 */
const MEASURE_EM = 25.5
/** 끝 줄이 가장 긴 줄의 이만큼도 안 되면 낱말 하나가 홀로 남은 것 */
const ORPHAN = 0.22
/** 글 폭과 끝 줄을 보는 부품: 문장을 쓰는 글 부품 */
const TEXT_TYPES = new Set(['message', 'text', 'quote', 'callout', 'bullets', 'note', 'faq', 'heading'])

/** 글이 문장이 아니라 그림의 이름표인 부품 (흐름, 연결도, 나누기, 모으기, 칸 조립) */
const FIGURE_TYPES = new Set(['flow', 'network', 'merge', 'split', 'tiles'])

type Span = { t: number; b: number }

const EDIT_UI = '.ed-halo, .it-remove, .it-grip, .pn-tools, .img-tools, .bk-handle, .bk-gutter, .bk-incoming'

/** 칸에서 실제로 그려진 위아래 (화면 px). 발표 화면의 쌓기와 같은 것으로 본다(fitBlocks.ts의 drawn) */
const inkSpan = (cell: HTMLElement): Span | null => blockDrawn(cell)

/** 겹치는 범위를 합친 띠들 (위에서 아래로) */
function merge(spans: Span[]): Span[] {
  const out: Span[] = []
  for (const s of [...spans].sort((a, b) => a.t - b.t)) {
    const last = out.at(-1)
    if (last && s.t <= last.b) last.b = Math.max(last.b, s.b)
    else out.push({ ...s })
  }
  return out
}

const hangul = (s: string) => /[가-힣]/.test(s)
/** 숫자와 단위('2.4조 원', '억 원'): 숫자는 답이라 제목보다 커도 된다 */
const numeric = (s: string) => {
  const words = s.replace(/[\d.,%+\-~()\s]/g, '')
  return words.length <= 2 || (/\d/.test(s) && words.length <= 3)
}

/** 위계: 핵심 한 줄보다 큰 다른 부품의 글. 핵심 한 줄은 그 장의 결론이라(장 제목이 없으면 곧 제목) 다른 부품의 문장이 더 크면 결론이 넘어간다 */
function overMessage(area: HTMLElement): string[] {
  const msg = area.querySelector<HTMLElement>(':scope > .bk-message .bk-msg-t')
  if (!msg) return []
  const mfs = parseFloat(getComputedStyle(msg).fontSize)
  const out = new Set<string>()
  for (const cell of area.querySelectorAll<HTMLElement>(':scope > .bk:not(.bk-layout):not(.bk-message)')) {
    // 그림 안의 이름표(연결도의 가운데 상자 같은)는 문장이 아니라 그림의 일부라 견주지 않는다
    if (FIGURE_TYPES.has(cell.dataset.type ?? '')) continue
    const inner = cell.querySelector<HTMLElement>(':scope > .bk-in')
    if (!inner) continue
    for (const q of blockTextLines(inner)) {
      const el = q.n.parentElement
      const text = (q.n.textContent ?? '').trim()
      if (!el || !hangul(text) || numeric(text)) continue
      const fs = parseFloat(getComputedStyle(el).fontSize)
      if (fs > mfs + 0.5) out.add(`${cell.dataset.type}: 글이 핵심 한 줄보다 커요(${Math.round(fs)} > ${Math.round(mfs)}) 「${text.slice(0, 12)}」`)
    }
  }
  return [...out]
}

/** 위계: 장 제목과 다투는 부품의 글 */
function rivals(slide: HTMLElement, area: HTMLElement): string[] {
  const title = slide.querySelector<HTMLElement>('.s-title')
  if (!title || title.matches('.is-hint, .is-empty') || !title.textContent?.trim()) return overMessage(area)
  const ts = getComputedStyle(title)
  const tfs = parseFloat(ts.fontSize)
  const out = new Set<string>()
  // 레이아웃 부품은 그 레이아웃의 장과 같은 모양이라(장 제목 아래의 표, 일정) 부품 장만의 부품을 본다
  for (const cell of area.querySelectorAll<HTMLElement>(':scope > .bk:not(.bk-layout)')) {
    const inner = cell.querySelector<HTMLElement>(':scope > .bk-in')
    if (!inner) continue
    for (const q of blockTextLines(inner)) {
      const el = q.n.parentElement
      const text = (q.n.textContent ?? '').trim()
      if (!el || !hangul(text) || numeric(text)) continue
      const cs = getComputedStyle(el)
      // 제목과 다른 색(강조색의 답, 버금 글자색의 딸린 글)은 제목과 다투지 않는다
      if (cs.color !== ts.color) continue
      const fs = parseFloat(cs.fontSize)
      const same = Number(cs.fontWeight) >= 600
      if (fs >= tfs - 0.5) out.add(`${cell.dataset.type}: 글이 장 제목만큼 커요(${Math.round(fs)} ≥ ${Math.round(tfs)}) 「${text.slice(0, 12)}」`)
      else if (same && fs * 1.2 >= tfs - 0.5) out.add(`${cell.dataset.type}: 장 제목과 같은 색, 굵기에 크기가 한 단계 안쪽이라 제목과 다퉈요(${Math.round(fs)}, 제목 ${Math.round(tfs)}) 「${text.slice(0, 12)}」`)
    }
  }
  return [...out, ...overMessage(area)]
}

/** 빈 띠: 장 머리 아래와 내용 사이 */
function bands(slide: HTMLElement, area: HTMLElement, k: number): string[] {
  const out: string[] = []
  const all = [...area.querySelectorAll<HTMLElement>(':scope > .bk')]
  const inks = all.map(inkSpan)
  const spans = inks.filter((s): s is Span => !!s)
  if (!spans.length) return out
  // 그려진 것끼리 겹치는 곳: 발표 화면은 줄째 올려 붙여서(fitBlocks.ts 3-4) 칸이 아니라 그려진 범위로 본다
  all.forEach((a, i) =>
    all.slice(i + 1).forEach((b, j) => {
      const p = inks[i]
      const q = inks[i + 1 + j]
      const ra = a.getBoundingClientRect()
      const rb = b.getBoundingClientRect()
      if (p && q && Math.min(p.b, q.b) - Math.max(p.t, q.t) > 1 && Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left) > 1)
        out.push(`${a.dataset.type}와 ${b.dataset.type}의 그려진 것이 겹쳐요`)
    }),
  )
  const merged = merge(spans)
  const head = slide.querySelector<HTMLElement>('.s-head')
  const hasHead = !!head && head.getClientRects().length > 0 && !!head.textContent?.trim()
  // 장 머리 아래의 빈 띠 (머리가 없으면 0)
  let headGap = 0
  if (hasHead) {
    // 머리의 아래: 부제가 있으면 부제, 없으면 제목의 글 줄 아래
    const last = [...head!.querySelectorAll<HTMLElement>('.s-title, .s-lead')].filter((el) => el.textContent?.trim()).at(-1)
    const hb = last ? last.getBoundingClientRect().bottom : head!.getBoundingClientRect().bottom
    const gap = (merged[0].t - hb) / k
    headGap = gap
    // 내용이 적은 장은 남는 높이를 머리 아래와 맨 아래에 2 : 3으로 둔다(fitBlocks.ts 3-4). 그래서 머리 아래가 넓어도 아래가 그보다 넓으면
    // 내용이 눈높이 가운데에 선 것이라 괜찮다. 아래보다 넓으면 내용이 가라앉은 것
    const under = (area.getBoundingClientRect().bottom - merged[merged.length - 1].b) / k
    if (gap > GAP_MAX + 24 && gap > under) out.push(`장 머리 아래가 ${Math.round(gap)}px 비어요`)
  }
  let widest = 0
  for (let i = 1; i < merged.length; i++) {
    const gap = (merged[i].t - merged[i - 1].b) / k
    widest = Math.max(widest, gap)
    if (gap > GAP_MAX) out.push(`부품 사이가 위아래로 ${Math.round(gap)}px 비어요`)
  }
  // 아래로 몰린 빈 띠: 본문 아래 3분의 1 넘게 비었는데 묶음 사이는 아직 벌릴 수 있던 장(가장 넓은 사이가 --bk-gap 두 배 밑).
  // 남는 높이를 맨 아래에만 모으면 내용이 위에 몰려 위가 무거워 보였다(fitBlocks.ts 3-4).
  // 쌓기가 칸을 올려 붙여 생긴 빈 띠만 본다: 판이 맨 아래 칸에 높이를 주어 칸 안이 빈 것(칸이 본문 바닥까지 닿는다)은 쌓기 몫이 아니다
  const ab = area.getBoundingClientRect().bottom
  const bottom = (ab - merged[merged.length - 1].b) / k
  // 칸이 본문 바닥에 닿는지는 캔버스 16px까지 봐준다: 첫 줄을 장 머리에 맞춰 몇 px 올린 칸도 판이 바닥까지 준 칸이다
  const filled = all.some((c) => c.getBoundingClientRect().bottom >= ab - 16 * k)
  // 벌릴 수 있는 사이가 있는지: 소제목 아래는 그 아래 부품과 한 덩어리라 벌리지 않는다
  const at = (c: HTMLElement, v: string) => Number(c.style.getPropertyValue(v)) || 0
  const opens = all.some((p) => p.dataset.type !== 'heading' && all.some((q) => at(q, '--y') >= at(p, '--y') + at(p, '--h') && at(q, '--x') < at(p, '--x') + at(p, '--w') && at(p, '--x') < at(q, '--x') + at(q, '--w')))
  // 남는 높이를 머리 아래에도 나눈 장(머리 아래가 아래 빈 띠의 반 넘게)은 내용이 눈높이 가운데에 선 것이라 몰린 것이 아니다
  if (hasHead && opens && !filled && bottom > area.offsetHeight / 3 && widest < GAP_SPREAD && headGap < bottom / 2)
    out.push(`내용이 위에 몰려 아래가 ${Math.round(bottom)}px 비어요`)
  // 이음표는 그려진 것 사이의 빈자리에 혼자 서야 한다
  for (const lk of area.querySelectorAll<HTMLElement>(':scope > .bk-link')) {
    const g = (lk.querySelector('svg, .bk-link-vs') ?? lk).getBoundingClientRect()
    const hit = all.some((c, i) => {
      const p = inks[i]
      const r = c.getBoundingClientRect()
      return !!p && Math.min(p.b, g.bottom) - Math.max(p.t, g.top) > 1 && Math.min(r.right, g.right) - Math.max(r.left, g.left) > 1
    })
    if (hit) out.push(`이음표(${lk.dataset.link})가 그려진 것에 걸쳐요`)
  }
  // 소제목은 아래 부품들의 이름이라 그 아래(같은 단)에 묶을 부품이 있어야 한다
  const cells = [...area.querySelectorAll<HTMLElement>(':scope > .bk')]
  // 판의 자리로 본다: 발표 화면에서 올려 붙인 만큼(--bk-shift)은 되돌린다
  const placeOf = (c: HTMLElement) => {
    const r = c.getBoundingClientRect()
    return new DOMRect(r.left, r.top - (parseFloat(c.style.getPropertyValue('--bk-shift')) || 0) * k, r.width, r.height)
  }
  if (cells.length > 1)
    for (const h of cells.filter((c) => c.dataset.type === 'heading')) {
      const r = placeOf(h)
      const under = cells.some((c) => {
        const o = placeOf(c)
        return c !== h && o.top >= r.bottom - 1 && o.left < r.right - 1 && r.left < o.right - 1
      })
      if (!under) out.push('소제목 아래에 묶을 부품이 없어요')
    }
  return out
}

/** 글 폭과 끝 줄 */
function measure(area: HTMLElement, k: number): string[] {
  const out = new Set<string>()
  for (const cell of area.querySelectorAll<HTMLElement>(':scope > .bk')) {
    if (!TEXT_TYPES.has(cell.dataset.type ?? '')) continue
    const inner = cell.querySelector<HTMLElement>(':scope > .bk-in')
    if (!inner) continue
    // 글 칸(요소)마다 줄을 모은다: 같은 높이의 조각은 한 줄
    const byEl = new Map<Element, { t: number; l: number; r: number }[]>()
    for (const q of blockTextLines(inner)) {
      const el = q.n.parentElement
      if (!el || el.closest(EDIT_UI)) continue
      const rows = byEl.get(el) ?? []
      const row = rows.find((x) => Math.abs(x.t - q.t) < 4 * k)
      if (row) {
        row.l = Math.min(row.l, q.l)
        row.r = Math.max(row.r, q.r)
      } else rows.push({ t: q.t, l: q.l, r: q.r })
      byEl.set(el, rows)
    }
    byEl.forEach((rows, el) => {
      const fs = parseFloat(getComputedStyle(el).fontSize)
      const text = (el.textContent ?? '').trim().slice(0, 12)
      const ws = rows.map((x) => (x.r - x.l) / k)
      const most = Math.max(...ws)
      if (most > fs * MEASURE_EM) out.add(`${cell.dataset.type}: 한 줄이 ${Math.round(most)}px(글자 크기의 ${Math.round(most / fs)}배)로 길어요 「${text}」`)
      rows.sort((a, b) => a.t - b.t)
      const tail = (rows.at(-1)!.r - rows.at(-1)!.l) / k
      if (rows.length >= 2 && tail < most * ORPHAN) out.add(`${cell.dataset.type}: 끝 줄에 낱말 하나만 남았어요 「${text}」`)
    })
  }
  return [...out]
}

/** 면 안의 빈 띠가 이보다 넓게 아래에 몰리면 (캔버스 px). 면 안의 위아래 여백은 같아 보여야 한다 */
const FACE_SLACK = 48
/** 여러 단으로 흘린 목록에서 앞 단의 글 끝과 다음 단 사이가 이보다 넓으면 흩어져 보인다 (옆 칸 사이 72의 세 배) */
const COLUMN_GAP_MAX = 72 * 3
/** 면이 제 내용(안쪽 여백까지)과 나란한 칸의 높이보다 이만큼 넘게 크면 빈 면으로 보인다 (fitBlocks.ts의 hug는 24 밑이면 그대로 둔다. 그 두 배) */
const FACE_OVER = 48

/**
 * 면이 있는 칸이 제 내용에 쓰는 높이(안쪽 여백까지, 캔버스 px). 내용은 줄 사이를 넓히기 전(--bk-air 없이)으로 잰다:
 * 줄 사이를 넓혀 면을 채우면 내용이 면만큼 커 보여 놓쳤다. 잴 수 없으면 null
 */
function faceNeed(cell: HTMLElement, k: number): number | null {
  const inner = cell.querySelector<HTMLElement>(':scope > .bk-in')
  const body = inner && [...inner.children].find((el) => (el as HTMLElement).offsetHeight > 0)
  if (!inner || !body) return null
  const air = cell.style.getPropertyValue('--bk-air')
  if (air) cell.style.removeProperty('--bk-air')
  let t = Infinity
  let b = -Infinity
  for (const el of body.children) {
    const q = el.getBoundingClientRect()
    if (!q.height || getComputedStyle(el).position === 'absolute' || el.closest(EDIT_UI)) continue
    t = Math.min(t, q.top)
    b = Math.max(b, q.bottom)
  }
  if (air) cell.style.setProperty('--bk-air', air)
  if (t === Infinity) return null
  const cs = getComputedStyle(inner)
  return (b - t) / k + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
}

/**
 * 짜임 안의 빈 곳: 면(옅은 면, 진한 면) 안에서 내용이 위에 붙고 아래 안쪽만 크게 빈 것,
 * 여러 줄을 여러 단으로 흘린 목록에서 단 사이가 지나치게 벌어진 것(단을 칸 너비로 반씩 나누면 짧은 요점이 흩어져 보였다)
 */
function inside(area: HTMLElement, k: number): string[] {
  const out: string[] = []
  for (const cell of area.querySelectorAll<HTMLElement>(':scope > .bk:not(.bk-look-plain)')) {
    const inner = cell.querySelector<HTMLElement>(':scope > .bk-in')
    const body = inner && [...inner.children].find((el) => (el as HTMLElement).offsetHeight > 0)
    if (!inner || !body) continue
    let t = Infinity
    let b = -Infinity
    for (const el of body.children) {
      const q = el.getBoundingClientRect()
      if (!q.height || getComputedStyle(el).position === 'absolute' || el.closest(EDIT_UI)) continue
      t = Math.min(t, q.top)
      b = Math.max(b, q.bottom)
    }
    if (t === Infinity) continue
    const cs = getComputedStyle(inner)
    const ir = inner.getBoundingClientRect()
    const top = (t - ir.top) / k - parseFloat(cs.paddingTop)
    const bottom = (ir.bottom - b) / k - parseFloat(cs.paddingBottom)
    if (bottom - top > FACE_SLACK && bottom > top * 2) out.push(`${cell.dataset.type}: 면 안의 아래가 ${Math.round(bottom)}px 비어요(위 ${Math.round(Math.max(0, top))}px)`)
    // 면이 내용보다 훨씬 큰 것: 면은 제 내용과 고른 안쪽 여백만큼, 나란한 칸이 더 길면 그 높이까지만 (fitBlocks.ts의 hug).
    // 판이 남는 높이를 면에 주면 두 줄짜리 결정 요청의 면이 본문 바닥까지 닿아 글이 면 가운데에 떠 있었다.
    // 나란한 칸들이 그려진 위아래 범위로 견준다: 옆에 둘을 쌓았으면 둘을 합친 높이까지(옆 단 전체와 높이를 맞춘 면은 사람도 그렇게 둔다).
    // 옆의 면도 면 높이가 아니라 제 내용으로 본다: 나란한 두 면이 같이 부풀면 서로를 핑계로 놓쳤다
    const cr = cell.getBoundingClientRect()
    let nt = Infinity
    let nb = -Infinity
    for (const other of area.querySelectorAll<HTMLElement>(':scope > .bk')) {
      const or = other.getBoundingClientRect()
      if (other === cell || other.dataset.band !== cell.dataset.band || Math.min(or.bottom, cr.bottom) - Math.max(or.top, cr.top) < 1) continue
      const fh = other.classList.contains('bk-look-plain') ? null : faceNeed(other, k)
      const ink = fh === null ? inkSpan(other) : { t: or.top, b: or.top + fh * k }
      if (!ink) continue
      nt = Math.min(nt, ink.t)
      nb = Math.max(nb, ink.b)
    }
    // 면은 칸의 윗선에 서므로 칸 윗선부터 옆 칸이 그려진 끝까지 (fitBlocks.ts의 hug와 같은 기준)
    const need = Math.max(faceNeed(cell, k) ?? Infinity, nt < nb ? (nb - cr.top) / k : 0)
    const face = cr.height / k
    if (face - need > FACE_OVER) out.push(`${cell.dataset.type}: 면이 내용보다 ${Math.round(face - need)}px 커요(면 ${Math.round(face)}, 내용 ${Math.round(need)})`)
  }
  for (const list of area.querySelectorAll<HTMLElement>(':scope > .bk .bk-list')) {
    const items = [...list.children].filter((el) => (el as HTMLElement).offsetHeight > 0) as HTMLElement[]
    const cols = new Map<number, HTMLElement[]>()
    for (const it of items) {
      const x = Math.round(it.getBoundingClientRect().left)
      const key = [...cols.keys()].find((c) => Math.abs(c - x) < 4) ?? x
      cols.set(key, (cols.get(key) ?? []).concat(it))
    }
    // 높이가 넉넉한데 단을 나눈 목록: 단 나누기와 나란히 세우기는 높이가 모자랄 때의 짜임이다. 한 단으로 쌓아도 칸 안에 들면
    // 나눈 단이 장의 한쪽 구석에 작게 몰려 보였다(소제목과 점 다섯이 셋과 둘로 갈려 왼쪽 위 4분의 1에)
    if (cols.size >= 2) {
      const cell = list.closest<HTMLElement>('.bk')
      const inner = cell?.querySelector<HTMLElement>(':scope > .bk-in')
      if (cell && inner) {
        const ls = getComputedStyle(list)
        const rowGap = parseFloat(ls.rowGap) || 0
        const cs = getComputedStyle(inner)
        const ir = inner.getBoundingClientRect()
        // 한 단으로 쌓을 때의 높이: 칸 위에서 목록 위까지(소제목) + 항목 높이의 합 + 항목 사이
        const above = (list.getBoundingClientRect().top - ir.top) / k - parseFloat(cs.paddingTop)
        const one = above + items.reduce((sum, it) => sum + it.getBoundingClientRect().height / k, 0) + rowGap * (items.length - 1)
        const room = ir.height / k - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
        if (one <= room) out.push(`${cell.dataset.type}: 높이가 넉넉한데 목록을 ${cols.size}단으로 나눴어요(한 단 ${Math.round(one)}px, 칸 ${Math.round(room)}px)`)
      }
    }
    if (cols.size < 2 || items.length <= cols.size) continue
    const xs = [...cols.keys()].sort((a, b) => a - b)
    for (let i = 1; i < xs.length; i++) {
      // 앞 단에서 글이 가장 길게 나간 끝
      let end = -Infinity
      for (const it of cols.get(xs[i - 1])!) for (const q of blockTextLines(it)) end = Math.max(end, q.r)
      const gap = (xs[i] - end) / k
      if (gap > COLUMN_GAP_MAX) out.push(`${list.closest<HTMLElement>('.bk')?.dataset.type}: 목록의 단 사이가 ${Math.round(gap)}px 벌어져요`)
    }
    const counts = [...cols.values()].map((c) => c.length)
    if (Math.max(...counts) - Math.min(...counts) > 1) out.push(`${list.closest<HTMLElement>('.bk')?.dataset.type}: 목록의 단이 고르지 않아요(${counts.join(', ')})`)
  }
  return out
}

/**
 * 내용이 적은 장이 본문의 한쪽 구석(왼쪽 위)에 몰린 것: 그려진 것이 본문 너비의 절반도 안 쓰고 아래 3분의 1 넘게 비었다.
 * 항목이 여럿인 부품(목록, 표 같은)이 있는 장만 본다: 항목은 단을 바꾸거나 소제목 옆으로 눕혀 넓게 짤 수 있다.
 * 글만 있는 장은 글 폭(--measure)이 일부러 줄을 꺾어 오른쪽이 비는 것이라 보지 않는다
 */
const CORNER_W = 0.5
const CORNER_B = 1 / 3

function corner(area: HTMLElement, k: number): string[] {
  const a = area.getBoundingClientRect()
  let l = Infinity
  let r = -Infinity
  let b = -Infinity
  for (const cell of area.querySelectorAll<HTMLElement>(':scope > .bk')) {
    const ink = inkSpan(cell)
    if (!ink) continue
    b = Math.max(b, ink.b)
    if (!cell.classList.contains('bk-look-plain')) {
      const q = cell.getBoundingClientRect()
      l = Math.min(l, q.left)
      r = Math.max(r, q.right)
      continue
    }
    const inner = cell.querySelector<HTMLElement>(':scope > .bk-in')
    if (!inner) continue
    for (const q of blockTextLines(inner)) {
      l = Math.min(l, q.l)
      r = Math.max(r, q.r)
    }
    for (const f of inner.querySelectorAll('svg, img')) {
      if (f.parentElement?.closest('svg')) continue
      const q = f.getBoundingClientRect()
      if (!q.width) continue
      l = Math.min(l, q.left)
      r = Math.max(r, q.right)
    }
  }
  if (!(l < r) || !area.querySelector(':scope > .bk .it ~ .it')) return []
  const w = (r - l) / a.width
  const bottom = (a.bottom - b) / a.height
  return w < CORNER_W && bottom > CORNER_B ? [`내용이 본문의 왼쪽 위에 몰렸어요(너비의 ${Math.round(w * 100)}%, 아래 ${Math.round((a.bottom - b) / k)}px 빔)`] : []
}

/**
 * 이음표의 뜻: 이음표마다 앞 부품과 선 건너편 부품들이 뜻이 서는 짝인지(links.ts의 linkFits, linkIssue). 건너편이 여럿이면 모두와 서야 한다:
 * 개요와 날짜를 견주거나, 목표 대비와 주석 사이에 '='가 서면 무엇과 무엇의 관계인지 읽히지 않았다
 */
function linkMeaning(area: HTMLElement): string[] {
  const out: string[] = []
  const cells = [...area.querySelectorAll<HTMLElement>(':scope > .bk')]
  const at = (c: HTMLElement, v: string) => Number(c.style.getPropertyValue(v)) || 0
  for (const lk of area.querySelectorAll<HTMLElement>(':scope > .bk-link')) {
    const link = [...lk.classList].map((c) => c.replace(/^is-/, '')).find(isLink)
    const from = cells.find((c) => c.dataset.block === lk.dataset.after)
    if (!link || !from) continue
    const h = lk.classList.contains('lk-h')
    const [x, y, w, hh] = ['--x', '--y', '--w', '--h'].map((v) => at(from, v))
    const next = cells.filter((c) =>
      h
        ? at(c, '--x') === x + w && at(c, '--y') < y + hh && y < at(c, '--y') + at(c, '--h')
        : at(c, '--y') === y + hh && at(c, '--x') < x + w && x < at(c, '--x') + at(c, '--w'),
    )
    // 소제목과 주석은 옆 부품에 딸린 글이라 함께 쌓인 다른 부품이 있으면 빼고 본다 (links.ts의 linkIssue와 같이)
    const main = next.filter((c) => c.dataset.type !== 'heading' && c.dataset.type !== 'note')
    for (const to of main.length ? main : next)
      if (!linkFits(link, from.dataset.type as BlockType, to.dataset.type as BlockType)) out.push(`이음표(${link})의 뜻이 서지 않아요: ${from.dataset.type} → ${to.dataset.type}`)
  }
  return out
}

/** 그려진 부품 장마다 위계, 빈 띠, 글 폭을 본다. 없으면 빈 목록 */
export async function checkAssembly(): Promise<{ slides: number; problems: string[] }> {
  await document.fonts.ready
  await new Promise((r) => setTimeout(r, 300))
  const problems: string[] = []
  const areas = [...document.querySelectorAll<HTMLElement>('.bk-area')]
  areas.forEach((area, i) => {
    const slide = area.closest<HTMLElement>('.slide')
    if (!slide) return
    const k = slide.getBoundingClientRect().width / 1920
    for (const p of [...rivals(slide, area), ...bands(slide, area, k), ...measure(area, k), ...inside(area, k), ...corner(area, k), ...linkMeaning(area)]) problems.push(`${i + 1}번 장: ${p}`)
  })
  return { slides: areas.length, problems }
}
