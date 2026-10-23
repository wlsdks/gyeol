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

  // ---------- 연출표 ----------

  function play(root: Element, levelName: MotionLevel): () => void {
    const L: Level = LEVELS[levelName] || LEVELS.calm
    const slide = root.classList.contains('slide') ? root : root.querySelector('.slide')
    const anims: Animation[] = []
    const stops: (() => void)[] = []
    const restores: (() => void)[] = []
    if (!slide || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
    const $ = (sel: string) => Array.prototype.slice.call(slide.querySelectorAll(sel)) as HTMLElement[]
    const one = (sel: string) => slide.querySelector(sel) as HTMLElement | null
    const layout = (/\bl-([a-zA-Z]+)/.exec(slide.className) || [])[1] || ''
    const variant = (/\bva-([a-zA-Z]+)/.exec(slide.className) || [])[1] || 'base'
    const s = (ms: number) => ms * L.speed

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
      run(anims, el, [{ clipPath: inset }, { clipPath: 'inset(0 0 0 0)' }], s(at), { easing: 'cubic-bezier(0.7, 0, 0.2, 1)', duration: s(duration) })
    }
    /** 낱말마다 아래에서 올라오는 제목. 생동감은 살짝 기울었다가 바로 선다. */
    const words = (el: Element | null, at: number, gap = L.word, blur = false) => {
      if (!el) return at
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
      if (el) countUp(el, s(at), levelName === 'lively' ? 1400 : 900, stops)
    }
    const items = (sel: string, at: number, each: (el: HTMLElement, at: number, i: number) => void, step = L.step) => {
      $(sel).forEach((el, i) => each(el, at + i * step, i))
      return at + $(sel).length * step
    }

    // 머리: 제목 낱말 → 부제. 본문은 제목이 거의 다 올라왔을 때부터.
    const head = () => {
      const t = words(one('.s-head .s-title'), 0)
      rise(one('.s-head .s-lead'), Math.min(t, 420), L.y * 0.6)
      return Math.min(t, 520)
    }

    switch (layout) {
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
        run(anims, one('.sc-num') ?? slide, [{ opacity: 0, translate: '0 22%' }], 0, levelName === 'lively' ? SPRINGS.soft : SPRINGS.glide)
        const t = words(one('.sc-title'), 160, L.word * 1.2)
        rise(one('.sc-lead'), t, L.y * 0.6)
        items('.sc-map li', t + 120, (el, at) => fade(el, at, 500), 60)
        break
      }
      case 'agenda': {
        const t = words(one('.ag-title'), 0)
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
          count(el.querySelector('.kp-value'), at + 120)
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
        break
      }
      case 'timeline': {
        const t = head()
        items('.tl-item', t, (el, at) => {
          grow(el, at, variant === 'steps' ? 'down' : 'x', '::before')
          pop(el.querySelector('.tl-dot'), at + 140)
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
          count(el.querySelector('.br-value'), at + 120)
        })
        fade(one('.s-source'), t + 400)
        break
      }
      case 'scorecard': {
        const t = head()
        fade(one('.sk-headrow'), t, 500)
        const end = items('.sk-row.it', t + 120, (el, at) => {
          rise(el.querySelector('.sk-name'), at, L.y * 0.5)
          grow(el.querySelector('.sk-fill'), at + 120)
          pop(el.querySelector('.sk-mark'), at + 320)
          fade(el.querySelector('.sk-target'), at + 80, 500)
          count(el.querySelector('.sk-value'), at + 120)
          count(el.querySelector('.sk-rate'), at + 200)
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
          if (plot) run(anims, plot, [{ opacity: 0 }], s(at + 420), { easing: OUT, duration: s(400) }, '::after')
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
        if (svg) run(anims, svg, [{ clipPath: 'inset(-10% 100% -10% 0)' }, { clipPath: 'inset(-10% 0 -10% 0)' }], s(t + 100), { easing: 'linear', duration: s(draw) })
        $('.tn-pt').forEach((el) => {
          const at = t + 100 + ((parseFloat(el.style.getPropertyValue('--x')) || 0) / 100) * draw
          pop(el.querySelector('.tn-dot'), at)
          if (el.classList.contains('is-hl')) {
            rise(el.querySelector('.tn-val'), at + 60, L.y * 0.5)
            count(el.querySelector('.tn-num'), at + 60)
          } else fade(el.querySelector('.tn-val'), at + 40, 400)
        })
        items('.tn-col', t, (el, at) => fade(el, at, 400), 30)
        fade(one('.tn-target'), t + 200, 600)
        fade(one('.s-source'), t + draw)
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
        if (hl) run(anims, hl, [{ backgroundColor: 'transparent' }], s(t + 260 + L.step * 4), { easing: OUT, duration: s(700) })
        break
      }
      case 'closing': {
        const t = words(one('.cl-title'), 0, L.word * 1.2)
        fade(one('.cl-contact'), t)
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
