import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { LAYOUTS, PANE_UNIT, panesOf, placeOf, sideOf, variantOf } from '../deck/layouts'
import { fontOf, footerOf, isDarkLook, motionOf, themeStyle, toneOf, transitionOf } from '../deck/themes'
import { presentable, type PageInfo } from '../deck/fields'
import { sceneOf } from '../deck/scenes'
import type { Deck, Slide } from '../deck/types'
import { cx } from '../lib/cx'
import { Compose } from './blocks'
import { fitBlocks } from './fitBlocks'
import { T } from './fields'
import { SlideContext, type SlideActions, type SlideMode } from './context'
import { useHalos } from './halos'
import { BOLD_LAYOUTS, LAYOUT_VIEWS } from './layouts'
import { PaneTools } from './panes'

export const SLIDE_W = 1920
export const SLIDE_H = 1080

export interface SlideCanvasProps {
  deck: Pick<Deck, 'meta' | 'theme' | 'title' | 'motion'>
  slide: Slide
  mode: SlideMode
  actions?: SlideActions
  /** 화면에 보이는 장 기준 번호 (1부터). 0이면 표시하지 않는다. */
  page?: number
  total?: number
  /** 발표의 단락 이름들과 이 장이 속한 단락 (0부터) */
  sections?: readonly string[]
  sectionIndex?: number
  /** 부품 하나만 이 크기(캔버스 px)로: 부품 고르기 카드, 끌고 있는 부품 */
  solo?: { w: number; h: number }
}

const NO_SECTIONS: readonly string[] = []

/** 덱 전체 정보에서 한 장에 필요한 쪽 번호와 단락 정보를 꺼낸다 */
export function pageProps(info: PageInfo, slideId: string) {
  return {
    page: info.page.get(slideId) ?? 0,
    total: info.total,
    sections: info.sections,
    sectionIndex: info.sectionOf.get(slideId) ?? -1,
  }
}

/** 단락 이름이 그대로면 같은 배열을 돌려준다. 축소 목록이 글자 하나 칠 때마다 다시 그려지지 않게. */
export function useStableSections(info: PageInfo): readonly string[] {
  const key = info.sections.join('\n')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => info.sections, [key])
}

/** 1920×1080 슬라이드 한 장. 크기 맞춤은 바깥 프레임이 한다. */
export const SlideCanvas = memo(function SlideCanvas({
  deck,
  slide: given,
  mode,
  actions,
  page = 0,
  total = 0,
  sections = NO_SECTIONS,
  sectionIndex = -1,
  solo,
}: SlideCanvasProps) {
  // 발표 모습(발표, 미리 보기, 내보낸 파일)에서는 하나도 채우지 않은 항목을 그리지 않는다
  const slide = useMemo(() => (mode === 'final' ? presentable(given) : given), [given, mode])
  const View = slide.layout === 'compose' ? Compose : LAYOUT_VIEWS[slide.layout]
  const spec = LAYOUTS[slide.layout]
  const bold = BOLD_LAYOUTS.includes(slide.layout)
  const canRemoveItem = !!spec.items && slide.items.length > spec.items.min
  const density = deck.meta.method === 'send' ? 'd-read' : 'd-present'
  // 표지, 단락 장, 마지막 장은 모양(색 면, 바탕)으로 면을 고르므로 장의 바탕은 바꾸지 않는다
  const tone = bold ? 'base' : toneOf(slide)
  const size = deck.theme.size === 'small' || deck.theme.size === 'large' ? `sz-${deck.theme.size}` : null
  const footer = footerOf(deck)
  // 아래 띠 한 줄: 왼쪽에 이 장의 출처(숫자 장), 오른쪽에 단락 지도와 쪽 번호. 예전에는 출처를 단락 지도 바로 위에
  // 따로 얹어서 작은 회색 글 두 줄이 왼쪽 아래에 쌓였다
  const source = spec.fields.some((f) => f.key === 'source')
  const mark = !bold && page > 0 && footer !== 'none'
  const ref = useRef<HTMLDivElement>(null)
  useHalos(ref, mode === 'edit')
  // 레이아웃 장의 채움(fitBlocks.ts의 fitLayout): 내용이 본문의 60%에 못 미치면 글자를 단계로 키우고 줄 사이를 넓힌다.
  // 부품 장은 판(BlockArea)이 맞춘다. 글꼴이 늦게 오면 그 전에 잰 값은 대신 쓴 글꼴의 것이라 한 번 더
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || given.layout === 'compose' || solo) return
    fitBlocks(el)
    // 글꼴을 받는 중일 때만 한 번 더. 맞추기가 글을 재면서 새로 쓸 글자의 글꼴 조각을 부르므로 그 뒤에 본다.
    // 예전에는 그릴 때마다 물어서, 글꼴이 다 왔어도 바로 이어서 한 번 더 맞췄고(그림마다 두 번) fonts.ready를 읽는 것만으로 스타일을 다시 계산했다
    if (document.fonts?.status !== 'loading') return
    let live = true
    document.fonts.ready.then(() => {
      if (live && ref.current) fitBlocks(ref.current)
    })
    return () => {
      live = false
    }
  })
  // 두 판으로 나뉜 장: 옆 판의 자리(왼쪽, 오른쪽)와 너비. 레이아웃 CSS가 --side-w를 쓴다
  // (편집할 때 너비가 부드럽게 바뀌도록 등록한 값이라 CSS의 기본값이 먹지 않는다. 판이 있는 장은 늘 적는다)
  const panes = panesOf(slide)
  const place = placeOf(slide)
  const side = sideOf(slide)
  const themed = themeStyle(deck.theme, tone)
  const style: CSSProperties = side !== null ? { ...themed, '--side-w': `${side * PANE_UNIT}px` } : themed

  return (
    <SlideContext.Provider value={{ slide, meta: deck.meta, mode, actions, canRemoveItem, sections, sectionIndex }}>
      <div
        ref={ref}
        className={cx(
          'slide',
          `l-${slide.layout}`,
          `t-${deck.theme.id}`,
          `f-${fontOf(deck.theme)}`,
          density,
          bold && 'is-bold',
          `m-${mode}`,
          // 움직임과 전환은 클래스로 남겨 내보낸 파일의 뷰어도 같은 값을 읽게 한다
          `mo-${motionOf(deck, slide)}`,
          `tr-${transitionOf(deck, slide)}`,
          `va-${variantOf(slide)}`,
          size,
          tone !== 'base' && `tone-${tone}`,
          isDarkLook(deck.theme, tone) && 'is-dark',
          solo && 'is-solo',
          panes && slide.options.flip && 'is-flip',
          // 제목 덩어리의 자리: 레이아웃 기본 자리면 붙이지 않는다
          place && place !== spec.place?.base && `pl-${place}`,
        )}
        style={solo ? { ...themed, width: solo.w, height: solo.h } : style}
        // 장면도 슬라이드에 남겨 내보낸 파일의 뷰어가 같은 컷으로 움직이게 한다. 지금 레이아웃에 맞을 때만(sceneOf)
        data-scene={sceneOf(slide) ?? undefined}
      >
        <View />
        {mode === 'edit' && spec.panes && !solo && <PaneTools />}
        {!solo && (source || mark) && (
          <footer className="s-foot">
            {source ? <T k="source" className="s-source" /> : <span />}
            {mark && (
              <div className="s-mark">
                {footer === 'page' ? null : sections.length > 1 && sectionIndex >= 0 ? (
                  <ol className="s-map">
                    {sections.map((name, i) => (
                      <li key={i} className={cx(i === sectionIndex && 'is-on')}>
                        {name}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <span className="s-deck">{deck.title}</span>
                )}
                {footer !== 'section' && (
                  <span className="s-page">
                    {page}
                    <span className="s-total"> / {total}</span>
                  </span>
                )}
              </div>
            )}
          </footer>
        )}
      </div>
    </SlideContext.Provider>
  )
})

/** 정해진 너비로 축소한 슬라이드 (목록, 미리보기) */
/**
 * 작게 줄인 슬라이드. decorative면 화면 읽기 프로그램에서 뺀다: 장 목록이나 장 고르기의 단추 안에 그대로 두면
 * 단추 이름이 장 안의 모든 글이 되어 '3번 장' 하나를 듣는 데 수십 줄을 들어야 했다. 이름은 단추가 따로 짧게 단다
 */
export function ScaledSlide({ width, children, className, decorative }: { width: number; children: ReactNode; className?: string; decorative?: boolean }) {
  const scale = width / SLIDE_W
  return (
    <div className={cx('slide-frame', className)} style={{ width, height: (width * SLIDE_H) / SLIDE_W }} aria-hidden={decorative || undefined}>
      <div className="slide-scale" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}

/** 장 틀 안에서 장을 키우거나 돌릴 때 걸리는 시간(ms). edit.css의 .is-zooming과 같다 */
export const ZOOM_MS = 300

/**
 * 키운 장을 장 틀 안에 둘 자리(화면 px의 translate). 점(x, y, 캔버스 px)을 틀 가운데에 두되, 장 끝이 틀 안으로 들어와 옆이 비지 않게 막는다.
 * S는 장의 배율(맞춘 배율 × z), w와 h는 장 틀의 크기
 */
export function zoomShift(zoom: { x: number; y: number }, S: number, w: number, h: number): { x: number; y: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  return { x: clamp(w / 2 - zoom.x * S, w - SLIDE_W * S, 0), y: clamp(h / 2 - zoom.y * S, h - SLIDE_H * S, 0) }
}

/** 부모 영역 안에 최대한 크게 맞추는 슬라이드. `below`는 슬라이드 바로 아래에 같은 너비로 붙는다. */
export function FitSlide({
  children,
  className,
  padding = 0,
  below,
  belowHeight = 0,
  zoom,
}: {
  children: ReactNode
  className?: string
  padding?: number
  below?: ReactNode
  belowHeight?: number
  /**
   * 장 틀 안에서 장을 키워 보일 때(편집기의 '쓸 때 크게 보기', screens/editor/zoom.ts): z배로 키우고 점 (x, y)(캔버스 px)를 틀 가운데에.
   * 틀의 크기와 자리는 그대로라 아래(below)는 움직이지 않는다
   */
  zoom?: { z: number; x: number; y: number } | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale = Math.max(0.05, Math.min((box.w - padding * 2) / SLIDE_W, (box.h - padding * 2 - belowHeight) / SLIDE_H))
  const w = SLIDE_W * scale
  const h = SLIDE_H * scale
  // 키운 배율과 자리. 늘 translate와 scale 둘을 같은 차례로 적는다: 바뀌는 동안(edit.css의 .is-zooming) 두 값이 따로 부드럽게 바뀌게
  const S = scale * (zoom?.z ?? 1)
  const at = zoom ? zoomShift(zoom, S, w, h) : { x: 0, y: 0 }
  // 확대가 바뀌는 동안만 움직임을 건다. 늘 걸어 두면 창 크기를 바꿀 때 장이 창을 늦게 따라온다
  const key = zoom ? `${zoom.z} ${zoom.x} ${zoom.y}` : ''
  const [glide, setGlide] = useState({ key, on: false })
  if (glide.key !== key) setGlide({ key, on: true })
  useEffect(() => {
    if (!glide.on) return
    const t = window.setTimeout(() => setGlide((g) => ({ ...g, on: false })), ZOOM_MS + 80)
    return () => window.clearTimeout(t)
  }, [glide])
  const frame = (
    <div className={cx('slide-frame', zoom && 'is-zoomed', glide.on && 'is-zooming')} style={{ width: w, height: h }}>
      {/* --vs: 슬라이드 안의 편집 도구(부품 도구)가 축소와 상관없이 같은 크기로 보이게 (키운 배율까지) */}
      <div className="slide-scale" style={{ transform: `translate(${at.x}px, ${at.y}px) scale(${S})`, '--vs': S }}>
        {children}
      </div>
    </div>
  )
  return (
    <div ref={ref} className={cx('fit-area', className)}>
      {box.w > 0 &&
        (below ? (
          <div className="fit-group" style={{ width: w }}>
            {frame}
            <div className="fit-below" style={{ height: belowHeight }}>
              {below}
            </div>
          </div>
        ) : (
          frame
        ))}
    </div>
  )
}
