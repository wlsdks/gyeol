import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { pageInfo } from '../deck/fields'
import type { Deck } from '../deck/types'
import { cx } from '../lib/cx'
import { isMac } from '../lib/keys'
import { hasSecondScreen, presentChannel, type Blank, type PresentMessage } from '../present/link'
import { FitSlide, pageProps, ScaledSlide, SlideCanvas } from '../slides/SlideCanvas'
import { BLANK_KEYS, NEXT_KEYS, PREV_KEYS } from './Present'

const NOTE_SIZES = [18, 21, 24, 28, 32, 38]
const NOTE_SIZE_KEY = 'html-maker:notes-size'

function readNoteSize(): number {
  try {
    const n = Number(localStorage.getItem(NOTE_SIZE_KEY))
    return NOTE_SIZES.includes(n) ? n : 24
  } catch {
    return 24
  }
}

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * 발표자 화면. 발표 화면(Present)이 연 창에서 뜬다.
 * 지금 장, 다음 장, 노트, 지난 시간을 보여 주고, 여기서 넘기면 발표 화면도 넘어간다.
 */
export function Presenter({ id }: { id: string }) {
  const [deck, setDeck] = useState<Deck | null>(null)
  const [index, setIndex] = useState(0)
  const [blank, setBlank] = useState<Blank>(null)
  const [ended, setEnded] = useState(false)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [paused, setPaused] = useState<number | null>(null)
  const [tick, setTick] = useState(() => Date.now())
  const [noteSize, setNoteSize] = useState(readNoteSize)
  const [extended, setExtended] = useState(hasSecondScreen)
  const link = useRef<ReturnType<typeof presentChannel> | null>(null)
  const now = useRef({ index, blank })
  now.current = { index, blank }

  useEffect(() => {
    document.title = '발표자 화면'
    const onMessage = (m: PresentMessage) => {
      if (m.type === 'deck') {
        setDeck(m.deck)
        setIndex(m.index)
        setBlank(m.blank)
        setStartedAt(m.startedAt)
      } else if (m.type === 'state') {
        setIndex(m.index)
        setBlank(m.blank)
      } else if (m.type === 'end') {
        setEnded(true)
        window.close()
      }
    }
    const l = presentChannel(id, onMessage)
    link.current = l
    l.post({ type: 'hello' })
    return () => {
      link.current = null
      l.close()
    }
  }, [id])

  // 발표 화면이 아직 안 떴으면 뜰 때까지 묻는다
  useEffect(() => {
    if (deck) return
    const t = window.setInterval(() => link.current?.post({ type: 'hello' }), 1000)
    return () => window.clearInterval(t)
  }, [deck])

  useEffect(() => {
    const t = window.setInterval(() => setTick(Date.now()), 500)
    return () => window.clearInterval(t)
  }, [])

  // 프로젝터를 꽂거나 '확장'으로 바꾸면 안내를 바로 고친다
  useEffect(() => {
    const s = screen as unknown as Partial<EventTarget>
    const on = () => setExtended(hasSecondScreen())
    s.addEventListener?.('change', on)
    return () => s.removeEventListener?.('change', on)
  }, [])

  const slides = useMemo(() => (deck ? deck.slides.filter((s) => !s.hidden) : []), [deck])

  const go = useCallback(
    (n: number) => {
      const to = Math.max(0, Math.min(slides.length - 1, n))
      if (to === now.current.index) return
      setIndex(to)
      link.current?.post({ type: 'go', index: to })
    },
    [slides.length],
  )

  const sendBlank = useCallback((b: Blank) => {
    setBlank(b)
    link.current?.post({ type: 'blank', blank: b })
  }, [])

  const end = useCallback(() => {
    link.current?.post({ type: 'end' })
    setEnded(true)
    window.close()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const { index: i, blank: b } = now.current
      const nextBlank = BLANK_KEYS[e.key]
      if (nextBlank) {
        sendBlank(b === nextBlank ? null : nextBlank)
        e.preventDefault()
        return
      }
      if (b && e.key !== 'Escape') {
        sendBlank(null)
        e.preventDefault()
        return
      }
      if (NEXT_KEYS.includes(e.key)) go(i + 1)
      else if (PREV_KEYS.includes(e.key)) go(i - 1)
      else if (e.key === 'Home') go(0)
      else if (e.key === 'End') go(slides.length - 1)
      else if (e.key === 'Escape') end()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, sendBlank, end, slides.length])

  const pickNoteSize = (dir: 1 | -1) => {
    const next = NOTE_SIZES[Math.max(0, Math.min(NOTE_SIZES.length - 1, NOTE_SIZES.indexOf(noteSize) + dir))]
    setNoteSize(next)
    try {
      localStorage.setItem(NOTE_SIZE_KEY, String(next))
    } catch {
      /* 저장이 안 돼도 이번 발표에서는 그대로 쓴다 */
    }
  }

  const stripRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    stripRef.current?.querySelector('.pv-thumb.is-on')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [index, deck])

  if (ended) {
    return (
      <div className="pv pv-wait">
        <p className="pv-wait-t">발표가 끝났어요</p>
        <p className="pv-wait-b">이 창은 닫아도 돼요.</p>
      </div>
    )
  }

  if (!deck) {
    return (
      <div className="pv pv-wait">
        <p className="pv-wait-t">발표 화면과 연결하고 있어요</p>
        <p className="pv-wait-b">편집 화면에서 발표를 시작하면 여기에 지금 장과 노트가 보여요.</p>
      </div>
    )
  }

  const info = pageInfo(deck.slides)
  const slide = slides[index]
  const next = slides[index + 1]
  const elapsed = (paused ?? tick) - startedAt
  const planned = deck.meta.duration * 60_000
  const left = planned - elapsed
  const ratio = planned ? Math.min(1, elapsed / planned) : 0
  const timeState = left < 0 ? 'over' : left < 60_000 ? 'soon' : 'ok'

  return (
    <div className="pv">
      <header className="pv-top">
        <h1 className="pv-title">{deck.title}</h1>
        <div className="pv-timer" role="timer" aria-label="지난 시간">
          <span className={cx('pv-elapsed', paused !== null && 'is-paused')}>{clock(elapsed)}</span>
          <span className={cx('pv-left', `is-${timeState}`)}>
            {left >= 0 ? `${Math.ceil(left / 60_000)}분 남음` : `${Math.ceil(-left / 60_000)}분 넘음`}
            <span className="pv-plan"> / 목표 {deck.meta.duration}분</span>
          </span>
          <button
            type="button"
            className="pv-btn pv-btn-sm"
            onClick={() => {
              if (paused === null) setPaused(Date.now())
              else {
                setStartedAt((s) => s + (Date.now() - paused))
                setPaused(null)
              }
            }}
          >
            {paused === null ? '멈춤' : '이어서'}
          </button>
          <button
            type="button"
            className="pv-btn pv-btn-sm"
            onClick={() => {
              setStartedAt(Date.now())
              setPaused(paused === null ? null : Date.now())
            }}
          >
            처음부터
          </button>
        </div>
        <span className="pv-clock">{new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' }).format(tick)}</span>
        <button type="button" className="pv-btn pv-btn-end" onClick={end}>
          발표 끝내기
        </button>
        <div className={cx('pv-progress', `is-${timeState}`)} style={{ ['--p' as string]: ratio }} aria-hidden="true" />
      </header>

      {!extended && (
        <p className="pv-hint" role="status">
          {isMac
            ? '화면이 하나만 연결돼 있어요. 시스템 설정 > 디스플레이에서 미러링을 끄면 발표 화면과 이 화면이 나뉘어요.'
            : '화면이 하나만 연결돼 있어요. Windows 키 + P를 눌러 ‘확장’을 고르면 발표 화면과 이 화면이 나뉘어요.'}
        </p>
      )}

      <main className="pv-main">
        <section className="pv-now" aria-label="지금 장">
          <FitSlide className="pv-now-stage">
            {slide && <SlideCanvas deck={deck} slide={slide} mode="final" {...pageProps(info, slide.id)} />}
          </FitSlide>
          {blank && <p className="pv-blanked">발표 화면을 {blank === 'black' ? '검게' : '하얗게'} 가렸어요. 아무 키나 누르면 다시 보여요.</p>}
          <div className="pv-controls">
            <button type="button" className="pv-btn" disabled={index === 0} onClick={() => go(index - 1)}>
              이전
            </button>
            <span className="pv-count">
              <b>{index + 1}</b> / {slides.length}
            </span>
            <button type="button" className="pv-btn pv-btn-primary" disabled={index >= slides.length - 1} onClick={() => go(index + 1)}>
              다음
            </button>
            <button
              type="button"
              className={cx('pv-btn', blank === 'black' && 'is-on')}
              aria-pressed={blank === 'black'}
              title="B 키"
              onClick={() => sendBlank(blank === 'black' ? null : 'black')}
            >
              화면 가리기
            </button>
          </div>
        </section>

        <aside className="pv-side">
          <section className="pv-next" aria-label="다음 장">
            <h2 className="pv-h">다음 장</h2>
            {next ? (
              <FitSlide className="pv-next-stage">
                <SlideCanvas deck={deck} slide={next} mode="final" {...pageProps(info, next.id)} />
              </FitSlide>
            ) : (
              <p className="pv-last">마지막 장이에요</p>
            )}
          </section>
          <section className="pv-notes" aria-label="발표자 노트">
            <div className="pv-notes-head">
              <h2 className="pv-h">발표자 노트</h2>
              <div className="pv-size" role="group" aria-label="노트 글자 크기">
                <button type="button" className="pv-btn pv-btn-sm" aria-label="노트 글자 작게" onClick={() => pickNoteSize(-1)}>
                  가−
                </button>
                <button type="button" className="pv-btn pv-btn-sm" aria-label="노트 글자 크게" onClick={() => pickNoteSize(1)}>
                  가+
                </button>
              </div>
            </div>
            <div className="pv-notes-body" style={{ fontSize: noteSize }}>
              {slide?.notes.trim() ? slide.notes : <span className="pv-notes-empty">이 장에는 노트가 없어요.</span>}
            </div>
          </section>
        </aside>
      </main>

      <ol className="pv-strip" ref={stripRef} aria-label="모든 장">
        {slides.map((s, i) => (
          <li key={s.id}>
            <button type="button" className={cx('pv-thumb', i === index && 'is-on')} aria-current={i === index} onClick={() => go(i)}>
              <ScaledSlide width={136}>
                <SlideCanvas deck={deck} slide={s} mode="final" {...pageProps(info, s.id)} />
              </ScaledSlide>
              <span>{i + 1}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
