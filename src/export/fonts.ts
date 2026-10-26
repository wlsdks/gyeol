// 내보낸 파일(HTML 발표 파일, PPT의 장 그림)에 넣는 글꼴. 실제로 쓴 글자가 들어 있는 묶음(unicode-range 조각)만 넣는다.
// 글꼴 파일은 이 화면이 이미 받아 둔 것(같은 주소)을 다시 읽어 data: 주소로 바꾼다. 바깥 주소로는 가지 않는다.

import { fontOf } from '../deck/themes'
import type { DeckTheme, FontId } from '../deck/types'

type Range = [number, number]

export function parseRanges(value: string): Range[] {
  return value.split(',').flatMap((part) => {
    const m = /U\+([0-9a-f?]+)(?:-([0-9a-f]+))?/i.exec(part.trim())
    if (!m) return []
    if (m[1].includes('?')) return [[parseInt(m[1].replace(/\?/g, '0'), 16), parseInt(m[1].replace(/\?/g, 'f'), 16)] as Range]
    const start = parseInt(m[1], 16)
    return [[start, m[2] ? parseInt(m[2], 16) : start] as Range]
  })
}

/**
 * 고른 글꼴 짝에 더해 넣는 글꼴 (themes.ts의 FONT_LOOK과 같은 짝). Pretendard는 늘 넣는다: 명조 제목의 본문이고,
 * 다른 글꼴에 없는 글자(SUIT의 드문 한글, ▲▼ 같은 기호)를 대신 그리고, 내보낸 파일의 뷰어 단추도 Pretendard다
 */
const EXTRA: Record<FontId, string[]> = {
  sans: [],
  serif: ['Hahmlet'],
  suit: ['SUIT'],
  myeongjo: ['Noto Serif KR'],
}

/** 이 테마가 쓰는 글꼴 (@font-face의 font-family를 고르는 식) */
export function fontFamiliesOf(theme: DeckTheme): RegExp {
  return new RegExp(['Pretendard', ...EXTRA[fontOf(theme)]].join('|'), 'i')
}

/** CSS가 content로 그리는 글자(인용 부호, 화살표). 글에는 없지만 글꼴 조각을 고를 때 넣는다 */
export function cssGlyphs(css: string): string {
  return [...css.matchAll(/content:\s*(['"])(.*?)\1/g)]
    .map((m) => m[2].replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16))))
    .join('')
}

/** 글에 든 글자들 (글꼴 조각 고르기에 쓴다) */
export function codePointsOf(text: string): number[] {
  return [...new Set([...text].map((ch) => ch.codePointAt(0)!))]
}

/** 조각의 unicode-range가 쓴 글자 하나라도 품는지. 범위가 없으면 모든 글자 */
export function rangeHits(range: string, used: number[]): boolean {
  if (!range) return true
  const ranges = parseRanges(range)
  return used.some((cp) => ranges.some(([a, b]) => cp >= a && cp <= b))
}

const fontCache = new Map<string, string>()

async function toDataUrl(url: string): Promise<string> {
  const cached = fontCache.get(url)
  if (cached) return cached
  const blob = await (await fetch(url)).blob()
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
  fontCache.set(url, dataUrl)
  return dataUrl
}

/** text에 쓰인 글자가 든 글꼴 조각들의 @font-face (data: 주소) */
export async function embedFonts(text: string, families: RegExp): Promise<string> {
  const used = codePointsOf(text)
  const out: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue
      const family = rule.style.getPropertyValue('font-family')
      if (!families.test(family)) continue
      const range = rule.style.getPropertyValue('unicode-range')
      if (!rangeHits(range, used)) continue
      const url = /url\(["']?([^"')]+)["']?\)/.exec(rule.style.getPropertyValue('src'))?.[1]
      if (!url) continue
      const data = await toDataUrl(new URL(url, sheet.href ?? location.href).href)
      out.push(
        `@font-face{font-family:${family};font-style:normal;font-weight:${rule.style.getPropertyValue('font-weight') || '100 900'};font-display:block;src:url(${data}) format('woff2');${range ? `unicode-range:${range};` : ''}}`,
      )
    }
  }
  return out.join('\n')
}
