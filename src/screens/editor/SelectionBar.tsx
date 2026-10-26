import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'
import { visibleItems } from '../../deck/fields'
import { highlightOf, LAYOUTS, panesOf, placeOf, sideOf, variantOf } from '../../deck/layouts'
import { PLACES } from '../../deck/themes'
import type { Deck, Place, Slide } from '../../deck/types'
import { cx } from '../../lib/cx'
import { gestureKey, usePointerSessions } from '../../lib/pointerSession'
import { josa } from '../../lib/josa'
import { frameRect } from '../../slides/blockFrame'
import { startItemDrag } from '../../slides/itemDrag'
import { placeFor, sideName, sideZone, zoneOf } from '../../slides/panes'
import { useDeck } from '../../store/deckStore'
import { CopyIcon, GripIcon, Icon, TrashIcon, useEscape } from '../ui'
import { moving, useTrackRect } from './useTrackRect'
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

/** 제목 덩어리의 테를 덩어리 밖으로 띄우는 너비(화면 px) */
const GROUP_PAD = 10
/** 면이 없는 항목의 테를 옆으로 띄우는 너비(화면 px) */
const ITEM_PAD = 8

/**
 * 고른 것 위에 띄울 막대의 자리. 위에 자리가 있으면 테 바로 위, 없으면 테 안쪽 위.
 * 슬라이드 위 여백까지 쓴다 (판이나 부품이 장 맨 위에 붙어 있어도 그 글을 가리지 않게)
 */
function barSpot(r: DOMRect, bar: HTMLElement | null, canvas: HTMLElement | null, others: TextRect[] = [], slide?: DOMRect | null, beside = false) {
  const area = (canvas?.closest('.stage') ?? canvas)?.getBoundingClientRect()
  const bw = bar?.offsetWidth ?? 0
  const bh = bar?.offsetHeight ?? 36
  const top = area ? area.top + 4 : 4
  const bottom = area ? area.bottom - 4 : innerHeight - 4
  const minX = area ? area.left + 8 : 8
  const maxX = (area ? area.right : innerWidth) - bw - 8
  const clampX = (x: number) => Math.max(minX, Math.min(x, maxX))
  // 고른 것 안의 글은 더 무겁게 친다: 지금 고치는 것이라 다음에 누를 칸이다 (막대 비교에서 줄을 고르면 막대가 그 줄의 숫자를 덮어 누를 수 없었다)
  const own = (o: DOMRect) => (o.left >= r.left - 1 && o.right <= r.right + 1 && o.top >= r.top - 1 && o.bottom <= r.bottom + 1 ? OWN_WEIGHT : 1)
  const hit = (x: number, y: number) =>
    others.reduce(
      (a, { r: o, w }) =>
        a + w * own(o) * Math.max(0, Math.min(x + bw, o.right) - Math.max(x, o.left)) * Math.max(0, Math.min(y + bh, o.bottom) - Math.max(y, o.top)),
      0,
    )
  // 놓을 자리들 (앞의 것일수록 먼저): 고른 것 바로 위, 바로 아래. 장(slide)을 주면 장 위 여백, 장 아래 여백, 고른 것 안쪽 위도.
  // 줄 사이(48px)와 제목 아래 여백은 막대보다 좁아서, 위아래만 견주면 윗줄을 고를 때 위로는 장 제목을, 아래로는
  // 아랫줄 숫자를 통째로 가렸다(1280×600의 핵심 포인트 아래 숫자 줄). 장 위 여백은 장 밖 회색 띠와 장의 위 틀(--pad-y)이라
  // 글이 없다. 가로는 고른 것의 왼쪽 끝에 맞추거나, 왼쪽 위의 제목을 피해 오른쪽 끝에, 아니면 가운데에 맞춘다
  // (막대 비교의 줄처럼 양 끝에 이름과 숫자가 있고 가운데가 그림이면, 가운데가 윗줄의 글을 가리지 않는다)
  const ys = [r.top - bh - 8, r.bottom + 8]
  if (slide) ys.push(Math.max(top, slide.top - bh - 8), Math.min(bottom - bh, slide.bottom + 8))
  const xs = slide ? [clampX(r.left), clampX(r.right - bw), clampX(r.left + (r.width - bw) / 2)] : [clampX(r.left)]
  const spots = ys.filter((y) => y >= top && y + bh <= bottom).flatMap((y) => xs.map((x) => ({ x, y })))
  // 장 아래 여백은 장 아래 도구 줄과 겹친다. 왼쪽 묶음(AI로 다듬기, 넘침 알림)과 오른쪽 묶음(미리 보기, 발표) 사이가 막대보다
  // 넓으면 그 사이에도 놓아 본다 (1440×900에서 맨 아래 컴포넌트를 고르면 막대가 'AI로 다듬기'를, 1920×1080에서는 '미리 보기'를
  // 반쯤 덮어 단추 두 줄이 겹쳐 보였다. 견주는 자리가 고른 것에 맞춘 셋뿐이라 그 사이의 빈 곳을 몰랐다).
  // 도구를 하나도 덮지 않고 양옆 도구와 8px씩 떨어지는 자리만 더한다: 도구는 가볍게 쳐서, 덮는 자리를 더하면 아무것도 덮지 않던
  // 장 위 여백보다 앞설 수 있고, 틈에 꼭 끼우면 막대가 도구 줄의 단추처럼 보인다
  const tools = others.filter((t) => t.tool).map((t) => t.r)
  for (const y of [...new Set(spots.map((s) => s.y))]) {
    const row = tools.filter((o) => o.top < y + bh && o.bottom > y)
    for (const o of row) {
      for (const x of [clampX(o.right + 8), clampX(o.left - bw - 8)]) if (row.every((p) => x + bw + 8 <= p.left || x >= p.right + 8)) spots.push({ x, y })
    }
  }
  if (slide) spots.push({ x: clampX(r.right - bw - 8), y: Math.max(top, r.top + 8) })
  if (!spots.length) return { x: clampX(r.left), y: r.top + 8, room: area ? area.width - 16 : innerWidth }
  // 가리는 글(others)의 넓이에, 고른 것에서 떨어진 만큼을 조금 더한다. 그래서 빈칸 안내를 조금 가리는 바로 아래가
  // 아무것도 가리지 않는 먼 장 위 여백보다 낫고, 장 제목을 가리는 바로 위보다는 장 위 여백이 낫다
  const away = (y: number) => Math.max(0, r.top - 8 - (y + bh), y - (r.bottom + 8))
  // 부품 장에서는 두 자리를 더 견준다. 위아래로 쌓인 컴포넌트 가운데 하나를 고르면 바로 위와 아래가 이웃의 글(핵심 한 줄의 부제, 기준)이라,
  // 테두리 끝에 맞춘 세 자리가 다 그 글을 덮어서 막대가 장 위 여백이나 장 아래 도구 줄까지 150~250px 떨어져 떴다.
  // 1) 바로 위아래이되 장의 오른쪽 끝이나 왼쪽 끝에 맞춘 자리: 이웃의 짧은 글은 대개 왼쪽에 모여 있다. 막대가 테두리와 3분의 1 넘게
  //    겹칠 때만(고른 것의 막대로 읽히게). 2) 테두리 옆, 위 끝에 맞춘 자리(왼쪽에 모인 짧은 글, 큰 숫자): 50px 떨어진 것만큼 더 쳐서,
  //    비어 있는 위나 아래가 있으면 그쪽이 먼저다(위아래가 '고른 것의 도구'로 더 잘 읽힌다)
  const more: { x: number; y: number }[] = []
  const sides: { x: number; y: number }[] = []
  if (beside && slide) {
    for (const y of [r.top - bh - 8, r.bottom + 8]) {
      if (y < top || y + bh > bottom) continue
      for (const x of [clampX(slide.right - bw), clampX(slide.left)])
        if (Math.min(x + bw, r.right) - Math.max(x, r.left) >= Math.min(bw, r.width) / 3) more.push({ x, y })
    }
    for (const x of [r.right + 8, r.left - bw - 8]) if (x >= minX && x <= maxX) sides.push({ x, y: Math.max(top, Math.min(r.top, bottom - bh)) })
  }
  // 더한 두 자리는 글과 그림을 조금도 덮지 않을 때만 쓴다(빈칸 안내와 빈 글 칸은 덮어도 된다): 먼 자리보다 싸다고 이웃 글의 끝
  // (핵심 한 줄 아래 기준의 긴 글)을 덮으면 그 글을 읽지도 누르지도 못했다. 그럴 바에는 예전처럼 아무것도 덮지 않는 장 위 여백이 낫다
  const covers = (s: { x: number; y: number }) =>
    others.some(({ r: o, w, tool }) => w >= ART_WEIGHT && !tool && Math.min(s.x + bw, o.right) > Math.max(s.x, o.left) && Math.min(s.y + bh, o.bottom) > Math.max(s.y, o.top))
  // 부품 장에서는 적은 글(무게 1)을 조금이라도 덮는 자리를 한 번 더 크게 친다: 덮은 넓이로만 치면 이웃 글의 끝 두세 글자를 덮는 바로 아래가
  // 145px 떨어진 장 위 여백보다 싸서, 1280×600에서 핵심 한 줄, 컴포넌트, 기준을 쌓은 장의 가운데를 고르면 막대가 기준 글의 끝을 덮었다.
  // 덮인 글은 읽지도 누르지도 못하니 COVER_COST만큼 더 떨어지더라도 덮지 않는 자리가 낫다. 글자 줄 상자의 가장자리 몇 px는 글자가 아니라 뺀다.
  const hides = (s: { x: number; y: number }) =>
    beside &&
    others.some(({ r: o, w }) => w === 1 && Math.min(s.x + bw, o.right) - Math.max(s.x, o.left) > 3 && Math.min(s.y + bh, o.bottom) - Math.max(s.y, o.top) > 3)
  const score = (s: { x: number; y: number }) => hit(s.x, s.y) + away(s.y) * AWAY_COST + (sides.includes(s) ? 50 * AWAY_COST : 0) + (hides(s) ? COVER_COST : 0)
  const best = [...spots, ...[...more, ...sides].filter((s) => !covers(s))].reduce((b, s) => (score(s) < score(b) - 1 ? s : b))
  return { x: best.x, y: best.y, room: area ? area.width - 16 : innerWidth }
}

/** 고른 것에서 1px 떨어질 때마다 더하는 값 (가린 넓이 px²와 같은 단위). 한 줄 글(20px)을 다 가리는 것보다 100px 떨어지는 게 낫게 */
const AWAY_COST = 6
/** 고른 것 안의 글을 가릴 때 곱하는 값 */
const OWN_WEIGHT = 4
/** 부품 장에서 적은 글을 조금이라도 덮는 자리에 더하는 값: 200px 더 떨어지는 것과 같다 (장 위 여백까지가 대개 그 안쪽) */
const COVER_COST = 200 * AWAY_COST

/**
 * 그려진 것의 자리와 가렸을 때의 무게. 빈칸의 안내는 발표 화면에 나오지 않아서 적은 글보다 가려도 덜 아프다. tool은 장 아래 도구 줄의 것
 */
type TextRect = { r: DOMRect; w: number; tool?: boolean }
const HINT_WEIGHT = 0.2
/** 차트와 원 같은 그림: 그림의 네모에는 빈 곳도 있어서 글보다 덜 친다 */
const ART_WEIGHT = 0.5
/** 장 아래 도구(미리 보기, 복제 같은): 고른 것을 다 고치고 나서 쓰는 것이라 잠깐 가려도 된다 */
const TOOL_WEIGHT = 0.3
/**
 * 글을 적는 칸의 네모 (글자 줄 말고 칸 전체): 누르는 자리라 비어 있어도 가리면 못 누른다.
 * 글자만 견주면 짧은 안내만 있는 빈 강조 상자 안쪽 위가 '아무것도 안 가리는 자리'가 되어, 막대가 칸 위에 올라앉아 적으려고 누르면 막대가 눌렸다
 */
const FIELD_WEIGHT = 0.3

/**
 * 장 안의 글과 그림이 그려진 자리들 (고른 것 안의 것도: 장 위 여백이나 안쪽 위에 둘 때 그 글을 가리지 않게).
 * 칸의 네모로 견주면 글 없는 차트 윗부분도 가리는 것으로 쳐서 글자 줄로 잰다. 장 아래 도구도 가벼운 무게로 넣는다
 */
function contentRects(slide: Element | null, canvas: Element | null): TextRect[] {
  if (!slide) return []
  const out: TextRect[] = []
  const range = document.createRange()
  const walk = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    // 칸 왼쪽 위의 끌기 이름표(.bk-handle)는 손을 올린 칸에만 보인다. 숨은 이름표를 글로 쳐서, 고른 컴포넌트 바로 위가 늘 막힌 자리가 되어
    // 막대가 아래나 장 위 여백으로 떨어져 떴다
    if (!n.nodeValue?.trim() || n.parentElement?.closest('.bk-handle')) continue
    // 빈 부제의 안내를 피하느라 아래로 내려가 차트의 숫자를 가렸다(1366×650의 핵심 숫자 아래 추이)
    const hint = !!n.parentElement?.closest('.ed-hint, .ed.is-empty')
    // 장 아래 띠의 발표 이름과 쪽 번호는 적는 글이 아니고 장마다 같아서 덮어도 되니 빈칸 안내만큼만 친다. 적은 글로 치면 맨 아래 컴포넌트를
    // 고를 때 바로 아래 대신 장 위 여백까지 150~180px 떨어져 떴다: 1280×600에서는 이 짧은 표시 하나(250점 남짓)로 바로 아래와 장 위 여백이
    // 1점 차이로 비겨서, 짜임이 거의 같은 두 장에서 막대가 한 장은 바로 아래, 한 장은 위 컴포넌트 너머 장 위에 떴다
    const mark = !!n.parentElement?.closest('.s-mark')
    range.selectNodeContents(n)
    for (const r of range.getClientRects()) if (r.width && r.height) out.push({ r, w: hint || mark ? HINT_WEIGHT : 1 })
  }
  for (const f of slide.querySelectorAll('[contenteditable]')) {
    // 컴포넌트 안의 글 칸은 그 컴포넌트의 테두리(그린 것 둘레) 안만 친다: 한 줄 글 칸은 칸 너비를 다 차지해서, 짧은 상태 글의 옆이나
    // 짧은 부제 오른쪽처럼 비어 보이는 곳도 막힌 자리로 쳐 막대가 장 위 여백까지 250px 떨어져 떴다
    const cell = f.closest<HTMLElement>('.bk')
    const r = cell ? overlap(f.getBoundingClientRect(), frameRect(cell)) : f.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) out.push({ r, w: FIELD_WEIGHT })
  }
  out.push(...paintedRects(slide))
  for (const g of slide.querySelectorAll('svg, img')) {
    const r = g.getBoundingClientRect()
    if (r.width && r.height && !g.closest('button, .bk-handle')) out.push({ r, w: ART_WEIGHT })
  }
  // 넘침 알림(.stage-warn)도 도구 줄의 것으로 친다: 도구 사이의 빈 곳을 찾을 때 알림 위를 빈 곳으로 보지 않게
  for (const b of canvas?.querySelectorAll('.stage-tools button, .stage-tools .stage-warn') ?? []) {
    const r = b.getBoundingClientRect()
    if (r.width && r.height) out.push({ r, w: TOOL_WEIGHT, tool: true })
  }
  return out
}

/** 두 네모가 겹친 곳 (겹치지 않으면 너비나 높이가 0 이하) */
const overlap = (a: DOMRect, b: DOMRect) => {
  const left = Math.max(a.left, b.left)
  const top = Math.max(a.top, b.top)
  return new DOMRect(left, top, Math.min(a.right, b.right) - left, Math.min(a.bottom, b.bottom) - top)
}

/** 그린 것으로 세지 않는 편집 표시: 빈칸과 칸의 면, 항목 도구, 그림 칸의 단추, 끌기 손잡이, 빈 그림 칸 */
const EDIT_MARKS = '.ed-halo, .it-grip, .it-remove, .img-tools, .bk-handle, .img-ed'

/**
 * 컴포넌트가 칠해서 그린 것(막대, 점, 칸)의 자리. 글자 줄과 svg만 세던 때는 모으기의 막대, 목표 대비의 막대, 칸 조립의 칸 위를
 * 빈 곳으로 보고 고른 컴포넌트 안쪽 위에 막대를 올려 그 그림을 통째로 가렸다. 칸 대부분을 덮는 면(바탕)과 손을 올린 항목의 옅은 면은 뺀다
 */
function paintedRects(slide: Element): TextRect[] {
  const out: TextRect[] = []
  const seen = (c: string) => !!c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)
  for (const inner of slide.querySelectorAll<HTMLElement>('.bk > .bk-in')) {
    const box = inner.getBoundingClientRect()
    for (const el of inner.querySelectorAll<HTMLElement>('*')) {
      if (el.closest(EDIT_MARKS) || el.matches('.it:hover')) continue
      const s = getComputedStyle(el)
      if (!seen(s.backgroundColor) && s.backgroundImage === 'none') continue
      const r = el.getBoundingClientRect()
      if (r.width && r.height && r.width * r.height < box.width * box.height * 0.6) out.push({ r, w: ART_WEIGHT })
    }
  }
  return out
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
  const texts = useRef<{ key: string; rects: TextRect[] }>({ key: '', rects: [] })
  useTrackRect(
    () => canvasRef.current,
    () => {
      // 고른 부품, 아니면 고른 이음표의 그림 (이음표만 고르면 도구가 붙을 데가 없어 보이지 않았다)
      const el = canvasRef.current?.querySelector<HTMLElement>('.bk-area .bk.is-selected, .bk-area > .bk-link.is-selected > .bk-link-g') ?? null
      const bar = ref.current
      if (!el || !bar) return setSpot(null)
      // 다른 것을 고르면 도구가 달라지니 글자를 다 보인 너비부터 다시 잰다 (다음 프레임에)
      if (el !== anchor.current) {
        anchor.current = el
        full.current = 0
        setTight(false)
        return true
      }
      // 칸이 아니라 부품의 테두리(그린 것 둘레) 바로 위에: 칸 위에 두면 짧은 내용 위로 빈 데를 건너 떠 보인다
      const r = el.classList.contains('bk') ? frameRect(el) : el.getBoundingClientRect()
      const slide = el.closest('.slide')
      // 글자 줄은 고른 것이 움직이거나 커질 때만 다시 잰다 (잴 때마다 장의 모든 글을 재지 않게). 항목 수가 바뀌어도: 위치 비교는
      // 점수를 적지 않은 점을 판 위쪽에 세워서, 점을 더해도 테두리는 그대로라 예전 자리의 막대가 새 점과 이름을 덮었다
      const key = `${r.left},${r.top},${r.width},${r.height},${el.querySelectorAll('.it').length}`
      if (texts.current.key !== key) texts.current = { key, rects: contentRects(slide, canvasRef.current) }
      const s = barSpot(r, bar, canvasRef.current, texts.current.rects, slide?.getBoundingClientRect(), true)
      if (!bar.classList.contains('is-tight')) full.current = bar.offsetWidth
      setTight(full.current > s.room)
      setSpot((p) => (p && p.x === s.x && p.y === s.y ? p : { x: s.x, y: s.y }))
      return moving(el)
    },
  )
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
  // 할 일(액션)만 쓴다. 저장소 전체를 구독하면 고칠 때마다 다시 그린다
  const store = useDeck.getState()
  // 끄는 동안 창에 건 처리기. 막대가 사라지면(다른 장, 미리 보기) 끝나지 않은 끌기를 거둔다
  const startSession = usePointerSessions()
  const [target, setTarget] = useState<Target | null>(null)
  const [ring, setRing] = useState<Rect | null>(null)
  const [bar, setBar] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  /** 제목 덩어리를 위아래로 끄는 중: 덩어리가 놓이는 칸의 자리와 지금 붙을 자리 (세 자리를 그 위에 보인다) */
  const [placing, setPlacing] = useState<{ rect: Rect; at: Place } | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const texts = useRef<{ key: string; rects: TextRect[] }>({ key: '', rects: [] })
  const slideRef = useRef(slide)
  slideRef.current = slide

  // 다른 장으로 가면 고른 것을 놓는다
  useEffect(() => setTarget(null), [slide.id])
  // Esc로도 놓는다(컴포넌트 장의 고르기와 같게): 글을 쓰다 누른 첫 Esc는 쓰기를 끝내고 다음 Esc가 고른 것을 놓는다.
  // 예전에는 Esc를 몇 번 눌러도 항목의 테와 도구 막대가 그대로 남았다
  useEscape(() => setTarget(null), { active: !!target, typing: false })

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
        const session = startSession()
        session.on(
          'pointerup',
          () => {
            setDragging(false)
            session.end()
          },
          true,
        )
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
  }, [canvasRef, startSession])

  // 고른 것의 자리를 따라간다 (글을 적어 카드가 커지거나 순서를 바꿔 옮겨 가도)
  useTrackRect(
    () => canvasRef.current,
    () => {
      if (!target) {
        setRing(null)
        setBar(null)
        return
      }
      if (!target.el.isConnected) return setTarget(null)
      const box = target.el.getBoundingClientRect()
      // 제목 덩어리는 쓰는 중인 칸의 테와 겹치지 않게 조금 넓게 두른다 (styles/selection.css의 .sel-ring.is-group)
      const pad = target.kind === 'field' && target.place ? GROUP_PAD : 0
      // 면이 없는 항목(줄로 나뉜 목록의 한 줄)은 글이 상자 끝에서 시작해서, 테를 상자에 딱 두르면 이름 글자가 테에 붙었다.
      // 옆으로만 조금 띄운다(위아래는 줄 선이라 띄우면 옆 줄을 덮는다). 옮길 수 있는 판(마지막 장의 요청 목록) 안이면 판의 테가
      // 같은 너비로 둘러 있어서, 띄우면 두 테가 엇갈린다
      const paneSel = panesOf(slideRef.current)?.el
      const inPane = !!paneSel && !!target.el.closest(paneSel)
      const flat = target.kind === 'item' && !target.across && !inPane && getComputedStyle(target.el).backgroundColor === 'rgba(0, 0, 0, 0)'
      const padX = flat ? ITEM_PAD : pad
      const r = new DOMRect(box.left - padX, box.top - pad, box.width + padX * 2, box.height + pad * 2)
      setRing((p) => (p && p.x === r.left && p.y === r.top && p.w === r.width && p.h === r.height ? p : { x: r.left, y: r.top, w: r.width, h: r.height }))
      // 부품 장의 막대(FloatTools)와 같이, 가리는 글과 장 위아래 여백까지 보고 자리를 고른다. 위에 자리만 있으면 늘 위로
      // 가서 윗줄 항목에 적은 글을 가렸고, 장 맨 위 항목은 아래로 내려가 다음 항목의 빈칸을 덮어 누를 수 없었다(마지막 장의 요청)
      const slideEl = target.el.closest('.slide')
      const key = `${r.left},${r.top},${r.width},${r.height}`
      if (texts.current.key !== key) texts.current = { key, rects: contentRects(slideEl, canvasRef.current) }
      const { x, y } = barSpot(r, barRef.current, canvasRef.current, texts.current.rects, slideEl?.getBoundingClientRect())
      setBar((p) => (p && p.x === x && p.y === y ? p : { x, y }))
      return moving(target.el)
    },
  )

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
            title={on ? `${highlight.label} 끄기` : `이 ${josa(spec.items.label, '을', '를')} ${highlight.label}`}
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
          title={n >= spec.items.max ? `${josa(spec.items.label, '은', '는')} ${spec.items.max}개까지예요` : '복제'}
          aria-label="복제"
          disabled={n >= spec.items.max}
          onClick={() => store.duplicateItem(slide.id, i)}
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          className="sel-btn"
          title={n <= spec.items.min ? `${josa(spec.items.label, '은', '는')} ${spec.items.min}개 아래로 줄일 수 없어요` : '이 항목 빼기'}
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
                // 누르기를 막으면 초점이 쓰던 칸에 남아서, 끌어 옮긴 뒤 누른 Ctrl+Z가 옮긴 것이 아니라 칸의 글로 갔다
                e.currentTarget.focus({ preventScroll: true })
                setDragging(true)
                const session = startSession()
                session.on(
                  'pointerup',
                  () => {
                    setDragging(false)
                    session.end()
                  },
                  true,
                )
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
      // 쓰던 칸에 초점을 두지 않는다: 자리를 옮긴 뒤 누른 Ctrl+Z가 칸의 글로 갔다 (항목 이름표와 같다)
      e.currentTarget.focus({ preventScroll: true })
      const from = current
      const key = gestureKey(`place:${slide.id}`)
      let at = from
      const rectOf = () => {
        const r = box.getBoundingClientRect()
        return { x: r.left, y: r.top, w: r.width, h: r.height }
      }
      setPlacing({ rect: rectOf(), at })
      const session = startSession('is-placing')
      const stop = (cancel: boolean) => {
        session.end()
        if (cancel && at !== from) setPlace(from, key)
        setPlacing(null)
      }
      session.on('pointermove', (ev) => {
        const r = rectOf()
        const next = placeAt((ev.clientY - r.y) / r.h)
        if (next !== at) {
          at = next
          setPlace(next, key)
        }
        setPlacing({ rect: r, at })
      })
      session.on('pointerup', () => stop(false))
      session.on(
        'keydown',
        (ev) => {
          if (ev.key !== 'Escape') return
          ev.preventDefault()
          ev.stopPropagation()
          stop(true)
        },
        true,
      )
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
      // 모양과 좌우는 되돌리기 한 단계로 (판을 끌어 옮길 때와 같이, panes.tsx): 따로 남기면 옆으로 세운 것이 두 단계라
      // Ctrl+Z 한 번에 아래 띠로 돌아오지 않았다
      const key = gestureKey('pane.place')
      if (p.variant !== undefined && p.variant !== variantOf(slide)) store.setVariant(slide.id, p.variant, key)
      if (p.flip !== !!slide.options.flip) store.setOptions(slide.id, { flip: p.flip || undefined }, key)
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
          <button type="button" className="sel-btn has-t" title={zone === 'below' ? '옆으로 세우기' : '장 아래에 띠로 깔기'} onClick={() => place(zone === 'below' ? sideZone(slide) : 'below')}>
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
              // 쓰던 칸에 초점을 두지 않는다: 판을 옮긴 뒤 누른 Ctrl+Z가 칸의 글로 갔다 (항목 이름표와 같다)
              e.currentTarget.focus({ preventScroll: true })
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
