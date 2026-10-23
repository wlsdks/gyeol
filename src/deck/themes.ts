import type { CSSProperties } from 'react'
import type { Deck, Motion, ThemeId } from './types'

export interface Theme {
  id: ThemeId
  name: string
  description: string
  accent: string
  /** good, bad: 목표 대비, 증감처럼 좋고 나쁨을 보일 때만 쓴다. 늘 글자(▲▼, 달성)와 함께 */
  colors: { bg: string; ink: string; ink2: string; ink3: string; line: string; surface: string; good: string; bad: string }
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
      good: '#13795B',
      bad: '#C8372D',
    },
    headFont: SANS,
    headWeight: 700,
    headTracking: '-0.022em',
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
      good: '#6FD3A0',
      bad: '#FF8A80',
    },
    headFont: SANS,
    headWeight: 700,
    headTracking: '-0.022em',
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
      good: '#1E6B4F',
      bad: '#A63D2F',
    },
    headFont: SERIF,
    headWeight: 600,
    headTracking: '-0.012em',
  },
}

export const THEME_ORDER: ThemeId[] = ['white', 'navy', 'serif']

/** 발표할 때의 움직임. 이름과 설명은 테마 메뉴와 AI 카탈로그에 함께 쓴다. */
export const MOTIONS: { id: Motion; name: string; description: string }[] = [
  { id: 'none', name: '없음', description: '넘기면 바로 다 보여요.' },
  { id: 'calm', name: '차분하게', description: '제목, 항목이 차례로 살짝 올라와요. 보고 자리에 어울려요.' },
  { id: 'lively', name: '생동감', description: '더 크게 움직이고 숫자가 0부터 올라가요. 발표가 길 때 좋아요.' },
]

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
    '--good': c.good,
    '--bad': c.bad,
    '--accent': accent,
    '--accent-ink': inkOn(accent),
    '--font-head': theme.headFont,
    '--font-body': SANS,
    '--head-weight': theme.headWeight,
    '--display-weight': theme.headWeight + 100,
    '--head-tracking': theme.headTracking,
  } as CSSProperties
}
