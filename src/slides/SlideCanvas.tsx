import { memo, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { LAYOUTS } from '../deck/layouts'
import { themeStyle } from '../deck/themes'
import type { Deck, Slide } from '../deck/types'
import { cx } from '../lib/cx'
import { SlideContext, type SlideActions, type SlideMode } from './context'
import { BOLD_LAYOUTS, LAYOUT_VIEWS } from './layouts'

export const SLIDE_W = 1920
export const SLIDE_H = 1080

export interface SlideCanvasProps {
  deck: Pick<Deck, 'meta' | 'theme' | 'title'>
  slide: Slide
  mode: SlideMode
  actions?: SlideActions
  /** 화면에 보이는 장 기준 번호 (1부터). 0이면 표시하지 않는다. */
  page?: number
  total?: number
  sectionNumber?: number
}

/** 1920×1080 슬라이드 한 장. 크기 맞춤은 바깥 프레임이 한다. */
export const SlideCanvas = memo(function SlideCanvas({
  deck,
  slide,
  mode,
  actions,
  page = 0,
  total = 0,
  sectionNumber,
}: SlideCanvasProps) {
  const View = LAYOUT_VIEWS[slide.layout]
  const spec = LAYOUTS[slide.layout]
  const bold = BOLD_LAYOUTS.includes(slide.layout)
  const canRemoveItem = !!spec.items && slide.items.length > spec.items.min
  const density = deck.meta.method === 'send' ? 'd-read' : 'd-present'

  return (
    <SlideContext.Provider value={{ slide, meta: deck.meta, mode, actions, canRemoveItem, sectionNumber }}>
      <div
        className={cx('slide', `l-${slide.layout}`, `t-${deck.theme.id}`, density, bold && 'is-bold', `m-${mode}`)}
        style={themeStyle(deck.theme)}
      >
        <View />
        {!bold && page > 0 && (
          <footer className="s-foot">
            <span>{slide.section || deck.title}</span>
            <span className="s-page">
              {page} / {total}
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
      <div className="slide-scale" style={{ transform: `scale(${scale})` }}>
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
