import type { CSSProperties } from 'react'
import type { Deck, DeckTheme, FontId, FooterMode, Motion, Slide, TextSize, ThemeId, Tone, Transition } from './types'

export interface Theme {
  id: ThemeId
  name: string
  description: string
  accent: string
  /** good, bad: 목표 대비, 증감처럼 좋고 나쁨을 보일 때만 쓴다. 늘 글자(▲▼, 달성)와 함께 */
  colors: { bg: string; ink: string; ink2: string; ink3: string; line: string; surface: string; good: string; bad: string }
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
  },
}

export const THEME_ORDER: ThemeId[] = ['white', 'navy', 'serif']

/** 발표할 때의 움직임. 이름과 설명은 테마 메뉴와 AI 카탈로그에 함께 쓴다. */
export const MOTIONS: { id: Motion; name: string; description: string }[] = [
  { id: 'none', name: '없음', description: '넘기면 바로 다 보여요.' },
  { id: 'calm', name: '차분하게', description: '제목, 항목이 차례로 살짝 올라와요. 보고 자리에 어울려요.' },
  { id: 'lively', name: '생동감', description: '더 크게 움직이고 숫자가 0부터 올라가요. 발표가 길 때 좋아요.' },
]

/** 고를 수 있는 것들. 이름과 설명은 테마 메뉴, 이 장 설정, AI 카탈로그에 함께 쓴다. */
export const FONTS: { id: FontId; name: string; description: string }[] = [
  { id: 'sans', name: '고딕', description: '또렷하고 현대적이에요.' },
  { id: 'serif', name: '명조', description: '제목이 차분하고 격식 있어 보여요.' },
]

export const TEXT_SIZES: { id: TextSize; name: string; description: string }[] = [
  { id: 'small', name: '작게', description: '글이 많은 장도 넉넉하게 들어가요.' },
  { id: 'normal', name: '보통', description: '회의실 화면에 맞춘 크기예요.' },
  { id: 'large', name: '크게', description: '큰 회의실이나 화면 공유에서 잘 읽혀요.' },
]

export const FOOTERS: { id: FooterMode; name: string; description: string }[] = [
  { id: 'all', name: '단락과 쪽 번호', description: '아래에 지금 단락과 쪽 번호가 보여요.' },
  { id: 'page', name: '쪽 번호만', description: '아래에 쪽 번호만 보여요.' },
  { id: 'none', name: '숨기기', description: '아래에 아무것도 넣지 않아요.' },
]

export const TRANSITIONS: { id: Transition; name: string; description: string }[] = [
  { id: 'auto', name: '움직임에 맞춰', description: '차분하게는 흐리게, 생동감은 밀기로 넘어가요.' },
  { id: 'none', name: '바로', description: '전환 없이 바로 다음 장이 보여요.' },
  { id: 'fade', name: '흐리게', description: '앞 장이 흐려지며 다음 장이 나타나요.' },
  { id: 'slide', name: '밀기', description: '다음 장이 옆에서 밀고 들어와요.' },
  { id: 'zoom', name: '다가오기', description: '다음 장이 앞으로 다가오듯 커지며 나타나요.' },
]

export const TONES: { id: Tone; name: string; description: string }[] = [
  { id: 'base', name: '바탕', description: '발표 전체와 같은 바탕이에요.' },
  { id: 'invert', name: '반대 색', description: '밝은 테마는 어둡게, 어두운 테마는 밝게. 흐름을 끊고 눈길을 모아요.' },
  { id: 'accent', name: '강조색', description: '강조색 면 위에 글을 놓아요. 가장 중요한 장 한두 곳에만 써요.' },
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

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const n = m ? parseInt(m[1], 16) : 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** a를 t만큼, b를 (1 - t)만큼 섞은 색 */
function mix(a: string, b: string, t: number): string {
  const x = rgb(a)
  const y = rgb(b)
  return '#' + x.map((c, i) => Math.round(c * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('')
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (hi + 0.05) / (lo + 0.05)
}

/** 바탕 위에서 큰 글자로 읽힐 만큼(3:1) 강조색을 밝히거나 어둡게 한다 */
function readable(accent: string, bg: string): string {
  const toward = luminance(bg) < 0.2 ? '#FFFFFF' : '#10141F'
  for (let t = 1; t >= 0.2; t -= 0.1) {
    const c = mix(accent, toward, t)
    if (contrast(c, bg) >= 3) return c
  }
  return toward
}

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

const FONT_LOOK: Record<FontId, { font: string; weight: number; tracking: string }> = {
  sans: { font: SANS, weight: 700, tracking: '-0.022em' },
  serif: { font: SERIF, weight: 600, tracking: '-0.012em' },
}

/** 테마가 원래 쓰는 글꼴 */
export function fontOf(deckTheme: DeckTheme): FontId {
  if (deckTheme.font && FONT_LOOK[deckTheme.font]) return deckTheme.font
  return deckTheme.id === 'serif' ? 'serif' : 'sans'
}

/** 이 장의 움직임: 장에 정한 값, 없으면 발표 전체 값 */
export function motionOf(deck: Pick<Deck, 'motion'>, slide?: Pick<Slide, 'options'>): Motion {
  const own = slide?.options.motion
  if (own && MOTIONS.some((m) => m.id === own)) return own
  return deck.motion ?? 'calm'
}

/** 장을 넘길 때의 전환. '움직임에 맞춰'면 움직임 정도로 정한다 */
export function transitionOf(deck: Pick<Deck, 'theme' | 'motion'>): Exclude<Transition, 'auto'> {
  const t = deck.theme.transition
  if (t && t !== 'auto' && TRANSITIONS.some((x) => x.id === t)) return t as Exclude<Transition, 'auto'>
  const m = deck.motion ?? 'calm'
  return m === 'lively' ? 'slide' : m === 'calm' ? 'fade' : 'none'
}

export function toneOf(slide: Pick<Slide, 'options'>): Tone {
  const t = slide.options.tone
  return t && TONES.some((x) => x.id === t) ? t : 'base'
}

interface Palette {
  bg: string
  ink: string
  ink2: string
  ink3: string
  line: string
  surface: string
  good: string
  bad: string
  accent: string
  accentInk: string
}

function paletteOf(deckTheme: DeckTheme, tone: Tone): Palette {
  const theme = THEMES[deckTheme.id] ?? THEMES.white
  const accent = accentOf(deckTheme)
  if (tone === 'invert') {
    const other = theme.id === 'navy' ? THEMES.white : THEMES.navy
    const a = readable(accent, other.colors.bg)
    return { ...other.colors, accent: a, accentInk: inkOn(a) }
  }
  if (tone === 'accent') {
    // 강조색이 바탕이 되면 글자는 그 위에서 읽히는 색, 강조는 글자색 그대로 굵게
    const ink = inkOn(accent)
    return {
      bg: accent,
      ink,
      ink2: mix(ink, accent, 0.84),
      ink3: mix(ink, accent, 0.66),
      line: mix(ink, accent, 0.26),
      surface: mix(ink, accent, 0.1),
      good: ink,
      bad: ink,
      accent: ink,
      accentInk: accent,
    }
  }
  return { ...theme.colors, accent, accentInk: inkOn(accent) }
}

/** 이 바탕이 어두운지. 어두운 바탕에서는 로고 밑에 밝은 면을 까는 등 몇 가지를 바꾼다 */
export function isDarkLook(deckTheme: DeckTheme, tone: Tone = 'base'): boolean {
  return luminance(paletteOf(deckTheme, tone).bg) < 0.2
}

export function themeStyle(deckTheme: DeckTheme, tone: Tone = 'base'): CSSProperties {
  const c = paletteOf(deckTheme, tone)
  const f = FONT_LOOK[fontOf(deckTheme)]
  return {
    '--bg': c.bg,
    '--ink': c.ink,
    '--ink-2': c.ink2,
    '--ink-3': c.ink3,
    '--line': c.line,
    '--surface': c.surface,
    '--good': c.good,
    '--bad': c.bad,
    '--accent': c.accent,
    '--accent-ink': c.accentInk,
    '--font-head': f.font,
    '--font-body': SANS,
    '--head-weight': f.weight,
    '--display-weight': f.weight + 100,
    '--head-tracking': f.tracking,
  } as CSSProperties
}
