// 앱 전체의 말풍선. 단추마다 적어 둔 title을 브라우저 기본 말풍선(1초쯤 늦게, 작은 회색 상자) 대신
// 바로 알아보이는 검은 말풍선으로 보인다. 그림만 있는 단추(좁은 창에서 글자를 숨긴 단추 포함)가 무엇인지
// 마우스를 올리거나 키보드로 옮겨 오면 곧 알 수 있게.
//
// title은 지우지 않고 올려 둔 동안만 잠깐 떼어 둔다. 화면 읽기 프로그램이 읽는 이름이 그대로 남고,
// 떼어 둔 동안 React가 title을 새로 바꿔 넣었으면 그 값을 살린다.

const SHOW_MS = 380
/** 말풍선을 막 닫은 뒤 옆 단추로 옮겨 가면 기다리지 않고 바로 보인다 */
const WARM_MS = 600
const GAP = 8
const EDGE = 8

let tip: HTMLDivElement | null = null
let owner: HTMLElement | null = null
let saved: string | null = null
let timer = 0
let frame = 0
let hiddenAt = 0

function ensureTip(): HTMLDivElement {
  if (tip) return tip
  tip = document.createElement('div')
  tip.className = 'tt'
  tip.setAttribute('role', 'tooltip')
  tip.id = 'app-tooltip'
  document.body.append(tip)
  return tip
}

/** '지금 장부터 발표 (Shift+F5)'처럼 끝에 괄호로 붙은 단축키는 옅게 따로 보인다 */
function fill(el: HTMLDivElement, text: string) {
  const m = /^(.*?)\s*\(([^()]*(?:Ctrl|Shift|Alt|Esc|Enter|Tab|F\d+|⌘|⌥|⇧|Delete|Backspace)[^()]*)\)\s*$/.exec(text)
  el.textContent = ''
  if (!m) {
    el.textContent = text
    return
  }
  el.append(m[1])
  const key = document.createElement('span')
  key.className = 'tt-key'
  key.textContent = m[2]
  el.append(key)
}

function place() {
  if (!tip || !owner) return
  if (!owner.isConnected) return hide()
  const r = owner.getBoundingClientRect()
  if (!r.width && !r.height) return hide()
  const w = tip.offsetWidth
  const h = tip.offsetHeight
  const vw = document.documentElement.clientWidth
  const vh = document.documentElement.clientHeight
  // 아래에 자리가 없으면 위로. 화면 맨 아래의 단추줄(슬라이드 아래 도구)도 가리지 않게
  const below = r.bottom + GAP + h <= vh - EDGE
  const top = below ? r.bottom + GAP : Math.max(EDGE, r.top - GAP - h)
  const left = Math.min(Math.max(EDGE, r.left + r.width / 2 - w / 2), vw - EDGE - w)
  tip.style.translate = `${Math.round(left)}px ${Math.round(top)}px`
  tip.dataset.side = below ? 'below' : 'above'
  frame = requestAnimationFrame(place)
}

function show(el: HTMLElement) {
  const text = el.getAttribute('title')?.trim()
  if (!text) return
  release()
  owner = el
  saved = text
  el.removeAttribute('title')
  el.setAttribute('aria-describedby', 'app-tooltip')
  const t = ensureTip()
  fill(t, text)
  window.clearTimeout(timer)
  const open = () => {
    if (owner !== el) return
    t.classList.add('is-on')
    cancelAnimationFrame(frame)
    place()
  }
  if (performance.now() - hiddenAt < WARM_MS) open()
  else timer = window.setTimeout(open, SHOW_MS)
}

/** 떼어 둔 title을 돌려 놓는다 */
function release() {
  if (owner) {
    if (saved && !owner.hasAttribute('title')) owner.setAttribute('title', saved)
    if (owner.getAttribute('aria-describedby') === 'app-tooltip') owner.removeAttribute('aria-describedby')
  }
  owner = null
  saved = null
}

function hide() {
  window.clearTimeout(timer)
  cancelAnimationFrame(frame)
  if (tip?.classList.contains('is-on')) hiddenAt = performance.now()
  tip?.classList.remove('is-on')
  release()
}

function targetOf(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null
  const el = node.closest<HTMLElement>('[title]')
  // 움직이는 그림(svg의 title 요소)이나 글을 고치는 칸은 말풍선을 띄우지 않는다
  if (!el || el instanceof SVGElement || el.matches('input, textarea, [contenteditable="true"], [data-no-tip]')) return null
  return el
}

let installed = false

export function installTooltips() {
  if (installed || typeof document === 'undefined') return
  installed = true
  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType === 'touch') return
      // 올려 둔 단추 안에서 움직이는 것은 그대로 (title을 떼어 둬서 바깥 칸의 title을 잡지 않게)
      if (owner && e.target instanceof Node && owner.contains(e.target)) return
      const el = targetOf(e.target)
      if (el) show(el)
      else if (owner) hide()
    },
    true,
  )
  document.addEventListener(
    'pointerout',
    (e) => {
      if (!owner) return
      const to = e.relatedTarget
      if (to instanceof Node && owner.contains(to)) return
      hide()
    },
    true,
  )
  // 누르면 할 일을 하는 중이니 말풍선은 걷는다
  document.addEventListener('pointerdown', hide, true)
  document.addEventListener('wheel', hide, { capture: true, passive: true })
  document.addEventListener('scroll', hide, true)
  window.addEventListener('blur', hide)
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && owner) hide()
    },
    true,
  )
  // 키보드로 옮겨 온 단추도 무엇인지 보인다 (마우스로 누른 초점에는 띄우지 않는다)
  document.addEventListener('focusin', (e) => {
    const el = targetOf(e.target)
    if (el && el.matches(':focus-visible')) show(el)
  })
  document.addEventListener('focusout', (e) => {
    if (owner && e.target === owner) hide()
  })
}
