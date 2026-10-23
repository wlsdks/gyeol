import type { Deck } from '../deck/types'

// 작업 파일(.deck): 발표자 노트까지 모두 담는다. 고객에게 보내는 HTML과 다른 파일이다.

export const DECK_EXT = '.deck'
const FORMAT = 'html-maker/deck'

interface DeckFileData {
  format: typeof FORMAT
  version: 1
  savedAt: number
  deck: Deck
}

export function encodeDeckFile(deck: Deck): string {
  const data: DeckFileData = { format: FORMAT, version: 1, savedAt: Date.now(), deck }
  return JSON.stringify(data)
}

export function isDeck(value: unknown): value is Deck {
  const d = value as Deck
  return !!d && typeof d === 'object' && typeof d.id === 'string' && Array.isArray(d.slides) && !!d.meta && !!d.theme
}

export function decodeDeckFile(text: string): Deck | null {
  try {
    const data = JSON.parse(text) as Partial<DeckFileData>
    return data.format === FORMAT && isDeck(data.deck) ? data.deck : null
  } catch {
    return null
  }
}

/** 윈도우와 맥 어디서나 쓸 수 있는 파일 이름 */
export function safeFileName(title: string, fallback = '제목 없는 발표'): string {
  // eslint-disable-next-line no-control-regex
  const name = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim()
  return name.slice(0, 80).trim() || fallback
}

/** 2026-10-23 15-12 처럼 이름순으로 정렬하면 시간순이 되는 표기 */
export function fileStamp(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}`
}

export function downloadText(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 폴더를 쓸 수 없는 브라우저에서 작업 파일을 내려받는다 */
export function downloadDeckFile(deck: Deck) {
  downloadText(encodeDeckFile(deck), `${safeFileName(deck.title)}${DECK_EXT}`, 'application/json')
}
