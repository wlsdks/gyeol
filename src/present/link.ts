// 발표 화면과 발표자 화면을 잇는다. 두 창은 같은 PC, 같은 주소(127.0.0.1)라서 BroadcastChannel로 충분하다.
// 발표 내용은 창 사이에서만 오가고 어디로도 나가지 않는다.

import type { Deck } from '../deck/types'

export type Blank = 'black' | 'white' | null

export type PresentMessage =
  /** 발표자 화면이 열리면 지금 상태를 묻는다 */
  | { type: 'hello' }
  /** 발표 화면이 답한다. 발표 내용은 이때 한 번만 보낸다 */
  | { type: 'deck'; deck: Deck; index: number; blank: Blank; startedAt: number; left?: number }
  /** left: 지금 장에서 아직 누르지 않은 차례 수('누르면' 나오는 컴포넌트) */
  | { type: 'state'; index: number; blank: Blank; left?: number }
  | { type: 'go'; index: number }
  | { type: 'blank'; blank: Blank }
  | { type: 'end' }

export function presentChannel(deckId: string, onMessage: (m: PresentMessage) => void) {
  const channel = new BroadcastChannel(`html-maker-present:${deckId}`)
  channel.onmessage = (e: MessageEvent<PresentMessage>) => onMessage(e.data)
  return {
    post: (m: PresentMessage) => channel.postMessage(m),
    close: () => channel.close(),
  }
}

// ---------- 화면 두 개 다루기 (Window Management API, 크롬·엣지) ----------

interface ScreenDetailed extends Screen {
  readonly availLeft: number
  readonly availTop: number
  readonly isPrimary: boolean
  readonly isInternal: boolean
}

interface ScreenDetails {
  readonly screens: ScreenDetailed[]
  readonly currentScreen: ScreenDetailed
}

type WithScreens = Window & { getScreenDetails?: () => Promise<ScreenDetails> }

/** 모니터나 프로젝터가 '확장'으로 연결돼 있는지. 허락 없이 알 수 있다. */
export function hasSecondScreen(): boolean {
  return !!(screen as Screen & { isExtended?: boolean }).isExtended
}

/** 화면 두 개를 다뤄도 되는지 사용자에게 이미 허락받았는지 */
export async function screensPermission(): Promise<'granted' | 'prompt' | 'denied' | 'unsupported'> {
  if (!(window as WithScreens).getScreenDetails) return 'unsupported'
  try {
    const status = await navigator.permissions.query({ name: 'window-management' as PermissionName })
    return status.state
  } catch {
    return 'prompt'
  }
}

export interface Placement {
  /** 발표 화면을 띄울 큰 화면(프로젝터, 모니터) */
  audience: ScreenDetailed
  /** 발표자 화면을 띄울 이 노트북 화면 */
  presenter: ScreenDetailed
}

/** 화면이 둘 이상이면 어디에 무엇을 띄울지 정한다. 허락을 묻는 창이 뜰 수 있다. */
export async function findPlacement(): Promise<Placement | null> {
  const get = (window as WithScreens).getScreenDetails
  if (!get) return null
  try {
    const details = await get.call(window)
    const here = details.currentScreen
    const others = details.screens.filter((s) => s !== here)
    if (!others.length) return null
    // 노트북 화면이 아닌 쪽(바깥에 연결한 화면)을 발표 화면으로
    const audience = others.find((s) => !s.isInternal) ?? others[0]
    return { audience, presenter: here }
  } catch {
    return null
  }
}

const PRESENTER_WINDOW = 'html-maker-presenter'

/** 발표자 화면 창을 연다. 자리를 정했으면 그 화면에 꽉 차게, 아니면 보통 창으로. */
export function openPresenterWindow(deckId: string, at?: ScreenDetailed): Window | null {
  const url = `${location.pathname}#/presenter/${deckId}`
  const box = at
    ? `left=${at.availLeft},top=${at.availTop},width=${at.availWidth},height=${at.availHeight}`
    : `width=${Math.min(1280, screen.availWidth)},height=${Math.min(800, screen.availHeight)}`
  return window.open(url, PRESENTER_WINDOW, `popup=1,${box}`)
}

/** 발표 화면을 전체 화면으로. 자리를 정했으면 그 화면에서. */
export async function enterFullscreen(at?: ScreenDetailed): Promise<boolean> {
  try {
    const el = document.documentElement as HTMLElement & {
      requestFullscreen(options?: FullscreenOptions & { screen?: ScreenDetailed }): Promise<void>
    }
    await el.requestFullscreen(at ? { screen: at } : undefined)
    return true
  } catch {
    return false
  }
}

const AUTO_KEY = 'html-maker:presenter-auto'

/**
 * 화면이 두 개면 발표자 화면을 저절로 쓸지. 처음에는 꺼 둔다.
 * 창 두 개를 쓰는 방식은 회사 PC 설정(창 관리 허락, 화면 '복제')에 따라 안 될 수 있어서,
 * 늘 되는 '슬라이드만 발표'를 기본으로 두고 발표자 화면은 직접 골라 쓰게 한다.
 */
export function presenterAuto(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) === 'on'
  } catch {
    return false
  }
}

export function setPresenterAuto(on: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, on ? 'on' : 'off')
  } catch {
    /* 저장이 안 되면 이번에만 */
  }
}
