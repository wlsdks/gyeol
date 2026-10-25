import type { Deck } from '../deck/types'

// 작업 파일(.deck): 발표자 노트까지 모두 담는다. 듣는 분께 나눠 주는 발표 파일(HTML)과 다른 파일이다.

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

/**
 * 윈도우와 맥 어디서나 쓸 수 있는 파일 이름.
 * 윈도우는 경로 전체가 260자를 넘으면 못 쓰는 프로그램이 많아서, 버전 기록 폴더까지 생각해 짧게 자른다.
 */
export function safeFileName(title: string, fallback = '제목 없는 발표', max = 60): string {
  const name = title
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .normalize('NFC')
    .slice(0, max)
    // 윈도우는 끝의 점과 빈칸을 지워 버려서 다른 파일과 이름이 겹칠 수 있다
    .replace(/[. ]+$/, '')
    .trim()
  // CON, NUL, COM1 같은 이름은 윈도우에서 파일로 만들 수 없다
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i.test(name)) return `${name} 발표`
  return name || fallback
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
