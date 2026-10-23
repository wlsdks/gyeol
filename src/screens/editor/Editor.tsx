import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { deckMissingCount, missingFields, pageInfo, visibleItems, type Missing } from '../../deck/fields'
import { LAYOUTS, variantOf } from '../../deck/layouts'
import type { Deck, Slide } from '../../deck/types'
import { downloadHtml } from '../../export/exportHtml'
import { cx } from '../../lib/cx'
import { isMac, keys } from '../../lib/keys'
import { go } from '../../lib/router'
import type { SlideActions } from '../../slides/context'
import { countUp } from '../../slides/countUp'
import { FitSlide, pageProps, SlideCanvas } from '../../slides/SlideCanvas'
import { useDeck, useSelectedSlide } from '../../store/deckStore'
import { downloadDeckFile } from '../../store/deckFile'
import { loadBestDeck, saveToBrowser, saveToFolder } from '../../store/persist'
import { AUTO_INTERVAL, saveVersion, type VersionReason } from '../../store/versions'
import { Present } from '../Present'
import { BackIcon, CopyIcon, EyeIcon, EyeOffIcon, HistoryIcon, Modal, PlayIcon, PlusIcon, RedoIcon, ShapesIcon, TrashIcon, UndoIcon, useToast } from '../ui'
import { applyOps, type ChangeRequest } from '../../ai/ops'
import { useAiShare } from '../../ai/useAiShare'
import { AiInbox, AiMenu, AiReview } from './AiShare'
import { ExportMenu, PREVIEW_MOTION, ThemeMenu } from './DeckMenus'
import { Inspector } from './Inspector'
import { OutlineView } from './OutlineView'
import { SaveStatus } from './SaveStatus'
import { SlideList } from './SlideList'
import { VersionPanel } from './Versions'

export function Editor({ id }: { id: string }) {
  const deck = useDeck((s) => s.deck)
  const open = useDeck((s) => s.open)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (useDeck.getState().deck?.id === id) return
    loadBestDeck(id).then((d) => (d ? open(d) : setNotFound(true)))
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

/**
 * 고칠 때마다 저장한다. 브라우저에는 바로, 보관 폴더에는 조금 모아서.
 * 고치는 중에는 10분마다 자동 버전을 남긴다. 화면을 떠나거나 창을 닫을 때는 남은 저장을 바로 끝낸다.
 */
function useAutosave(deck: Deck) {
  const latest = useRef(deck)
  const dirty = useRef({ browser: false, folder: false })
  const lastVersionAt = useRef(Date.now())
  latest.current = deck

  const flush = useCallback(() => {
    const d = latest.current
    if (dirty.current.browser) {
      dirty.current.browser = false
      void saveToBrowser(d)
    }
    if (dirty.current.folder) {
      dirty.current.folder = false
      void saveToFolder(d)
    }
  }, [])

  // 열 때 한 번 남긴다. 앞 버전과 같으면 저장소가 건너뛴다.
  useEffect(() => {
    void saveVersion(latest.current, { reason: 'open' })
  }, [deck.id])

  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    dirty.current = { browser: true, folder: true }
    const tb = window.setTimeout(() => {
      dirty.current.browser = false
      void saveToBrowser(deck)
    }, 400)
    const tf = window.setTimeout(() => {
      dirty.current.folder = false
      void saveToFolder(deck)
      if (Date.now() - lastVersionAt.current >= AUTO_INTERVAL) {
        lastVersionAt.current = Date.now()
        void saveVersion(deck, { reason: 'interval' })
      }
    }, 1500)
    return () => {
      window.clearTimeout(tb)
      window.clearTimeout(tf)
    }
  }, [deck])

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [flush])

  /** 발표나 내보내기처럼 중요한 순간 전에 부른다 */
  return useCallback((reason: VersionReason) => {
    flush()
    lastVersionAt.current = Date.now()
    void saveVersion(latest.current, { reason })
  }, [flush])
}

function EditorBody({ deck }: { deck: Deck }) {
  const slide = useSelectedSlide() ?? deck.slides[0]
  const store = useDeck()
  const markVersion = useAutosave(deck)
  const [view, setView] = useState<'slides' | 'doc'>('slides')
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [presenting, setPresenting] = useState<{ startId?: string } | null>(null)
  const [confirmPresent, setConfirmPresent] = useState<{ startId?: string; missing: number } | null>(null)
  const [printing, setPrinting] = useState(false)
  const [reviewing, setReviewing] = useState<ChangeRequest | null>(null)
  const toast = useToast()
  const ai = useAiShare(deck)

  const applyAi = async (request: ChangeRequest) => {
    // 적용 전 상태를 버전으로 남긴다. 미리 본 뒤에 덱이 바뀌었을 수 있으니 지금 덱에 다시 적용한다.
    markVersion('ai')
    const current = useDeck.getState().deck ?? deck
    const result = applyOps(current, request.ops)
    store.replaceDeck(result.deck)
    setReviewing(null)
    toast.show('AI 제안을 적용했어요', { label: '되돌리기', run: () => useDeck.getState().undo() })
    await ai.resolve(request, 'applied', result.results)
  }

  const rejectAi = async (request: ChangeRequest) => {
    setReviewing(null)
    toast.show('AI 제안을 거절했어요')
    await ai.resolve(request, 'rejected', [])
  }

  const startPresent = useCallback(
    (startId?: string, force = false) => {
      const missing = deckMissingCount(deck)
      if (missing > 0 && !force) {
        setConfirmPresent({ startId, missing })
        return
      }
      setConfirmPresent(null)
      markVersion('present')
      document.documentElement.requestFullscreen?.().catch(() => {})
      setPresenting({ startId })
    },
    [deck, markVersion],
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
    markVersion('export')
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
          <SaveStatus deck={deck} onOpenVersions={() => setVersionsOpen(true)} />
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
          <button type="button" className="icon-btn" aria-label="되돌리기" title={`되돌리기 (${keys('mod+Z')})`} disabled={!store.past.length} onClick={store.undo}>
            <UndoIcon />
          </button>
          <button type="button" className="icon-btn" aria-label="다시 하기" title={`다시 하기 (${isMac ? keys('mod+shift+Z') : keys('mod+Y')})`} disabled={!store.future.length} onClick={store.redo}>
            <RedoIcon />
          </button>
          <button
            type="button"
            className={cx('icon-btn', versionsOpen && 'is-on')}
            aria-label="버전 기록"
            title="버전 기록"
            aria-pressed={versionsOpen}
            onClick={() => setVersionsOpen((o) => !o)}
          >
            <HistoryIcon />
          </button>
          <AiMenu deck={deck} ai={ai} />
          <ThemeMenu deck={deck} />
          <ExportMenu
            onHtml={exportHtml}
            onPdf={() => {
              markVersion('export')
              setPrinting(true)
            }}
            onDeckFile={() => {
              downloadDeckFile(deck)
              toast.show('작업 파일을 저장했어요. 다운로드 폴더를 확인해 주세요.')
            }}
          />
          <button type="button" className="btn btn-primary" title="처음부터 발표 (F5)" onClick={() => startPresent()}>
            <PlayIcon />
            발표하기
          </button>
        </div>
      </header>

      <div className={cx('ed-body', view === 'doc' && 'is-doc', versionsOpen && 'has-versions')}>
        <SlideList deck={deck} selectedId={slide?.id ?? null} />
        {view === 'slides' && slide ? (
          <SlideStage deck={deck} slide={slide} onRemove={removeSlide} onPresentHere={() => startPresent(slide.id)} />
        ) : (
          <OutlineView
            deck={deck}
            onOpenSlide={(sid) => {
              store.select(sid)
              setView('slides')
            }}
          />
        )}
        {versionsOpen ? (
          <VersionPanel deck={deck} onClose={() => setVersionsOpen(false)} notify={(text) => toast.show(text, undefined, 6000)} />
        ) : (
          view === 'slides' && slide && <Inspector deck={deck} slide={slide} onFocusField={(m) => focusField(slide.id, m)} />
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
      {!reviewing && <AiInbox ai={ai} onOpen={setReviewing} />}
      {reviewing && (
        <AiReview
          deck={deck}
          request={reviewing}
          onClose={() => setReviewing(null)}
          onApply={() => applyAi(reviewing)}
          onReject={() => rejectAi(reviewing)}
        />
      )}
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
  const look = useMemo(() => ({ meta: deck.meta, theme: deck.theme, title: deck.title, motion: deck.motion }), [deck.meta, deck.theme, deck.title, deck.motion])
  const canAddItem = !!spec.items && visibleItems(slide).length < spec.items.max
  const variants = spec.variants ?? []
  const nextVariant = variants.length > 1 ? variants[(variants.findIndex((v) => v.id === variantOf(slide)) + 1) % variants.length] : null

  // 테마 메뉴에서 움직임을 고르면 이 장에서 발표할 때처럼 한 번 보여 준다
  const [preview, setPreview] = useState(0)
  const previewRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const on = () => setPreview((n) => n + 1)
    window.addEventListener(PREVIEW_MOTION, on)
    return () => window.removeEventListener(PREVIEW_MOTION, on)
  }, [])
  useEffect(() => {
    if (!preview) return
    const stop = deck.motion === 'lively' && previewRef.current ? countUp(previewRef.current) : undefined
    const t = window.setTimeout(() => setPreview(0), 2800)
    return () => {
      window.clearTimeout(t)
      stop?.()
    }
  }, [preview, deck.motion])

  return (
    <main className="stage">
      <div className="ed-canvas" ref={canvasRef}>
        <FitSlide
          padding={4}
          belowHeight={56}
          below={
            <div className="stage-tools">
              <div className="stage-tools-l">
                {nextVariant && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    title={`다음 모양: ${nextVariant.name}`}
                    onClick={() => store.setVariant(slide.id, nextVariant.id)}
                  >
                    <ShapesIcon />
                    다른 모양
                  </button>
                )}
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
          <div key={preview} ref={previewRef} className={cx(preview > 0 && 'is-playing')}>
            <SlideCanvas
              deck={look}
              slide={slide}
              mode={preview > 0 ? 'final' : 'edit'}
              actions={actions}
              {...pageProps(info, slide.id)}
            />
          </div>
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
            <SlideCanvas deck={deck} slide={s} mode="final" {...pageProps(info, s.id)} />
          </div>
        ))}
    </div>,
    document.body,
  )
}
