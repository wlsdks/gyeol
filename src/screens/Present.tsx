import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { pageInfo } from '../deck/fields'
import type { Deck } from '../deck/types'
import { cx } from '../lib/cx'
import { motionOf, transitionOf } from '../deck/themes'
import { motionEngine } from '../motion/engine'
import { presentChannel, type Blank, type PresentMessage } from '../present/link'
import { FitSlide, pageProps, SlideCanvas } from '../slides/SlideCanvas'

export const NEXT_KEYS = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n']
export const PREV_KEYS = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p']
/** PowerPoint처럼 B나 .은 검은 화면, W나 ,는 흰 화면. 클리커의 '화면 가리기' 단추도 이 키를 보낸다. */
export const BLANK_KEYS: Record<string, 'black' | 'white'> = { b: 'black', B: 'black', '.': 'black', w: 'white', W: 'white', ',': 'white' }

/**
 * 전체 화면 발표. 클리커가 보내는 PageUp/PageDown도 받는다.
 * 발표자 화면(Presenter)이 열려 있으면 같이 움직인다. 어느 창에서 넘겨도 된다.
 */
export function Present({ deck, startId, onExit }: { deck: Deck; startId?: string; onExit: () => void }) {
  const slides = useMemo(() => deck.slides.filter((s) => !s.hidden), [deck.slides])
  const info = pageInfo(deck.slides)
  const transition = transitionOf(deck)
  const engine = useMemo(() => motionEngine(), [])
  const [view, setView] = useState(() => {
    const index = Math.max(0, slides.findIndex((s) => s.id === startId))
    return { index, play: motionOf(deck, slides[index]) !== 'none' }
  })
  const [idle, setIdle] = useState(false)
  const [blank, setBlankState] = useState<Blank>(null)
  const idleTimer = useRef(0)
  const stageRef = useRef<HTMLDivElement | null>(null)
  // FitSlide는 크기를 잰 다음에야 슬라이드를 그린다. 첫 장도 움직이도록 붙는 때를 알아 둔다.
  const [ready, setReady] = useState(false)
  const attachStage = useCallback((el: HTMLDivElement | null) => {
    stageRef.current = el
    if (el) setReady(true)
  }, [])
  const startedAt = useRef(Date.now())
  const now = useRef({ index: view.index, blank })
  now.current = { index: view.index, blank }
  const link = useRef<ReturnType<typeof presentChannel> | null>(null)

  const goTo = useCallback(
    (next: number, fromLink = false) => {
      const to = Math.max(0, Math.min(slides.length - 1, next))
      const from = now.current.index
      if (to === from) return
      const dir = to > from ? 1 : -1
      // 앞으로 넘길 때만 움직인다. 이전 장으로 돌아가면 다 보인 상태로 (PowerPoint와 같게).
      const play = motionOf(deck, slides[to]) !== 'none' && dir > 0
      engine.swap(() => flushSync(() => setView({ index: to, play })), transition, dir)
      if (!fromLink) link.current?.post({ type: 'state', index: to, blank: now.current.blank })
    },
    [slides, deck, engine, transition],
  )

  const setBlank = useCallback((next: Blank, fromLink = false) => {
    setBlankState(next)
    if (!fromLink) link.current?.post({ type: 'state', index: now.current.index, blank: next })
  }, [])

  const exit = useCallback(
    (fromLink = false) => {
      if (!fromLink) link.current?.post({ type: 'end' })
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
      onExit()
    },
    [onExit],
  )

  // 발표자 화면과 잇기
  const handlers = useRef<(m: PresentMessage) => void>(() => {})
  handlers.current = (m) => {
    if (m.type === 'hello') {
      link.current?.post({ type: 'deck', deck, index: now.current.index, blank: now.current.blank, startedAt: startedAt.current })
    } else if (m.type === 'go') goTo(m.index, true)
    else if (m.type === 'blank') setBlank(m.blank, true)
    else if (m.type === 'end') exit(true)
  }
  useEffect(() => {
    const l = presentChannel(deck.id, (m) => handlers.current(m))
    link.current = l
    return () => {
      link.current = null
      l.close()
    }
  }, [deck.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const nextBlank = BLANK_KEYS[e.key]
      const { index, blank: b } = now.current
      if (nextBlank) {
        setBlank(b === nextBlank ? null : nextBlank)
        e.preventDefault()
        return
      }
      // 가린 화면에서는 아무 키나 누르면 넘기지 않고 그 장으로 돌아온다
      if (b && e.key !== 'Escape') {
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
  }, [goTo, exit, setBlank, slides.length])

  // 전체 화면을 Esc로 빠져나오면 발표도 끝낸다
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) exit()
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [exit])

  const wake = () => {
    setIdle(false)
    window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => setIdle(true), 2200)
  }
  useEffect(() => {
    wake()
    return () => window.clearTimeout(idleTimer.current)
  }, [])

  // 장이 화면에 붙자마자(그리기 전에) 움직임을 건다. 그래야 다 보인 모습이 한 번 번쩍이지 않는다.
  const level = motionOf(deck, slides[view.index])
  useLayoutEffect(() => {
    if (!ready || !view.play || !stageRef.current || level === 'none') return
    return engine.play(stageRef.current, level)
  }, [view, ready, engine, level])

  const slide = slides[view.index]
  if (!slide) return null

  return (
    <div
      className={cx('present', idle && 'is-idle')}
      onMouseMove={wake}
      onClick={(e) => (blank ? setBlank(null) : goTo(e.clientX < window.innerWidth * 0.3 ? view.index - 1 : view.index + 1))}
    >
      <FitSlide className="present-stage">
        <div key={slide.id} ref={attachStage} className="present-slide">
          <SlideCanvas deck={deck} slide={slide} mode="final" {...pageProps(info, slide.id)} />
        </div>
      </FitSlide>
      {blank && <div className={cx('present-blank', `is-${blank}`)} />}
      <div className="present-bar" onClick={(e) => e.stopPropagation()}>
        <span className="present-count">
          {view.index + 1} / {slides.length}
        </span>
        <button type="button" className="present-exit" onClick={() => exit()}>
          발표 끝내기
        </button>
      </div>
    </div>
  )
}
