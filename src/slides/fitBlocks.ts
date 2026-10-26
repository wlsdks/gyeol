/**
 * 부품 장에서 칸에 다 들어가지 않는 부품을 잘리지 않게 맞춘다.
 * 부품을 놓을 때는 잘리지 않는 자리만 고르지만, 놓은 뒤에 항목을 더하거나 글을 길게 쓰면 넘칠 수 있다.
 *
 * 칸의 자리는 판(deck/blocks/board.ts)이 부품마다 잘리지 않는 크기로 나눠 두었다. 잰 높이(blockHeights.ts)는 보통 글자 크기라
 * 크게나 명조에서는 모자랄 수 있고, 놓은 뒤에 글을 길게 쓰면 넘칠 수 있다.
 * 3. 그래서 칸 안의 글이 넘치거나 서로 겹치는 부품은 글자를 단계로 줄인다(--bk-fit). 단계라서 같은 장의 비슷한 칸끼리 크기가 같다.
 *    카드와 강조색 면은 안쪽 여백까지 내려간 글도 넘친 것으로 본다.
 * 3-1. 거꾸로 장에 자리가 남으면(넘치는 칸이 하나도 없으면) 모든 칸의 글과 그림을 같은 비율로 단계로 키운다.
 *    내용이 적은 장에서 작은 글이 넓은 칸 한쪽에만 있으면 칸이 비어 보인다. 모든 칸을 같이 키워서 칸끼리 크기는 그대로 맞는다.
 * 3-2. 키운 뒤에도 칸에 높이가 남으면 줄이 쌓이는 부품(목록, 표, 일정 막대)은 줄 사이를 넓혀 칸 바닥까지 채운다(--bk-air, 캔버스 px, 24까지).
 *    글자를 더 키우면 장마다 글자 크기가 들쭉날쭉해지고, 가운데에 작게 모아 두면 위아래가 빈다. 줄 사이만 넓히면 칸을 채운다.
 *    칸마다 따로 고른다: 항목 수가 다른 두 목록이 한 줄에 있어도 둘 다 칸 아래까지 닿는다. 이 값을 쓰지 않는 부품은 그대로다
 *
 * 3-3. 한 줄에 부품이 둘 이상이면 부품마다 위에서부터 그린다(소제목 윗선을 맞춘다, blocks.css). 칸 높이를 다 쓰는 부품(차트, 표,
 *    바닥까지 채운 목록) 옆의 짧은 부품만 그것들끼리 묶어 가운데로 내리고(--bk-lift, 캔버스 px), 그 가운데 숫자 부품은 그 전에 한두 단계 키운다.
 *    그런 부품이 없는 줄은 위에 그대로 둔다: 남는 높이는 3-4가 맨 아래에 모은다.
 *
 * 3-4. 발표 화면에서는 판을 위아래로 나눈 줄마다 그려진 내용을 앞 줄 내용 바로 아래(--bk-gap, 소제목 아래는 좁게)로 올려 붙이고,
 *    남는 높이를 맨 아래 한곳에 모은다(--bk-shift, 캔버스 px, 칸째 옮긴다). 칸마다 가운데에 두거나 틈을 고르게 나누면 남는 높이가
 *    부품 사이마다 흩어져 부제 아래가 200px 넘게, 부품 사이가 130px 넘게 벌어졌다. 장 제목이 없으면 모은 묶음째 위아래 가운데에.
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
  // 줄 사이를 넓히는 가장 큰 값 (줄의 위아래에 더하는 캔버스 px). 넘게 벌리면 줄끼리 따로 떨어져 보여서 이만큼까지만
  const airMax = 24
  let range: Range | null = null
  let ctx: CanvasRenderingContext2D | null | undefined
  let inks: Record<string, [number, number]> = {}
  // 움직임이 끝나기를 기다리는 본문 상자와 판 (같은 것을 여러 번 기다리지 않게)
  const waiting = new WeakSet<Element>()

  /**
   * 안쪽 상자(.bk-in)의 글 없는 그림: 맨 바깥 svg와 읽지 않는 그림 상자(aria-hidden). 크기가 없는 것은 뺀다.
   * 글 줄만 보면 카드 아래 여백 밖으로 밀려난 차트의 점과 선을 놓쳐서, 맞추기(over)와 잘리지 않는 높이 재기가 같이 본다.
   * 이 함수 밖에 두면 내보낸 HTML에서는 없는 이름이라 맞추기가 처음부터 멈췄다(뷰어는 blockFitter의 소스만 넣는다)
   */
  function figures(inner: HTMLElement): Element[] {
    return Array.from(inner.querySelectorAll(':scope svg, :scope [aria-hidden="true"]')).filter((el) => {
      if (el.parentElement?.closest('svg')) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })
  }

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
    // 글이 없는 그림도 같은 자리 안에: 글자를 키우면 글 아래의 차트가 밀려 내려가 점이 카드 아래 여백 밖으로 나갔는데,
    // 글만 보면 넘치지 않은 것으로 알고 글자를 그대로 두거나 더 키웠다(한 개의 흐름, 몇 중 몇)
    for (const f of figures(inner)) {
      const q = f.getBoundingClientRect()
      if (q.top < top || q.bottom > bottom || q.left < left || q.right > right) return true
    }
    // 칠한 면이 늘어선 것(색 표의 칸들, data-fit-box)은 안쪽 여백에 조금도 들어가지 않게: 글자는 여백에 몇 px 걸쳐도 티가 안 나지만
    // 칠한 칸이 들어가면 그쪽 여백만 좁아 보인다(크게에서 색 표 여덟 줄이 아래 여백을 6px 먹어 위 51, 아래 38)
    // 줄은 묶음 상자 밖으로 넘칠 수 있어서(1fr 줄의 바닥은 내용) 묶음 안의 줄마다 본다
    for (const f of Array.from(inner.querySelectorAll('[data-fit-box] > *'))) {
      const q = f.getBoundingClientRect()
      if (q.top < r.top + parseFloat(cs.paddingTop) * k - slack || q.bottom > r.bottom - parseFloat(cs.paddingBottom) * k + slack) return true
    }
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
   * 추이의 점 숫자 자리를 그려진 크기로 다시 고른다. 그릴 때 어림한 자리(골짜기는 점 아래, Trend.tsx의 data-tn-side)를 먼저 보고,
   * 숫자가 선(앞뒤 점으로 가는 선)이나 다른 점, 앞의 숫자를 덮거나 그림 밖(위는 숫자 띠까지, 아래는 바닥줄)으로 나가면
   * 위, 점 오른쪽 위, 왼쪽 위, 점 바로 왼쪽과 오른쪽, 아래 차례로 겹치지 않는 자리를 찾는다. 없으면 가장 덜 겹치는 자리.
   * 앞 점보다 한참 낮은 마지막 점은 내리꽂히는 선이 점 위의 숫자를 그대로 지나갔다(바닥에 붙어 아래에 둘 자리도 없다)
   */
  function trendPlace(canvas: HTMLElement): void {
    const plot = canvas.parentElement
    if (!plot || !canvas.clientWidth) return
    const P = plot.getBoundingClientRect()
    const k = canvas.offsetWidth ? canvas.getBoundingClientRect().width / canvas.offsetWidth : 1
    const pts = Array.from(canvas.children).filter((c) => c instanceof HTMLElement && c.classList.contains('tn-pt') && !c.classList.contains('is-blank')) as HTMLElement[]
    const SIDES = ['is-below', 'is-after', 'is-before', 'is-mid']
    // 옆으로 비키기를 아래보다 먼저: 숫자가 모두 선 위에 있어야 읽기 쉽고, 아래는 바닥줄과 시기 이름에 붙기 쉽다.
    // 위로 비킬 자리가 없으면 점의 바로 옆(is-mid). 앞 점보다 한참 낮은 마지막 점은 위로는 내리꽂히는 선이, 아래로는 바닥줄이 지나가서
    // 강조한 큰 숫자가 바닥줄에 걸쳤다
    const tries = [[], ['is-after'], ['is-before'], ['is-mid', 'is-before'], ['is-mid', 'is-after'], ['is-below'], ['is-below', 'is-after'], ['is-below', 'is-before']]
    const set = (el: HTMLElement, on: string[]) => SIDES.forEach((c) => el.classList.toggle(c, on.indexOf(c) >= 0))
    const gap = 8 * k
    const dots = pts.map((p) => p.querySelector<HTMLElement>('.tn-dot')?.getBoundingClientRect() ?? null)
    const mid = dots.map((d) => (d ? { x: (d.left + d.right) / 2, y: (d.top + d.bottom) / 2 } : null))
    // 숫자 상자(떨어져야 할 틈까지)를 지나는 선의 길이를 점 24개로 어림한다
    const crossed = (r: DOMRect) => {
      let n = 0
      for (let j = 1; j < mid.length; j++) {
        const a = mid[j - 1]
        const b = mid[j]
        if (!a || !b) continue
        for (let t = 0; t <= 24; t++) {
          const x = a.x + ((b.x - a.x) * t) / 24
          const y = a.y + ((b.y - a.y) * t) / 24
          if (x > r.left - gap && x < r.right + gap && y > r.top - gap && y < r.bottom + gap) n++
        }
      }
      return n
    }
    const meet = (a: DOMRect, b: DOMRect) =>
      Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left) + gap) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) + gap)
    // 위는 그림 판(숫자 띠까지), 아래는 바닥줄, 양옆은 판 끝까지
    const outside = (r: DOMRect) => Math.max(0, P.top - r.top) + Math.max(0, r.bottom - (P.bottom - 4 * k)) + Math.max(0, P.left - r.left) + Math.max(0, r.right - P.right)
    const taken: DOMRect[] = []
    pts.forEach((p, i) => {
      const label = p.querySelector<HTMLElement>('.tn-val')
      if (!label) return
      const first = (p.dataset.tnSide ?? '').split(' ').filter(Boolean)
      let pick = first
      let best = Infinity
      for (const o of [first, ...tries]) {
        set(p, o)
        const r = label.getBoundingClientRect()
        let cost = (crossed(r) + outside(r)) * r.height * 40
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
   * 그림이 키우기 전의 70% 밑으로 줄어도 넘친 것이다: 글자를 키우느라 그래프를 찌그러뜨리지 않는다(반까지 봐주던 때는 크게에서
   * 좁은 카드의 비율 원이 170px에서 89px로 줄었다)
   */
  function crowded(inner: HTMLElement, shapes: Shape[] = []): boolean {
    if (over(inner, true)) return true
    const r = inner.getBoundingClientRect()
    const k = inner.offsetWidth ? r.width / inner.offsetWidth : 1
    const bottom = r.bottom - parseFloat(getComputedStyle(inner).paddingBottom) * k + 2 * k
    for (const it of inner.querySelectorAll<HTMLElement>('.it')) if (it.getBoundingClientRect().bottom > bottom) return true
    // 면을 깐 항목(핵심 숫자의 카드 같은)은 그 안의 글도 항목의 안쪽 여백 안에. 항목 상자는 칸 높이로 정해져 있어서, 키운 글은
    // 항목 밖으로 넘치지 않고 아래 여백만 먹었다(크게에서 키운 카드가 위 48px, 아래 27px)
    const limit = new Map<Element, number>()
    for (const q of lines(inner)) {
      const own = q.n.parentElement?.closest('.it')
      if (!own || !inner.contains(own)) continue
      let b = limit.get(own)
      if (b === undefined) {
        const pb = parseFloat(getComputedStyle(own).paddingBottom)
        b = pb >= 16 ? own.getBoundingClientRect().bottom - (pb - 8) * k : Infinity
        limit.set(own, b)
      }
      if (q.b > b + 2 * k) return true
    }
    for (const s of shapes) {
      const b = s.el.getBoundingClientRect()
      if (b.width < s.w * 0.7 || b.height < s.h * 0.7) return true
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

  /**
   * 칸마다 줄 사이를 넘치지 않는 가장 넓은 값으로 (1px 단위로 나눠 찾는다). 키우기(enlarge)가 끝난 뒤. 그림은 키우기 전 크기와 견준다.
   * 단계(24, 18, 12, 6)로 고르던 때는 줄이 넷인 목록에서 한 단계가 칸 높이로 100px쯤이라, 한 단계만 넘쳐도 아래로 내려가
   * 옆 칸(색 표, 차트)은 바닥까지 닿는데 이 목록만 칸의 4분의 3에서 끝났다
   */
  function spread(cells: HTMLElement[], shapes: Map<HTMLElement, Shape[]>): void {
    for (const c of cells) {
      const inner = c.querySelector<HTMLElement>(':scope > .bk-in')
      if (!inner) continue
      const fits = (a: number) => {
        c.style.setProperty('--bk-air', a + 'px')
        return !crowded(inner, shapes.get(inner))
      }
      let best = 0
      if (fits(airMax)) best = airMax
      else {
        let lo = 0
        let hi = airMax
        while (hi - lo > 1) {
          const mid = (lo + hi) >> 1
          if (fits(mid)) lo = mid
          else hi = mid
        }
        best = lo
      }
      if (best > 0) c.style.setProperty('--bk-air', best + 'px')
      else c.style.removeProperty('--bk-air')
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
   * 차트 옆의 짧은 부품을 가운데로 (맨 위 설명 3-3). 이음표가 선 줄은 부품마다 가운데에 두어서(blocks.css) 건너뛴다.
   * 내릴 수 있는 부품(blocks.css의 --bk-lifts: 글, 목록, 숫자, 강조 상자)은 글이 시작하는 선 하나(T)를 같이 쓴다. 그 선은
   * 묶음 가운데 가장 긴 내용이 줄 가운데에 오는 자리이고, 어느 칸도 넘치지 않게 그 안에서만 옮긴다.
   * 칸마다 칸 위에서 재면 안 된다: 옅은 면, 진한 면은 안쪽 여백만큼 글이 아래에서 시작해서, 옆의 글은 칸 위에 붙고 면 안의 글만
   * 내려가 있었다.
   * 줄에 칸 높이를 거의 다 쓰는 부품(차트, 표, 바닥까지 채운 목록)이 있으면 그것은 그대로 두고, 그 옆에서 칸의 60%도 쓰지 않는
   * 짧은 부품만 자기들끼리 가운데로 내린다. 소제목이 있어도 내린다: 차트 옆 소제목과 두 줄 글을 위에 붙여 두면 칸 아래 절반이
   * 통째로 비어, 옆 칸만 꽉 차고 이 칸은 덜 만든 것처럼 보였다. 내용이 칸의 60~80%인 부품은 위에 그대로 둔다: 조금만 내려가면
   * 나란한 소제목의 윗선이 어긋나 실수처럼 보인다. 그런 부품이 없는 줄은 그대로 위에서부터(남는 높이는 pack이 맨 아래로).
   * 칸 높이를 다 쓰는 차트, 표 옆의 숫자 부품(큰 숫자, 전과 후, 목표 대비)은 내리기 전에 한두 단계 키운다(boosts): 높은 칸에
   * 작은 숫자가 떠 있으면 칸이 비어 보인다. 글 부품은 키우지 않는다(장 제목과 크기가 가까워진다)
   */
  const boosts = [1.44, 1.2]
  const boostable = new Set(['number', 'delta', 'goal'])
  // 자기 큰 숫자가 있는 그림(몇 중 몇, 비율 원) 옆에서는 키우지 않는다: 키우면 나란한 두 숫자가 한 장 안에서 크기가 달라진다
  const figured = new Set(['ratio', 'ring'])
  /** 내용(첫 보이는 자식)이 --bk-lift로 내려가는 부품인지 (blocks.css가 정한다) */
  function liftable(c: HTMLElement): boolean {
    const body = Array.from(c.querySelectorAll<HTMLElement>(':scope > .bk-in > *')).find((el) => el.offsetHeight > 0)
    return !!body && getComputedStyle(body).getPropertyValue('--bk-lifts').trim() === '1'
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
      // 쌓은 부품은 칸 높이를 나눠 쓰므로 가운데로 내리지 않는다
      if (!c.classList.contains('is-shared') || c.classList.contains('lk-row') || c.classList.contains('is-stacked')) continue
      const key = c.dataset.band || '0'
      rows.set(key, (rows.get(key) || []).concat(c))
    }
    // 칸 높이를 다 쓰는지 (캔버스 16px까지는 다 쓴 것으로)
    const fills = (c: HTMLElement) => {
      const m = used(c)
      return !!m && m.used >= m.room - 16 * m.k
    }
    // 칸 높이 가운데 내용이 쓰는 몫
    const share = (c: HTMLElement) => {
      const m = used(c)
      return m && m.room > 0 ? m.used / m.room : 0
    }
    rows.forEach((row) => {
      const all = row.filter(liftable)
      if (!all.length) return
      // 칸 높이를 거의 다(80%) 쓰는 부품. 내릴 수 없는 차트, 표는 칸 높이를 다 쓸 때(fills)만 기준이 된다
      const anchored = (c: HTMLElement) => (liftable(c) ? share(c) >= 0.8 : fills(c))
      const anchors = row.filter(anchored)
      const rest = all.filter((c) => !anchors.includes(c))
      // 칸 높이를 다 쓰는 차트, 표 옆이면 숫자 부품을 먼저 키운다
      const tall = anchors.some((c) => !liftable(c))
      if (tall && !row.some((c) => figured.has(c.dataset.type || ''))) {
        for (const c of rest) {
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
      // 기준이 되는 부품 옆의 짧은 부품끼리만. 기준이 없는 줄(글과 숫자뿐)은 위에 둔다: 줄째 가운데로 내리면 칸이 내용보다 높은 만큼
      // 줄 위아래가 비어 부품 사이가 들쭉날쭉 벌어졌다. 남는 높이는 쌓기(pack)가 맨 아래에 모은다
      if (!anchors.length) return
      const lifted = rest.filter((c) => share(c) <= 0.6)
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

  /**
   * 칸에서 그려진 것의 위아래 (화면 px). 면이 있는 칸은 면째(칸 전체), 없으면 글 줄(글자가 그려진 선)과 그림(svg, 이미지),
   * 바탕이나 테두리를 칠한 상자의 범위. 상자의 자리로 재면 높이를 다 쓰는 격자(몇 중 몇의 점 판 같은)가 칸 바닥까지 잡혀,
   * 그 아래가 비어도 비지 않은 것으로 보았다. 본문이 위에 긋는 선(소제목의 ::before)도 그려진 것이라 그만큼 위로 늘린다.
   * 쌓기(pack)와 개발용 검사(screens/assembly.ts)가 같이 쓴다
   */
  function drawn(c: HTMLElement): { t: number; b: number } | null {
    const r = c.getBoundingClientRect()
    if (!c.classList.contains('bk-look-plain')) return { t: r.top, b: r.bottom }
    const inner = c.querySelector<HTMLElement>(':scope > .bk-in')
    if (!inner) return null
    const k = inner.offsetWidth ? inner.getBoundingClientRect().width / inner.offsetWidth : 1
    let t = Infinity
    let b = -Infinity
    for (const q of lines(inner)) {
      t = Math.min(t, q.t)
      b = Math.max(b, q.b)
    }
    const els = inner.querySelectorAll<HTMLElement>('*')
    for (let i = 0; i < els.length; i++) {
      const el = els[i]
      if (el.parentElement?.closest('svg')) continue
      const e = el.getBoundingClientRect()
      if (!e.width || !e.height) continue
      const tag = el.tagName.toLowerCase()
      let paint = tag === 'svg' || tag === 'img'
      if (!paint) {
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || cs.opacity === '0') continue
        const bg = cs.backgroundColor
        const clear = !bg || bg === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(bg) || /\/\s*0\)$/.test(bg)
        paint = !clear || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0
      }
      if (!paint) continue
      t = Math.min(t, e.top)
      b = Math.max(b, e.bottom)
    }
    if (t === Infinity) return null
    const body = Array.from(inner.children).find((el) => (el as HTMLElement).offsetHeight > 0)
    if (body) {
      const pb = getComputedStyle(body, '::before')
      if (pb.content !== 'none' && pb.content !== 'normal' && pb.display !== 'none' && pb.position !== 'absolute') t -= ((parseFloat(pb.height) || 0) + (parseFloat(pb.marginBottom) || 0)) * k
    }
    return { t, b }
  }

  /**
   * 면을 내용에 맞춰 줄이기 (맨 위 설명 3-4). 판은 본문을 늘 다 덮고 면(옅은 면, 진한 면)은 남는 높이를 차트 다음으로 받아서,
   * 한두 줄짜리 강조 상자가 700px 높이의 짙은 면이 되어 면 가운데에 글 한 줄만 떠 있었다. 발표 화면에서는 면을
   * 그 줄(나란한 묶음)의 다른 내용이 쓰는 높이까지, 그보다 짧으면 제 내용 높이까지 줄인다(--bk-trim, 칸 높이에서 뺀다).
   * 나란한 면끼리는 같은 높이로. 줄인 뒤 어느 칸이라도 넘치면(칸 높이로 정한 글자 단계가 바뀐다) 그 줄은 그대로 둔다
   */
  function hug(bands: HTMLElement[][], k: number): void {
    for (const cs of bands) {
      const boxes = cs.map((c) => c.getBoundingClientRect())
      const top = Math.min(...boxes.map((x) => x.top))
      const bottom = Math.max(...boxes.map((x) => x.bottom))
      const faced = cs.filter((c) => !c.classList.contains('bk-look-plain'))
      if (!faced.length) continue
      // 줄 안에 위아래로 쌓인 면은 그 둘레가 따로 정해져 있어 건드리지 않는다
      const spans = (c: HTMLElement) => {
        const r = c.getBoundingClientRect()
        return r.top <= top + 1 && r.bottom >= bottom - 1
      }
      if (!faced.every(spans)) continue
      let need = 0
      for (const c of cs) {
        if (faced.includes(c)) {
          const inner = c.querySelector<HTMLElement>(':scope > .bk-in')
          const body = inner && Array.from(inner.children).find((el) => (el as HTMLElement).offsetHeight > 0)
          if (!inner || !body) {
            need = Infinity
            break
          }
          const ir = inner.getBoundingClientRect()
          const cs2 = getComputedStyle(inner)
          const room = ir.height - (parseFloat(cs2.paddingTop) + parseFloat(cs2.paddingBottom)) * k
          let t = Infinity
          let b = -Infinity
          for (const el of Array.from(body.children)) {
            const e = el.getBoundingClientRect()
            const es = getComputedStyle(el)
            if (!e.height || es.position === 'absolute' || es.position === 'fixed') continue
            t = Math.min(t, e.top)
            b = Math.max(b, e.bottom)
          }
          if (t === Infinity) {
            need = Infinity
            break
          }
          need = Math.max(need, c.getBoundingClientRect().height - Math.max(0, room - (b - t)))
        } else {
          const ink = drawn(c)
          if (!ink) {
            need = Infinity
            break
          }
          need = Math.max(need, ink.b - top)
        }
      }
      if (!Number.isFinite(need)) continue
      const trim = Math.floor((bottom - top - need) / k)
      // 캔버스 24px 밑이면 그대로 (글을 적을 때마다 면이 조금씩 움직이지 않게)
      if (trim < 24) continue
      for (const c of faced) c.style.setProperty('--bk-trim', trim + 'px')
      for (const c of faced) {
        const inner = c.querySelector<HTMLElement>(':scope > .bk-in')
        if (inner) place(inner)
      }
      const spills = (c: HTMLElement) => {
        const inner = c.querySelector<HTMLElement>(':scope > .bk-in')
        return !!inner && over(inner)
      }
      if (faced.some(spills)) {
        for (const c of faced) c.style.removeProperty('--bk-trim')
        for (const c of faced) {
          const inner = c.querySelector<HTMLElement>(':scope > .bk-in')
          if (inner) place(inner)
        }
      }
    }
  }

  /**
   * 위에서부터 쌓기 (맨 위 설명 3-4). 판은 늘 본문 상자를 빈틈없이 덮어서, 칸이 내용보다 높으면 그 차이가 칸마다 내용 위아래에
   * 흩어져 부품 사이가 들쭉날쭉 벌어졌다(부제 아래 200px, 핵심 한 줄과 인용 사이 130px). 사람이 짠 장처럼, 판을 위아래로 나눈
   * 줄(나란한 묶음, data-band)마다 그려진 내용을 앞 줄의 내용 바로 아래(줄 사이 --bk-gap, 소제목 아래는 좁게)로 올려 붙이고
   * 남는 높이는 맨 아래 한곳에 모은다. 장 제목이 없는 장(결론 한 장)은 모은 묶음째 위아래 가운데에 둔다.
   * 줄째 같은 만큼 옮겨서 나란한 칸끼리의 윗선은 그대로다. 칸을 옮기므로(--bk-shift, 칸의 top) 면이 있는 칸도 면째 간다.
   * 발표 화면(편집이 아닌 장)에서만: 편집 화면은 판의 칸과 나누는 선을 그대로 보여야 해서, 칸 안의 글만 위에서부터 그린다
   * (blocks/base.css). 판이 남는 높이를 맨 아래 줄에 주어(board.ts의 share) 편집 화면에서도 빈 곳은 아래에 모인다.
   * 이음표: 옆 이음표는 그 줄과 같이 옮기고, 줄 사이의 아래 이음표는 그 사이를 이음표가 설 자리만큼 넓히고 가운데에 세운다
   */
  const headGap = 32
  function pack(cells: HTMLElement[], area: HTMLElement): void {
    if (!cells.length || area.closest('.m-edit')) return
    if (cells.some((c) => c.classList.contains('is-slot'))) return
    const a = area.getBoundingClientRect()
    const k = a.height / area.offsetHeight
    if (!a.height || !k) return
    const style = getComputedStyle(area)
    const gap = (parseFloat(style.getPropertyValue('--bk-gap')) || 48) * k
    const pad = (parseFloat(style.getPropertyValue('--lk-pad')) || 24) * k
    const links = Array.from(area.querySelectorAll<HTMLElement>(':scope > .bk-link'))
    const groups = new Map<string, HTMLElement[]>()
    for (const c of cells) {
      const key = c.dataset.band ?? c.dataset.block ?? ''
      groups.set(key, (groups.get(key) || []).concat(c))
    }
    // 옆 이음표가 선 줄은 이음표가 칸 높이의 가운데에 서서 면을 줄이지 않는다
    hug(
      Array.from(groups.values()).filter((cs) => !cs.some((c) => c.classList.contains('lk-row'))),
      k,
    )
    // 칸마다 판의 자리(화면 px)와 그려진 범위, 바로 위에 있는 칸들(판에서 이 칸 위 선보다 위에서 끝나고 옆으로 겹친다)
    const side = (p: DOMRect, q: DOMRect) => Math.min(p.right, q.right) - Math.max(p.left, q.left) > 1
    const items = cells.map((c) => ({ c, r: c.getBoundingClientRect(), ink: drawn(c), id: c.dataset.block, above: [] as HTMLElement[] }))
    if (items.some((x) => !x.ink)) return
    for (const x of items) x.above = items.filter((y) => y.r.bottom <= x.r.top + 1 && side(x.r, y.r)).map((y) => y.c)
    // 같은 묶음에서 같은 줄 선(--y)에 서고 위에 있는 칸도 같은 칸들은 같이 옮긴다: 나란한 칸의 윗선(과 차트 옆에 가운데로 내린
    // 짧은 칸)이 그대로다. 위에 있는 칸이 다르면(소제목 묶음 둘이 나란한 장) 저마다 제 소제목 아래에 붙는다
    const rows = new Map<string, typeof items>()
    for (const x of items) {
      const key = [x.c.dataset.band ?? '', x.c.style.getPropertyValue('--y'), ...x.above.map((c) => c.dataset.block)].join('|')
      rows.set(key, (rows.get(key) || []).concat(x))
    }
    const order = Array.from(rows.values()).sort((p, q) => Math.min(...p.map((x) => x.r.top)) - Math.min(...q.map((x) => x.r.top)))
    const dy = new Map<HTMLElement, number>()
    for (const row of order) {
      let at = a.top
      for (const x of items) {
        if (!row[0].above.includes(x.c) || !dy.has(x.c)) continue
        const below = links.some((l) => l.classList.contains('lk-v') && l.dataset.after === x.id)
        // 아래 이음표가 서면 이음표가 설 자리(양쪽 --lk-pad)만큼 넓게, 소제목 아래는 그 아래 부품과 한 덩어리라 좁게
        const room = below ? gap + 2 * pad : x.c.dataset.type === 'heading' ? headGap * k : gap
        at = Math.max(at, x.ink!.b + dy.get(x.c)! + room)
      }
      const t = Math.min(...row.map((x) => x.ink!.t))
      const d = Math.min(0, at - t)
      for (const x of row) dy.set(x.c, d)
    }
    const head = area.parentElement?.querySelector<HTMLElement>(':scope > .s-head')
    if (!head || !head.getClientRects().length) {
      const end = Math.max(...items.map((x) => x.ink!.b + dy.get(x.c)!))
      const spare = a.bottom - end
      if (spare > 0) for (const x of items) dy.set(x.c, dy.get(x.c)! + spare / 2)
    }
    // 모두 캔버스 8px 밑이면 그대로 (글을 적을 때마다 조금씩 움직이지 않게)
    if (Math.max(...items.map((x) => Math.abs(dy.get(x.c)!))) / k < 8) return
    for (const x of items) {
      const px = Math.round(dy.get(x.c)! / k)
      if (px) x.c.style.setProperty('--bk-shift', px + 'px')
    }
    // 옆 이음표는 옮긴 앞 칸의 그려진 것 가운데 높이로, 아래 이음표는 옮긴 위아래 칸의 그려진 것 사이 가운데로
    for (const l of links) {
      const from = items.find((x) => x.id === l.dataset.after)
      if (!from) continue
      if (l.classList.contains('lk-h')) {
        // 앞 칸의 그려진 것 가운데 높이에: 칸 가운데에 두면 위에 붙은 소제목 옆 이음표가 그 아래로 올려 붙인 부품에 걸쳤다
        const r = l.getBoundingClientRect()
        const mid = (from.ink!.t + from.ink!.b) / 2 + dy.get(from.c)!
        const move = Math.round((mid - (r.top + r.bottom) / 2) / k)
        if (move) l.style.setProperty('--bk-shift', move + 'px')
        continue
      }
      const to = items.filter((x) => x.r.top >= from.r.bottom - 1 && side(x.r, from.r)).sort((p, q) => p.r.top - q.r.top)[0]
      if (!to) continue
      const r = l.getBoundingClientRect()
      const mid = (from.ink!.b + dy.get(from.c)! + to.ink!.t + dy.get(to.c)!) / 2
      const move = Math.round((mid - (r.top + r.bottom) / 2) / k)
      if (move) l.style.setProperty('--bk-shift', move + 'px')
    }
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
      const cells = Array.from(area.querySelectorAll<HTMLElement>(':scope > .bk'))
      // 안 보이는 장(자리를 재지 못한다)은 맞춘 값을 지우지 않고 건너뛴다. 내보낸 파일은 발표하는 동안 다른 장을 숨겨 두는데,
      // 그때 글꼴이 와서 다시 맞추면 숨긴 장의 값이 모두 지워져 넘겨 보면 글자가 다른 크기였다
      if (!cells.length || !area.clientHeight) continue
      for (const l of Array.from(area.querySelectorAll<HTMLElement>(':scope > .bk-link'))) l.style.removeProperty('--bk-shift')
      for (const c of cells) {
        c.style.removeProperty('--bk-fit')
        c.style.removeProperty('--bk-air')
        c.style.removeProperty('--bk-lift')
        c.style.removeProperty('--bk-shift')
        c.style.removeProperty('--bk-trim')
      }
      // 편집 화면의 편집 표시(칸 옆으로 나온 단추 같은)는 재는 동안 뺀다 (edit.css)
      area.classList.add('is-fitting')
      // 크게(1.2배)의 첫 단계는 1/1.2: 0.84면 보통보다 조금 커서(1.008배) 보통 크기로 잰 높이에 딱 맞는 칸은 또 넘친다
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
        if (inner) {
          place(inner)
          for (const canvas of Array.from(inner.querySelectorAll<HTMLElement>('.tn-canvas'))) trendPlace(canvas)
        }
        shrink(c, least)
      }
      for (const c of cells) shrink(c, 0)
      if (cells.every((c) => !c.style.getPropertyValue('--bk-fit'))) spread(cells, enlarge(cells))
      lift(cells)
      pack(cells, area)
      area.classList.remove('is-fitting')
    }
    // 부품 장 밖(한 장을 다 쓰는 위치 비교, 추이)도
    for (const plot of Array.from(root.querySelectorAll<HTMLElement>('.pm-plot, .tn-canvas'))) if (!plot.closest('.bk-area')) labels(plot)
  }

  /** 이름표 자리 고르기의 바깥 입구: 움직이는 중인 판(점이 내려앉는 중이다)은 끝난 뒤에. 추이의 점 숫자도 같다 */
  function labels(scope: ParentNode): void {
    const plots = scope instanceof HTMLElement && scope.classList.contains('pm-plot') ? [scope] : Array.from(scope.querySelectorAll<HTMLElement>('.pm-plot'))
    for (const plot of plots) {
      const mover = moving(plot)
      if (mover) later(plot, mover, () => place(plot))
      else place(plot)
    }
    const canvases = scope instanceof HTMLElement && scope.classList.contains('tn-canvas') ? [scope] : Array.from(scope.querySelectorAll<HTMLElement>('.tn-canvas'))
    for (const canvas of canvases) {
      const mover = moving(canvas)
      if (mover) later(canvas, mover, () => trendPlace(canvas))
      else trendPlace(canvas)
    }
  }

  return { fit, lines, over, labels, figures, drawn }
}

let fitter: ReturnType<typeof blockFitter> | null = null
const shared = () => (fitter ??= blockFitter())

/** 이 안의 부품 장을 모두 맞춘다 (root가 .bk-area면 그것만) */
export const fitBlocks = (root: ParentNode) => shared().fit(root)
/** 칸 안쪽의 글 줄마다 글자가 그려지는 자리 (부품 높이 재기에서 겹침과 잘림을 볼 때) */
export const blockTextLines = (inner: HTMLElement) => shared().lines(inner)
/** 위치 비교의 이름표와 추이의 점 숫자 자리를 그려진 크기로 다시 고른다 (scope 안의 판 모두, scope가 판이면 그것만) */
export const placeLabels = (scope: ParentNode) => shared().labels(scope)
/** 칸 안쪽이 넘치거나 글이 겹치는지 (fitBlocks가 글자를 줄이는 기준. 진단용) */
export const blockOverflows = (inner: HTMLElement) => shared().over(inner)
/** 칸 안쪽의 글 없는 그림 (맞추기와 잘리지 않는 높이 재기가 같이 본다) */
export const blockFigures = (inner: HTMLElement) => shared().figures(inner)
/** 칸에서 그려진 것의 위아래 (쌓기와 개발용 검사 checkAssembly가 같이 본다) */
export const blockDrawn = (cell: HTMLElement) => shared().drawn(cell)
