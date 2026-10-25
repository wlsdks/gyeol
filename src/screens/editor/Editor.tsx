import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { blockFieldPrefix, composeAreaH, withImage } from '../../deck/blocks'
import { knownOnly, unknownParts } from '../../deck/compat'
import { deckMissingCount, missingFields, pageInfo, visibleItems, type Missing } from '../../deck/fields'
import { LAYOUTS } from '../../deck/layouts'
import { motionOf } from '../../deck/themes'
import type { Deck, LayoutId, Slide } from '../../deck/types'
import { downloadHtml } from '../../export/exportHtml'
import { downloadPptx } from '../../export/exportPptx'
import { exposePptDebug } from '../../export/rasterize'
import { cx } from '../../lib/cx'
import { isMac, keys } from '../../lib/keys'
import { go } from '../../lib/router'
import { APP_VERSION } from '../../lib/version'
import { BlockEditContext } from '../../slides/blockEdit'
import type { SlideActions } from '../../slides/context'
import { motionEngine } from '../../motion/engine'
import { enterFullscreen, findPlacement, hasSecondScreen, openPresenterWindow, presenterAuto, screensPermission, type Placement } from '../../present/link'
import { slideOverflow } from '../../slides/overflow'
import { FitSlide, pageProps, SlideCanvas } from '../../slides/SlideCanvas'
import { useDeck, useSelectedSlide } from '../../store/deckStore'
import { downloadDeckFile } from '../../store/deckFile'
import { uid } from '../../deck/generate'
import { loadBestDeck, persistNow, saveToBrowser, saveToFolder, useStorage } from '../../store/persist'
import { AUTO_INTERVAL, saveVersion, type VersionReason } from '../../store/versions'
import { Present, presentKey } from '../Present'
import { BackIcon, BlocksIcon, CloseIcon, CopyIcon, dialogOpen, EyeIcon, EyeOffIcon, HistoryIcon, Info, Modal, PlayIcon, PlusIcon, RedoIcon, SAVE_HELP, ScreenIcon, SlidersIcon, takeNotice, TrashIcon, undoAction, UndoIcon, useToast } from '../ui'
import { applyOps, type ChangeRequest } from '../../ai/ops'
import { useAiAsk, type AiAsk } from '../../ai/useAiAsk'
import { useAiShare, type AiShare } from '../../ai/useAiShare'
import { ASK_ERROR, AiInbox, AiMenu, AiReview, AskStatus, SlideAsk } from './AiShare'
import { useBlockEditing, type BlockEditing } from './BlockEditor'
import { useImageInput } from './useImageInput'
import { BlockLibrary } from './BlockLibrary'
import { ExportMenu, PREVIEW_MOTION, PresentButton, ThemeMenu, type PresentHow } from './DeckMenus'
import { Inspector, layoutPreview } from './Inspector'
import { SaveStatus } from './SaveStatus'
import { FloatTools, SelectionBar } from './SelectionBar'
import { VariantMenu } from './VariantMenu'
import { SlideList } from './SlideList'
import { VersionPanel } from './Versions'

export function Editor({ id }: { id: string }) {
  const deck = useDeck((s) => s.deck)
  const newer = useDeck((s) => s.newer)
  const open = useDeck((s) => s.open)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const now = useDeck.getState()
    if (now.deck?.id === id || now.newer?.id === id) return
    loadBestDeck(id).then((d) => (d ? open(d) : setNotFound(true)))
  }, [id, open])

  if (notFound) {
    return (
      <div className="center-msg">
        <p>
          이 발표를 찾을 수 없어요. 다른 브라우저에서 만들었거나 지운 발표일 수 있어요. 작업 파일(.deck)이 있으면 내 발표에서 ‘파일 열기’로 불러오세요.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => go({ name: 'home' })}>
          내 발표로 가기
        </button>
      </div>
    )
  }
  if (newer?.id === id) return <NewerDeck deck={newer} />
  if (!deck || deck.id !== id) return <div className="center-msg">불러오는 중</div>
  return <EditorBody deck={deck} />
}

/**
 * 새 버전에서 만든 발표. 여기서 고치면 이 버전이 모르는 부품과 그 안의 글이 빠지므로 열지 않는다.
 * 원래 발표는 건드리지 않고, 급하면 아는 것만 남긴 사본을 만들어 고친다.
 */
function NewerDeck({ deck }: { deck: Deck }) {
  const count = unknownParts(deck)
  const known = knownOnly(deck)
  const toast = useToast()
  const openCopy = async () => {
    const now = Date.now()
    const copy: Deck = { ...structuredClone(known), id: uid(), title: `${deck.title} 사본`, createdAt: now, updatedAt: now, aiShare: false }
    if (!(await persistNow(copy))) {
      toast.show(`사본을 만들지 못했어요. ${SAVE_HELP}`, undefined, 8000)
      return
    }
    go({ name: 'edit', id: copy.id })
  }
  return (
    <div className="center-msg newer-deck">
      <h1 className="newer-h">새 버전에서 만든 발표예요</h1>
      <p>
        이 결 앱에는 없는 컴포넌트나 모양이 {count}개 들어 있어요. 여기서 고치면 그것과 안에 적은 글이 빠져서 열지 않았어요. 원래 발표는 그대로
        있어요.
      </p>
      <p>
        결을 새 버전으로 바꾼 뒤 열어 주세요(지금은 {APP_VERSION} 버전). 지금 꼭 고쳐야 하면, 없는 것만 뺀 사본을 만들어 고칠 수
        있어요.
      </p>
      <div className="newer-actions">
        <button type="button" className="btn btn-primary" onClick={() => go({ name: 'home' })}>
          내 발표로 가기
        </button>
        {known.slides.length > 0 && (
          <button type="button" className="btn btn-ghost" onClick={openCopy}>
            없는 {count}개를 뺀 사본 만들기
          </button>
        )}
      </div>
      {toast.node}
    </div>
  )
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
    // 폴더에서 새 버전의 발표가 들어와 편집기가 닫히는 중: 들고 있던 것으로 덮어쓰지 않는다 (고친 것은 버전으로 남겨 두었다)
    if (useDeck.getState().newer?.id === d.id) return
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
  const markVersion = useCallback((reason: VersionReason) => {
    flush()
    lastVersionAt.current = Date.now()
    void saveVersion(latest.current, { reason })
  }, [flush])

  /** Ctrl+S: 모아 둔 저장을 기다리지 않고 두 곳에 바로 저장한다. 고른 폴더에 쓰지 못했거나 브라우저에 못 쓰면 false */
  const saveNow = useCallback(async () => {
    const d = latest.current
    if (useDeck.getState().newer?.id === d.id) return true
    dirty.current = { browser: false, folder: false }
    const browser = await saveToBrowser(d)
    const folder = await saveToFolder(d)
    return browser && (folder || useStorage.getState().folder?.kind !== 'ready')
  }, [])

  return { markVersion, saveNow }
}

/** app.css의 '좁은 화면'과 같은 너비: 이보다 좁으면 오른쪽 칸을 접는다 */
const NARROW = '(max-width: 1100px)'

/** 오른쪽 칸(이 장 설정, 컴포넌트)을 좁은 창에서 띄우고 닫는 일 */
interface SidePanel {
  /** 좁은 창에서 띄워 두었는지 */
  shown: boolean
  /** 띄운 칸이 '이 장 설정'을 보이는지 */
  settingsShown: boolean
  settings(): void
  toggleSettings(): void
  toggleLibrary(): void
  close(): void
}

function EditorBody({ deck }: { deck: Deck }) {
  const slide = useSelectedSlide() ?? deck.slides[0]
  const store = useDeck()
  const { markVersion, saveNow } = useAutosave(deck)
  const [versionsOpen, setVersionsOpen] = useState(false)
  // '레이아웃 바꾸기'에서 그림에 올린 레이아웃. 슬라이드 자리에 그 모습으로 미리 보인다
  const [layoutPeek, setLayoutPeek] = useState<LayoutId | null>(null)
  useEffect(() => setLayoutPeek(null), [slide?.id])
  const [presenting, setPresenting] = useState<{ startId?: string } | null>(null)
  const [confirmPresent, setConfirmPresent] = useState<{ startId?: string; how: PresentHow; missing: number } | null>(null)
  // 발표자 화면을 처음 쓸 때: 화면 두 개를 다뤄도 되는지 브라우저가 묻는다
  const [askScreens, setAskScreens] = useState<{ startId?: string; placement?: Placement } | null>(null)
  const [printing, setPrinting] = useState(false)
  const [reviewing, setReviewing] = useState<ChangeRequest | null>(null)
  const toast = useToast()
  const ai = useAiShare(deck)
  const ask = useAiAsk(deck)
  const blocks = useBlockEditing(deck, slide, toast)
  const fileOver = useImageInput(blocks, toast)

  // 내 발표에서 파일을 열고 왔을 때의 알림 (있던 발표를 파일 내용으로 바꿨는지, 사본으로 열었는지)
  useEffect(() => {
    const text = takeNotice()
    if (text) toast.show(text, undefined, 8000)
    // 처음 열 때 한 번만
  }, [])

  // 부탁이 끝나면: 제안이 왔으면 미리 보기를 바로 열고, 아니면 왜인지 알려 준다.
  // 바꿀 게 없다고 하면 AI가 말한 까닭을 읽을 수 있게 오른쪽 아래 카드를 남겨 둔다.
  const job = ask.job
  useEffect(() => {
    if (!job || job.state === 'running' || job.state === 'no_change') return
    if (job.state === 'done') {
      const request = ai.requests.find((r) => r.id === job.request)
      if (!request) {
        ai.refresh()
        return
      }
      setReviewing(request)
    } else if (job.state === 'failed') {
      toast.show(ASK_ERROR[job.error ?? 'failed'], undefined, 8000)
    }
    ask.dismiss()
    // toast는 그릴 때마다 새로 만들어져서 의존성에서 뺀다
  }, [job, ai.requests])

  const applyAi = async (request: ChangeRequest) => {
    // 적용 전 상태를 버전으로 남긴다. 미리 본 뒤에 덱이 바뀌었을 수 있으니 지금 덱에 다시 적용한다.
    markVersion('ai')
    const current = useDeck.getState().deck ?? deck
    const result = applyOps(current, request.ops)
    store.replaceDeck(result.deck)
    setReviewing(null)
    toast.show('AI 제안을 적용했어요', undoAction(toast))
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
      // 같은 클릭 안에서 전체 화면 다음에 창을 열어야 크롬·엣지가 둘 다 허락한다
      if (placement && !(await enterFullscreen(placement.audience))) return false
      // 화면이 하나면 연습용: 발표자 화면은 보통 창으로, 발표 화면은 이 창에
      const win = placement ? openPresenterWindow(deck.id, placement.presenter) : openPresenterWindow(deck.id)
      setAskScreens(null)
      if (!win) {
        // 팝업 차단: 발표자 화면 없이 시작하면 노트도 다음 장도 볼 수 없다. 시작하지 않고 허용하는 법을 알린다.
        // 전체 화면을 빠져나와야 주소창의 차단 아이콘이 보인다
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
        toast.show('브라우저가 발표자 화면 창을 막았어요. 주소창의 팝업 차단 아이콘에서 허용한 뒤 다시 발표해 주세요.', undefined, 10000)
        return true
      }
      setPresenting({ startId })
      return true
    },
    // toast는 그릴 때마다 새로 만들어지지만 알림을 띄우는 길은 같아서 의존성에서 뺀다
    [deck.id],
  )

  const startPresent = useCallback(
    async (startId?: string, force = false, how: PresentHow = 'auto') => {
      // 모든 장을 발표에서 빼 두었으면 빈 전체 화면만 뜬다
      if (!deck.slides.some((s) => !s.hidden)) {
        toast.show('모든 장이 발표에서 빠져 있어서 발표할 장이 없어요. 장을 골라 ‘발표에 다시 넣기’를 눌러 주세요.', undefined, 6000)
        return
      }
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
    store.select(target.id)
    const m = missingFields(target, deck.meta)[0]
    window.setTimeout(() => focusField(target.id, m), 60)
  }

  const printPdf = useCallback(() => {
    markVersion('export')
    setPrinting(true)
  }, [markVersion])

  // 단축키: 되돌리기, F5로 발표 (PowerPoint와 같게), Ctrl+S 저장, Ctrl+P PDF
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest?.('input, textarea, [contenteditable]')
      const mod = e.metaKey || e.ctrlKey
      // 한글 입력 상태에서는 Ctrl+Z가 'ㅋ'로 와서 글자 키는 자판 자리로 읽는다
      const k = presentKey(e).toLowerCase()
      const save = mod && !e.shiftKey && !e.altKey && k === 's'
      // Ctrl+P를 브라우저에 맡기면 인쇄할 장이 없어 빈 쪽이 나온다. 내보내기의 PDF와 같은 길로 보낸다
      const print = mod && !e.shiftKey && !e.altKey && k === 'p'
      // 브라우저의 새로 고침, 페이지 저장, 인쇄 창은 글을 쓰는 중에도, 창이 떠 있어도 막는다
      if (e.key === 'F5' || save || print) e.preventDefault()
      if (presenting || dialogOpen()) return
      if (e.key === 'F5') {
        void startPresent(e.shiftKey ? slide?.id : undefined, false, e.altKey ? 'presenter' : 'auto')
        return
      }
      if (save) {
        void saveNow().then((ok) =>
          toast.show(ok ? '저장했어요. 고칠 때마다 자동으로 저장되고 있어요.' : '저장하지 못했어요. 위쪽의 저장 상태를 눌러 할 일을 확인해 주세요.'),
        )
        return
      }
      if (print) {
        printPdf()
        return
      }
      if (typing) return
      if (mod && k === 'z') {
        e.preventDefault()
        if (e.shiftKey) store.redo()
        else store.undo()
      } else if (mod && k === 'y') {
        e.preventDefault()
        store.redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // toast는 그릴 때마다 새로 만들어져서 의존성에서 뺀다
  }, [presenting, startPresent, slide?.id, store, saveNow, printPdf])

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

  // PPT는 장마다 그림을 그려서 장이 많으면 오래 걸린다. 지금 몇 장째인지 보이고, 두 번 눌러도 한 번만 만든다
  const pptBusy = useRef(false)
  const exportPpt = async () => {
    if (pptBusy.current) {
      toast.show('PPT를 만들고 있어요. 다 되면 알려 드릴게요.')
      return
    }
    const total = deck.slides.filter((s) => !s.hidden).length
    if (!total) {
      toast.show('모든 장을 숨겨서 PPT에 넣을 장이 없어요. 장 하나 이상의 숨기기를 풀어 주세요.')
      return
    }
    pptBusy.current = true
    markVersion('export')
    try {
      await downloadPptx(deck, (done, all) => toast.show(`PPT를 만드는 중이에요 (${done}/${all})`, undefined, 60000))
      toast.show('PPT 파일을 저장했어요. 다운로드 폴더를 확인해 주세요.')
    } catch {
      toast.show('PPT 파일을 만들지 못했어요. 다시 시도해 주세요.')
    } finally {
      pptBusy.current = false
    }
  }
  // 콘솔에서 PPT의 장 그림만 볼 수 있게 (그림 점검용. rasterize.tsx의 exposePptDebug)
  useEffect(() => exposePptDebug(() => useDeck.getState().deck), [])

  const removeSlide = (s: Slide) => {
    store.removeSlide(s.id)
    toast.show('장을 지웠어요', undoAction(toast))
  }

  // 좁은 창(1100px 아래)에서는 오른쪽 칸을 접어 두고, 열면 슬라이드 위에 띄운다.
  // 띄워 둘지는 어느 탭을 보는지와 따로 둔다: 탭을 '이 장 설정'으로 바꿔도 닫히지 않게 (컴포넌트를 고르는 중이면 늘 띄운다)
  const [sideOpen, setSideOpen] = useState(false)
  const side: SidePanel = {
    shown: sideOpen || blocks.libraryOpen,
    settingsShown: sideOpen && !blocks.libraryOpen,
    settings: () => {
      blocks.setLibraryOpen(false)
      if (matchMedia(NARROW).matches) setSideOpen(true)
    },
    toggleSettings: () => {
      if (sideOpen && !blocks.libraryOpen) setSideOpen(false)
      else {
        blocks.setLibraryOpen(false)
        setSideOpen(true)
      }
    },
    toggleLibrary: () => {
      if (!blocks.libraryOpen) return blocks.setLibraryOpen(true)
      blocks.setLibraryOpen(false)
      setSideOpen(false)
    },
    close: () => {
      setSideOpen(false)
      blocks.setLibraryOpen(false)
    },
  }
  // 띄운 '이 장 설정'은 Esc로 닫는다 (컴포넌트 탭의 Esc는 BlockLibrary가 받아 '이 장 설정'으로 돌아간다)
  useEffect(() => {
    if (!sideOpen || blocks.libraryOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || dialogOpen()) return
      if ((e.target as HTMLElement).closest?.('input, textarea, [contenteditable]')) return
      setSideOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sideOpen, blocks.libraryOpen])

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
          <AiMenu deck={deck} ai={ai} ask={ask} />
          <ThemeMenu deck={deck} />
          <ExportMenu
            onHtml={exportHtml}
            onPdf={printPdf}
            onPpt={() => void exportPpt()}
            onDeckFile={() => {
              downloadDeckFile(deck)
              toast.show('작업 파일을 저장했어요. 다운로드 폴더를 확인해 주세요.')
            }}
          />
          <PresentButton onStart={(how, here) => void startPresent(here ? slide?.id : undefined, false, how)} />
        </div>
      </header>

      <div className={cx('ed-body', versionsOpen && 'has-versions', side.shown && !versionsOpen && 'has-side')}>
        <SlideList deck={deck} selectedId={slide?.id ?? null} />
        {slide && <SlideStage deck={deck} slide={slide} ai={ai} ask={ask} blocks={blocks} fileOver={fileOver} side={side} layoutPeek={layoutPeek} onRemove={removeSlide} onPresentHere={() => void startPresent(slide.id)} />}
        {versionsOpen ? (
          <VersionPanel deck={deck} onClose={() => setVersionsOpen(false)} notify={(text) => toast.show(text, undefined, 6000)} />
        ) : (
          slide && (
            // 오른쪽 칸은 탭 두 개: 이 장 설정과 컴포넌트. 컴포넌트를 고르는 동안에도 어디로 돌아가는지 보인다
            <aside className="side" aria-label="오른쪽 칸">
              <div className="side-tabs" role="tablist">
                <button type="button" role="tab" className="side-tab" aria-selected={!blocks.libraryOpen} onClick={side.settings}>
                  이 장 설정
                </button>
                <button type="button" role="tab" className="side-tab" aria-selected={blocks.libraryOpen} onClick={() => blocks.setLibraryOpen(true)}>
                  컴포넌트
                </button>
                {blocks.libraryOpen && (
                  <Info label="컴포넌트 넣는 법">
                    슬라이드로 끌어다 놓거나 눌러서 넣어요. 아무 데나 놓아도 알맞은 자리에 맞춰져요. 그림에 마우스를 올리면 발표할 때의 움직임을 보여 줘요.
                  </Info>
                )}
                {/* 좁은 창에서 슬라이드 위에 띄웠을 때만 보인다 */}
                <button type="button" className="icon-btn side-close" aria-label="오른쪽 칸 닫기" title="닫기 (Esc)" onClick={side.close}>
                  <CloseIcon />
                </button>
              </div>
              {blocks.libraryOpen ? (
                <BlockLibrary deck={deck} slide={slide} blocks={blocks} />
              ) : (
                <Inspector deck={deck} slide={slide} onFocusField={(m) => focusField(slide.id, m)} onPeekLayout={setLayoutPeek} />
              )}
            </aside>
          )
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
      {!reviewing && (job ? <AskStatus deck={deck} job={job} onCancel={ask.cancel} /> : <AiInbox ai={ai} onOpen={setReviewing} />)}
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
  const key = (m.block ? blockFieldPrefix(m.block) : '') + (m.item !== undefined ? `${m.item}.${m.key}` : m.key)
  const inCanvas = document.querySelector<HTMLElement>(`.ed-canvas [data-field="${CSS.escape(key)}"]`)
  const inDoc = document.querySelector<HTMLElement>(`[data-doc-field="${CSS.escape(`${slideId}:${key}`)}"]`)
  const el = inCanvas ?? inDoc
  if (!el) return
  el.focus()
  el.scrollIntoView({ block: 'nearest' })
}

/**
 * 슬라이드 아래 단추줄: 왼쪽과 오른쪽 단추가 한 줄에 다 들어가지 않으면 글자를 숨긴다.
 * 1단계는 오른쪽 단추, 2단계는 왼쪽의 덜 쓰는 단추(다른 모양, 항목 추가)까지. 왼쪽 단추 수가 장마다 달라서 너비 하나로 정하지 않고 잰다
 */
function useTightTools(ref: RefObject<HTMLDivElement | null>) {
  const check = useCallback(() => {
    const el = ref.current
    if (!el) return
    const need = () => {
      const l = el.querySelector<HTMLElement>('.stage-tools-l')
      const r = el.querySelector<HTMLElement>('.stage-tools-r')
      return (l?.scrollWidth ?? 0) + (r?.scrollWidth ?? 0) + 16
    }
    for (const level of ['', '1', '2']) {
      if (level) el.dataset.tight = level
      else delete el.dataset.tight
      if (need() <= el.clientWidth) return
    }
  }, [ref])
  useLayoutEffect(check)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [check, ref])
}

function SlideStage({
  deck,
  slide,
  ai,
  ask,
  blocks,
  fileOver,
  side,
  layoutPeek,
  onRemove,
  onPresentHere,
}: {
  deck: Deck
  slide: Slide
  ai: AiShare
  ask: AiAsk
  blocks: BlockEditing
  /** 이미지 파일을 장 위로 끌고 있을 때 (놓으면 이미지로 들어간다) */
  fileOver: boolean
  side: SidePanel
  layoutPeek: LayoutId | null
  onRemove: (s: Slide) => void
  onPresentHere: () => void
}) {
  const store = useDeck()
  const info = pageInfo(deck.slides)
  const spec = LAYOUTS[slide.layout]
  const canvasRef = useRef<HTMLDivElement>(null)
  const look = useMemo(() => ({ meta: deck.meta, theme: deck.theme, title: deck.title, motion: deck.motion }), [deck.meta, deck.theme, deck.title, deck.motion])
  // 테마, 글꼴, 글자 크기, 발표 정보(아래 표시의 이름, 소속)를 바꿔도 다시 잰다
  const overflow = useOverflow(canvasRef, slide, look)

  const actions = useMemo<SlideActions>(
    () => ({
      setField: (key, value) => useDeck.getState().setField(slide.id, key, value),
      setItem: (index, key, value) => useDeck.getState().setItem(slide.id, index, key, value),
      removeItem: (index) => useDeck.getState().removeItem(slide.id, index),
      moveItem: (from, to, key) => useDeck.getState().moveItem(slide.id, from, to, key),
      setOptions: (options, key) => useDeck.getState().setOptions(slide.id, options, key),
      setVariant: (variant, key) => useDeck.getState().setVariant(slide.id, variant, key),
      updateBlock: (blockId, fn, key) => useDeck.getState().updateBlock(slide.id, blockId, fn, key),
      placeImage: (blockId, url) => {
        const st = useDeck.getState()
        const cur = st.deck?.slides.find((s) => s.id === slide.id)
        if (!cur || !st.deck) return
        st.setRows(cur.id, withImage(cur.rows ?? [], blockId, url, composeAreaH(cur, st.deck, true)))
      },
    }),
    [slide.id],
  )
  const canAddItem = !!spec.items && visibleItems(slide).length < spec.items.max
  const variants = spec.variants ?? []
  const peekSlide = useMemo(() => (layoutPeek ? layoutPreview(slide, layoutPeek) : null), [slide, layoutPeek])

  // 테마 메뉴에서 움직임을 고르면 이 장에서 발표할 때처럼 한 번 보여 준다
  const [preview, setPreview] = useState(0)
  const previewRef = useRef<HTMLDivElement>(null)
  const toolsRef = useRef<HTMLDivElement>(null)
  useTightTools(toolsRef)
  useEffect(() => {
    const on = () => setPreview((n) => n + 1)
    window.addEventListener(PREVIEW_MOTION, on)
    return () => window.removeEventListener(PREVIEW_MOTION, on)
  }, [])
  // 이 장 미리보기: 편집 표시 없이 발표 화면 그대로 보여 주고 움직임을 한 번 돌린다.
  // 발표를 시작하지 않고도 '윗분이 볼 모습'을 바로 확인하게. 슬라이드를 누르거나 Esc, 다른 장을 고르면 편집으로 돌아온다.
  const [peek, setPeek] = useState(false)
  useEffect(() => setPeek(false), [slide.id])
  useEffect(() => {
    if (!peek) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && !dialogOpen() && setPeek(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [peek])
  const startPeek = () => {
    setPeek(true)
    setPreview((n) => n + 1)
  }

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
      <div
        className={cx('ed-canvas', fileOver && 'is-file-over')}
        ref={canvasRef}
        // 부품 밖을 누르면 부품 고르기를 끝낸다
        onPointerDown={(e) => !(e.target as Element).closest('.bk') && blocks.select(null)}
      >
        {(blocks.hint || fileOver) && (
          <p className="bk-hint" role="status">
            {blocks.hint ?? '놓으면 이 장에 이미지로 들어가요'}
          </p>
        )}
        {/* 고른 것의 도구: 레이아웃 장은 고른 항목이나 옆 판, 부품 장은 고른 컴포넌트나 이음표. 둘 다 그 바로 위에 뜬다 */}
        {!peek && !preview && !peekSlide && slide.layout !== 'compose' && <SelectionBar deck={deck} slide={slide} canvasRef={canvasRef} />}
        {!peek && blocks.toolbar && <FloatTools canvasRef={canvasRef}>{blocks.toolbar}</FloatTools>}
        <FitSlide
          padding={4}
          belowHeight={56}
          below={
            <div ref={toolsRef} className="stage-tools">
              {peekSlide ? (
                <div className="stage-tools-l">
                  <p className="stage-peek">‘{LAYOUTS[peekSlide.layout].name}’ 레이아웃으로 바꾸면 이렇게 보여요. 누르면 바뀌어요.</p>
                </div>
              ) : peek ? (
                <div className="stage-tools-l">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreview((n) => n + 1)}>
                    <PlayIcon />
                    움직임 다시 보기
                  </button>
                  <p className="stage-peek" title="빈칸과 편집 표시는 보이지 않아요">발표 화면에서 보이는 모습이에요</p>
                </div>
              ) : (
              <div className="stage-tools-l">
                <button
                  type="button"
                  className={cx('btn btn-sm stage-blocks', blocks.libraryOpen ? 'is-on' : 'btn-ghost')}
                  aria-pressed={blocks.libraryOpen}
                  title="컴포넌트를 골라 이 장에 넣어요"
                  onClick={side.toggleLibrary}
                >
                  <BlocksIcon />
                  컴포넌트 넣기
                </button>
                {/* 오른쪽 칸을 접는 좁은 창에서만 보인다. 레이아웃, 모양, 바탕을 여기서 연다 */}
                <button
                  type="button"
                  className={cx('btn btn-sm stage-side', side.settingsShown ? 'is-on' : 'btn-ghost')}
                  aria-pressed={side.settingsShown}
                  title="이 장의 레이아웃, 모양, 바탕, 움직임"
                  onClick={side.toggleSettings}
                >
                  <SlidersIcon />
                  <span className="btn-t">이 장 설정</span>
                </button>
                <SlideAsk deck={deck} slide={slide} ai={ai} ask={ask} />
                {variants.length > 1 && <VariantMenu deck={deck} slide={slide} />}
                {spec.items && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    // 막아 둔 단추는 왜 안 되는지를 말한다
                    title={canAddItem ? `${spec.items.label} 추가` : `${spec.items.label} ${spec.items.max}개까지 넣을 수 있어요`}
                    disabled={!canAddItem}
                    onClick={() => store.addItem(slide.id)}
                  >
                    <PlusIcon />
                    <span className="btn-t">{spec.items.label} 추가</span>
                  </button>
                )}
                {overflow === 'over' && (
                  // 자리가 모자라면 짧은 말만 (말줄임으로 '글이 슬...'처럼 잘리면 무슨 뜻인지 모른다)
                  <p className="stage-warn" role="status" title="글이 슬라이드 밖으로 넘쳤어요. 글을 줄이거나 ‘이 장 설정’에서 레이아웃을 바꿔 보세요.">
                    <span className="stage-warn-l">글이 슬라이드 밖으로 넘쳤어요. 글을 줄이거나 레이아웃을 바꿔 보세요.</span>
                    <span className="stage-warn-s">글이 넘쳤어요</span>
                  </p>
                )}
                {overflow === 'tight' && (
                  <p className="stage-warn" role="status" title="컴포넌트가 들어갈 높이가 모자라 줄여서 보여요. 제목이나 부제를 줄이거나 컴포넌트를 하나 빼 주세요.">
                    <span className="stage-warn-l">높이가 모자라 컴포넌트를 줄여서 보여요. 제목이나 부제를 줄이거나 컴포넌트를 빼 주세요.</span>
                    <span className="stage-warn-s">자리가 모자라요</span>
                  </p>
                )}
              </div>
              )}
              {/* 단추가 한 줄에 다 들어가지 않으면 오른쪽부터 글자를 숨기고 그림만 남긴다 (이름은 title로, useTightTools) */}
              <div className="stage-tools-r">
                <button
                  type="button"
                  className={cx('btn btn-ghost btn-sm', peek && 'is-on')}
                  aria-pressed={peek}
                  title={peek ? '편집으로 돌아가기' : '발표 화면처럼 미리 보기'}
                  onClick={() => (peek ? setPeek(false) : startPeek())}
                >
                  <ScreenIcon />
                  <span className="btn-t">{peek ? '편집으로' : '미리 보기'}</span>
                </button>
                <button type="button" className="btn btn-ghost btn-sm" title={`지금 장부터 발표 (${keys('shift+F5')})`} onClick={onPresentHere}>
                  <PlayIcon />
                  <span className="btn-t">지금 장부터 발표</span>
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
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  title={deck.slides.length <= 1 ? '장이 하나뿐이라 지울 수 없어요' : '지우기'}
                  disabled={deck.slides.length <= 1}
                  onClick={() => onRemove(slide)}
                >
                  <TrashIcon />
                  <span className="btn-t">지우기</span>
                </button>
              </div>
            </div>
          }
        >
          <div key={preview} ref={previewRef} className={cx(peek && 'stage-peeking')} onPointerDown={peek ? () => setPeek(false) : undefined}>
            <BlockEditContext.Provider value={blocks.edit}>
              <SlideCanvas
                deck={look}
                // 부품을 끌어 부품 장이 아닌 장 위에 오면, 놓았을 때 바뀔 모습을 미리 보여 준다
                slide={peekSlide ?? (peek || preview > 0 ? slide : blocks.stageSlide)}
                mode={peekSlide ? 'preview' : peek || preview > 0 ? 'final' : 'edit'}
                actions={actions}
                {...pageProps(info, slide.id)}
              />
            </BlockEditContext.Provider>
          </div>
        </FitSlide>
        {blocks.ghost}
        {!peek && !preview && blocks.room}
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

/**
 * 슬라이드 안의 글이 영역을 넘치는지('over') 확인한다. 부품 장은 넘치지 않게 줄 높이를 낮춰 맞추는데(fitBlocks의 --bk-sq),
 * 그렇게 눌러 담은 것도('tight') 알린다. 꽉 채운 장에 나중에 부제를 쓰거나 제목이 두 줄이 되면 컴포넌트를 더 넣지 않아도
 * 자리가 줄어서, 알리지 않으면 글자와 차트가 조용히 작아진다
 */
function useOverflow(ref: React.RefObject<HTMLDivElement | null>, slide: Slide, look: unknown): 'over' | 'tight' | null {
  const [overflow, setOverflow] = useState<'over' | 'tight' | null>(null)
  useLayoutEffect(() => {
    const root = ref.current?.querySelector<HTMLElement>('.slide')
    if (!root) return
    let wait = 0
    const check = () => {
      // 칸 너비나 줄 높이를 끄는 동안에는 바뀐 너비에 맞춰 다시 맞추기 전의 모습이 잠깐 넘쳐 보인다. 손을 뗀 뒤에 본다
      if (document.body.matches('.is-block-resizing, .is-row-resizing, .is-block-dragging')) {
        window.clearTimeout(wait)
        wait = window.setTimeout(check, 300)
        return
      }
      setOverflow(slideOverflow(root))
    }
    check()
    document.fonts?.ready.then(check)
    // 부품 장에서 부품이 자리를 옮기는 동안(움직임 중)에는 넘쳐 보일 수 있어서, 다 움직인 뒤에 한 번 더 본다
    const t = window.setTimeout(check, 800)
    return () => {
      window.clearTimeout(t)
      window.clearTimeout(wait)
    }
  }, [ref, slide, look])
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
