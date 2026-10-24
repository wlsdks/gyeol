/**
 * 부품 장에서 칸에 다 들어가지 않는 부품을 잘리지 않게 맞춘다.
 * 부품을 놓을 때는 잘리지 않는 자리만 고르지만, 놓은 뒤에 항목을 더하거나 글을 길게 쓰면 넘칠 수 있다.
 *
 * 1. 줄마다의 가장 낮은 높이를 더해도 본문 상자보다 높으면, 줄 높이를 같은 비율로 낮춘다(--bk-sq).
 * 2. 줄 높이는 똑같이 나누지만(deck/blocks.ts의 areaStyle), 글이 넘치는 칸이 있는 줄은 다른 줄이 잘리지 않을 높이까지
 *    남는 높이를 가져온다(--bk-r1..). 잰 높이(blockHeights.ts)는 보통 글자 크기라, 크게나 명조에서 딱 그 높이면 모자랄 수 있다.
 * 3. 그래도 칸 안의 글이 넘치거나 서로 겹치는 부품은 글자를 단계로 줄인다(--bk-fit). 단계라서 같은 장의 비슷한 칸끼리 크기가 같다.
 *    카드와 강조색 면은 안쪽 여백까지 내려간 글도 넘친 것으로 본다.
 *
 * 4. 위치 비교의 이름표는 그려진 크기로 서로, 그리고 다른 점과 겹치지 않는 자리를 다시 고른다(labels).
 *
 * 앱과 내보낸 HTML(export/viewer.ts가 blockFitter의 소스를 그대로 넣는다)이 같이 쓴다. 그래서 안에서 바깥의 이름을 쓰지 않는다.
 * 부품의 잘리지 않는 높이를 잴 때(screens/measureBlocks.ts)도 이것으로 맞추고, 글 줄의 자리도 이것으로 본다.
 */
export function blockFitter() {
  const steps = [0.92, 0.84, 0.76, 0.68]
  let range: Range | null = null
  let ctx: CanvasRenderingContext2D | null | undefined
  let inks: Record<string, [number, number]> = {}

  /**
   * 글자 상자(글꼴의 위아래 여백까지 든 높이) 가운데 위와 아래로 비어 있는 몫. 글꼴마다, 글마다 다르다:
   * 한글은 상자를 거의 채우고 숫자는 키가 작으며, 명조는 고딕보다 상자가 크다. 그래서 그 글을 캔버스에 그려 잰다
   */
  function ink(el: Element, text: string): [number, number] {
    const cs = getComputedStyle(el)
    const key = cs.fontFamily + '|' + cs.fontWeight + '|' + text
    const known = inks[key]
    if (known) return known
    let v: [number, number] = /[가-힣]/.test(text) ? [0.12, 0.12] : [0.2, 0.2]
    if (ctx === undefined) ctx = document.createElement('canvas').getContext('2d')
    if (ctx) {
      ctx.font = cs.fontWeight + ' 100px ' + cs.fontFamily
      const m = ctx.measureText(text)
      const box = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent
      if (box > 0) v = [Math.max(0, (m.fontBoundingBoxAscent - m.actualBoundingBoxAscent) / box), Math.max(0, (m.fontBoundingBoxDescent - m.actualBoundingBoxDescent) / box)]
    }
    inks[key] = v
    return v
  }

  /** 칸 안쪽(.bk-in)의 글 줄마다 글자가 그려지는 자리(화면 px). 꾸밈 글자(인용 부호처럼 aria-hidden)는 일부러 글 뒤에 깔아서 뺀다 */
  function lines(inner: HTMLElement): { n: Node; t: number; b: number; l: number; r: number }[] {
    const out: { n: Node; t: number; b: number; l: number; r: number }[] = []
    if (!range) range = document.createRange()
    const walk = document.createTreeWalker(inner, NodeFilter.SHOW_TEXT)
    while (walk.nextNode()) {
      const n = walk.currentNode
      const text = (n.textContent || '').trim()
      const el = n.parentElement
      if (!text || !el || el.closest('[aria-hidden="true"]')) continue
      const [up, down] = ink(el, text.slice(0, 60))
      range.selectNodeContents(n)
      const rects = range.getClientRects()
      for (let i = 0; i < rects.length; i++) {
        const q = rects[i]
        if (q.width && q.height) out.push({ n, t: q.top + q.height * up, b: q.bottom - q.height * down, l: q.left, r: q.right })
      }
    }
    return out
  }

  /**
   * 칸 안의 글이 안쪽 상자를 넘거나 다른 글과 겹치는지. 글이 안쪽 상자의 자식(가운데 맞춘 묶음 같은) 밖으로 넘치면
   * scrollHeight는 안쪽 여백만큼을 넘침으로 세지 않아서, 카드 아래 여백을 먹고 들어간 글을 놓친다. 그래서 글 줄의 자리로도 본다
   */
  function over(inner: HTMLElement): boolean {
    if (inner.scrollHeight > inner.clientHeight + 2 || inner.scrollWidth > inner.clientWidth + 2) return true
    const r = inner.getBoundingClientRect()
    // 편집 화면과 갤러리는 장을 줄여 그려서, 여백(캔버스 px)을 화면 px로 바꾼다
    const k = inner.offsetWidth ? r.width / inner.offsetWidth : 1
    const cs = getComputedStyle(inner)
    // 여백 안으로 8px까지는 봐준다 (그 정도는 여백이 무너져 보이지 않는다)
    const pad = (v: string) => Math.max(0, parseFloat(v) - 8) * k
    const top = r.top + pad(cs.paddingTop) - 1
    const bottom = r.bottom - pad(cs.paddingBottom) + 1
    const left = r.left + pad(cs.paddingLeft) - 1
    const right = r.right - pad(cs.paddingRight) + 1
    const ls = lines(inner)
    for (const q of ls) if (q.t < top || q.b > bottom || q.l < left || q.r > right) return true
    // 겹침은 캔버스 2px 넘게 (줄여 그린 화면에서도 같은 기준)
    const gap = 2 * k
    const hit = (a: { t: number; b: number; l: number; r: number }, b: { top: number; bottom: number; left: number; right: number }) =>
      Math.min(a.r, b.right) - Math.max(a.l, b.left) > gap && Math.min(a.b, b.bottom) - Math.max(a.t, b.top) > gap
    // 글자를 키우면(크게, 명조) 정한 자리의 이름과 설명이 서로 올라탄다
    for (let i = 0; i < ls.length; i++) {
      for (let j = i + 1; j < ls.length; j++) {
        const b = ls[j]
        if (ls[i].n !== b.n && hit(ls[i], { top: b.t, bottom: b.b, left: b.l, right: b.r })) return true
      }
    }
    // 항목의 글이 옆 항목의 자리로 넘어가는 것: 좁은 칸에서 막대 위 숫자가 옆 막대를 덮거나, 낮은 칸에서 줄이 다음 줄에 올라탄다
    const items = Array.from(inner.querySelectorAll<HTMLElement>('.it'))
    if (items.length > 1) {
      const boxes = items.map((el) => el.getBoundingClientRect())
      for (const q of ls) {
        const own = q.n.parentElement && q.n.parentElement.closest('.it')
        if (!own) continue
        for (let i = 0; i < items.length; i++) {
          const b = boxes[i]
          if (items[i] === own || items[i].contains(own) || own.contains(items[i]) || !b.width || !b.height) continue
          if (hit(q, b)) return true
        }
      }
    }
    return false
  }

  /**
   * 위치 비교의 이름표 자리를 그려진 크기로 다시 고른다. 그리기 전에 글 길이로 어림한 자리(layouts.tsx의 labelSides)를 먼저 보고,
   * 앞의 점의 이름표나 다른 점을 덮거나 판 밖으로 나가면 오른쪽, 왼쪽, 위, 아래 차례로 겹치지 않는 자리를 찾는다. 없으면 어림한 자리
   */
  function labels(scope: ParentNode): void {
    const plots = scope instanceof HTMLElement && scope.classList.contains('pm-plot') ? [scope] : Array.from(scope.querySelectorAll<HTMLElement>('.pm-plot'))
    const SIDES = ['is-left', 'is-up', 'is-down']
    const tries = [[], ['is-left'], ['is-up'], ['is-down'], ['is-left', 'is-up'], ['is-left', 'is-down']]
    const set = (el: HTMLElement, on: string[]) => SIDES.forEach((c) => el.classList.toggle(c, on.indexOf(c) >= 0))
    for (const plot of plots) {
      if (!plot.clientWidth) continue
      const pts = Array.from(plot.children).filter((c) => c instanceof HTMLElement && c.classList.contains('pm-pt') && !c.classList.contains('is-blank')) as HTMLElement[]
      const P = plot.getBoundingClientRect()
      const k = plot.offsetWidth ? P.width / plot.offsetWidth : 1
      const gap = 6 * k
      // 겹친 넓이 (떨어져야 할 틈까지 넣어서). 0이면 안 겹친다
      const meet = (a: DOMRect, b: DOMRect) =>
        Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left) + gap) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) + gap)
      // 판의 축(왼쪽, 아래 굵은 줄)은 넘지 않고, 위와 오른쪽은 판 둘레의 여백만큼 나가도 된다
      const outside = (r: DOMRect) =>
        Math.max(0, P.left + 4 * k - r.left) + Math.max(0, r.bottom - (P.bottom - 4 * k)) + Math.max(0, r.right - (P.right + 24 * k)) + Math.max(0, P.top - 24 * k - r.top)
      const dots = pts.map((p) => p.querySelector<HTMLElement>('.pm-dot')?.getBoundingClientRect() ?? null)
      const taken: DOMRect[] = []
      pts.forEach((p, i) => {
        const label = p.querySelector<HTMLElement>('.pm-label')
        if (!label) return
        // 어림한 자리는 그릴 때 data-pm-side에 적어 둔다: 다시 맞출 때(글꼴이 오거나 글자가 줄 때) 거기서부터 다시 고른다
        const first = (p.dataset.pmSide ?? '').split(' ').filter(Boolean)
        // 겹치지 않는 첫 자리. 어디에 두어도 겹치면 가장 덜 겹치는 자리 (판 밖으로 나간 것은 크게 친다)
        let pick = first
        let best = Infinity
        for (const o of [first, ...tries]) {
          set(p, o)
          const r = label.getBoundingClientRect()
          let cost = outside(r) * r.height * 4
          for (const t of taken) cost += meet(r, t)
          dots.forEach((d, j) => {
            if (j !== i && d) cost += meet(r, d) * 2
          })
          if (cost < best) {
            best = cost
            pick = o
          }
          if (cost === 0) break
        }
        set(p, pick)
        taken.push(label.getBoundingClientRect())
      })
    }
  }

  /**
   * 글이 넘치는 칸이 있는 줄의 바닥을 조금씩 올린다. 다른 줄은 잘리지 않을 높이(data-mins)나 이미 올린 바닥 밑으로
   * 내려가지 않게, 바닥을 다 더해도 본문 상자를 넘지 않는 데까지만. 넘치는 줄이 여럿이면 차례로 조금씩 나눠 가진다.
   * 올린 만큼은 다른 줄이 똑같이 나눠 내준다(격자의 1fr)
   */
  function grow(area: HTMLElement, cells: HTMLElement[], room: number): void {
    const floor = (area.dataset.mins || '').split(',').map(Number)
    const n = getComputedStyle(area).gridTemplateRows.split(' ').length
    if (n < 2 || floor.length !== n || floor.some((m) => !(m >= 0))) return
    const inners = floor.map((_, i) =>
      cells
        .filter((c) => c.style.gridRow === String(i + 1))
        .map((c) => c.querySelector<HTMLElement>(':scope > .bk-in'))
        .filter((el): el is HTMLElement => !!el),
    )
    for (let moved = true; moved; ) {
      moved = false
      for (let i = 0; i < n; i++) {
        const most = room - floor.reduce((a, m, j) => (j === i ? a : a + m), 0)
        const h = parseFloat(getComputedStyle(area).gridTemplateRows.split(' ')[i])
        if (h >= most - 1 || !inners[i].some(over)) continue
        floor[i] = Math.min(most, h + 16)
        area.style.setProperty('--bk-r' + (i + 1), floor[i] + 'px')
        moved = true
      }
    }
  }

  function fit(root: ParentNode): void {
    // 글꼴이 늦게 오면 그 전에 잰 글자 자리는 대신 쓴 글꼴의 것이라, 맞출 때마다 다시 잰다
    inks = {}
    const areas = root instanceof HTMLElement && root.classList.contains('bk-area') ? [root] : Array.from(root.querySelectorAll<HTMLElement>('.bk-area'))
    for (const area of areas) {
      const cells = Array.from(area.children).filter((c) => c instanceof HTMLElement && c.classList.contains('bk')) as HTMLElement[]
      area.style.removeProperty('--bk-sq')
      for (let i = 1; i <= 3; i++) area.style.removeProperty('--bk-r' + i)
      for (const c of cells) c.style.removeProperty('--bk-fit')
      // 안 보이는 장(자리를 재지 못한다)은 건너뛴다
      if (!cells.length || !area.clientHeight) continue
      // 편집 화면의 편집 표시(칸 옆으로 나온 단추 같은)는 재는 동안 뺀다 (edit.css)
      area.classList.add('is-fitting')
      // 줄 높이의 합으로 본다. 상자 전체의 scrollHeight는 칸 밖으로 넘친 글까지 세어서, 칸 하나가 조금 넘쳐도
      // 모든 줄을 낮추게 된다 (넘친 칸은 아래에서 그 칸의 글자만 줄인다)
      const style = getComputedStyle(area)
      const tracks = style.gridTemplateRows.split(' ').map(parseFloat).filter((n) => n >= 0)
      const gaps = (parseFloat(style.rowGap) || 0) * Math.max(0, tracks.length - 1)
      const need = tracks.reduce((a, n) => a + n, 0)
      const room = area.clientHeight - gaps
      const squeezed = need > room + 1
      if (squeezed) area.style.setProperty('--bk-sq', Math.max(0.4, room / need).toFixed(3))
      // 글자는 먼저 늘 줄여도 되는 데까지만(보통 한 단계, 크게는 두 단계: 보통을 한 단계 줄인 것과 같은 크기) 줄인다.
      // 그래도 넘치는 줄만 다른 줄의 남는 높이를 가져온다. 거꾸로 하면 조금만 넘쳐도 줄 높이가 달라져 1:1이 자주 깨진다
      const least = area.closest('.sz-large') ? 0.84 : 0.92
      const shrink = (c: HTMLElement, last: number) => {
        const inner = c.querySelector<HTMLElement>(':scope > .bk-in')
        if (!inner) return
        for (const k of steps) {
          if (k < last || !over(inner)) break
          if (Number(c.style.getPropertyValue('--bk-fit') || 1) <= k) continue
          c.style.setProperty('--bk-fit', String(k))
          labels(inner)
        }
      }
      for (const c of cells) {
        const inner = c.querySelector<HTMLElement>(':scope > .bk-in')
        if (inner) labels(inner)
        shrink(c, least)
      }
      if (!squeezed) grow(area, cells, room)
      for (const c of cells) shrink(c, 0)
      area.classList.remove('is-fitting')
    }
    // 부품 장 밖(한 장을 다 쓰는 위치 비교)도
    for (const plot of Array.from(root.querySelectorAll<HTMLElement>('.pm-plot'))) if (!plot.closest('.bk-area')) labels(plot)
  }

  return { fit, lines, over, labels }
}

let fitter: ReturnType<typeof blockFitter> | null = null
const shared = () => (fitter ??= blockFitter())

/** 이 안의 부품 장을 모두 맞춘다 (root가 .bk-area면 그것만) */
export const fitBlocks = (root: ParentNode) => shared().fit(root)
/** 칸 안쪽의 글 줄마다 글자가 그려지는 자리 (부품 높이 재기에서 겹침과 잘림을 볼 때) */
export const blockTextLines = (inner: HTMLElement) => shared().lines(inner)
/** 위치 비교의 이름표 자리를 그려진 크기로 다시 고른다 (scope 안의 판 모두, scope가 판이면 그것만) */
export const placeLabels = (scope: ParentNode) => shared().labels(scope)
/** 칸 안쪽이 넘치거나 글이 겹치는지 (fitBlocks가 글자를 줄이는 기준. 진단용) */
export const blockOverflows = (inner: HTMLElement) => shared().over(inner)
