import { useCallback, useEffect, useRef, useState } from 'react'
import { pageInfo } from '../deck/fields'
import type { Deck } from '../deck/types'
import { cx } from '../lib/cx'
import { FitSlide, pageProps, SlideCanvas } from '../slides/SlideCanvas'

const NEXT_KEYS = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n']
const PREV_KEYS = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p']
/** PowerPoint처럼 B나 .은 검은 화면, W나 ,는 흰 화면. 클리커의 '화면 가리기' 단추도 이 키를 보낸다. */
const BLANK_KEYS: Record<string, 'black' | 'white'> = { b: 'black', B: 'black', '.': 'black', w: 'white', W: 'white', ',': 'white' }

/** 전체 화면 발표. 클리커가 보내는 PageUp/PageDown도 받는다. */
export function Present({ deck, startId, onExit }: { deck: Deck; startId?: string; onExit: () => void }) {
  const slides = deck.slides.filter((s) => !s.hidden)
  const info = pageInfo(deck.slides)
  const [index, setIndex] = useState(() => Math.max(0, slides.findIndex((s) => s.id === startId)))
  const [dir, setDir] = useState<1 | -1>(1)
  const [idle, setIdle] = useState(false)
  const [blank, setBlank] = useState<'black' | 'white' | null>(null)
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
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const nextBlank = BLANK_KEYS[e.key]
      if (nextBlank) {
        setBlank((b) => (b === nextBlank ? null : nextBlank))
        e.preventDefault()
        return
      }
      // 가린 화면에서는 아무 키나 누르면 넘기지 않고 그 장으로 돌아온다
      if (blank && e.key !== 'Escape') {
        setBlank(null)
        e.preventDefault()
        return
      }
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
  }, [index, goTo, exit, slides.length, blank])

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
      onClick={(e) => (blank ? setBlank(null) : goTo(e.clientX < window.innerWidth * 0.3 ? index - 1 : index + 1))}
    >
      <FitSlide className="present-stage">
        <div key={slide.id} className={cx('present-slide', dir > 0 ? 'from-right' : 'from-left')}>
          <SlideCanvas
            deck={deck}
            slide={slide}
            mode="final"
            {...pageProps(info, slide.id)}
          />
        </div>
      </FitSlide>
      {blank && <div className={cx('present-blank', `is-${blank}`)} />}
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
