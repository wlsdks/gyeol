// 발표할 때의 움직임 엔진. 앱의 발표 화면과 내보낸 HTML의 뷰어가 똑같이 쓴다.
//
// - 의존성 없이 브라우저 기능만 쓴다: Web Animations(WAAPI), CSS linear() 이징, View Transitions.
// - 사용자는 움직임을 하나하나 붙이지 않는다. 레이아웃마다 짜 둔 순서(연출표)로 움직이고, 정도만 고른다.
// - 움직임은 처음부터 직접 만들었다. 특정 사이트나 라이브러리의 코드를 옮기지 않았다(docs/MOTION.md).
// - 끝나면 원래 모습 그대로다. 애니메이션은 시작 모습만 정하고(fill: backwards), 끝 모습은 CSS 그대로.
//   제목을 낱말로 나눈 것도 끝나면 원래 글자 노드로 되돌린다.
//
// 뷰어에는 이 함수의 소스(toString)가 그대로 들어간다. 그래서 바깥의 아무것도 참조하지 않게,
// 필요한 것은 모두 이 함수 안에 둔다.

export type MotionLevel = 'calm' | 'lively'

export interface MotionEngine {
  /** 한 장을 움직인다. 돌려받은 함수를 부르면 바로 끝 모습으로 */
  play(root: Element, level: MotionLevel): () => void
  /** 장을 바꾸는 동안 앞 장과 다음 장을 이어 준다. 지원하지 않으면 그냥 바꾼다 */
  swap(update: () => void, kind: string, direction: 1 | -1): void
}

export function motionEngine(): MotionEngine {
  // ---------- 스프링: 물리 시뮬레이션을 CSS linear() 이징으로 ----------
  // 같은 스프링이라도 시간이 정해져 있어서, 멈출 때까지 흉내 내 보고 그 시간을 쓴다.
  function spring(stiffness: number, damping: number) {
    const dt = 1 / 240
    let x = 0
    let v = 0
    let t = 0
    const pts: number[] = []
    while (t < 3) {
      v += (-stiffness * (x - 1) - damping * v) * dt
      x += v * dt
      t += dt
      pts.push(x)
      if (Math.abs(x - 1) < 0.001 && Math.abs(v) < 0.01) break
    }
    const n = 64
    const out: string[] = ['0']
    for (let i = 1; i < n; i++) out.push(String(Math.round(pts[Math.round((i / n) * (pts.length - 1))] * 10000) / 10000))
    out.push('1')
    return { easing: `linear(${out.join(', ')})`, duration: Math.round(t * 1000) }
  }

  // 차분하게: 넘치지 않고 빠르게 자리 잡는다(보고 자리에서 기다리게 하지 않게).
  // 생동감: 조금 넘쳤다가 되돌아오며 자리 잡는다.
  const SPRINGS = {
    quick: spring(300, 35),
    glide: spring(170, 26),
    soft: spring(110, 21),
    bounce: spring(200, 16),
    pop: spring(320, 17),
  }
  const OUT = 'cubic-bezier(0.16, 1, 0.3, 1)'

  const LEVELS = {
    calm: { y: 20, step: 60, word: 30, rot: 0, scale: 0.98, move: SPRINGS.quick, grow: SPRINGS.glide, pop: SPRINGS.quick, speed: 0.8 },
    lively: { y: 64, step: 110, word: 55, rot: 3, scale: 0.92, move: SPRINGS.bounce, grow: SPRINGS.bounce, pop: SPRINGS.pop, speed: 1.1 },
  }

  type Level = (typeof LEVELS)['calm']
  type Spring = { easing: string; duration: number }

  // ---------- 하나하나의 움직임 ----------

  function run(
    out: Animation[],
    el: Element,
    frames: Keyframe[],
    at: number,
    timing: { easing: string; duration: number },
    pseudoElement?: string,
  ) {
    // 키프레임 하나만 주면 Web Animations는 그것을 '끝' 모습으로 본다. 여기서는 늘 '시작' 모습이라 offset 0을 붙인다.
    const keyframes = frames.length === 1 ? [{ ...frames[0], offset: 0 }] : frames
    const a = el.animate(keyframes, {
      duration: timing.duration,
      delay: Math.max(0, at),
      easing: timing.easing,
      fill: 'backwards',
      pseudoElement,
    })
    out.push(a)
    return a
  }

  /** 제목을 낱말로 나눈다. 낱말마다 아래에서 올라오게. 되돌리는 함수도 함께 돌려준다. */
  function splitWords(el: Element) {
    const words: HTMLElement[] = []
    const undo: (() => void)[] = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const texts: Text[] = []
    for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text)
    for (const node of texts) {
      const parts = (node.nodeValue || '').split(/(\s+)/)
      if (parts.every((p) => !p.trim())) continue
      const made: Node[] = []
      for (const part of parts) {
        if (!part) continue
        if (!part.trim()) {
          made.push(document.createTextNode(part))
          continue
        }
        const outer = document.createElement('span')
        outer.className = 'mo-w'
        const inner = document.createElement('span')
        inner.className = 'mo-wi'
        inner.textContent = part
        outer.appendChild(inner)
        made.push(outer)
        words.push(inner)
      }
      const parent = node.parentNode
      if (!parent) continue
      for (const m of made) parent.insertBefore(m, node)
      parent.removeChild(node)
      undo.push(() => {
        if (!made[0].parentNode) return
        made[0].parentNode.insertBefore(node, made[0])
        for (const m of made) m.parentNode?.removeChild(m)
      })
    }
    return { words, restore: () => undo.forEach((u) => u()) }
  }

  /** 큰 숫자를 0부터 올린다. 숫자가 하나만 있는 칸만. '3~4개월', 날짜는 그대로 둔다. */
  function countUp(el: Element, at: number, duration: number, stops: (() => void)[]) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode() as Text | null
    while (node && !/\d/.test(node.nodeValue || '')) node = walker.nextNode() as Text | null
    if (!node) return
    const text = node.nodeValue || ''
    const all = text.match(/\d[\d,]*(\.\d+)?/g)
    if (!all || all.length !== 1) return
    const m = /^(\D*)(\d[\d,]*)(\.\d+)?([\s\S]*)$/.exec(text)
    if (!m) return
    const target = parseFloat((m[2] + (m[3] || '')).replace(/,/g, ''))
    if (!(target > 0) || target >= 1e12) return
    const decimals = m[3] ? m[3].length - 1 : 0
    const grouped = m[2].indexOf(',') >= 0
    const format = (v: number) => {
      let s = v.toFixed(decimals)
      if (grouped) {
        const parts = s.split('.')
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        s = parts.join('.')
      }
      return m[1] + s + m[4]
    }
    const target_node = node
    const start = performance.now() + at
    let frame = 0
    target_node.nodeValue = format(0)
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration))
      // 처음엔 빠르게, 끝에서 천천히 멈춘다
      target_node.nodeValue = t >= 1 ? text : format(target * (1 - Math.pow(2, -10 * t)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    stops.push(() => {
      cancelAnimationFrame(frame)
      target_node.nodeValue = text
    })
  }

  /**
   * 숫자를 자리마다 굴려서 맞춘다(주행 거리계처럼). 숫자가 하나만 있는 칸만, countUp과 같은 조건.
   * 제자리 숫자는 투명하게 남겨 줄과 폭을 그대로 지키고, 자리마다 그 글자 상자와 같은 크기의 창을 덮어
   * 0부터 그 숫자까지(한 바퀴 더) 굴린다. 왼쪽 자리부터 차례로 멈춘다. 다 굴러가면 창을 걷고 원래 글자로.
   * 글자 상자를 잴 수 없으면(안 보이는 칸) false를 돌려준다. 그때는 0부터 올리기로.
   */
  function roll(el: Element, at: number, duration: number, easing: string, anims: Animation[], restores: (() => void)[]) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode() as Text | null
    while (node && !/\d/.test(node.nodeValue || '')) node = walker.nextNode() as Text | null
    const parent = node && node.parentElement
    if (!node || !parent) return false
    const text = node.nodeValue || ''
    const all = text.match(/\d[\d,]*(\.\d+)?/g)
    if (!all || all.length !== 1 || all[0].replace(/\D/g, '').length > 9) return false
    const base = parent.getBoundingClientRect()
    // 발표 화면은 장을 줄여 그린다. 잰 값을 장의 px로 되돌린다
    const k = parent.offsetWidth ? base.width / parent.offsetWidth : 0
    if (!k) return false
    // 숫자마다 감싼다. 감싼 것은 글자 모양을 바꾸지 않는 보통 span이라 줄과 폭이 그대로다
    const frag = document.createDocumentFragment()
    const cells: HTMLElement[] = []
    let plain = ''
    for (const ch of text) {
      if (ch >= '0' && ch <= '9') {
        if (plain) frag.appendChild(document.createTextNode(plain))
        plain = ''
        const c = document.createElement('span')
        c.textContent = ch
        cells.push(c)
        frag.appendChild(c)
      } else plain += ch
    }
    if (plain) frag.appendChild(document.createTextNode(plain))
    const parts = Array.prototype.slice.call(frag.childNodes) as Node[]
    const original = node
    parent.replaceChild(frag, original)
    const covers: HTMLElement[] = []
    const position = parent.style.position
    // 나눈 조각과 덮은 창을 걷고 원래 글 하나로
    const undo = () => {
      covers.forEach((c) => c.remove())
      if (parts[0].parentNode === parent) parent.insertBefore(original, parts[0])
      parts.forEach((p) => p.parentNode === parent && parent.removeChild(p))
      parent.style.position = position
    }
    const boxes = cells.map((c) => c.getBoundingClientRect())
    if (boxes.some((b) => !b.width || !b.height)) {
      undo()
      return false
    }
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative'
    const n = cells.length
    cells.forEach((c, i) => {
      const b = boxes[i]
      const h = b.height / k
      const digit = Number(c.textContent)
      const strip = document.createElement('span')
      strip.className = 'mo-odr'
      const seq: string[] = []
      // 0부터 한 바퀴(0~9) 돈 뒤 그 숫자에서 멈춘다. 마지막 칸이 꼭 그 숫자여야 한다(9 + digit까지만 넣으면 하나 모자라
      // 3.7에서 멈췄다가 원래 글자로 돌아올 때 4.8로 튄다)
      for (let d = 0; d <= 10 + digit; d++) seq.push(String(d % 10))
      strip.textContent = seq.join('\n')
      strip.style.lineHeight = h + 'px'
      strip.style.translate = `0 ${-(seq.length - 1) * h}px`
      const cover = document.createElement('span')
      cover.className = 'mo-od'
      cover.setAttribute('aria-hidden', 'true')
      cover.style.left = (b.left - base.left) / k - parent.clientLeft + 'px'
      cover.style.top = (b.top - base.top) / k - parent.clientTop + 'px'
      cover.style.width = b.width / k + 'px'
      cover.style.height = h + 'px'
      cover.appendChild(strip)
      parent.appendChild(cover)
      covers.push(cover)
      c.className = 'mo-odc'
      // 왼쪽 자리가 먼저 멈추고 오른쪽으로 갈수록 조금씩 늦게
      run(anims, strip, [{ translate: '0 0' }], at, { easing, duration: duration + (n > 1 ? (i / (n - 1)) * duration * 0.25 : 0) })
    })
    restores.push(undo)
    return true
  }

  // ---------- 연출표 ----------

  /**
   * 한 장을 움직인다. 부품 장의 칸(.bk) 하나를 넘기면 그 부품만 (편집기에서 움직임을 고를 때 미리 보기).
   * 부품 장은 부품을 읽는 차례대로 하나씩: 레이아웃 부품은 그 레이아웃의 연출을 그 칸 안에서, 부품마다 고른 움직임이 있으면 그것으로.
   */
  /**
   * 장을 바꾸는 중이면 다음 장의 움직임을 이만큼 늦게 시작한다. 앞 장이 사라지기 전에 다음 장의 글이 나오면
   * 두 장의 글이 겹쳐 보인다(motion.css의 전환 시간과 맞춘다). 밀기는 다음 장이 거의 다 들어온 뒤에 글이 나온다
   */
  const SWAP_LEAD: Record<string, number> = { fade: 150, zoom: 200, slide: 220 }

  function play(root: Element, levelName: MotionLevel): () => void {
    const L: Level = LEVELS[levelName] || LEVELS.calm
    const lead = SWAP_LEAD[document.documentElement.dataset.moSwap || ''] || 0
    const cellOnly = root.classList.contains('bk') ? root : null
    const slide = cellOnly ? cellOnly.closest('.slide') : root.classList.contains('slide') ? root : root.querySelector('.slide')
    const anims: Animation[] = []
    const stops: (() => void)[] = []
    const restores: (() => void)[] = []
    if (!slide || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
    // 부품 하나를 움직이는 동안에는 그 칸 안에서만 찾고, 시간은 그 부품이 시작하는 때부터 센다
    let scope: Element = slide
    let t0 = 0
    const $ = (sel: string) => Array.prototype.slice.call(scope.querySelectorAll(sel)) as HTMLElement[]
    const one = (sel: string) => scope.querySelector(sel) as HTMLElement | null
    const layout = (/\bl-([a-zA-Z]+)/.exec(slide.className) || [])[1] || ''
    const slideVariant = (/\bva-([a-zA-Z]+)/.exec(slide.className) || [])[1] || 'base'
    const s = (ms: number) => (t0 + ms) * L.speed + lead
    /** 걸리는 시간은 시작 때와 상관없이 빠르기만 맞춘다 */
    const d = (ms: number) => ms * L.speed

    const rise = (el: Element | null, at: number, y = L.y, timing: Spring = L.move) => {
      if (el) run(anims, el, [{ opacity: 0, translate: `0 ${y}px` }], s(at), timing)
    }
    const card = (el: Element | null, at: number) => {
      if (el) run(anims, el, [{ opacity: 0, translate: `0 ${L.y}px`, scale: String(L.scale) }], s(at), L.move)
    }
    const fade = (el: Element | null, at: number, duration = 600) => {
      if (el) run(anims, el, [{ opacity: 0 }], s(at), { easing: OUT, duration })
    }
    const pop = (el: Element | null, at: number, pseudo?: string) => {
      if (el) run(anims, el, [{ opacity: 0, scale: '0.3' }], s(at), L.pop, pseudo)
    }
    /** x: 왼쪽에서 (가로 막대), down: 위에서 (세로 일정의 선), up: 바닥에서 (세로 막대) */
    const grow = (el: Element | null, at: number, axis: 'x' | 'down' | 'up' = 'x', pseudo?: string) => {
      if (!el) return
      const origin = axis === 'x' ? 'left center' : axis === 'down' ? 'center top' : 'center bottom'
      run(anims, el, [{ scale: axis === 'x' ? '0 1' : '1 0', transformOrigin: origin }, { scale: '1 1', transformOrigin: origin }], s(at), L.grow, pseudo)
    }
    const wipe = (el: Element | null, at: number, from: 'left' | 'right' | 'bottom', duration = 1000) => {
      if (!el) return
      const inset = from === 'left' ? 'inset(0 100% 0 0)' : from === 'right' ? 'inset(0 0 0 100%)' : 'inset(100% 0 0 0)'
      run(anims, el, [{ clipPath: inset }, { clipPath: 'inset(0 0 0 0)' }], s(at), { easing: 'cubic-bezier(0.7, 0, 0.2, 1)', duration: d(duration) })
    }
    /** 낱말마다 아래에서 올라오는 제목. 생동감은 살짝 기울었다가 바로 선다. */
    const words = (el: Element | null, at: number, gap = L.word, blur = false) => {
      if (!el) return at
      // 편집 중인 칸의 글자는 나누지 않는다 (입력 칸을 건드리지 않게). 통째로 올라온다
      if (el.closest('.m-edit')) {
        rise(el, at, L.y * 0.6)
        return at + 240
      }
      const split = splitWords(el)
      restores.push(split.restore)
      split.words.forEach((w, i) => {
        const frames: Keyframe[] = blur
          ? [{ opacity: 0, translate: '0 40%', filter: 'blur(18px)' }, { opacity: 1, translate: '0 0', filter: 'blur(0px)' }]
          : [{ translate: '0 115%', rotate: `${L.rot}deg`, transformOrigin: '0 100%' }, { translate: '0 0', rotate: '0deg', transformOrigin: '0 100%' }]
        run(anims, w, frames, s(at + i * gap), blur ? { easing: OUT, duration: 1100 } : L.move)
      })
      // 다음 차례는 마지막 낱말이 반쯤 올라왔을 때
      return at + split.words.length * gap + 160
    }
    const count = (el: Element | null, at: number) => {
      // 편집 중인 칸의 글자는 바꾸지 않는다 (쓰고 있는 글과 엇갈리지 않게)
      if (!el || el.closest('.m-edit')) return
      // 자리마다 굴린다. 생동감은 맞는 숫자를 살짝 지나쳤다가 돌아와 멈춘다. 굴릴 수 없는 칸은 0부터 올린다
      const lively = levelName === 'lively'
      // 숫자는 장이 나오고 2초 안에 다 멈춘다(녹화해 보니 1.3초씩 굴리면 다음 장으로 넘길 때까지 굴러가고 있었다)
      if (!roll(el, s(at), lively ? 900 : 800, lively ? SPRINGS.bounce.easing : 'cubic-bezier(0.25, 0.8, 0.15, 1)', anims, restores))
        countUp(el, s(at), lively ? 1000 : 800, stops)
    }
    /** 지금 점(강조한 점)이 맺힌 뒤 고리가 두 번 퍼진다. 고리는 그동안만 점 안에 넣는다 */
    const pulse = (el: HTMLElement | null, at: number) => {
      if (!el || el.closest('.m-edit')) return
      const ring = document.createElement('span')
      ring.className = 'mo-ring'
      ring.setAttribute('aria-hidden', 'true')
      // 점의 테두리 바깥에 맞춘다
      ring.style.inset = -el.clientLeft + 'px'
      el.appendChild(ring)
      restores.push(() => ring.remove())
      for (const k of [0, 1]) {
        run(
          anims,
          ring,
          [
            { opacity: 0, scale: '1', offset: 0 },
            { opacity: 0.6, scale: '1.15', offset: 0.1 },
            { opacity: 0, scale: '2.6', offset: 1 },
          ],
          s(at) + k * d(900),
          { easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)', duration: d(1400) },
        )
      }
    }
    /** 감싼 줄이 따로 나타나지 않는 숫자: 올라가기 시작할 때 함께 나타난다. 아직 차례가 아닌 줄에 0이 미리 보이지 않게 */
    const countIn = (el: Element | null, at: number) => {
      fade(el, at, 240)
      count(el, at)
    }
    const items = (sel: string, at: number, each: (el: HTMLElement, at: number, i: number) => void, step = L.step) => {
      $(sel).forEach((el, i) => each(el, at + i * step, i))
      return at + $(sel).length * step
    }

    // 머리: 제목 낱말 → 부제. 본문은 제목이 거의 다 올라왔을 때부터. 부품 안에서는 머리가 없다.
    // 본문 상자도 그때 함께 나타난다: 따로 움직이지 않는 줄(표의 선, 빈 막대 자리, 단위)이 장이 뜨자마자
    // 제목보다 먼저 보이면 빈 틀이 깔려 있다가 채워지는 것처럼 보인다 (녹화해 보니 그랬다)
    const head = () => {
      if (scope !== slide) return 0
      const t = words(one('.s-head .s-title'), 0)
      rise(one('.s-head .s-lead'), Math.min(t, 420), L.y * 0.6)
      const body = Math.min(t, 520)
      fade(one('.s-body'), Math.max(0, body - 120), 360)
      return body
    }

    function choreo(layout: string, variant: string) {
    switch (layout) {
      case 'compose': {
        const t = head()
        let at = Math.min(t, 420)
        for (const cell of $('.bk-area > .bk')) {
          block(cell, at)
          at += L.step * 2.6
        }
        fade(one('.s-source'), at + 200)
        break
      }
      case 'cover': {
        // 띠는 아래에서, 오른쪽 면은 오른쪽에서 밀려 들어온다. 색 면 모양은 면이 장 전체라 줄만 나타난다
        if (variant === 'full') fade(one('.cv-side'), 300, 700)
        else if (levelName === 'lively') wipe(one('.cv-side'), 0, variant === 'band' ? 'bottom' : 'right', 1100)
        else fade(one('.cv-side'), 0, 700)
        fade(one('.cv-logo'), 200)
        const t = words(one('.cv-title'), 180)
        rise(one('.cv-lead'), t, L.y * 0.6)
        rise(one('.cv-ask'), levelName === 'lively' ? 760 : 420)
        items('.cv-meta > *', levelName === 'lively' ? 980 : 600, (el, at) => rise(el, at, L.y * 0.5), 70)
        break
      }
      case 'section': {
        run(anims, one('.sc-num') ?? scope, [{ opacity: 0, translate: '0 22%' }], 0, levelName === 'lively' ? SPRINGS.soft : SPRINGS.glide)
        const t = words(one('.sc-title'), 160, L.word * 1.2)
        rise(one('.sc-lead'), t, L.y * 0.6)
        fade(one('.sc-map'), t, 400)
        items('.sc-map li', t + 120, (el, at) => fade(el, at, 500), 60)
        break
      }
      case 'agenda': {
        const t = words(one('.ag-title'), 0)
        fade(one('.ag-list'), Math.min(t, 360) - 120, 360)
        items('.ag-item', Math.min(t, 360), (el, at) => {
          rise(el, at, L.y * 0.7)
          pop(el.querySelector('.ag-n'), at + 80)
        })
        break
      }
      case 'statement': {
        const t = words(one('.st-title'), 0, L.word * 1.4, levelName === 'lively')
        rise(one('.st-lead'), t + 80, L.y * 0.6)
        break
      }
      case 'summary': {
        const t = head()
        items('.sm-row', t, (el, at) => {
          fade(el.querySelector('.sm-label'), at, 500)
          rise(el.querySelector('.sm-body'), at + 40, L.y * 0.6)
        })
        break
      }
      case 'kpi': {
        const t = head()
        const end = items('.kp-item', t, (el, at) => {
          // 면이 있는 카드만 커지며 들어오고, 띠는 숫자가 올라오기만
          if (variant === 'cards') card(el, at)
          else rise(el, at, L.y * 0.7)
          count(el.querySelector('.kp-value'), at + 40)
        })
        fade(one('.s-source'), end + 200)
        break
      }
      case 'points': {
        const t = head()
        items('.pt-item', t, (el, at) => rise(el, at))
        break
      }
      case 'compare': {
        const t = head()
        const panel = one('.cp')
        if (panel) {
          run(anims, panel, [{ opacity: 0, scale: String(L.scale) }], s(t), L.move, '::before')
          run(anims, panel, [{ opacity: 0, scale: String(L.scale) }], s(t + L.step * 1.5), L.move, '::after')
        }
        rise(one('.cp-headrow'), t + 80, L.y * 0.5)
        items('.cp-row.it', t + 200, (el, at) => {
          rise(el.querySelector('.cp-l'), at, L.y * 0.6)
          pop(el.querySelector('.cp-arrow'), at + 160)
          rise(el.querySelector('.cp-r'), at + 240, L.y * 0.6)
        })
        pop(one('.cp > .cp-arrow'), t + L.step * 1.5 + 160)
        break
      }
      case 'timeline': {
        const t = head()
        items('.tl-item', t, (el, at) => {
          grow(el, at, variant === 'steps' ? 'down' : 'x', '::before')
          pop(el.querySelector('.tl-dot'), at + 140)
          if (el.classList.contains('is-now')) pulse(el.querySelector('.tl-dot'), at + 420)
          rise(el.querySelector('.tl-meta'), at + 60, L.y * 0.5)
          rise(el.querySelector('.tl-title'), at + 200, L.y * 0.6)
          rise(el.querySelector('.tl-body'), at + 260, L.y * 0.6)
        }, L.step * 1.6)
        break
      }
      case 'case': {
        if (levelName === 'lively') wipe(one('.cs-side'), 0, 'right', 1000)
        else fade(one('.cs-side'), 0)
        rise(one('.cs-client'), 80, L.y * 0.5)
        const t = words(one('.cs-title'), 160)
        rise(one('.cs-body'), Math.min(t, 600), L.y * 0.6)
        rise(one('.cs-quote'), Math.min(t, 600) + 200, L.y * 0.6)
        pop(one('.cs-quote'), Math.min(t, 600) + 260, '::before')
        fade(one('.cs-logo'), 300)
        items('.cs-res', 500, (el, at) => {
          rise(el, at)
          count(el.querySelector('.cs-value'), at + 100)
        })
        break
      }
      case 'pricing': {
        const t = head()
        const end = items('.pr-plan', t, (el, at) => {
          card(el, at)
          count(el.querySelector('.pr-price'), at + 120)
        })
        const hl = one('.pr-plan.is-hl')
        if (hl) {
          run(anims, hl, [{ scale: '1' }, { scale: '1.035' }, { scale: '1' }], s(end + 500), { easing: 'ease-in-out', duration: 700 })
          pop(hl.querySelector('.pr-tag'), end + 420)
        }
        break
      }
      case 'imageText': {
        const flip = !!one('.ix.is-flip')
        wipe(one('.ix-img'), 0, flip ? 'right' : 'left', 1100)
        const img = one('.ix-img img')
        if (img) run(anims, img, [{ scale: '1.16' }, { scale: '1' }], 0, { easing: 'cubic-bezier(0.2, 0.6, 0.2, 1)', duration: 2600 })
        const t = words(one('.ix-title'), 380)
        rise(one('.ix-body'), Math.min(t, 760), L.y * 0.6)
        break
      }
      case 'logos': {
        const t = head()
        items('.lg-cell', t, (el, at) => run(anims, el, [{ opacity: 0, scale: '0.86' }], s(at), L.pop), 45)
        break
      }
      case 'bars': {
        const t = head()
        items('.br-row', t, (el, at) => {
          rise(el.querySelector('.br-label'), at, L.y * 0.5)
          fade(el.querySelector('.br-track'), at, 400)
          grow(el.querySelector(variant === 'columns' ? '.br-track' : '.br-fill'), at + 120, variant === 'columns' ? 'up' : 'x')
          countIn(el.querySelector('.br-value'), at + 120)
        })
        fade(one('.s-source'), t + 400)
        break
      }
      case 'versus': {
        const t = head()
        items('.vs-key', t, (el, at) => fade(el, at, 400), 80)
        fade(one('.vs-unit'), t, 400)
        let end = t
        if (variant === 'lines') {
          // 앞 값(작년) 선이 먼저 그려지고, 뒤 값(올해) 선이 조금 늦게 그 위를 따라간다. 점은 선이 닿을 때 맺힌다
          const draw = d(levelName === 'lively' ? 1400 : 1000)
          const from = { a: t + 80, b: t + 420 }
          for (const k of ['a', 'b'] as const) {
            const svg = one(`.vs-svg.is-${k}`)
            if (svg) run(anims, svg, [{ clipPath: 'inset(-10% 100% -10% 0)' }, { clipPath: 'inset(-10% 0 -10% 0)' }], s(from[k]), { easing: 'linear', duration: draw })
          }
          const reach = (k: 'a' | 'b', x: number) => from[k] + (x / 100) * (draw / L.speed)
          $('.vs-pt').forEach((el) => {
            const k = el.classList.contains('is-a') ? 'a' : 'b'
            const at = reach(k, parseFloat(el.style.getPropertyValue('--x')) || 0)
            pop(el.querySelector('.vs-dot'), at)
            if (el.classList.contains('is-hl')) {
              rise(el.querySelector('.vs-val'), at + 60, L.y * 0.5)
              count(el.querySelector('.vs-num'), at + 60)
            } else fade(el.querySelector('.vs-val'), at + 40, 400)
          })
          $('.vs-col').forEach((el, i, all) => {
            fade(el.querySelector('.vs-name'), t + i * 30, 400)
            pop(el.querySelector('.vs-change'), reach('b', ((i + 0.5) / all.length) * 100) + 120)
          })
          end = from.b + draw / L.speed
        } else if (variant === 'dots') {
          // 점 두 개: 앞 값 점이 맺히고, 뒤 값 점이 앞 값 자리에서 제 자리까지 미끄러진다. 잇는 길은 점을 따라 늘어난다
          end = items('.vs-row', t, (el, at) => {
            fade(el.querySelector('.vs-label'), at, 400)
            pop(el.querySelector('.vs-d.is-a'), at + 60)
            fade(el.querySelector('.vs-num.is-a'), at + 60, 400)
            const a = el.style.getPropertyValue('--a')
            const b = el.style.getPropertyValue('--b')
            const dot = el.querySelector('.vs-d.is-b')
            if (dot && a && b) {
              run(anims, dot, [{ left: `${a}%`, opacity: 0 }, { left: `${a}%`, opacity: 1, offset: 0.12 }, { left: `${b}%`, opacity: 1 }], s(at + 160), L.grow)
              const span = el.querySelector('.vs-span')
              // 줄어든 줄은 오른쪽(앞 값)에서 왼쪽으로, 늘어난 줄은 왼쪽에서 오른쪽으로 늘어난다
              const origin = el.classList.contains('is-down') ? 'right center' : 'left center'
              if (span) run(anims, span, [{ scale: '0 1', transformOrigin: origin }, { scale: '1 1', transformOrigin: origin }], s(at + 160), L.grow)
            } else pop(dot, at + 160)
            rise(el.querySelector('.vs-num.is-b'), at + 240, L.y * 0.4)
            count(el.querySelector('.vs-num.is-b'), at + 240)
            pop(el.querySelector('.vs-change'), at + 520)
          }, L.step * 1.2)
        } else {
          // 항목마다 앞 값 막대가 서고, 바로 옆에서 뒤 값 막대가 더 높이(또는 낮게) 따라 선다. 바뀐 비율은 둘이 다 선 뒤에
          end = items('.vs-col', t, (el, at) => {
            fade(el.querySelector('.vs-name'), at, 400)
            grow(el.querySelector('.vs-bar.is-a .vs-fill'), at, 'up')
            grow(el.querySelector('.vs-bar.is-b .vs-fill'), at + 120, 'up')
            rise(el.querySelector('.vs-bar.is-a .vs-val'), at + 140, L.y * 0.4)
            count(el.querySelector('.vs-bar.is-a .vs-num'), at + 140)
            rise(el.querySelector('.vs-bar.is-b .vs-val'), at + 260, L.y * 0.4)
            count(el.querySelector('.vs-bar.is-b .vs-num'), at + 260)
            pop(el.querySelector('.vs-change'), at + 460)
          }, L.step * 1.2)
        }
        fade(one('.s-source'), end + 200)
        break
      }
      case 'scorecard': {
        const t = head()
        fade(one('.sk-headrow'), t, 500)
        const end = items('.sk-row.it', t + 120, (el, at) => {
          rise(el.querySelector('.sk-name'), at, L.y * 0.5)
          grow(el.querySelector('.sk-fill'), at + 120)
          pop(el.querySelector('.sk-mark'), at + 320)
          // 넘은 만큼(모자란 만큼)은 목표 줄이 선 다음 그 자리에서 뻗어 나간다
          grow(el.querySelector('.sk-diff'), at + 420)
          fade(el.querySelector('.sk-target'), at + 80, 500)
          countIn(el.querySelector('.sk-value'), at + 120)
          countIn(el.querySelector('.sk-rate'), at + 200)
        })
        fade(one('.s-source'), end + 200)
        break
      }
      case 'bridge': {
        const t = head()
        // 처음 막대부터 차례로: 더한 요인은 아래에서 솟고, 뺀 요인은 위에서 내려온다. 잇는 점선은 막대가 선 뒤에.
        const end = items('.wf-col', t, (el, at) => {
          const down = el.classList.contains('wf-down')
          fade(el.querySelector('.wf-label') || el.querySelector(':scope > .wf-title'), at, 500)
          grow(el.querySelector('.wf-bar'), at + 80, down ? 'down' : 'up')
          rise(el.querySelector('.wf-val'), at + 220, L.y * 0.4)
          if (el.classList.contains('wf-total')) count(el.querySelector('.wf-num'), at + 120)
          const plot = el.querySelector('.wf-plot')
          if (plot) run(anims, plot, [{ opacity: 0 }], s(at + 420), { easing: OUT, duration: d(400) }, '::after')
        }, L.step * 1.3)
        fade(one('.s-source'), end + 200)
        break
      }
      case 'trend': {
        const t = head()
        fade(one('.tn-unit'), t, 500)
        // 선은 왼쪽에서부터 그려지고, 점은 선이 닿을 때 하나씩 맺힌다. 그래서 선은 일정한 빠르기로
        const draw = levelName === 'lively' ? 1500 : 1100
        const svg = one('.tn-svg')
        if (svg) run(anims, svg, [{ clipPath: 'inset(-10% 100% -10% 0)' }, { clipPath: 'inset(-10% 0 -10% 0)' }], s(t + 100), { easing: 'linear', duration: d(draw) })
        $('.tn-pt').forEach((el) => {
          const at = t + 100 + ((parseFloat(el.style.getPropertyValue('--x')) || 0) / 100) * draw
          pop(el.querySelector('.tn-dot'), at)
          if (el.classList.contains('is-hl')) {
            pulse(el.querySelector('.tn-dot'), at + 300)
            rise(el.querySelector('.tn-val'), at + 60, L.y * 0.5)
            count(el.querySelector('.tn-num'), at + 60)
          } else fade(el.querySelector('.tn-val'), at + 40, 400)
        })
        items('.tn-col', t, (el, at) => fade(el, at, 400), 30)
        fade(one('.tn-target'), t + 200, 600)
        fade(one('.s-source'), t + draw)
        break
      }
      case 'progress': {
        const t = head()
        fade(one('.ps-sum'), t, 500)
        fade(one('.ps-headrow'), t + 80, 500)
        const end = items('.ps-row.it', t + 160, (el, at) => {
          rise(el.querySelector('.ps-name'), at, L.y * 0.5)
          grow(el.querySelector('.ps-fill'), at + 120)
          countIn(el.querySelector('.ps-pct'), at + 120)
          pop(el.querySelector('.ps-chip'), at + 380)
        })
        fade(one('.s-source'), end + 200)
        break
      }
      case 'share': {
        const t = head()
        fade(one('.sh-top'), t, 500)
        if (variant === 'donut') {
          // 12시 방향에서 시계 방향으로 한 바퀴: 조각마다 앞 조각이 끝난 자리에서 이어 그려진다.
          // 한 바퀴는 처음에 빠르고 끝에서 느려지게, 조각은 그 안에서 제 몫의 시간만 쓴다
          const sweep = d(levelName === 'lively' ? 1300 : 1000)
          const ease = (x: number) => 1 - Math.pow(1 - x, 2.2)
          fade(one('.sh-ring-track'), t, 300)
          for (const el of $('.sh-arc')) {
            const from = -(parseFloat(el.getAttribute('stroke-dashoffset') || '0') || 0) / 100
            const len = (parseFloat(el.getAttribute('stroke-dasharray') || '0') || 0) / 100
            const a = ease(from)
            const b = ease(Math.min(1, from + len))
            run(anims, el, [{ strokeDasharray: '0 100' }, { strokeDasharray: el.getAttribute('stroke-dasharray') || '0 100' }], s(t + 80) + a * sweep, { easing: 'linear', duration: Math.max(1, (b - a) * sweep) })
          }
          // 강조한 조각은 다 그려진 뒤 한 번 도톰해졌다 돌아온다
          const hl = $('.sh-item').findIndex((el) => el.classList.contains('is-hl'))
          const arc = hl >= 0 ? $('.sh-arc')[hl] : null
          if (arc) {
            const w = parseFloat(getComputedStyle(arc).strokeWidth) || 15
            run(anims, arc, [{ strokeWidth: String(w) }, { strokeWidth: String(w * 1.3) }, { strokeWidth: String(w) }], s(t + 80) + sweep, { easing: 'ease-in-out', duration: d(520) })
          }
          rise(one('.sh-total'), t + 360, L.y * 0.4)
          count(one('.sh-total-v'), t + 360)
        } else wipe(one('.sh-band'), t, 'left', 900)
        const end = items('.sh-item', t + 260, (el, at) => {
          rise(el, at, L.y * 0.5)
          count(el.querySelector('.sh-pct'), at + 60)
        })
        fade(one('.s-source'), end + 200)
        break
      }
      case 'process': {
        const t = head()
        if (variant === 'cards') {
          items('.pc-step', t, (el, at) => {
            run(anims, el, [{ opacity: 0, translate: `${-L.y}px 0` }], s(at), L.move)
            run(anims, el, [{ opacity: 0 }], s(at + 200), { easing: OUT, duration: 400 }, '::after')
            rise(el.querySelector('.pc-text'), at + 140, L.y * 0.5)
          }, L.step * 1.4)
          break
        }
        // 선으로 잇기: 점이 맺히면 다음 점까지 선이 그어지고, 선이 닿을 때 다음 점이 맺힌다
        const step = L.step * 1.7
        items('.pc-step', t, (el, at) => {
          pop(el.querySelector('.pc-n'), at)
          if (el.classList.contains('is-hl')) pulse(el.querySelector('.pc-n'), at + 300)
          rise(el.querySelector('.pc-title'), at + 80, L.y * 0.5)
          rise(el.querySelector('.pc-text'), at + 160, L.y * 0.5)
          run(
            anims,
            el,
            [{ scale: '0 1', transformOrigin: 'left center' }, { scale: '1 1', transformOrigin: 'left center' }],
            s(at + 90),
            { easing: 'cubic-bezier(0.45, 0, 0.25, 1)', duration: d(step - 90) },
            '::before',
          )
        }, step)
        break
      }
      case 'funnel': {
        const t = head()
        // 위 단계부터 막대가 가운데에서 양옆으로 벌어지고, 잇는 면과 전환율은 막대가 선 뒤에
        const end = items('.fn-row', t, (el, at) => {
          rise(el.querySelector('.fn-label'), at, L.y * 0.5)
          const bar = el.querySelector('.fn-bar')
          if (bar) run(anims, bar, [{ scale: '0 1' }, { scale: '1 1' }], s(at + 80), L.grow)
          fade(el.querySelector('.fn-link'), at, 400)
          pop(el.querySelector('.fn-rate'), at + 260)
          count(el.querySelector('.fn-num'), at + 120)
          // 단위는 숫자와 함께: 숫자보다 먼저 나오면 막대 옆에 '곳'만 떠 있다
          fade(el.querySelector('.fn-val'), at + 120, 240)
        }, L.step * 1.3)
        fade(one('.fn-total'), end + 100, 500)
        fade(one('.s-source'), end + 200)
        break
      }
      case 'table': {
        const t = head()
        fade(one('.tb-headrow'), t, 500)
        const end = items('.tb-row.it', t + 120, (el, at) => rise(el, at, L.y * 0.5), L.step * 0.8)
        fade(one('.s-source'), end + 200)
        break
      }
      case 'matrix': {
        const t = head()
        const grid = one('.mx-grid')
        if (grid) wipe(grid, t, 'bottom', 700)
        fade(one('.mx-y'), t + 200, 500)
        fade(one('.mx-x'), t + 200, 500)
        items('.mx-cell', t + 260, (el, at) => {
          rise(el.querySelector('.mx-title'), at, L.y * 0.5)
          rise(el.querySelector('.mx-body'), at + 80, L.y * 0.5)
        })
        const hl = one('.mx-cell.is-hl')
        if (hl) run(anims, hl, [{ backgroundColor: 'transparent' }], s(t + 260 + L.step * 4), { easing: OUT, duration: d(700) })
        break
      }
      case 'position': {
        const t = head()
        // 축이 왼쪽 아래에서 펼쳐지고, 점이 하나씩 위에서 제자리로 내려앉는다(살짝 튀며). 강조할 점은 맨 나중에, 내려앉은 뒤 고리
        const plot = one('.pm-plot')
        if (plot) run(anims, plot, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(-40px -40px -40px -40px)' }], s(t), { easing: 'cubic-bezier(0.7, 0, 0.2, 1)', duration: d(700) })
        fade(one('.pm-y'), t + 200, 500)
        fade(one('.pm-x'), t + 200, 500)
        const pts = $('.pm-pt')
        const ordered = pts.filter((el) => !el.classList.contains('is-hl')).concat(pts.filter((el) => el.classList.contains('is-hl')))
        let at = t + 420
        for (const el of ordered) {
          const hl = el.classList.contains('is-hl')
          run(anims, el.querySelector('.pm-dot') || el, [{ opacity: 0, translate: `0 ${-L.y * 1.4}px` }, { opacity: 1, offset: 0.25 }, { translate: '0 0' }], s(at), L.pop)
          fade(el.querySelector('.pm-label'), at + 160, 500)
          if (hl) pulse(el.querySelector('.pm-dot'), at + 380)
          at += L.step * (hl ? 2 : 1.4)
        }
        fade(one('.s-source'), at + 200)
        break
      }
      case 'closing': {
        const t = words(one('.cl-title'), 0, L.word * 1.2)
        fade(one('.cl-contact'), t)
        // 할 일 사이의 선도 할 일과 함께 (제목보다 먼저 빈 줄이 그어져 있지 않게)
        fade(one('.cl-steps'), Math.min(t, 560) - 120, 360)
        items('.cl-step', Math.min(t, 560), (el, at) => {
          pop(el.querySelector('.cl-n'), at)
          rise(el.querySelector('.cl-step-text'), at + 60, L.y * 0.6)
        })
        break
      }
      default: {
        const t = head()
        items('.s-body .it', t, (el, at) => rise(el, at))
      }
    }
    }

    /** 부품 장만의 부품이 알아서 움직이는 모습. 면이 있는 부품은 면이 먼저 자리 잡고 안의 글이 뒤따른다 */
    function nativeAuto(cell: HTMLElement, type: string) {
      if (!cell.classList.contains('bk-look-plain')) card(cell, 0)
      switch (type) {
        case 'message': {
          const t = words(one('.bk-msg-t'), 0, L.word * 1.2)
          rise(one('.bk-msg-s'), t, L.y * 0.6)
          break
        }
        case 'text':
          rise(one('.bk-label'), 60, L.y * 0.4)
          rise(one('.bk-h'), 120, L.y * 0.6)
          rise(one('.bk-body'), 240, L.y * 0.6)
          break
        case 'bullets':
          rise(one('.bk-h'), 60, L.y * 0.5)
          items('.bk-li', 160, (el, at) => {
            pop(el.querySelector('.bk-dot'), at)
            rise(el.querySelector('.bk-li-text'), at + 40, L.y * 0.5)
          })
          break
        case 'quote':
          pop(one('.bk-q-mark'), 60)
          rise(one('.bk-q-t'), 200, L.y * 0.6)
          fade(one('.bk-q-by'), 520, 600)
          break
        case 'callout':
          rise(one('.bk-call-l'), 160, L.y * 0.4)
          rise(one('.bk-call-t'), 240, L.y * 0.6)
          break
        case 'number':
          fade(one('.bk-num-l'), 100, 500)
          rise(one('.bk-num-v'), 140, L.y * 0.4)
          count(one('.bk-num-v'), 160)
          fade(one('.bk-num-n'), 520, 600)
          break
        case 'delta': {
          fade(one('.bk-dl-l'), 80, 500)
          rise(one('.bk-dl-from'), 140, L.y * 0.4)
          const arrow = one('.bk-dl-arrow')
          if (arrow) run(anims, arrow, [{ opacity: 0, translate: `${-L.y * 0.6}px 0` }], s(320), L.move)
          rise(one('.bk-dl-to'), 420, L.y * 0.5)
          count(one('.bk-dl-to .bk-dl-v'), 440)
          pop(one('.bk-dl-chip'), 900)
          fade(one('.bk-dl-n'), 980, 500)
          break
        }
        case 'goal':
          fade(one('.bk-gl-l'), 80, 500)
          grow(one('.bk-gl-fill'), 200)
          countIn(one('.bk-gl-pct'), 200)
          fade(one('.bk-gl-of'), 380, 500)
          fade(one('.bk-gl-n'), 520, 500)
          break
        case 'ring': {
          fade(one('.bk-rg-l'), 60, 500)
          fade(one('.bk-rg-track'), 80, 500)
          // 둘레가 12시 방향에서부터 비율만큼 차오르고, 가운데 숫자가 같이 올라간다
          const arc = one('.bk-rg-arc')
          const fill = { easing: OUT, duration: d(levelName === 'lively' ? 1500 : 1100) }
          if (arc) run(anims, arc, [{ strokeDasharray: '0 100' }], s(160), fill)
          // 길이 0인 호도 둥근 끝 때문에 점으로 보인다. 차오르기 전에 점 하나만 떠 있지 않게
          fade(arc, 140, 200)
          // 반원 게이지의 손잡이는 호와 같은 시간, 같은 이징으로 돌아서 호의 끝에 붙어 간다
          const knob = one('.bk-rg-knob')
          if (knob) {
            run(anims, knob, [{ rotate: '0deg' }], s(160), fill)
            fade(knob, 120, 240)
          }
          countIn(one('.bk-rg-v'), 160)
          fade(one('.bk-rg-n'), 640, 500)
          break
        }
        case 'ratio': {
          fade(one('.bk-rt-l'), 60, 500)
          fade(one('.bk-rt-of'), 120, 500)
          rise(one('.bk-rt-big'), 160, L.y * 0.4)
          count(one('.bk-rt-v'), 180)
          // 점이 많아도 1초 안에 다 맺히게
          const dots = $('.bk-rt-d')
          const step = Math.min(L.step, 900 / Math.max(1, dots.length))
          dots.forEach((el, i) => (el.classList.contains('is-on') ? pop(el, 240 + i * step) : fade(el, 240 + i * step, 300)))
          fade(one('.bk-rt-n'), 360 + dots.length * step, 500)
          break
        }
        case 'spark': {
          fade(one('.bk-sp-l'), 60, 500)
          rise(one('.bk-sp-v'), 100, L.y * 0.4)
          count(one('.bk-sp-v'), 120)
          // 선은 왼쪽부터 같은 빠르기로 그려지고, 끝점(지금)이 선이 닿을 때 맺힌다
          const draw = levelName === 'lively' ? 1300 : 1000
          for (const el of $('.bk-sp-fill, .bk-sp-svg')) run(anims, el, [{ clipPath: 'inset(-10% 100% -10% 0)' }, { clipPath: 'inset(-10% 0 -10% 0)' }], s(200), { easing: 'linear', duration: d(draw) })
          pop(one('.bk-sp-dot'), 200 + draw)
          fade(one('.bk-sp-n'), 400, 500)
          break
        }
        case 'facts':
          rise(one('.bk-h'), 60, L.y * 0.5)
          items('.bk-fc-row', 160, (el, at) => {
            grow(el, at, 'x', '::before')
            rise(el.querySelector('.bk-fc-k'), at + 80, L.y * 0.4)
            rise(el.querySelector('.bk-fc-v'), at + 140, L.y * 0.4)
          })
          break
        case 'risks':
          rise(one('.bk-h'), 60, L.y * 0.5)
          fade(one('.bk-rk-head'), 120, 500)
          items('.bk-rk-row', 220, (el, at) => {
            rise(el.querySelector('.bk-rk-t'), at, L.y * 0.4)
            const arrow = el.querySelector('.bk-rk-arrow')
            if (arrow) run(anims, arrow, [{ opacity: 0, translate: `${-L.y * 0.6}px 0` }], s(at + 160), L.move)
            rise(el.querySelector('.bk-rk-b'), at + 260, L.y * 0.4)
          }, L.step * 1.8)
          break
        case 'faq':
          rise(one('.bk-h'), 60, L.y * 0.5)
          items('.bk-qa-item', 160, (el, at) => {
            pop(el.querySelector('.bk-qa-k'), at)
            rise(el.querySelector('.bk-qa-qt'), at + 60, L.y * 0.4)
            fade(el.querySelector('.bk-qa-a'), at + 260, 600)
          }, L.step * 1.8)
          break
        case 'checks':
          rise(one('.bk-h'), 60, L.y * 0.5)
          fade(one('.bk-ck-sum'), 160, 500)
          items('.bk-ck-row', 200, (el, at) => {
            rise(el.querySelector('.bk-ck-text'), at, L.y * 0.4)
            pop(el.querySelector('.bk-ck-mark'), at + 140)
            fade(el.querySelector('.bk-ck-s'), at + 220, 400)
          })
          break
        case 'swot':
          // 네 칸이 읽는 차례(강점, 약점, 기회, 위협)로: 글자가 맺히고 이름과 내용이 따라 올라온다
          rise(one('.bk-h'), 60, L.y * 0.5)
          items('.bk-sw-q', 140, (el, at) => {
            pop(el.querySelector('.bk-sw-k'), at)
            rise(el.querySelector('.bk-sw-t'), at + 80, L.y * 0.4)
            rise(el.querySelector('.bk-sw-b'), at + 160, L.y * 0.4)
          }, L.step * 1.4)
          break
        case 'gantt':
          // 기간 칸과 지금 띠가 먼저 깔리고, 할 일마다 이름이 올라오며 막대가 시작 칸에서 끝 칸으로 그어진다
          rise(one('.bk-h'), 60, L.y * 0.5)
          fade(one('.bk-gt-cols'), 120, 500)
          fade(one('.bk-gt-now'), 160, 800)
          items('.bk-gt-row', 240, (el, at) => {
            rise(el.querySelector('.bk-gt-label'), at, L.y * 0.4)
            grow(el.querySelector('.bk-gt-bar'), at + 120, 'x')
          })
          break
        case 'people':
          rise(one('.bk-h'), 60, L.y * 0.5)
          items('.bk-pp-card', 160, (el, at) => {
            pop(el.querySelector('.bk-pp-av'), at)
            rise(el.querySelector('.bk-pp-text'), at + 100, L.y * 0.4)
          }, L.step * 1.5)
          break
        case 'image': {
          wipe(one('.bk-img-i'), 0, 'left', 1000)
          const img = one('.bk-img-i img')
          if (img) run(anims, img, [{ scale: '1.12' }, { scale: '1' }], s(0), { easing: 'cubic-bezier(0.2, 0.6, 0.2, 1)', duration: 2200 })
          fade(one('.bk-img-c'), 600, 500)
          break
        }
        default:
          rise(cell, 0)
      }
    }

    /** 부품 하나: 고른 움직임으로. '알아서'면 레이아웃 부품은 그 레이아웃의 연출, 아니면 부품마다 짜 둔 움직임 */
    function block(cell: HTMLElement, at: number) {
      const effect = (/\bfx-([a-z]+)/.exec(cell.className) || [])[1] || 'auto'
      const type = cell.getAttribute('data-type') || ''
      const saved = { scope, t0 }
      scope = cell
      t0 = at
      if (effect === 'rise') rise(cell, 0)
      else if (effect === 'fade') fade(cell, 0, 800)
      else if (effect === 'wipe') wipe(cell, 0, 'left', 900)
      else if (effect === 'slide') run(anims, cell, [{ opacity: 0, translate: `${L.y * 2.6}px 0` }], s(0), L.move)
      else if (effect === 'pop') run(anims, cell, [{ opacity: 0, scale: '0.6' }], s(0), L.pop)
      else if (effect === 'zoom') run(anims, cell, [{ opacity: 0, scale: '1.14' }], s(0), { easing: OUT, duration: d(900) })
      else if (effect === 'flip')
        // 아래 가장자리를 축으로 누워 있다가 선다. 원근은 칸마다 따로 (장 전체가 휘어 보이지 않게)
        run(
          anims,
          cell,
          [
            { opacity: 0, transform: 'perspective(1800px) rotateX(-72deg)', transformOrigin: '50% 100%' },
            { opacity: 1, transform: 'perspective(1800px) rotateX(0deg)', transformOrigin: '50% 100%' },
          ],
          s(0),
          L.grow,
        )
      else if (effect === 'blur')
        run(anims, cell, [{ opacity: 0, filter: 'blur(20px)', scale: '1.03' }, { opacity: 1, filter: 'blur(0px)', scale: '1' }], s(0), { easing: OUT, duration: 1000 })
      else if (effect === 'auto') {
        // 칸 안의 따로 움직이지 않는 줄과 빈 자리도 이 부품의 차례에 (장 머리의 본문 상자와 같은 까닭)
        fade(cell.querySelector(':scope > .bk-in'), 0, 360)
        if (cell.classList.contains('bk-layout')) choreo(type, (/\bva-([a-zA-Z]+)/.exec(cell.className) || [])[1] || 'base')
        else nativeAuto(cell, type)
      }
      scope = saved.scope
      t0 = saved.t0
    }

    if (cellOnly) block(cellOnly as HTMLElement, 0)
    else choreo(layout, slideVariant)

    let restored = false
    const restore = () => {
      if (restored) return
      restored = true
      restores.forEach((f) => f())
    }
    // 다 움직이고 나면 낱말로 나눈 제목을 원래 글자로 되돌린다. 화면을 그린 쪽(React)이 다시 다룰 수 있게.
    Promise.all(anims.map((a) => a.finished)).then(restore, () => {})
    return () => {
      anims.forEach((a) => a.finish())
      stops.forEach((f) => f())
      restore()
    }
  }

  // ---------- 장 바꾸기 ----------

  /** 장을 바꾼다. kind는 전환 이름(fade, slide, zoom, none). 예전처럼 움직임 정도(calm, lively)를 넘겨도 된다. */
  function swap(update: () => void, kind: string, direction: 1 | -1) {
    type Transition = { finished: Promise<void>; ready: Promise<void>; updateCallbackDone: Promise<void> }
    const doc = document as Document & { startViewTransition?: (cb: () => void) => Transition }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const name = kind === 'calm' ? 'fade' : kind === 'lively' ? 'slide' : kind
    if ((name !== 'fade' && name !== 'slide' && name !== 'zoom') || reduced || !doc.startViewTransition) {
      update()
      return
    }
    const html = document.documentElement
    html.dataset.moSwap = name
    html.dataset.moDir = direction > 0 ? 'next' : 'prev'
    const done = () => {
      delete html.dataset.moSwap
      delete html.dataset.moDir
    }
    try {
      const t = doc.startViewTransition(update)
      // 빨리 연달아 넘기면 앞의 전환은 건너뛴다. 그때 나는 거절은 정상이라 조용히 받는다.
      t.ready.catch(() => {})
      t.updateCallbackDone.catch(() => {})
      t.finished.then(done, done)
    } catch {
      done()
      update()
    }
  }

  return { play, swap }
}
