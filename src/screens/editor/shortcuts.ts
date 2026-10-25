import { useEffect, useEffectEvent } from 'react'
import { presentKey } from '../../lib/presentKeys'
import { useDeck } from '../../store/deckStore'
import { dialogOpen, isTyping, type Toast } from '../ui'
import type { PresentHow } from './DeckMenus'

/**
 * 편집기의 단축키: 되돌리기, F5로 발표 (PowerPoint와 같게), Ctrl+S 저장, Ctrl+P PDF.
 * 창에는 한 번만 걸고 늘 최근 처리기를 부른다 (예전에는 글자 하나 칠 때마다 떼었다 다시 걸었다)
 */
export function useEditorShortcuts(on: {
  /** 발표하는 동안은 쉰다 (발표 화면이 키를 받는다) */
  paused: boolean
  /** F5는 처음부터, Shift+F5는 지금 장부터. Alt를 같이 누르면 발표자 화면과 함께 */
  present(here: boolean, how: PresentHow): void
  /** 두 곳에 바로 저장한다. 고른 폴더나 브라우저에 쓰지 못하면 false */
  saveNow(): Promise<boolean>
  print(): void
  toast: Toast
}) {
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    const typing = isTyping(e)
    const mod = e.metaKey || e.ctrlKey
    // 한글 입력 상태에서는 Ctrl+Z가 'ㅋ'로 와서 글자 키는 자판 자리로 읽는다
    const k = presentKey(e).toLowerCase()
    const save = mod && !e.shiftKey && !e.altKey && k === 's'
    // Ctrl+P를 브라우저에 맡기면 인쇄할 장이 없어 빈 쪽이 나온다. 내보내기의 PDF와 같은 길로 보낸다
    const print = mod && !e.shiftKey && !e.altKey && k === 'p'
    // 브라우저의 새로 고침, 페이지 저장, 인쇄 창은 글을 쓰는 중에도, 창이 떠 있어도 막는다
    if (e.key === 'F5' || save || print) e.preventDefault()
    if (on.paused || dialogOpen()) return
    if (e.key === 'F5') {
      on.present(e.shiftKey, e.altKey ? 'presenter' : 'auto')
      return
    }
    if (save) {
      void on.saveNow().then((ok) =>
        on.toast.show(ok ? '저장했어요. 고칠 때마다 자동으로 저장되고 있어요.' : '저장하지 못했어요. 위쪽의 저장 상태를 눌러 할 일을 확인해 주세요.'),
      )
      return
    }
    if (print) {
      on.print()
      return
    }
    if (typing) return
    const { undo, redo } = useDeck.getState()
    if (mod && k === 'z') {
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    } else if (mod && k === 'y') {
      e.preventDefault()
      redo()
    }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onShortcut(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
