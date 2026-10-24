import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { LAYOUTS, variantOf } from '../deck/layouts'
import { fontOf, isDarkLook, motionOf, themeStyle, toneOf, transitionOf } from '../deck/themes'
import type { PageInfo } from '../deck/fields'
import type { Deck, Slide } from '../deck/types'
import { cx } from '../lib/cx'
import { SlideContext, type SlideActions, type SlideMode } from './context'
import { useHalos } from './halos'
import { BOLD_LAYOUTS, LAYOUT_VIEWS } from './layouts'

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
  slide,
  mode,
  actions,
  page = 0,
  total = 0,
  sections = NO_SECTIONS,
  sectionIndex = -1,
  solo,
}: SlideCanvasProps) {
  const View = LAYOUT_VIEWS[slide.layout]
  const spec = LAYOUTS[slide.layout]
  const bold = BOLD_LAYOUTS.includes(slide.layout)
  const canRemoveItem = !!spec.items && slide.items.length > spec.items.min
  const density = deck.meta.method === 'send' ? 'd-read' : 'd-present'
  // 색 면 장(표지, 섹션, 마지막 장)은 이미 색이 정해져 있어 바탕을 바꾸지 않는다
  const tone = bold ? 'base' : toneOf(slide)
  const size = deck.theme.size === 'small' || deck.theme.size === 'large' ? `sz-${deck.theme.size}` : null
  const footer = deck.theme.footer ?? 'all'
  const ref = useRef<HTMLDivElement>(null)
  useHalos(ref, mode === 'edit')

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
          `tr-${transitionOf(deck)}`,
          `va-${variantOf(slide)}`,
          size,
          tone !== 'base' && `tone-${tone}`,
          isDarkLook(deck.theme, tone) && 'is-dark',
          solo && 'is-solo',
        )}
        style={solo ? { ...themeStyle(deck.theme, tone), width: solo.w, height: solo.h } : themeStyle(deck.theme, tone)}
      >
        <View />
        {!bold && !solo && page > 0 && footer !== 'none' && (
          <footer className="s-foot">
            {footer === 'page' ? (
              <span />
            ) : sections.length > 1 && sectionIndex >= 0 ? (
              <ol className="s-map">
                {sections.map((name, i) => (
                  <li key={i} className={cx(i === sectionIndex && 'is-on')}>
                    {name}
                    {/* 지금 단락 표시: 따로 둔 요소라 장을 넘길 때 다음 단락 자리로 미끄러져 간다(motion.css) */}
                    {i === sectionIndex && <span className="s-map-bar" aria-hidden="true" />}
                  </li>
                ))}
              </ol>
            ) : (
              <span className="s-deck">{deck.title}</span>
            )}
            <span className="s-page">
              {page}
              <span className="s-total"> / {total}</span>
            </span>
          </footer>
        )}
      </div>
    </SlideContext.Provider>
  )
})

/** 정해진 너비로 축소한 슬라이드 (목록, 미리보기) */
export function ScaledSlide({ width, children, className }: { width: number; children: ReactNode; className?: string }) {
  const scale = width / SLIDE_W
  return (
    <div className={cx('slide-frame', className)} style={{ width, height: (width * SLIDE_H) / SLIDE_W }}>
      <div className="slide-scale" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}

/** 부모 영역 안에 최대한 크게 맞추는 슬라이드. `below`는 슬라이드 바로 아래에 같은 너비로 붙는다. */
export function FitSlide({
  children,
  className,
  padding = 0,
  below,
  belowHeight = 0,
}: {
  children: ReactNode
  className?: string
  padding?: number
  below?: ReactNode
  belowHeight?: number
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
  const frame = (
    <div className="slide-frame" style={{ width: w, height: h }}>
      {/* --vs: 슬라이드 안의 편집 도구(부품 도구)가 축소와 상관없이 같은 크기로 보이게 */}
      <div className="slide-scale" style={{ transform: `scale(${scale})`, '--vs': scale } as CSSProperties}>
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
