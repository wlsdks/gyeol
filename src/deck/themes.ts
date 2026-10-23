import type { CSSProperties } from 'react'
import type { Deck, ThemeId } from './types'

export interface Theme {
  id: ThemeId
  name: string
  description: string
  accent: string
  colors: { bg: string; ink: string; ink2: string; ink3: string; line: string; surface: string }
  headFont: string
  headWeight: number
  headTracking: string
}

const SANS = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
const SERIF = "'Hahmlet Variable', 'AppleMyungjo', 'Batang', serif"

export const THEMES: Record<ThemeId, Theme> = {
  white: {
    id: 'white',
    name: '화이트',
    description: '밝고 깔끔해요',
    accent: '#2350E8',
    colors: {
      bg: '#FFFFFF',
      ink: '#121A2B',
      ink2: '#4A5468',
      ink3: '#8790A2',
      line: '#E3E7EE',
      surface: '#F3F5F9',
    },
    headFont: SANS,
    headWeight: 700,
    headTracking: '-0.03em',
  },
  navy: {
    id: 'navy',
    name: '네이비',
    description: '어두운 화면이라 집중돼요',
    accent: '#8FB3FF',
    colors: {
      bg: '#0F1626',
      ink: '#F2F4F8',
      ink2: '#AAB4C7',
      ink3: '#6F7B91',
      line: '#243047',
      surface: '#172036',
    },
    headFont: SANS,
    headWeight: 700,
    headTracking: '-0.03em',
  },
  serif: {
    id: 'serif',
    name: '세리프',
    description: '차분하고 격식 있어요',
    accent: '#1E6B4F',
    colors: {
      bg: '#F1F3EE',
      ink: '#17271F',
      ink2: '#4C5B52',
      ink3: '#7F8B83',
      line: '#D3D9D1',
      surface: '#E5E9E2',
    },
    headFont: SERIF,
    headWeight: 600,
    headTracking: '-0.02em',
  },
}

export const THEME_ORDER: ThemeId[] = ['white', 'navy', 'serif']

export const ACCENT_PRESETS = [
  '#2350E8',
  '#0B7A75',
  '#1E6B4F',
  '#C2410C',
  '#B4235A',
  '#6D3FD1',
  '#B7791F',
  '#8FB3FF',
]

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 0
  const n = parseInt(m[1], 16)
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

/** 강조색 위에 올릴 글자색. 대비가 더 큰 쪽을 고른다. */
export function inkOn(hex: string): string {
  const l = luminance(hex)
  const contrastWhite = 1.05 / (l + 0.05)
  const contrastDark = (l + 0.05) / 0.0568
  return contrastWhite >= contrastDark ? '#FFFFFF' : '#10141F'
}

export function accentOf(deckTheme: Deck['theme']): string {
  return deckTheme.accent || THEMES[deckTheme.id].accent
}

export function themeStyle(deckTheme: Deck['theme']): CSSProperties {
  const theme = THEMES[deckTheme.id] ?? THEMES.white
  const accent = accentOf(deckTheme)
  const c = theme.colors
  return {
    '--bg': c.bg,
    '--ink': c.ink,
    '--ink-2': c.ink2,
    '--ink-3': c.ink3,
    '--line': c.line,
    '--surface': c.surface,
    '--accent': accent,
    '--accent-ink': inkOn(accent),
    '--font-head': theme.headFont,
    '--font-body': SANS,
    '--head-weight': theme.headWeight,
    '--display-weight': theme.headWeight + 100,
    '--head-tracking': theme.headTracking,
  } as CSSProperties
}
