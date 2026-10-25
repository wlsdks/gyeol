import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { pageInfo } from '../deck/fields'
import type { Deck } from '../deck/types'
import { cx } from '../lib/cx'
import { presentAction, presentKey } from '../lib/presentKeys'
import { motionOf, transitionOf } from '../deck/themes'
import { motionEngine, type MotionPlay } from '../motion/engine'
import { presentChannel, type Blank, type PresentMessage } from '../present/link'
import { FitSlide, pageProps, SlideCanvas } from '../slides/SlideCanvas'

/** 발표를 시작할 장. 발표에서 뺀 장을 골랐으면 그 뒤의 첫 장부터 (뒤에 없으면 바로 앞 장) */
export function startIndex(deck: Deck, shown: Deck['slides'], startId?: string): number {
  const at = startId ? deck.slides.findIndex((s) => s.id === startId) : -1
  if (at < 0) return 0
  const from = deck.slides.slice(at).find((s) => !s.hidden) ?? deck.slides.slice(0, at).reverse().find((s) => !s.hidden)
  return Math.max(0, shown.findIndex((s) => s.id === from?.id))
}

/**
 * 전체 화면 발표. 클리커가 보내는 PageUp/PageDown도 받는다.
 * 발표자 화면(Presenter)이 열려 있으면 같이 움직인다. 어느 창에서 넘겨도 된다.
 */
export function Present({ deck, startId, onExit }: { deck: Deck; startId?: string; onExit: () => void }) {
  const slides = useMemo(() => deck.slides.filter((s) => !s.hidden), [deck.slides])
  const info = pageInfo(deck.slides)
  const engine = useMemo(() => motionEngine(), [])
  // play: 이 장을 움직일지 (앞으로 넘겨 온 장). 움직임이 없는 장도 엔진에 맡긴다: '누르면' 나오는 컴포넌트는 누를 때까지 감춘다
  const [view, setView] = useState(() => ({ index: startIndex(deck, slides, startId), play: true }))
  /** 지금 장의 움직임. 누르면 나오는 컴포넌트가 남았으면 다음 키에 그것부터 보인다 */
  const playing = useRef<MotionPlay | null>(null)
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
    (next: number) => {
      const to = Math.max(0, Math.min(slides.length - 1, next))
      const from = now.current.index
      if (to === from) return
      const dir = to > from ? 1 : -1
      // 앞으로 넘길 때만 움직인다. 이전 장으로 돌아가면 다 보인 상태로 (PowerPoint와 같게).
      // 전환은 넘어가는 장에 정한 것 (앞으로 가든 뒤로 가든 그 두 장 사이의 전환이 같게, 뒤로 갈 때는 떠나는 장의 것)
      const transition = transitionOf(deck, slides[dir > 0 ? to : from])
      engine.swap(
        () => {
          flushSync(() => setView({ index: to, play: dir > 0 }))
          // 새 장이 그려지고 움직임이 걸린 뒤에 알린다: 남은 차례 수는 그 장의 움직임이 정한다.
          // 발표자 화면에서 넘긴 것도 알린다. 발표자 화면은 이 수를 모른다
          link.current?.post({ type: 'state', index: to, blank: now.current.blank, left: playing.current?.left() ?? 0 })
        },
        transition,
        dir,
      )
    },
    [slides, deck, engine],
  )

  /** 다음으로: '누르면' 나오는 컴포넌트가 남았으면 그것을, 아니면 다음 장 */
  const forward = useCallback(() => {
    if (playing.current?.next()) {
      // 발표자 화면에서 눌렀어도 알린다: 남은 차례는 이 창만 안다
      link.current?.post({ type: 'state', index: now.current.index, blank: now.current.blank, left: playing.current.left() })
      return
    }
    goTo(now.current.index + 1)
  }, [goTo])

  const setBlank = useCallback((next: Blank, fromLink = false) => {
    setBlankState(next)
    if (!fromLink) link.current?.post({ type: 'state', index: now.current.index, blank: next, left: playing.current?.left() ?? 0 })
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
      link.current?.post({ type: 'deck', deck, index: now.current.index, blank: now.current.blank, startedAt: startedAt.current, left: playing.current?.left() ?? 0 })
    } else if (m.type === 'go') {
      // 발표자 화면에서 다음으로 넘기면 여기서처럼 '누르면' 나오는 컴포넌트부터
      if (m.index === now.current.index + 1) forward()
      else goTo(m.index)
    }
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
      // 발표를 시작한 F5(Shift+F5)를 발표 중에 또 누르면 브라우저가 페이지를 새로 고쳐 발표가 끊긴다
      if (e.key === 'F5') {
        e.preventDefault()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const { index, blank: b } = now.current
      const act = presentAction(presentKey(e), b, index, slides.length - 1)
      if (!act) return
      e.preventDefault()
      if (act.kind === 'blank') setBlank(act.blank)
      else if (act.kind === 'go' && act.index === index + 1) forward()
      else if (act.kind === 'go') goTo(act.index)
      else exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, forward, exit, setBlank, slides.length])

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
    if (!ready || !view.play || !stageRef.current) return
    const p = engine.play(stageRef.current, level)
    playing.current = p
    return () => {
      playing.current = null
      p()
    }
  }, [view, ready, engine, level])

  const slide = slides[view.index]
  if (!slide) return null

  return (
    <div
      className={cx('present', idle && 'is-idle')}
      onMouseMove={wake}
      onClick={(e) => (blank ? setBlank(null) : e.clientX < window.innerWidth * 0.3 ? goTo(view.index - 1) : forward())}
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
