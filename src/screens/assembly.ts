import { blockTextLines } from '../slides/fitBlocks'

/*
 * 개발용: 부품 장이 '사람이 짠 것처럼' 보이는지 보는 검사. checkCombos(combos.ts)는 잘리거나 겹치는 것만 봐서,
 * 하나도 잘리지 않았는데 어색한 장을 놓쳤다(예시 발표의 '사업 기회'에 핵심 한 줄과 인용을 더한 장: 제목, 핵심 한 줄, 인용이
 * 모두 굵은 검정에 비슷한 크기라 제목이 셋으로 읽혔고, 부제 아래와 부품 사이가 200px 넘게 비었고, 인용 한 줄이 1630px였다).
 * 그려진 장마다(발표 화면 모습, mode=final) 셋을 본다. 길이는 모두 캔버스 px(1920×1080 기준).
 * - 위계: 장 제목이 있으면, 부품 장만의 부품의 글이 제목만 하거나(같은 크기 이상) 제목과 같은 색, 굵기로 한 단계 안쪽이면(제목 ÷ 1.2 이상)
 *   제목과 다투는 것으로 본다. 강조색이나 버금 글자색의 글은 답이나 딸린 글이라,
 *   숫자와 단위는 답이라 제목과 다투지 않는다
 * - 빈 띠: 장 머리 아래와 부품 내용 사이에 위아래로 빈 띠가 GAP_MAX보다 넓은 곳. 남는 높이는 한곳(맨 아래)에 모여야 한다.
 *   내용은 칸이 아니라 그려진 것으로 잰다: 바탕 없는 칸은 글과 그림이 그려진 범위, 면이 있는 칸은 면 전체
 * - 글 폭: 글 부품(TEXT_TYPES)의 한 줄이 MEASURE_EM(그 글자 크기의 배수)보다 긴 것, 여러 줄 글의 끝 줄에 낱말 하나만 남은 것
 * #/gallery?set=combos&seed=1&n=60 (또는 set=review) → 콘솔에서 await checkAssembly()
 */

/** 위아래로 빈 띠의 허용 폭. 장에서 가장 큰 사이(--body-gap, 72)에 칸 한 줄 몫의 끝수(판의 칸이 내용보다 조금 높다)를 더한 것 */
const GAP_MAX = 72 * 1.5
/** 한 줄의 가장 긴 폭 (글자 크기의 배수). 글 칸은 24em(한글로 34자 남짓)에서 꺾는다(blocks/base.css의 --measure). 글꼴 차이 몫을 더한 값 */
const MEASURE_EM = 25.5
/** 끝 줄이 가장 긴 줄의 이만큼도 안 되면 낱말 하나가 홀로 남은 것 */
const ORPHAN = 0.22
/** 글 폭과 끝 줄을 보는 부품: 문장을 쓰는 글 부품 */
const TEXT_TYPES = new Set(['message', 'text', 'quote', 'callout', 'bullets', 'note', 'faq', 'heading'])

type Span = { t: number; b: number }

const EDIT_UI = '.ed-halo, .it-remove, .it-grip, .pn-tools, .img-tools, .bk-handle, .bk-gutter, .bk-incoming'

function painted(cs: CSSStyleDeclaration): boolean {
  const bg = cs.backgroundColor
  const clear = !bg || bg === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(bg) || /\/\s*0\)$/.test(bg)
  return !clear || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0
}

/** 칸에서 실제로 그려진 위아래 (화면 px). 면이 있는 칸은 칸 전체, 없으면 글 줄과 그림, 칠한 상자의 범위 */
function inkSpan(cell: HTMLElement): Span | null {
  const r = cell.getBoundingClientRect()
  if (!cell.classList.contains('bk-look-plain')) return { t: r.top, b: r.bottom }
  const inner = cell.querySelector<HTMLElement>(':scope > .bk-in')
  if (!inner) return null
  let t = Infinity
  let b = -Infinity
  const add = (x: DOMRect | { top: number; bottom: number }) => {
    t = Math.min(t, x.top)
    b = Math.max(b, x.bottom)
  }
  for (const q of blockTextLines(inner)) if (!q.n.parentElement?.closest(EDIT_UI)) add({ top: q.t, bottom: q.b })
  for (const el of inner.querySelectorAll<HTMLElement | SVGElement>('*')) {
    if (el.closest(EDIT_UI) || el.parentElement?.closest('svg')) continue
    const e = el.getBoundingClientRect()
    if (!e.width || !e.height) continue
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
    if (el instanceof SVGElement || el.tagName === 'IMG' || painted(getComputedStyle(el))) add(e)
  }
  return t === Infinity ? null : { t, b }
}

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

/** 위계: 장 제목과 다투는 부품의 글 */
function rivals(slide: HTMLElement, area: HTMLElement): string[] {
  const title = slide.querySelector<HTMLElement>('.s-title')
  if (!title || title.classList.contains('is-hint') || !title.textContent?.trim()) return []
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
  return [...out]
}

/** 빈 띠: 장 머리 아래와 내용 사이 */
function bands(slide: HTMLElement, area: HTMLElement, k: number): string[] {
  const out: string[] = []
  const spans = [...area.querySelectorAll<HTMLElement>(':scope > .bk')].map(inkSpan).filter((s): s is Span => !!s)
  if (!spans.length) return out
  const merged = merge(spans)
  const head = slide.querySelector<HTMLElement>('.s-head')
  const hasHead = !!head && head.getClientRects().length > 0 && !!head.textContent?.trim()
  if (hasHead) {
    // 머리의 아래: 부제가 있으면 부제, 없으면 제목의 글 줄 아래
    const last = [...head!.querySelectorAll<HTMLElement>('.s-title, .s-lead')].filter((el) => el.textContent?.trim()).at(-1)
    const hb = last ? last.getBoundingClientRect().bottom : head!.getBoundingClientRect().bottom
    const gap = (merged[0].t - hb) / k
    if (gap > GAP_MAX + 24) out.push(`장 머리 아래가 ${Math.round(gap)}px 비어요`)
  }
  for (let i = 1; i < merged.length; i++) {
    const gap = (merged[i].t - merged[i - 1].b) / k
    if (gap > GAP_MAX) out.push(`부품 사이가 위아래로 ${Math.round(gap)}px 비어요`)
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
    for (const p of [...rivals(slide, area), ...bands(slide, area, k), ...measure(area, k)]) problems.push(`${i + 1}번 장: ${p}`)
  })
  return { slides: areas.length, problems }
}
