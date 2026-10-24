/**
 * 부품 장에서 칸에 다 들어가지 않는 부품을 잘리지 않게 맞춘다.
 * 부품을 놓을 때는 잘리지 않는 자리만 고르지만, 놓은 뒤에 항목을 더하거나 글을 길게 쓰면 넘칠 수 있다.
 *
 * 1. 줄마다의 가장 낮은 높이를 더해도 본문 상자보다 높으면, 줄 높이를 같은 비율로 낮춘다(--bk-sq).
 * 2. 그래도 칸 안의 글이 넘치거나 서로 겹치는 부품은 글자를 단계로 줄인다(--bk-fit). 단계라서 같은 장의 비슷한 칸끼리 크기가 같다.
 *    카드와 강조색 면은 안쪽 여백까지 내려간 글도 넘친 것으로 본다.
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

  function fit(root: ParentNode): void {
    // 글꼴이 늦게 오면 그 전에 잰 글자 자리는 대신 쓴 글꼴의 것이라, 맞출 때마다 다시 잰다
    inks = {}
    const areas = root instanceof HTMLElement && root.classList.contains('bk-area') ? [root] : Array.from(root.querySelectorAll<HTMLElement>('.bk-area'))
    for (const area of areas) {
      const cells = Array.from(area.children).filter((c) => c instanceof HTMLElement && c.classList.contains('bk')) as HTMLElement[]
      area.style.removeProperty('--bk-sq')
      for (const c of cells) c.style.removeProperty('--bk-fit')
      // 안 보이는 장(자리를 재지 못한다)은 건너뛴다
      if (!cells.length || !area.clientHeight) continue
      // 줄 높이의 합으로 본다. 상자 전체의 scrollHeight는 칸 밖으로 넘친 글까지 세어서, 칸 하나가 조금 넘쳐도
      // 모든 줄을 낮추게 된다 (넘친 칸은 아래에서 그 칸의 글자만 줄인다)
      const style = getComputedStyle(area)
      const tracks = style.gridTemplateRows.split(' ').map(parseFloat).filter((n) => n >= 0)
      const gaps = (parseFloat(style.rowGap) || 0) * Math.max(0, tracks.length - 1)
      const need = tracks.reduce((a, n) => a + n, 0)
      const room = area.clientHeight - gaps
      if (need > room + 1) area.style.setProperty('--bk-sq', Math.max(0.4, room / need).toFixed(3))
      for (const c of cells) {
        const inner = c.querySelector<HTMLElement>(':scope > .bk-in')
        if (!inner) continue
        for (const k of steps) {
          if (!over(inner)) break
          c.style.setProperty('--bk-fit', String(k))
        }
      }
    }
  }

  return { fit, lines, over }
}

let fitter: ReturnType<typeof blockFitter> | null = null
const shared = () => (fitter ??= blockFitter())

/** 이 안의 부품 장을 모두 맞춘다 (root가 .bk-area면 그것만) */
export const fitBlocks = (root: ParentNode) => shared().fit(root)
/** 칸 안쪽의 글 줄마다 글자가 그려지는 자리 (부품 높이 재기에서 겹침과 잘림을 볼 때) */
export const blockTextLines = (inner: HTMLElement) => shared().lines(inner)
/** 칸 안쪽이 넘치거나 글이 겹치는지 (fitBlocks가 글자를 줄이는 기준. 진단용) */
export const blockOverflows = (inner: HTMLElement) => shared().over(inner)
