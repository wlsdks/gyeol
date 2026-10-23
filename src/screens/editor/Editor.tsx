import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { deckMissingCount, missingFields, pageInfo, visibleItems, type Missing } from '../../deck/fields'
import { LAYOUTS, variantOf } from '../../deck/layouts'
import { motionOf } from '../../deck/themes'
import type { Deck, Slide } from '../../deck/types'
import { downloadHtml } from '../../export/exportHtml'
import { cx } from '../../lib/cx'
import { isMac, keys } from '../../lib/keys'
import { go } from '../../lib/router'
import type { SlideActions } from '../../slides/context'
import { motionEngine } from '../../motion/engine'
import { enterFullscreen, findPlacement, hasSecondScreen, openPresenterWindow, presenterAuto, screensPermission, type Placement } from '../../present/link'
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
import { ExportMenu, PREVIEW_MOTION, PresentButton, ThemeMenu, type PresentHow } from './DeckMenus'
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
  const [confirmPresent, setConfirmPresent] = useState<{ startId?: string; how: PresentHow; missing: number } | null>(null)
  // 발표자 화면을 처음 쓸 때: 화면 두 개를 다뤄도 되는지 브라우저가 묻는다
  const [askScreens, setAskScreens] = useState<{ startId?: string; placement?: Placement } | null>(null)
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

  /** 발표자 화면과 함께: 큰 화면에 발표 화면을 꽉 채우고, 이 화면에 발표자 화면 창을 연다 */
  const launchWithPresenter = useCallback(
    async (startId: string | undefined, placement: Placement | null) => {
      if (placement) {
        // 같은 클릭 안에서 전체 화면 다음에 창을 열어야 크롬·엣지가 둘 다 허락한다
        const ok = await enterFullscreen(placement.audience)
        if (!ok) return false
        openPresenterWindow(deck.id, placement.presenter)
      } else {
        // 화면이 하나면 연습용: 발표자 화면은 보통 창으로, 발표 화면은 이 창에
        openPresenterWindow(deck.id)
      }
      setAskScreens(null)
      setPresenting({ startId })
      return true
    },
    [deck.id],
  )

  const startPresent = useCallback(
    async (startId?: string, force = false, how: PresentHow = 'auto') => {
      const missing = deckMissingCount(deck)
      if (missing > 0 && !force) {
        setConfirmPresent({ startId, how, missing })
        return
      }
      setConfirmPresent(null)
      markVersion('present')
      const presenter = how === 'presenter' || (how === 'auto' && presenterAuto() && hasSecondScreen())
      if (presenter) {
        const permission = await screensPermission()
        if (permission === 'granted') {
          if (await launchWithPresenter(startId, await findPlacement())) return
        } else if (permission === 'prompt' && hasSecondScreen()) {
          setAskScreens({ startId })
          return
        } else if (how === 'presenter') {
          await launchWithPresenter(startId, null)
          return
        }
      }
      void enterFullscreen()
      setPresenting({ startId })
    },
    [deck, markVersion, launchWithPresenter],
  )

  const allowScreens = async () => {
    if (!askScreens) return
    // 허락 창에서 시간을 쓰면 클릭의 효력이 끝나서 전체 화면이 거절될 수 있다. 그러면 한 번 더 누르게 한다.
    const placement = askScreens.placement ?? (await findPlacement())
    if (!placement) {
      setAskScreens(null)
      void enterFullscreen()
      setPresenting({ startId: askScreens.startId })
      return
    }
    if (!(await launchWithPresenter(askScreens.startId, placement))) setAskScreens({ ...askScreens, placement })
  }

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
        void startPresent(e.shiftKey ? slide?.id : undefined, false, e.altKey ? 'presenter' : 'auto')
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
          <PresentButton onStart={(how, here) => void startPresent(here ? slide?.id : undefined, false, how)} />
        </div>
      </header>

      <div className={cx('ed-body', view === 'doc' && 'is-doc', versionsOpen && 'has-versions')}>
        <SlideList deck={deck} selectedId={slide?.id ?? null} />
        {view === 'slides' && slide ? (
          <SlideStage deck={deck} slide={slide} onRemove={removeSlide} onPresentHere={() => void startPresent(slide.id)} />
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
              <button type="button" className="btn btn-primary" data-autofocus onClick={() => void startPresent(confirmPresent.startId, true, confirmPresent.how)}>
                그대로 발표하기
              </button>
            </>
          }
        >
          <p>빈칸은 발표 화면에서 보이지 않아요. 그래도 발표할까요?</p>
        </Modal>
      )}
      {askScreens && (
        <Modal
          title={askScreens.placement ? '준비됐어요' : '발표자 화면을 따로 띄울게요'}
          onClose={() => setAskScreens(null)}
          actions={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setAskScreens(null)
                  void enterFullscreen()
                  setPresenting({ startId: askScreens.startId })
                }}
              >
                슬라이드만 발표
              </button>
              <button type="button" className="btn btn-primary" data-autofocus onClick={() => void allowScreens()}>
                {askScreens.placement ? '발표 시작하기' : '허용하고 발표하기'}
              </button>
            </>
          }
        >
          {askScreens.placement ? (
            <p>큰 화면에 슬라이드를, 이 화면에 다음 장과 노트를 띄워요.</p>
          ) : (
            <p>
              화면이 두 개 연결돼 있어요. 큰 화면에는 슬라이드만, 이 화면에는 다음 장, 노트, 시간이 보여요.
              <br />
              브라우저가 ‘창 관리’를 물으면 <b>허용</b>을 눌러 주세요. 처음 한 번만 물어요.
            </p>
          )}
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
  const engine = useMemo(() => motionEngine(), [])
  const level = motionOf(deck, slide)
  useLayoutEffect(() => {
    if (!preview) return
    const stop = level !== 'none' && previewRef.current ? engine.play(previewRef.current, level) : undefined
    const t = window.setTimeout(() => setPreview(0), 3200)
    return () => {
      window.clearTimeout(t)
      stop?.()
    }
  }, [preview, level, engine])

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
              {/* 슬라이드가 좁게 보일 때는 오른쪽 단추의 글자를 숨기고 그림만 남긴다 (이름은 title로) */}
              <div className="stage-tools-r">
                <button type="button" className="btn btn-ghost btn-sm" title="여기서부터 발표" onClick={onPresentHere}>
                  <PlayIcon />
                  <span className="btn-t">여기서부터 발표</span>
                </button>
                <button type="button" className="btn btn-ghost btn-sm" title="복제" onClick={() => store.duplicateSlide(slide.id)}>
                  <CopyIcon />
                  <span className="btn-t">복제</span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  title={slide.hidden ? '발표에 다시 넣기' : '발표에서 빼기'}
                  onClick={() => store.setHidden(slide.id, !slide.hidden)}
                >
                  {slide.hidden ? <EyeIcon /> : <EyeOffIcon />}
                  <span className="btn-t">{slide.hidden ? '발표에 다시 넣기' : '발표에서 빼기'}</span>
                </button>
                <button type="button" className="btn btn-ghost btn-sm" title="지우기" disabled={deck.slides.length <= 1} onClick={() => onRemove(slide)}>
                  <TrashIcon />
                  <span className="btn-t">지우기</span>
                </button>
              </div>
            </div>
          }
        >
          <div key={preview} ref={previewRef}>
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
