import { useCallback, useEffect, useRef, useState } from 'react'
import { pageInfo } from '../deck/fields'
import type { Deck } from '../deck/types'
import { cx } from '../lib/cx'
import { FitSlide, SlideCanvas } from '../slides/SlideCanvas'

const NEXT_KEYS = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n']
const PREV_KEYS = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p']

/** 전체 화면 발표. 클리커가 보내는 PageUp/PageDown도 받는다. */
export function Present({ deck, startId, onExit }: { deck: Deck; startId?: string; onExit: () => void }) {
  const slides = deck.slides.filter((s) => !s.hidden)
  const info = pageInfo(deck.slides)
  const [index, setIndex] = useState(() => Math.max(0, slides.findIndex((s) => s.id === startId)))
  const [dir, setDir] = useState<1 | -1>(1)
  const [idle, setIdle] = useState(false)
  const idleTimer = useRef(0)

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, next))
      setIndex((cur) => {
        if (clamped !== cur) setDir(clamped > cur ? 1 : -1)
        return clamped
      })
    },
    [slides.length],
  )

  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    onExit()
  }, [onExit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (NEXT_KEYS.includes(e.key)) goTo(index + 1)
      else if (PREV_KEYS.includes(e.key)) goTo(index - 1)
      else if (e.key === 'Home') goTo(0)
      else if (e.key === 'End') goTo(slides.length - 1)
      else if (e.key === 'Escape') exit()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, goTo, exit, slides.length])

  // 전체 화면을 Esc로 빠져나오면 발표도 끝낸다
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) onExit()
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [onExit])

  const wake = () => {
    setIdle(false)
    window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => setIdle(true), 2200)
  }
  useEffect(() => {
    wake()
    return () => window.clearTimeout(idleTimer.current)
  }, [])

  const slide = slides[index]
  if (!slide) return null

  return (
    <div
      className={cx('present', idle && 'is-idle')}
      onMouseMove={wake}
      onClick={(e) => goTo(e.clientX < window.innerWidth * 0.3 ? index - 1 : index + 1)}
    >
      <FitSlide className="present-stage">
        <div key={slide.id} className={cx('present-slide', dir > 0 ? 'from-right' : 'from-left')}>
          <SlideCanvas
            deck={deck}
            slide={slide}
            mode="final"
            page={info.page.get(slide.id)}
            total={info.total}
            sectionNumber={info.section.get(slide.id)}
          />
        </div>
      </FitSlide>
      <div className="present-bar" onClick={(e) => e.stopPropagation()}>
        <span className="present-count">
          {index + 1} / {slides.length}
        </span>
        <button type="button" className="present-exit" onClick={exit}>
          발표 끝내기
        </button>
      </div>
    </div>
  )
}
