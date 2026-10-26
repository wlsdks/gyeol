import { describe, expect, it } from 'vitest'
import { ACCENT_COMBOS, THEME_ORDER, TONES, themeStyle } from './themes'

// 짙은 면(진한 면 컴포넌트, 표지 옆면, 색 면 단락 장) 위의 글이 묻히지 않는지. 예전에는 면이 쨍한 남색이고 강조가 4.5:1이라
// 답(후 숫자)이 흰 이름표보다 흐렸고, 바뀐 만큼 칩은 3.7:1이었다

function rgb(hex: string): number[] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (hi + 0.05) / (lo + 0.05)
}

/** CSS의 color-mix(in srgb, a t, b)와 같은 섞기 */
function mix(a: string, b: string, t: number): string {
  const x = rgb(a)
  const y = rgb(b)
  return '#' + x.map((c, i) => Math.round(c * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('')
}

describe('짙은 면 위의 글', () => {
  for (const id of THEME_ORDER)
    for (const tone of TONES.map((t) => t.id))
      for (const combo of ACCENT_COMBOS) {
        it(`${id}, ${tone}, ${combo.name}`, () => {
          const s = themeStyle({ id, accent: combo.accent }, tone) as Record<string, string>
          const deep = s['--deep']
          const ink = s['--deep-ink']
          const accent = s['--deep-accent']
          // 흰 글과 답(강조): 큰 숫자, 이름표
          expect(contrast(ink, deep)).toBeGreaterThanOrEqual(11.5)
          expect(contrast(accent, deep)).toBeGreaterThanOrEqual(7)
          expect(contrast(s['--deep-mark'], deep)).toBeGreaterThanOrEqual(7)
          // 옅은 글(--ink-3, looks.css의 60%): 전 숫자, 덧붙임 글, 이름표
          expect(contrast(mix(ink, deep, 0.6), deep)).toBeGreaterThanOrEqual(4.5)
          // 바뀐 만큼 칩: 강조 16%를 깐 옅은 면(--accent-soft) 위의 강조 글
          expect(contrast(accent, mix(accent, deep, 0.16))).toBeGreaterThanOrEqual(4.5)
        })
      }
})
