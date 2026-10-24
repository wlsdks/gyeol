import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'
import { visibleItems } from '../../deck/fields'
import { highlightOf, LAYOUTS, panesOf, placeOf, sideOf } from '../../deck/layouts'
import { PLACES } from '../../deck/themes'
import type { Deck, Place, Slide } from '../../deck/types'
import { cx } from '../../lib/cx'
import { startItemDrag } from '../../slides/itemDrag'
import { placeFor, sideName, zoneOf } from '../../slides/panes'
import { useDeck } from '../../store/deckStore'
import { CopyIcon, GripIcon, Icon, TrashIcon } from '../ui'
import { VariantMenu } from './VariantMenu'

/**
 * 장 위에서 고른 것의 도구. 레이아웃 장에서 칸을 누르면 그 칸이 든 항목(카드, 줄, 단계)이나 옆 판을
 * 파란 테로 두르고, 바로 위에 이름과 할 수 있는 일을 띄운다: 끌어 옮기기, 앞뒤로, 강조, 복제, 빼기 /
 * 반대쪽으로, 좁게·넓게, 아래로.
 *
 * 예전에는 칸을 누르면 글 상자 테두리만 보이고, 옮기는 손잡이는 마우스를 올려야 작게 보여서
 * '이걸 어떻게 옮기지?'를 알 수 없었다. 부품 장(.bk)은 부품마다 자기 도구가 있어 여기서는 다루지 않는다.
 */

type Target =
  | { kind: 'item'; el: HTMLElement; index: number; across: boolean }
  | { kind: 'pane'; el: HTMLElement }
  /** 항목도 판도 아닌 칸(표지 제목 같은): 무슨 칸인지와 이 장의 모양. place면 el은 위아래로 옮길 수 있는 제목 덩어리 */
  | { kind: 'field'; el: HTMLElement; label: string; place?: boolean }

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const ArrowIcon = ({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }) => (
  <Icon d={{ left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6', up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6' }[dir]} />
)
const StarIcon = () => <Icon d="M12 4.5l2.3 4.7 5.2.8-3.8 3.7.9 5.2-4.6-2.4-4.6 2.4.9-5.2L4.5 10l5.2-.8z" />
const SwapIcon = () => <Icon d="M7 7h11l-3-3M17 17H6l3 3" />
const NarrowIcon = () => <Icon d="M4 12h6M7 9l3 3-3 3M20 12h-6M17 9l-3 3 3 3" />
const WideIcon = () => <Icon d="M10 12H4M7 9l-3 3 3 3M14 12h6M17 9l3 3-3 3" />
const BelowIcon = () => <Icon d="M4 5h16v9H4zM4 17.5h16" />
/** 제목 자리: 장 틀 안의 위, 가운데, 아래 줄 */
const PlaceIcon = ({ at }: { at: Place }) => <Icon d={`M5 4h14v16H5zM8.5 ${at === 'top' ? 8 : at === 'middle' ? 12 : 16}h7`} />

/** 끄는 자리를 칸 높이의 어디에서 바꿀지 (가운데 칸을 조금 좁게: 위아래로 조금만 끌어도 바뀌지 않게) */
function placeAt(t: number): Place {
  return t < 0.36 ? 'top' : t < 0.64 ? 'middle' : 'bottom'
}

/**
 * 고른 것 위에 띄울 막대의 자리. 위에 자리가 있으면 테 바로 위, 없으면 테 안쪽 위.
 * 슬라이드 위 여백까지 쓴다 (판이나 부품이 장 맨 위에 붙어 있어도 그 글을 가리지 않게)
 */
/** 제목 덩어리의 테를 덩어리 밖으로 띄우는 너비(화면 px) */
const GROUP_PAD = 10

function barSpot(r: DOMRect, bar: HTMLElement | null, canvas: HTMLElement | null) {
  const area = (canvas?.closest('.stage') ?? canvas)?.getBoundingClientRect()
  const bw = bar?.offsetWidth ?? 0
  const bh = bar?.offsetHeight ?? 36
  const top = area ? area.top + 4 : 4
  const bottom = area ? area.bottom - 4 : innerHeight - 4
  // 위에 자리가 없으면(장 맨 위의 제목) 아래에 붙인다. 고른 것 위에 얹으면 고치려는 글을 가린다
  const y = r.top - bh - 8 >= top ? r.top - bh - 8 : r.bottom + 8 + bh <= bottom ? r.bottom + 8 : r.top + 8
  const maxX = (area ? area.right : innerWidth) - bw - 8
  const x = Math.max(area ? area.left + 8 : 8, Math.min(r.left, maxX))
  return { x, y, room: area ? area.width - 16 : innerWidth }
}

/**
 * 부품 장에서 고른 컴포넌트(이음표도)의 도구를 그 바로 위에 띄운다. 레이아웃 장의 막대와 같은 자리, 같은 방식이라
 * 어느 장이든 '고르면 위에 도구가 뜬다'로 같다. 예전에는 장 아래 도구 줄이 고른 부품의 도구로 바뀌어서
 * 고른 것과 도구가 멀리 떨어져 있었다. 장이 좁아 다 들어가지 않으면 이름표 말고는 글자를 숨긴다 (말풍선으로)
 */
export function FloatTools({ canvasRef, children }: { canvasRef: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null)
  const [tight, setTight] = useState(false)
  const full = useRef(0)
  const anchor = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = canvasRef.current?.querySelector<HTMLElement>('.bk-area > .is-selected') ?? null
      const bar = ref.current
      if (!el || !bar) return setSpot(null)
      // 다른 것을 고르면 도구가 달라지니 글자를 다 보인 너비부터 다시 잰다
      if (el !== anchor.current) {
        anchor.current = el
        full.current = 0
        setTight(false)
        return
      }
      const s = barSpot(el.getBoundingClientRect(), bar, canvasRef.current)
      if (!bar.classList.contains('is-tight')) full.current = bar.offsetWidth
      setTight(full.current > s.room)
      setSpot((p) => (p && p.x === s.x && p.y === s.y ? p : { x: s.x, y: s.y }))
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [canvasRef])
  return (
    <div ref={ref} className={cx('float-tools', tight && 'is-tight')} style={spot ? { translate: `${spot.x}px ${spot.y}px` } : { visibility: 'hidden' }}>
      {children}
    </div>
  )
}

/** 누른 곳에서 고를 것을 찾는다: 항목이 먼저, 아니면 옆 판 */
function targetAt(node: Element, slide: Slide): Target | null {
  const slideEl = node.closest<HTMLElement>('.slide')
  if (!slideEl || node.closest('.bk, .pn-tools, .it-grip, .it-remove')) return null
  const item = node.closest<HTMLElement>('.it')
  if (item && slideEl.contains(item) && LAYOUTS[slide.layout].items) {
    const list = [...(item.parentElement?.children ?? [])].filter((c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains('it'))
    const grip = item.querySelector<HTMLElement>(':scope > .it-grip')
    const index = grip?.dataset.i ? Number(grip.dataset.i) : list.indexOf(item)
    // 가로로 놓인 목록(카드, 단계)은 왼쪽·오른쪽, 세로로 쌓인 목록(줄)은 위·아래
    let across = true
    if (list.length > 1) {
      const a = list[0].getBoundingClientRect()
      const b = list[1].getBoundingClientRect()
      across = Math.abs(b.left - a.left) > Math.abs(b.top - a.top)
    }
    if (index >= 0) return { kind: 'item', el: item, index, across }
  }
  const panes = panesOf(slide)
  const pane = panes && slideEl.querySelector<HTMLElement>(panes.el)
  if (pane && pane.contains(node) && (sideOf(slide) !== null || zoneOf(slide) === 'below')) return { kind: 'pane', el: pane }
  // 제목 덩어리를 옮길 수 있는 장(표지, 섹션): 제목이나 부제를 누르면 덩어리를 고른다
  const place = LAYOUTS[slide.layout].place
  const group = place && slideEl.querySelector<HTMLElement>(place.el)
  if (group && group.contains(node)) return { kind: 'field', el: group, label: place.name, place: true }
  const field = node.closest<HTMLElement>('[data-field]')
  const label = field && LAYOUTS[slide.layout].fields.find((f) => f.key === field.dataset.field)?.label
  if (field && label && (LAYOUTS[slide.layout].variants?.length ?? 0) > 1) return { kind: 'field', el: field, label }
  return null
}

export function SelectionBar({ deck, slide, canvasRef }: { deck: Deck; slide: Slide; canvasRef: RefObject<HTMLDivElement | null> }) {
  const store = useDeck()
  const [target, setTarget] = useState<Target | null>(null)
  const [ring, setRing] = useState<Rect | null>(null)
  const [bar, setBar] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  /** 제목 덩어리를 위아래로 끄는 중: 덩어리가 놓이는 칸의 자리와 지금 붙을 자리 (세 자리를 그 위에 보인다) */
  const [placing, setPlacing] = useState<{ rect: Rect; at: Place } | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const slideRef = useRef(slide)
  slideRef.current = slide

  // 다른 장으로 가면 고른 것을 놓는다
  useEffect(() => setTarget(null), [slide.id])

  // 칸에 들어가거나(키보드도) 항목을 누르면 고르고, 슬라이드 밖을 누르면 놓는다
  useEffect(() => {
    const root = canvasRef.current
    if (!root) return
    const pick = (t: EventTarget | null) => {
      if (!(t instanceof Element) || t.closest('.sel-bar')) return
      if (!t.closest('.slide')) return setTarget(null)
      setTarget(targetAt(t, slideRef.current))
    }
    const onFocus = (e: FocusEvent) => pick(e.target)
    const onDown = (e: PointerEvent) => {
      // 항목의 손잡이로 끄는 동안은 도구를 걷는다 (항목이 손을 따라 움직인다)
      if (e.target instanceof Element && e.target.closest('.it-grip, .pn-tools')) {
        setDragging(true)
        const up = () => {
          setDragging(false)
          window.removeEventListener('pointerup', up, true)
        }
        window.addEventListener('pointerup', up, true)
        return
      }
      pick(e.target)
    }
    const onOutside = (e: PointerEvent) => {
      if (e.target instanceof Node && !root.contains(e.target)) setTarget(null)
    }
    root.addEventListener('focusin', onFocus)
    root.addEventListener('pointerdown', onDown)
    document.addEventListener('pointerdown', onOutside, true)
    return () => {
      root.removeEventListener('focusin', onFocus)
      root.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointerdown', onOutside, true)
    }
  }, [canvasRef])

  // 고른 것의 자리를 따라간다 (글을 적어 카드가 커지거나 순서를 바꿔 옮겨 가도)
  useLayoutEffect(() => {
    if (!target) {
      setRing(null)
      setBar(null)
      return
    }
    let raf = 0
    const tick = () => {
      if (!target.el.isConnected) return setTarget(null)
      const box = target.el.getBoundingClientRect()
      // 제목 덩어리는 쓰는 중인 칸의 테와 겹치지 않게 조금 넓게 두른다 (app.css의 .sel-ring.is-group)
      const pad = target.kind === 'field' && target.place ? GROUP_PAD : 0
      const r = new DOMRect(box.left - pad, box.top - pad, box.width + pad * 2, box.height + pad * 2)
      setRing((p) => (p && p.x === r.left && p.y === r.top && p.w === r.width && p.h === r.height ? p : { x: r.left, y: r.top, w: r.width, h: r.height }))
      const { x, y } = barSpot(r, barRef.current, canvasRef.current)
      setBar((p) => (p && p.x === x && p.y === y ? p : { x, y }))
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [target, canvasRef])

  // 옆 판을 고르면 판의 테와 판 사이 손잡이를 켜 두고, 판의 이름표는 막대의 이름이 맡는다.
  // 항목을 고르면 항목 모서리의 손잡이와 빼기 단추를 숨긴다 (막대에 같은 일이 있다). edit.css
  useEffect(() => {
    if (!target || target.kind === 'field') return
    const el = target.kind === 'pane' ? target.el.closest<HTMLElement>('.slide') : target.el
    if (!el) return
    el.dataset.sel = target.kind
    return () => {
      delete el.dataset.sel
    }
  }, [target])

  if (placing) return <PlaceGuide rect={placing.rect} at={placing.at} />
  if (!target || !ring || dragging) return null
  const spec = LAYOUTS[slide.layout]

  let name = ''
  let tools: ReactNode = null
  if (target.kind === 'item' && spec.items) {
    const i = target.index
    const n = visibleItems(slide).length
    const back = target.across ? 'left' : 'up'
    const fwd = target.across ? 'right' : 'down'
    const highlight = spec.highlight
    const on = highlight && highlightOf(slide) === i
    name = `${spec.items.label} ${i + 1}`
    // 옮긴 뒤에도 같은 항목을 고른 채로 둔다: 새 자리의 항목을 다시 찾는다
    const moveTo = (to: number) => {
      const list = target.el.parentElement
      store.moveItem(slide.id, i, to)
      requestAnimationFrame(() => {
        const items = [...(list?.children ?? [])].filter((c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains('it'))
        const el = items[to]
        if (el) setTarget({ ...target, el, index: to })
      })
    }
    const grip = target.el.querySelector<HTMLElement>(':scope > .it-grip')
    tools = (
      <>
        <button type="button" className="sel-btn" title={target.across ? '왼쪽으로' : '위로'} aria-label={target.across ? '왼쪽으로' : '위로'} disabled={i <= 0} onClick={() => moveTo(i - 1)}>
          <ArrowIcon dir={back} />
        </button>
        <button type="button" className="sel-btn" title={target.across ? '오른쪽으로' : '아래로'} aria-label={target.across ? '오른쪽으로' : '아래로'} disabled={i >= n - 1} onClick={() => moveTo(i + 1)}>
          <ArrowIcon dir={fwd} />
        </button>
        {highlight && (
          <button
            type="button"
            className={cx('sel-btn has-t', on && 'is-on')}
            aria-pressed={!!on}
            title={on ? `${highlight.label} 끄기` : `이 ${spec.items.label}을(를) ${highlight.label}`}
            onClick={() => store.setOptions(slide.id, { highlight: on ? -1 : i })}
          >
            <StarIcon />
            <span>강조</span>
          </button>
        )}
        <span className="sel-sep" aria-hidden="true" />
        <button
          type="button"
          className="sel-btn"
          title={n >= spec.items.max ? `${spec.items.label}은(는) ${spec.items.max}개까지예요` : '복제'}
          aria-label="복제"
          disabled={n >= spec.items.max}
          onClick={() => store.duplicateItem(slide.id, i)}
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          className="sel-btn"
          title={n <= spec.items.min ? `${spec.items.label}은(는) ${spec.items.min}개 아래로 줄일 수 없어요` : '이 항목 빼기'}
          aria-label="이 항목 빼기"
          disabled={n <= spec.items.min}
          onClick={() => {
            store.removeItem(slide.id, i)
            setTarget(null)
          }}
        >
          <TrashIcon />
        </button>
      </>
    )
    return (
      <>
        <div className="sel-ring" style={{ translate: `${ring.x}px ${ring.y}px`, width: ring.w, height: ring.h }} aria-hidden="true" />
        <div ref={barRef} className="sel-bar" role="toolbar" aria-label={`${name} 도구`} style={bar ? { translate: `${bar.x}px ${bar.y}px` } : { visibility: 'hidden' }}>
          {grip && n > 1 ? (
            <button
              type="button"
              className="sel-name is-grip"
              title="끌어서 순서 바꾸기"
              onPointerDown={(e) => {
                if (e.button !== 0) return
                e.preventDefault()
                setDragging(true)
                const up = () => {
                  setDragging(false)
                  window.removeEventListener('pointerup', up, true)
                }
                window.addEventListener('pointerup', up, true)
                startItemDrag(e.nativeEvent, grip, i, (from, to, key) => store.moveItem(slide.id, from, to, key))
              }}
            >
              <GripIcon />
              {name}
            </button>
          ) : (
            <span className="sel-name">{name}</span>
          )}
          <span className="sel-sep" aria-hidden="true" />
          {tools}
        </div>
      </>
    )
  }

  if (target.kind === 'field') {
    const placeSpec = target.place ? spec.place : undefined
    const current = placeOf(slide)
    const setPlace = (p: Place, key?: string) => store.setOptions(slide.id, { place: p === placeSpec?.base ? undefined : p }, key)
    // 이름을 잡고 위아래로 끌면 제목 덩어리가 세 자리 가운데 손 가까운 곳으로 바로 옮겨 간다. Esc는 처음 자리로, 한 번 끈 것은 되돌리기 한 단계
    const startPlace = (e: ReactPointerEvent<HTMLButtonElement>) => {
      // 세 자리는 제목 덩어리가 놓이는 칸(표지는 결정 요청 판을 뺀 쪽, 섹션은 장 전체) 안에서 나눈다
      const box = target.el.parentElement
      if (e.button !== 0 || !placeSpec || !box || !current) return
      e.preventDefault()
      const from = current
      const key = `place:${slide.id}:${Math.round(performance.now())}`
      let at = from
      const rectOf = () => {
        const r = box.getBoundingClientRect()
        return { x: r.left, y: r.top, w: r.width, h: r.height }
      }
      setPlacing({ rect: rectOf(), at })
      document.body.classList.add('is-placing')
      const move = (ev: PointerEvent) => {
        const r = rectOf()
        const next = placeAt((ev.clientY - r.y) / r.h)
        if (next !== at) {
          at = next
          setPlace(next, key)
        }
        setPlacing({ rect: r, at })
      }
      const stop = (cancel: boolean) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('keydown', onKey, true)
        document.body.classList.remove('is-placing')
        if (cancel && at !== from) setPlace(from, key)
        setPlacing(null)
      }
      const up = () => stop(false)
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== 'Escape') return
        ev.preventDefault()
        ev.stopPropagation()
        stop(true)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('keydown', onKey, true)
    }
    return (
      <>
        {placeSpec && <div className="sel-ring is-group" style={{ translate: `${ring.x}px ${ring.y}px`, width: ring.w, height: ring.h }} aria-hidden="true" />}
        <div ref={barRef} className="sel-bar" role="toolbar" aria-label={`${target.label} 도구`} style={bar ? { translate: `${bar.x}px ${bar.y}px` } : { visibility: 'hidden' }}>
          {placeSpec ? (
            <button type="button" className="sel-name is-grip" title="위아래로 끌어 자리 옮기기" onPointerDown={startPlace}>
              <GripIcon />
              {target.label}
            </button>
          ) : (
            <span className="sel-name">{target.label}</span>
          )}
          {placeSpec && current && (
            <>
              <span className="sel-sep" aria-hidden="true" />
              {PLACES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={cx('sel-btn', current === p.id && 'is-on')}
                  aria-pressed={current === p.id}
                  title={`${p.name}에 두기`}
                  onClick={() => setPlace(p.id)}
                >
                  <PlaceIcon at={p.id} />
                </button>
              ))}
            </>
          )}
          {(spec.variants?.length ?? 0) > 1 && (
            <>
              <span className="sel-sep" aria-hidden="true" />
              <VariantMenu deck={deck} slide={slide} compact />
            </>
          )}
        </div>
      </>
    )
  }

  if (target.kind === 'pane' && spec.panes) {
    const panes = panesOf(slide) ?? spec.panes
    const zone = zoneOf(slide)
    const side = sideOf(slide)
    const at = panes.sides.indexOf(side ?? panes.base)
    const place = (to: 'start' | 'end' | 'below') => {
      const p = placeFor(slide, to)
      if (p.variant) store.setVariant(slide.id, p.variant)
      store.setOptions(slide.id, { flip: p.flip || undefined })
    }
    const setSide = (k: number) => {
      const n = panes.sides[k]
      store.setOptions(slide.id, { pane: n === panes.base ? undefined : n })
    }
    name = panes.name
    tools = (
      <>
        {zone !== 'below' && (
          <button type="button" className="sel-btn has-t" title="반대쪽으로 옮기기" onClick={() => place(zone === 'start' ? 'end' : 'start')}>
            <SwapIcon />
            <span>{zone === 'start' ? '오른쪽으로' : '왼쪽으로'}</span>
          </button>
        )}
        {spec.panes.below && (
          <button type="button" className="sel-btn has-t" title={zone === 'below' ? '옆으로 세우기' : '장 아래에 띠로 깔기'} onClick={() => place(zone === 'below' ? (spec.panes!.start ? 'start' : 'end') : 'below')}>
            <BelowIcon />
            <span>{zone === 'below' ? '옆으로' : '아래로'}</span>
          </button>
        )}
        {side !== null && zone !== 'below' && (
          <>
            <span className="sel-sep" aria-hidden="true" />
            <button type="button" className="sel-btn" title={at > 0 ? `좁게 (${sideName(panes.sides[at - 1], panes.base)})` : '더 좁게 할 수 없어요'} aria-label="좁게" disabled={at <= 0} onClick={() => setSide(at - 1)}>
              <NarrowIcon />
            </button>
            <span className="sel-val">{sideName(side, panes.base)}</span>
            <button
              type="button"
              className="sel-btn"
              title={at < panes.sides.length - 1 ? `넓게 (${sideName(panes.sides[at + 1], panes.base)})` : '더 넓게 할 수 없어요'}
              aria-label="넓게"
              disabled={at >= panes.sides.length - 1}
              onClick={() => setSide(at + 1)}
            >
              <WideIcon />
            </button>
          </>
        )}
      </>
    )
    return (
      <>
        <div ref={barRef} className="sel-bar" role="toolbar" aria-label={`${name} 도구`} style={bar ? { translate: `${bar.x}px ${bar.y}px` } : { visibility: 'hidden' }}>
          <button
            type="button"
            className="sel-name is-grip"
            title={spec.panes.below ? '끌어서 반대쪽이나 아래로 옮겨요' : '끌어서 반대쪽으로 옮겨요'}
            onPointerDown={(e) => {
              if (e.button !== 0) return
              e.preventDefault()
              // 판 옮기기는 판의 이름표(panes.tsx)가 한다. 손이 막대에서 시작해도 이름표를 잡은 것처럼 넘긴다
              const handle = target.el.closest('.slide')?.querySelector<HTMLElement>('.pn-handle')
              handle?.dispatchEvent(
                new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: true }),
              )
            }}
          >
            <GripIcon />
            {name}
          </button>
          <span className="sel-sep" aria-hidden="true" />
          {tools}
        </div>
      </>
    )
  }
  return null
}

/** 제목 덩어리를 끄는 동안 그 칸 위에 보이는 세 자리. 손이 있는 자리가 짙어지고, 놓으면 그 자리에 붙는다 */
function PlaceGuide({ rect, at }: { rect: Rect; at: Place }) {
  const bands: [Place, number, number][] = [
    ['top', 0, 0.36],
    ['middle', 0.36, 0.64],
    ['bottom', 0.64, 1],
  ]
  return (
    <div className="place-guide" style={{ translate: `${rect.x}px ${rect.y}px`, width: rect.w, height: rect.h }} aria-hidden="true">
      {bands.map(([id, a, b]) => (
        <div key={id} className={cx('place-band', at === id && 'is-on')} style={{ top: `${a * 100}%`, height: `${(b - a) * 100}%` }}>
          <span>{PLACES.find((p) => p.id === id)?.name}</span>
        </div>
      ))}
    </div>
  )
}
