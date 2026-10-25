import { useState } from 'react'
import { useEscape } from '../ui'
import type { BlockEditing } from './BlockEditor'

/** app.css의 '좁은 화면'과 같은 너비: 이보다 좁으면 오른쪽 칸을 접는다 */
const NARROW = '(max-width: 1100px)'

/** 오른쪽 칸(이 장 설정, 컴포넌트)을 좁은 창에서 띄우고 닫는 일 */
export interface SidePanel {
  /** 좁은 창에서 띄워 두었는지 */
  shown: boolean
  /** 띄운 칸이 '이 장 설정'을 보이는지 */
  settingsShown: boolean
  settings(): void
  toggleSettings(): void
  toggleLibrary(): void
  close(): void
}

/**
 * 좁은 창(1100px 아래)에서는 오른쪽 칸을 접어 두고, 열면 슬라이드 위에 띄운다.
 * 띄워 둘지는 어느 탭을 보는지와 따로 둔다: 탭을 '이 장 설정'으로 바꿔도 닫히지 않게 (컴포넌트를 고르는 중이면 늘 띄운다)
 */
export function useSidePanel(blocks: Pick<BlockEditing, 'libraryOpen' | 'setLibraryOpen'>): SidePanel {
  const [sideOpen, setSideOpen] = useState(false)
  // 띄운 '이 장 설정'은 Esc로 닫는다 (컴포넌트 탭의 Esc는 BlockLibrary가 받아 '이 장 설정'으로 돌아간다)
  useEscape(() => setSideOpen(false), { active: sideOpen && !blocks.libraryOpen, typing: false })
  return {
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
}
