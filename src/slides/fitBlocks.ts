/**
 * 부품 장에서 칸에 다 들어가지 않는 부품을 잘리지 않게 맞춘다.
 * 부품을 놓을 때는 잘리지 않는 자리만 고르지만, 놓은 뒤에 항목을 더하거나 글을 길게 쓰면 넘칠 수 있다.
 *
 * 1. 줄마다의 가장 낮은 높이를 더해도 본문 상자보다 높으면, 줄 높이를 같은 비율로 낮춘다(--bk-sq).
 * 2. 줄마다 잘리지 않을 높이에 남는 높이를 똑같이 나눠 더하지만(deck/blocks.ts의 areaStyle), 글이 넘치는 칸이 있는 줄은
 *    다른 줄이 잘리지 않을 높이까지 남는 높이를 더 가져온다(--bk-r1..). 잰 높이(blockHeights.ts)는 보통 글자 크기라, 크게나 명조에서 딱 그 높이면 모자랄 수 있다.
 * 3. 그래도 칸 안의 글이 넘치거나 서로 겹치는 부품은 글자를 단계로 줄인다(--bk-fit). 단계라서 같은 장의 비슷한 칸끼리 크기가 같다.
 *    카드와 강조색 면은 안쪽 여백까지 내려간 글도 넘친 것으로 본다.
 * 3-1. 거꾸로 장에 자리가 남으면(넘치는 칸이 하나도 없으면) 모든 칸의 글과 그림을 같은 비율로 단계로 키운다.
 *    내용이 적은 장에서 작은 글이 넓은 칸 한쪽에만 있으면 칸이 비어 보인다. 모든 칸을 같이 키워서 칸끼리 크기는 그대로 맞는다.
 * 3-2. 키운 뒤에도 칸에 높이가 남으면 줄이 쌓이는 부품(목록, 표, 일정 막대)은 줄 사이를 단계로 넓힌다(--bk-air, 캔버스 px).
 *    글자를 더 키우면 장마다 글자 크기가 들쭉날쭉해지고, 가운데에 작게 모아 두면 위아래가 빈다. 줄 사이만 넓히면 칸을 채운다.
 *    칸마다 따로 고른다: 항목 수가 다른 두 목록이 한 줄에 있어도 둘 다 칸 아래까지 닿는다. 이 값을 쓰지 않는 부품은 그대로다
 *
 * 3-3. 한 줄에 부품이 둘 이상이면 부품마다 위에서부터 그리지만(소제목 윗선을 맞춘다, blocks.css), 줄 안에서 가장 긴 내용을
 *    기준으로 묶음째 가운데로 내린다(--bk-lift, 캔버스 px). 위에만 붙여 두면 높은 줄에서 아래 절반이 통째로 빈다.
 *    칸 높이를 다 쓰는 부품(차트, 표) 옆의 짧은 부품은 그것들끼리 묶어 가운데로, 그 가운데 숫자 부품은 그 전에 한두 단계 키운다.
 *
 * 4. 위치 비교의 이름표는 그려진 크기로 서로, 그리고 다른 점과 겹치지 않는 자리를 다시 고른다(labels).
 *
 * 발표할 때 움직이는 중인 장(motion/engine.ts가 data-mo-play를 붙인다)은 재지 않는다. 그동안 글자와 막대는 옮겨지거나 커지는 중이고
 * 숫자는 0부터 굴러가는 중이라, 재면 끝 모습과 다른 값이 나온다: 움직이며 넘긴 장은 글자를 줄이고, 뒤로 돌아온 장(움직이지 않는다)은
 * 키워서 같은 장이 넘긴 길에 따라 달라 보였다. 맞춘 값은 그대로 두고 움직임이 끝나면(mo-end) 다시 맞춘다. 처음 맞추기는
 * 움직임이 걸리기 전이다(BlockArea의 layout effect가 발표 화면의 움직임보다 먼저, 뷰어는 파일을 열 때).
 *
 * 앱과 내보낸 HTML(export/viewer.ts가 blockFitter의 소스를 그대로 넣는다)이 같이 쓴다. 그래서 안에서 바깥의 이름을 쓰지 않는다.
 * 부품의 잘리지 않는 높이를 잴 때(screens/measureBlocks.ts)도 이것으로 맞추고, 글 줄의 자리도 이것으로 본다.
 */
export function blockFitter() {
  // 글자 크기 비율(1.2)의 단계: 한 단계, 두 단계. 칸 크기로 정한 단계(--bk-w, --bk-h)와 같은 값이라 줄여도 크기가 단계 위에 있다
  const steps = [0.84, 0.7]
  // 키울 때도 한 단계만: 더 키우면 내용이 적은 장의 글자가 장 제목보다 커진다
  const ups = [1.2]
  // 줄 사이를 넓히는 단계 (줄의 위아래에 더하는 캔버스 px). 넘게 벌리면 줄끼리 따로 떨어져 보여서 이만큼까지만
  const airs = [24, 18, 12, 6]
  let range: Range | null = null
  let ctx: CanvasRenderingContext2D | null | undefined
  let inks: Record<string, [number, number]> = {}
  // 움직임이 끝나기를 기다리는 본문 상자와 판 (같은 것을 여러 번 기다리지 않게)
  const waiting = new WeakSet<Element>()

  /** 이것을 움직이는 중인 요소(그 장, 또는 그 안의 부품 하나). 없으면 null */
  function moving(el: Element): Element | null {
    return el.closest('[data-mo-play]') || el.querySelector('[data-mo-play]')
  }

  /**
   * 움직임이 끝나면 다시 맞춘다. 장을 넘겨서 끝난 움직임이면 그 장은 곧 빠지므로, 끝난 차례에 바로 재지 않고 한 박자 뒤에
   * (빠진 장은 크기가 없어 건너뛴다)
   */
  function later(el: Element, mover: Element, again: () => void): void {
    if (waiting.has(el)) return
    waiting.add(el)
    mover.addEventListener(
      'mo-end',
      () => {
        waiting.delete(el)
        Promise.resolve().then(again)
      },
      { once: true },
    )
  }

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
      // 일부러 숨긴 글(쌓은 막대에서 칸보다 큰 칸 안 숫자)은 그려지지 않으니 넘침으로 세지 않는다
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden') continue
      const [up, down] = ink(el, text.slice(0, 60))
      range.selectNodeContents(n)
      const rects = range.getClientRects()
      // 편집 칸은 띄어쓰기를 그대로 두는 pre-wrap이라 줄 끝의 띄어쓰기가 칸 밖으로 걸려 있고 줄 상자도 그만큼 넓다.
      // 그것까지 글로 세면 편집 화면에서만 넘친 것으로 보여 글자가 한 단계 작아진다. 그래서 줄 끝의 띄어쓰기 자리를 뺀다
      const spaces: DOMRect[] = []
      const ws = cs.whiteSpace
      if (ws === 'pre-wrap' || ws === 'break-spaces') {
        const raw = n.textContent || ''
        for (let i = 0; i < raw.length; i++) {
          if (raw[i] !== ' ') continue
          range.setStart(n, i)
          range.setEnd(n, i + 1)
          spaces.push(range.getBoundingClientRect())
        }
      }
      for (let i = 0; i < rects.length; i++) {
        const q = rects[i]
        if (!q.width || !q.height) continue
        // 뒤에서부터 보면 줄 끝에 띄어쓰기가 여럿 있어도 한 번에 뺀다
        let right = q.right
        for (let j = spaces.length - 1; j >= 0; j--) {
          const sp = spaces[j]
          if (sp.width && Math.abs(sp.right - right) < 1 && sp.top < q.bottom && sp.bottom > q.top) right = sp.left
        }
        out.push({ n, t: q.top + q.height * up, b: q.bottom - q.height * down, l: q.left, r: right })
      }
    }
    return out
  }

  /**
   * 칸 안의 글이 안쪽 상자를 넘거나 다른 글과 겹치는지. 글이 안쪽 상자의 자식(가운데 맞춘 묶음 같은) 밖으로 넘치면
   * scrollHeight는 안쪽 여백만큼을 넘침으로 세지 않아서, 카드 아래 여백을 먹고 들어간 글을 놓친다. 그래서 글 줄의 자리로도 본다
   */
  function over(inner: HTMLElement, tight = false): boolean {
    // 줄일지 볼 때는 4px까지 봐준다: 명조처럼 글자 윗선·아랫선이 높은 글꼴은 큰 숫자의 줄 상자가 칸 끝에서 몇 px 비어져 나와도
    // 글자는 칸 안에 있다(글자가 넘치는지는 아래에서 글 줄의 자리로 본다). 2px로 두면 핵심 숫자가 칸 높이 한 점(530px)에서만 한 단계 작아졌다.
    // 키울 때(crowded)는 2px로 엄격하게: 4px까지 키우면 칸마다 끝에 닿도록 커진다
    const slackPx = tight ? 2 : 4
    if (inner.scrollHeight > inner.clientHeight + slackPx || inner.scrollWidth > inner.clientWidth + slackPx) return true
    const r = inner.getBoundingClientRect()
    // 편집 화면과 갤러리는 장을 줄여 그려서, 여백(캔버스 px)을 화면 px로 바꾼다
    const k = inner.offsetWidth ? r.width / inner.offsetWidth : 1
    const cs = getComputedStyle(inner)
    // 여백 안으로 8px까지는 봐준다 (그 정도는 여백이 무너져 보이지 않는다)
    const pad = (v: string) => Math.max(0, parseFloat(v) - 8) * k
    // 글 줄이 여백에 걸쳐도 되는 틈도 캔버스 px로(2px, 잘리지 않는 높이를 재는 갤러리의 반 크기 장에서 화면 1px).
    // 화면 px로 두면 장을 그리는 크기마다 기준이 달라서, 내보낸 파일을 열었을 때(줄여 그린다)와 발표할 때(꽉 채운다) 글자 크기가 달랐다
    const slack = 2 * k
    const top = r.top + pad(cs.paddingTop) - slack
    const bottom = r.bottom - pad(cs.paddingBottom) + slack
    const left = r.left + pad(cs.paddingLeft) - slack
    const right = r.right - pad(cs.paddingRight) + slack
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
  function place(scope: ParentNode): void {
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
        if (h >= most - 1 || !inners[i].some((el) => over(el))) continue
        floor[i] = Math.min(most, h + 16)
        area.style.setProperty('--bk-r' + (i + 1), floor[i] + 'px')
        moved = true
      }
    }
  }

  /** 칸 안의 그림 하나와 키우기 전의 크기 (화면 px) */
  type Shape = { el: Element; w: number; h: number }

  /**
   * 칸 안의 그림: 글이 없는 요소(구성비 띠, 막대, 원, 그림 판) 가운데 가로세로 24px는 되는 것과 그 크기. 키우기 전에 잰다.
   * 글이 커지면 같은 칸의 그림이 남는 높이를 내주며 줄어드는데, 글이 없어서 넘침으로 보이지 않는다
   * (구성비 띠가 112px에서 1px 아래로 납작해졌다)
   */
  function shapesOf(inner: HTMLElement): Shape[] {
    const r = inner.getBoundingClientRect()
    const k = inner.offsetWidth ? r.width / inner.offsetWidth : 1
    const out: Shape[] = []
    for (const el of Array.from(inner.querySelectorAll('*'))) {
      if ((el.textContent || '').trim()) continue
      const b = el.getBoundingClientRect()
      if (b.width >= 24 * k && b.height >= 24 * k) out.push({ el, w: b.width, h: b.height })
    }
    return out
  }

  /**
   * 키울 때는 더 엄격하게: 글만이 아니라 항목(줄)의 상자까지 안쪽 여백 안에. 글만 보면 줄의 아래 여백과 선이
   * 카드 가장자리까지 내려가도 넘친 줄 모른다 (시장 규모의 목록이 카드 바닥에 선을 긋던 것).
   * 그림이 키우기 전의 반 밑으로 줄어도 넘친 것이다: 글자를 키우느라 그래프를 찌그러뜨리지 않는다
   */
  function crowded(inner: HTMLElement, shapes: Shape[] = []): boolean {
    if (over(inner, true)) return true
    const r = inner.getBoundingClientRect()
    const k = inner.offsetWidth ? r.width / inner.offsetWidth : 1
    const bottom = r.bottom - parseFloat(getComputedStyle(inner).paddingBottom) * k + 2 * k
    for (const it of inner.querySelectorAll<HTMLElement>('.it')) if (it.getBoundingClientRect().bottom > bottom) return true
    for (const s of shapes) {
      const b = s.el.getBoundingClientRect()
      if (b.width < s.w * 0.5 || b.height < s.h * 0.5) return true
    }
    return false
  }

  /** 자리가 남는 장의 모든 칸을 같은 단계로 키운다. 한 칸이라도 넘치거나 겹치거나 그림이 찌그러지면 그대로. 키우기 전 그림의 크기를 돌려준다 */
  function enlarge(cells: HTMLElement[]): Map<HTMLElement, Shape[]> {
    const inners = cells.map((c) => c.querySelector<HTMLElement>(':scope > .bk-in')).filter((el): el is HTMLElement => !!el)
    const shapes = new Map(inners.map((inner) => [inner, shapesOf(inner)] as const))
    for (const k of ups) {
      for (const c of cells) c.style.setProperty('--bk-fit', String(k))
      for (const inner of inners) place(inner)
      if (!inners.some((inner) => crowded(inner, shapes.get(inner)))) return shapes
    }
    for (const c of cells) c.style.removeProperty('--bk-fit')
    for (const inner of inners) place(inner)
    return shapes
  }

  /** 칸마다 줄 사이를 넘치지 않는 가장 넓은 단계로. 키우기(enlarge)가 끝난 뒤. 그림은 키우기 전 크기와 견준다 */
  function spread(cells: HTMLElement[], shapes: Map<HTMLElement, Shape[]>): void {
    for (const c of cells) {
      const inner = c.querySelector<HTMLElement>(':scope > .bk-in')
      if (!inner) continue
      let ok = false
      for (const a of airs) {
        c.style.setProperty('--bk-air', a + 'px')
        if (!crowded(inner, shapes.get(inner))) {
          ok = true
          break
        }
      }
      if (!ok) c.style.removeProperty('--bk-air')
    }
  }

  /**
   * 칸 안 내용이 차지한 높이와 칸 안쪽 높이 (화면 px). 그리지 않은 칸이면 null.
   * 내용은 보이는 첫 자식: 레이아웃 부품(차트, 표)은 첫 자식이 숨긴 장 제목(높이 0)이라, 첫 자식만 보면 차트가 있는 줄을 통째로 건너뛰었다
   */
  function used(c: HTMLElement): { room: number; used: number; k: number } | null {
    const body = Array.from(c.querySelectorAll<HTMLElement>(':scope > .bk-in > *')).find((el) => el.offsetHeight > 0)
    if (!body) return null
    const r = body.getBoundingClientRect()
    const k = r.height / body.offsetHeight
    const cs = getComputedStyle(body)
    const top = r.top + parseFloat(cs.paddingTop) * k
    let end = top
    for (const el of Array.from(body.children)) {
      const b = el.getBoundingClientRect()
      const es = getComputedStyle(el)
      if (b.height && es.position !== 'absolute' && es.position !== 'fixed') end = Math.max(end, b.bottom + Math.max(0, parseFloat(es.marginBottom)) * k)
    }
    return { room: r.bottom - parseFloat(cs.paddingBottom) * k - top, used: end - top, k }
  }

  /**
   * 줄마다 부품 내용의 묶음을 가운데로 (맨 위 설명 3-3). 이음표가 선 줄은 부품마다 가운데에 두어서(blocks.css) 건너뛴다.
   * 내릴 수 있는 부품(blocks.css의 --bk-lifts: 글, 목록, 숫자, 강조 상자)은 글이 시작하는 선 하나(T)를 같이 쓴다. 그 선은
   * 묶음 가운데 가장 긴 내용이 줄 가운데에 오는 자리이고, 어느 칸도 넘치지 않게 그 안에서만 옮긴다.
   * 칸마다 칸 위에서 재면 안 된다: 옅은 면, 진한 면은 안쪽 여백만큼 글이 아래에서 시작해서, 옆의 글은 칸 위에 붙고 면 안의 글만
   * 내려가 있었다. 칸 높이를 다 쓴 글 칸을 차트처럼 묶음에서 빼도 안 된다: 가장 낮은 줄에서 긴 쪽은 늘 칸을 다 쓰니, 짧은 쪽만
   * 내려가 나란한 소제목의 윗선이 어긋났다.
   * 차트, 표, 그림처럼 내리지 않는 부품은 묶음에 넣지 않는다. 그 옆의 짧은 부품은 자기들끼리 가운데로 내린다: 차트가 가장 길어
   * 기준이 되면 차트 옆의 숫자가 칸 위에 붙고 아래 절반이 통째로 비었다.
   * 칸 높이를 다 쓰는 그런 부품 옆의 숫자 부품(큰 숫자, 전과 후, 목표 대비)은 내리기 전에 한두 단계 키운다(boosts): 높은 칸에
   * 작은 숫자가 떠 있으면 칸이 비어 보인다. 글 부품은 키우지 않는다(장 제목과 크기가 가까워진다)
   */
  const boosts = [1.44, 1.2]
  const boostable = new Set(['number', 'delta', 'goal'])
  /** 내용(첫 보이는 자식)이 --bk-lift로 내려가는 부품인지 (blocks.css가 정한다) */
  function liftable(c: HTMLElement): boolean {
    const body = Array.from(c.querySelectorAll<HTMLElement>(':scope > .bk-in > *')).find((el) => el.offsetHeight > 0)
    return !!body && getComputedStyle(body).getPropertyValue('--bk-lifts').trim() === '1'
  }
  /** 내용에 보이는 소제목(.bk-h)이 있는지 */
  function headed(c: HTMLElement): boolean {
    return Array.from(c.querySelectorAll<HTMLElement>(':scope > .bk-in .bk-h')).some((h) => h.offsetHeight > 0)
  }
  /** 내용의 위아래 자리 (화면 px): 글이 시작할 수 있는 선, 끝나야 하는 선, 내용 높이 */
  function span(c: HTMLElement): { top: number; bottom: number; used: number; k: number } | null {
    const m = used(c)
    if (!m) return null
    const body = Array.from(c.querySelectorAll<HTMLElement>(':scope > .bk-in > *')).find((el) => el.offsetHeight > 0)!
    const top = body.getBoundingClientRect().top + parseFloat(getComputedStyle(body).paddingTop) * m.k
    return { top, bottom: top + m.room, used: m.used, k: m.k }
  }
  function lift(cells: HTMLElement[]): void {
    const rows = new Map<string, HTMLElement[]>()
    for (const c of cells) {
      if (!c.classList.contains('is-shared') || c.classList.contains('lk-row')) continue
      const key = c.style.gridRow || '1'
      rows.set(key, (rows.get(key) || []).concat(c))
    }
    rows.forEach((row) => {
      const group = row.filter(liftable)
      if (!group.length) return
      const others = row.filter((c) => !group.includes(c))
      // 칸 높이를 다 쓰는 차트, 표 (캔버스 16px까지는 다 쓴 것으로)
      const tall = others.some((c) => {
        const m = used(c)
        return !!m && m.used >= m.room - 16 * m.k
      })
      if (tall) {
        for (const c of group) {
          if (!boostable.has(c.dataset.type || '')) continue
          const inner = c.querySelector<HTMLElement>(':scope > .bk-in')
          if (!inner) continue
          const was = c.style.getPropertyValue('--bk-fit')
          const now = Number(was || 1)
          const shapes = shapesOf(inner)
          let ok = false
          for (const f of boosts) {
            if (f <= now) break
            c.style.setProperty('--bk-fit', String(f))
            place(inner)
            const m = used(c)
            if (m && m.used <= m.room && !crowded(inner, shapes)) {
              ok = true
              break
            }
          }
          if (!ok) {
            if (was) c.style.setProperty('--bk-fit', was)
            else c.style.removeProperty('--bk-fit')
            place(inner)
          }
        }
      }
      // 그런 차트 옆에서 소제목이 있는 부품(목록, 표, 준비 상황)은 내리지 않는다: 차트도 위에 소제목이 있어서, 내리면 나란한
      // 소제목의 윗선이 어긋난다. 소제목 없는 짧은 부품(숫자, 강조 상자, 핵심 한 줄)만 가운데로
      const lifted = tall ? group.filter((c) => !headed(c)) : group
      if (!lifted.length) return
      const ms = lifted.map(span)
      if (ms.some((m) => !m)) return
      const k = ms[0]!.k
      // 줄의 위아래: 칸의 테두리 상자 (면이 있으면 면의 바깥)
      const boxes = lifted.map((c) => c.getBoundingClientRect())
      const top = Math.min(...boxes.map((b) => b.top))
      const bottom = Math.max(...boxes.map((b) => b.bottom))
      const most = Math.max(...ms.map((m) => m!.used))
      const lo = Math.max(...ms.map((m) => m!.top))
      const hi = Math.min(...ms.map((m) => m!.bottom - m!.used))
      const T = Math.max(lo, Math.min(hi, top + (bottom - top - most) / 2))
      const d = ms.map((m) => Math.max(0, Math.min(T - m!.top, m!.bottom - m!.used - m!.top)) / k)
      // 모두 캔버스 8px 밑으로 내려가면 그대로 (내려 봐야 보이지 않고, 글을 적을 때마다 조금씩 움직인다)
      if (Math.max(...d) < 8) return
      lifted.forEach((c, i) => {
        if (d[i] >= 1) c.style.setProperty('--bk-lift', Math.round(d[i]) + 'px')
      })
    })
  }

  function fit(root: ParentNode): void {
    // 글꼴이 늦게 오면 그 전에 잰 글자 자리는 대신 쓴 글꼴의 것이라, 맞출 때마다 다시 잰다
    inks = {}
    const areas = root instanceof HTMLElement && root.classList.contains('bk-area') ? [root] : Array.from(root.querySelectorAll<HTMLElement>('.bk-area'))
    for (const area of areas) {
      // 움직이는 중이면 맞춘 값을 그대로 두고 끝나면 다시 (맨 위 설명)
      const mover = moving(area)
      if (mover) {
        later(area, mover, () => fit(area))
        continue
      }
      const cells = Array.from(area.children).filter((c) => c instanceof HTMLElement && c.classList.contains('bk')) as HTMLElement[]
      // 안 보이는 장(자리를 재지 못한다)은 맞춘 값을 지우지 않고 건너뛴다. 내보낸 파일은 발표하는 동안 다른 장을 숨겨 두는데,
      // 그때 글꼴이 와서 다시 맞추면 숨긴 장의 값이 모두 지워져 넘겨 보면 글자가 다른 크기였다
      if (!cells.length || !area.clientHeight) continue
      area.style.removeProperty('--bk-sq')
      for (let i = 1; i <= 3; i++) area.style.removeProperty('--bk-r' + i)
      for (const c of cells) {
        c.style.removeProperty('--bk-fit')
        c.style.removeProperty('--bk-air')
        c.style.removeProperty('--bk-lift')
      }
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
      // 보통 크기는 글자를 줄이기 전에 넘치는 줄이 다른 줄의 남는 높이를 먼저 가져온다(잰 높이는 줄이지 않고 들어가는 높이다).
      // 크게(1.2배)는 먼저 한 단계 줄인다: 줄여도 보통과 같은 크기이고, 줄 높이를 먼저 바꾸면 조금만 넘쳐도 줄 높이가 들쭉날쭉해진다.
      // 크게의 첫 단계는 1/1.2: 0.84면 보통보다 조금 커서(1.008배) 보통 크기로 잰 높이에 딱 맞는 칸은 또 넘친다
      const large = !!area.closest('.sz-large')
      const ladder = large ? [1 / 1.2, steps[1]] : steps
      const least = large ? ladder[0] : 1
      const shrink = (c: HTMLElement, last: number) => {
        const inner = c.querySelector<HTMLElement>(':scope > .bk-in')
        if (!inner) return
        for (const k of ladder) {
          if (k < last || !over(inner)) break
          if (Number(c.style.getPropertyValue('--bk-fit') || 1) <= k) continue
          c.style.setProperty('--bk-fit', String(k))
          place(inner)
        }
      }
      for (const c of cells) {
        const inner = c.querySelector<HTMLElement>(':scope > .bk-in')
        if (inner) place(inner)
        shrink(c, least)
      }
      if (!squeezed) grow(area, cells, room)
      for (const c of cells) shrink(c, 0)
      if (!squeezed && cells.every((c) => !c.style.getPropertyValue('--bk-fit'))) spread(cells, enlarge(cells))
      lift(cells)
      area.classList.remove('is-fitting')
    }
    // 부품 장 밖(한 장을 다 쓰는 위치 비교)도
    for (const plot of Array.from(root.querySelectorAll<HTMLElement>('.pm-plot'))) if (!plot.closest('.bk-area')) labels(plot)
  }

  /** 이름표 자리 고르기의 바깥 입구: 움직이는 중인 판(점이 내려앉는 중이다)은 끝난 뒤에 */
  function labels(scope: ParentNode): void {
    const plots = scope instanceof HTMLElement && scope.classList.contains('pm-plot') ? [scope] : Array.from(scope.querySelectorAll<HTMLElement>('.pm-plot'))
    for (const plot of plots) {
      const mover = moving(plot)
      if (mover) later(plot, mover, () => place(plot))
      else place(plot)
    }
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
