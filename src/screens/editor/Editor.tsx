import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { deckMissingCount, missingFields, pageInfo, visibleItems, type Missing } from '../../deck/fields'
import { LAYOUTS } from '../../deck/layouts'
import type { Deck, Slide } from '../../deck/types'
import { downloadHtml } from '../../export/exportHtml'
import { cx } from '../../lib/cx'
import { go } from '../../lib/router'
import type { SlideActions } from '../../slides/context'
import { FitSlide, SlideCanvas } from '../../slides/SlideCanvas'
import { useDeck, useSelectedSlide } from '../../store/deckStore'
import { loadDeck, saveDeck } from '../../store/library'
import { Present } from '../Present'
import { BackIcon, CheckIcon, CopyIcon, EyeIcon, EyeOffIcon, Modal, PlayIcon, PlusIcon, RedoIcon, TrashIcon, UndoIcon, useToast } from '../ui'
import { ExportMenu, ThemeMenu } from './DeckMenus'
import { Inspector } from './Inspector'
import { OutlineView } from './OutlineView'
import { SlideList } from './SlideList'

type SaveState = 'saved' | 'saving' | 'failed'

export function Editor({ id }: { id: string }) {
  const deck = useDeck((s) => s.deck)
  const open = useDeck((s) => s.open)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (useDeck.getState().deck?.id === id) return
    loadDeck(id).then((d) => (d ? open(d) : setNotFound(true)))
  }, [id, open])

  if (notFound) {
    return (
      <div className="center-msg">
        <p>이 발표를 찾을 수 없어요. 다른 브라우저에서 만들었거나 지운 발표일 수 있어요.</p>
        <button type="button" className="btn btn-primary" onClick={() => go({ name: 'home' })}>
          내 발표로 가기
        </button>
      </div>
    )
  }
  if (!deck || deck.id !== id) return <div className="center-msg">불러오는 중</div>
  return <EditorBody deck={deck} />
}

function useAutosave(deck: Deck): SaveState {
  const [state, setState] = useState<SaveState>('saved')
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setState('saving')
    const t = window.setTimeout(async () => setState((await saveDeck(deck)) ? 'saved' : 'failed'), 400)
    return () => window.clearTimeout(t)
  }, [deck])
  return state
}

function EditorBody({ deck }: { deck: Deck }) {
  const slide = useSelectedSlide() ?? deck.slides[0]
  const store = useDeck()
  const saveState = useAutosave(deck)
  const [view, setView] = useState<'slides' | 'doc'>('slides')
  const [presenting, setPresenting] = useState<{ startId?: string } | null>(null)
  const [confirmPresent, setConfirmPresent] = useState<{ startId?: string; missing: number } | null>(null)
  const [printing, setPrinting] = useState(false)
  const toast = useToast()

  const startPresent = useCallback(
    (startId?: string, force = false) => {
      const missing = deckMissingCount(deck)
      if (missing > 0 && !force) {
        setConfirmPresent({ startId, missing })
        return
      }
      setConfirmPresent(null)
      document.documentElement.requestFullscreen?.().catch(() => {})
      setPresenting({ startId })
    },
    [deck],
  )

  const focusFirstMissing = () => {
    setConfirmPresent(null)
    const target = deck.slides.find((s) => !s.hidden && missingFields(s, deck.meta).length > 0)
    if (!target) return
    setView('slides')
    store.select(target.id)
    const m = missingFields(target, deck.meta)[0]
    window.setTimeout(() => focusField(target.id, m), 60)
  }

  // 단축키: 되돌리기, F5로 발표 (PowerPoint와 같게)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (presenting) return
      const typing = (e.target as HTMLElement).closest?.('input, textarea, [contenteditable]')
      const mod = e.metaKey || e.ctrlKey
      if (e.key === 'F5') {
        e.preventDefault()
        startPresent(e.shiftKey ? slide?.id : undefined)
        return
      }
      if (typing) return
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) store.redo()
        else store.undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        store.redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [presenting, startPresent, slide?.id, store])

  const exportHtml = async () => {
    toast.show('발표 파일을 만들고 있어요')
    try {
      await downloadHtml(deck)
      toast.show('발표 파일을 저장했어요. 다운로드 폴더를 확인해 주세요.')
    } catch {
      toast.show('발표 파일을 만들지 못했어요. 다시 시도해 주세요.')
    }
  }

  const removeSlide = (s: Slide) => {
    store.removeSlide(s.id)
    toast.show('장을 지웠어요', { label: '되돌리기', run: () => useDeck.getState().undo() })
  }

  if (presenting) return <Present deck={deck} startId={presenting.startId} onExit={() => setPresenting(null)} />

  return (
    <div className="ed-app">
      <header className="ed-top">
        <div className="ed-top-l">
          <button type="button" className="icon-btn" aria-label="내 발표로" title="내 발표로" onClick={() => go({ name: 'home' })}>
            <BackIcon />
          </button>
          <input
            className="ed-title"
            value={deck.title}
            aria-label="발표 이름"
            onChange={(e) => store.setTitle(e.target.value)}
            onBlur={(e) => !e.target.value.trim() && store.setTitle('제목 없는 발표')}
          />
          <SaveBadge state={saveState} />
        </div>

        <div className="seg ed-view" role="group" aria-label="보기">
          <button type="button" className={cx('seg-btn', view === 'slides' && 'is-on')} aria-pressed={view === 'slides'} onClick={() => setView('slides')}>
            슬라이드
          </button>
          <button type="button" className={cx('seg-btn', view === 'doc' && 'is-on')} aria-pressed={view === 'doc'} onClick={() => setView('doc')}>
            문서
          </button>
        </div>

        <div className="ed-top-r">
          <button type="button" className="icon-btn" aria-label="되돌리기" title="되돌리기 (⌘Z)" disabled={!store.past.length} onClick={store.undo}>
            <UndoIcon />
          </button>
          <button type="button" className="icon-btn" aria-label="다시 하기" title="다시 하기 (⇧⌘Z)" disabled={!store.future.length} onClick={store.redo}>
            <RedoIcon />
          </button>
          <ThemeMenu deck={deck} />
          <ExportMenu onHtml={exportHtml} onPdf={() => setPrinting(true)} />
          <button type="button" className="btn btn-primary" title="처음부터 발표 (F5)" onClick={() => startPresent()}>
            <PlayIcon />
            발표하기
          </button>
        </div>
      </header>

      <div className={cx('ed-body', view === 'doc' && 'is-doc')}>
        <SlideList deck={deck} selectedId={slide?.id ?? null} />
        {view === 'slides' && slide ? (
          <>
            <SlideStage deck={deck} slide={slide} onRemove={removeSlide} onPresentHere={() => startPresent(slide.id)} />
            <Inspector deck={deck} slide={slide} onFocusField={(m) => focusField(slide.id, m)} />
          </>
        ) : (
          <OutlineView
            deck={deck}
            onOpenSlide={(sid) => {
              store.select(sid)
              setView('slides')
            }}
          />
        )}
      </div>

      {confirmPresent && (
        <Modal
          title={`빈칸이 ${confirmPresent.missing}곳 남았어요`}
          onClose={() => setConfirmPresent(null)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={focusFirstMissing}>
                빈칸 채우기
              </button>
              <button type="button" className="btn btn-primary" data-autofocus onClick={() => startPresent(confirmPresent.startId, true)}>
                그대로 발표하기
              </button>
            </>
          }
        >
          <p>빈칸은 발표 화면에서 보이지 않아요. 그래도 발표할까요?</p>
        </Modal>
      )}
      {printing && <PrintDeck deck={deck} onDone={() => setPrinting(false)} />}
      {toast.node}
    </div>
  )
}

function focusField(slideId: string, m: Missing) {
  const key = m.item !== undefined ? `${m.item}.${m.key}` : m.key
  const inCanvas = document.querySelector<HTMLElement>(`.ed-canvas [data-field="${CSS.escape(key)}"]`)
  const inDoc = document.querySelector<HTMLElement>(`[data-doc-field="${CSS.escape(`${slideId}:${key}`)}"]`)
  const el = inCanvas ?? inDoc
  if (!el) return
  el.focus()
  el.scrollIntoView({ block: 'nearest' })
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === 'failed') return <span className="save is-failed">저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.</span>
  return (
    <span className="save" aria-live="polite">
      {state === 'saving' ? (
        '저장 중'
      ) : (
        <>
          <CheckIcon />
          이 브라우저에 저장됨
        </>
      )}
    </span>
  )
}

function SlideStage({ deck, slide, onRemove, onPresentHere }: { deck: Deck; slide: Slide; onRemove: (s: Slide) => void; onPresentHere: () => void }) {
  const store = useDeck()
  const info = pageInfo(deck.slides)
  const spec = LAYOUTS[slide.layout]
  const canvasRef = useRef<HTMLDivElement>(null)
  const overflow = useOverflow(canvasRef, slide)

  const actions = useMemo<SlideActions>(
    () => ({
      setField: (key, value) => useDeck.getState().setField(slide.id, key, value),
      setItem: (index, key, value) => useDeck.getState().setItem(slide.id, index, key, value),
      removeItem: (index) => useDeck.getState().removeItem(slide.id, index),
    }),
    [slide.id],
  )
  const look = useMemo(() => ({ meta: deck.meta, theme: deck.theme, title: deck.title }), [deck.meta, deck.theme, deck.title])
  const canAddItem = !!spec.items && visibleItems(slide).length < spec.items.max

  return (
    <main className="stage">
      <div className="ed-canvas" ref={canvasRef}>
        <FitSlide
          padding={4}
          belowHeight={56}
          below={
            <div className="stage-tools">
              <div className="stage-tools-l">
                {spec.items && (
                  <button type="button" className="btn btn-ghost btn-sm" disabled={!canAddItem} onClick={() => store.addItem(slide.id)}>
                    <PlusIcon />
                    {spec.items.label} 추가
                  </button>
                )}
                {overflow && (
                  <p className="stage-warn" role="status" title="글을 줄이거나 오른쪽에서 레이아웃을 바꿔 보세요.">
                    글이 슬라이드 밖으로 넘쳤어요. 글을 줄이거나 레이아웃을 바꿔 보세요.
                  </p>
                )}
              </div>
              <div className="stage-tools-r">
                <button type="button" className="btn btn-ghost btn-sm" onClick={onPresentHere}>
                  <PlayIcon />
                  여기서부터 발표
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => store.duplicateSlide(slide.id)}>
                  <CopyIcon />
                  복제
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => store.setHidden(slide.id, !slide.hidden)}>
                  {slide.hidden ? <EyeIcon /> : <EyeOffIcon />}
                  {slide.hidden ? '발표에 다시 넣기' : '발표에서 빼기'}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={deck.slides.length <= 1} onClick={() => onRemove(slide)}>
                  <TrashIcon />
                  지우기
                </button>
              </div>
            </div>
          }
        >
          <SlideCanvas
            deck={look}
            slide={slide}
            mode="edit"
            actions={actions}
            page={info.page.get(slide.id)}
            total={info.total}
            sectionNumber={info.section.get(slide.id)}
          />
        </FitSlide>
      </div>

      <label className="notes">
        <span className="notes-label">발표자 노트</span>
        <textarea
          className="notes-input"
          value={slide.notes}
          placeholder="발표할 때 말할 내용을 적어 두세요. 발표 화면과 내보낸 파일에는 보이지 않아요."
          onChange={(e) => store.setNotes(slide.id, e.target.value)}
        />
      </label>
    </main>
  )
}

/** 슬라이드 안의 글이 영역을 넘치는지 확인한다 */
function useOverflow(ref: React.RefObject<HTMLDivElement | null>, slide: Slide): boolean {
  const [overflow, setOverflow] = useState(false)
  useLayoutEffect(() => {
    const root = ref.current?.querySelector<HTMLElement>('.slide')
    if (!root) return
    const check = () => {
      const boxes = [root, ...root.querySelectorAll<HTMLElement>('.s-body, .ix-text, .cs-main, .cs-side, .cl-main, .cv-main, .ag')]
      // 항목 빼기 버튼이 칸 오른쪽으로 살짝 나와 있어서, 가로 넘침은 슬라이드 전체만 본다.
      setOverflow(
        root.scrollWidth - root.clientWidth > 4 || boxes.some((el) => el.scrollHeight - el.clientHeight > 4),
      )
    }
    check()
    document.fonts?.ready.then(check)
  }, [ref, slide])
  return overflow
}

function PrintDeck({ deck, onDone }: { deck: Deck; onDone: () => void }) {
  const info = pageInfo(deck.slides)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    let cancelled = false
    let done = false
    const finish = () => {
      if (done) return
      done = true
      doneRef.current()
    }
    window.addEventListener('afterprint', finish)
    const run = async () => {
      await document.fonts?.ready
      await Promise.all([...document.querySelectorAll<HTMLImageElement>('.print-root img')].map((img) => img.decode().catch(() => {})))
      if (cancelled) return
      window.print()
      // 일부 브라우저는 afterprint를 보내지 않는다
      window.setTimeout(finish, 1000)
    }
    run()
    return () => {
      cancelled = true
      window.removeEventListener('afterprint', finish)
    }
  }, [])

  return createPortal(
    <div className="print-root">
      {deck.slides
        .filter((s) => !s.hidden)
        .map((s) => (
          <div key={s.id} className="print-page">
            <SlideCanvas deck={deck} slide={s} mode="final" page={info.page.get(s.id)} total={info.total} sectionNumber={info.section.get(s.id)} />
          </div>
        ))}
    </div>,
    document.body,
  )
}
