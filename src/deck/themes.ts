import type { CSSProperties } from 'react'
import type { Deck, DeckTheme, FontId, FooterMode, Motion, Slide, TextSize, ThemeId, Tone, Transition } from './types'

export interface Theme {
  id: ThemeId
  name: string
  description: string
  accent: string
  /**
   * 짙은 면(단락 장, 표지 옆면, 진한 면 부품)의 색. 강조색은 '답'(숫자, 고른 막대)에만 쓰고, 넓은 면은 같은 계열의 깊은 색으로 깐다.
   * 넓은 면을 쨍한 강조색으로 칠하면 화면이 시끄럽고 싸 보인다
   */
  deep: string
  /** good, bad: 목표 대비, 증감처럼 좋고 나쁨을 보일 때만 쓴다. 늘 글자(▲▼, 달성)와 함께 */
  colors: { bg: string; ink: string; ink2: string; ink3: string; line: string; surface: string; good: string; bad: string }
}

const SANS = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
const SERIF = "'Hahmlet Variable', 'AppleMyungjo', 'Batang', serif"

/*
 * 색은 공개된 색 체계의 원칙을 따라 새로 골랐다 (docs/DESIGN.md '색'):
 * - 회색은 강조색과 같은 계열로 아주 옅게 물들인다 (Radix Colors의 'natural pairing': 파랑에는 푸른 회색, 초록에는 초록 회색)
 * - 맥락(작년, 다른 조각)은 회색, 강조색은 말하려는 한 곳에만 (Datawrapper의 차트 색 안내)
 * - 넓은 면은 강조색을 깊게 가라앉힌 색, 그 위의 강조는 강조색을 밝힌 색
 */
export const THEMES: Record<ThemeId, Theme> = {
  white: {
    id: 'white',
    name: '화이트',
    description: '밝고 깔끔해요',
    accent: '#2F55D4',
    deep: '#16204A',
    colors: {
      bg: '#FFFFFF',
      ink: '#141A29',
      ink2: '#4A5266',
      ink3: '#868DA0',
      line: '#E2E5EC',
      surface: '#F3F4F8',
      good: '#137A56',
      bad: '#C93A2E',
    },
  },
  navy: {
    id: 'navy',
    name: '네이비',
    description: '깊은 남색에 금빛 강조. 집중돼요',
    accent: '#E8B54A',
    deep: '#1C3160',
    colors: {
      bg: '#0C1222',
      ink: '#EEF1F7',
      ink2: '#A7B0C4',
      ink3: '#6B7690',
      line: '#232D45',
      surface: '#141C30',
      good: '#67CFA0',
      bad: '#FF8B7E',
    },
  },
  serif: {
    id: 'serif',
    name: '세리프',
    description: '차분하고 격식 있어요',
    accent: '#1B6A52',
    deep: '#13302A',
    colors: {
      bg: '#F3F3EF',
      ink: '#191D1A',
      ink2: '#4E5550',
      ink3: '#858B85',
      line: '#D9DBD4',
      surface: '#E8E9E3',
      good: '#1B6A52',
      bad: '#A63D2F',
    },
  },
}

/**
 * 고를 수 있는 색 조합: 강조색과 짙은 면의 짝. 짝마다 세 테마와 바탕(그대로, 반대 색, 강조색)에서 맞춰 보고 골랐다.
 * 강조색을 직접 고르면 짙은 면은 그 색을 깊게 가라앉혀 만든다 (deepOf)
 */
export const ACCENT_COMBOS: { name: string; accent: string; deep: string }[] = [
  { name: '코발트', accent: '#2F55D4', deep: '#16204A' },
  { name: '청록', accent: '#0B776E', deep: '#0F3330' },
  { name: '숲', accent: '#1B6A52', deep: '#13302A' },
  { name: '남보라', accent: '#4A45B5', deep: '#201E52' },
  { name: '자두', accent: '#9A2F5F', deep: '#381426' },
  { name: '벽돌', accent: '#B8432A', deep: '#3A1D16' },
  { name: '황토', accent: '#9E6A12', deep: '#33260F' },
  { name: '금빛', accent: '#E8B54A', deep: '#1C3160' },
  { name: '먹', accent: '#3A4254', deep: '#161A22' },
]

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

/** 고른 색 조합의 이름 (테마 기본색, 직접 고른 색도) */
export function comboName(deckTheme: DeckTheme): string {
  if (!deckTheme.accent) return '테마 기본색'
  return ACCENT_COMBOS.find((c) => c.accent.toLowerCase() === deckTheme.accent?.toLowerCase())?.name ?? '직접 고른 색'
}

/** 색 조합 견본: 왼쪽 위는 강조색, 오른쪽 아래는 짙은 면 */
export function comboSwatch(c: { accent: string; deep: string }): string {
  return `linear-gradient(135deg, ${c.accent} 0 52%, ${c.deep} 52% 100%)`
}

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

/**
 * glyph: 한 줄로 줄이는 글(숫자 등)의 글자 폭이 고딕(textUnits의 기준)보다 얼마나 넓은지. 명조는 숫자와 %가 넓다.
 * tall: 큰 숫자의 줄 높이를 얼마나 늘리는지. 명조는 한글과 숫자의 키가 커서 줄 높이 0.8로는 위아래 글에 올라탄다
 */
const FONT_LOOK: Record<FontId, { font: string; weight: number; tracking: string; glyph: number; tall: number }> = {
  sans: { font: SANS, weight: 700, tracking: '-0.022em', glyph: 1, tall: 1 },
  serif: { font: SERIF, weight: 600, tracking: '-0.012em', glyph: 1.15, tall: 1.18 },
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
  /** 짙은 면, 그 위의 글자, 그 위의 강조, 그 위의 아주 큰 글자(단락 번호) */
  deep: string
  deepInk: string
  deepAccent: string
  deepMark: string
}

const NIGHT = '#0A0D16'

/**
 * 짙은 면의 색. 고른 색 조합이면 그 짝, 직접 고른 색이면 그 색을 깊게 가라앉힌 색.
 * 어두운 테마는 바탕보다 한 단계 떠 있는 테마의 짙은 면을 쓴다 (강조색을 섞으면 금빛이 탁한 올리브가 된다)
 */
function deepOf(theme: Theme, accent: string, dark: boolean): string {
  if (dark) return theme.deep
  const combo = ACCENT_COMBOS.find((c) => c.accent.toLowerCase() === accent.toLowerCase())
  if (combo && luminance(combo.deep) < 0.05) return combo.deep
  if (accent.toLowerCase() === theme.accent.toLowerCase()) return theme.deep
  return mix(accent, NIGHT, 0.34)
}

/**
 * 짙은 면 위에서 강조할 색: 강조색을 그 면 위에서 읽힐 만큼 밝힌다. 원래 밝은 색(금빛)은 그대로.
 * 글자와 점은 4.5:1, 단락 번호처럼 아주 큰 글자는 3:1이면 되어 강조색의 짙은 맛을 덜 잃는다
 */
function accentOnDeep(accent: string, deep: string, need = 4.5): string {
  for (let t = 1; t >= 0.2; t -= 0.05) {
    const c = mix(accent, '#FFFFFF', t)
    if (contrast(c, deep) >= need) return c
  }
  return '#FFFFFF'
}

/** 밝은 테마의 회색 면과 선을 강조색 쪽으로 아주 옅게 물들인다. 강조색을 바꿔도 회색이 따로 놀지 않게 */
function tinted(colors: Theme['colors'], accent: string): Theme['colors'] {
  return { ...colors, surface: mix(accent, colors.surface, 0.02), line: mix(accent, colors.line, 0.03) }
}

function paletteOf(deckTheme: DeckTheme, tone: Tone): Palette {
  const theme = THEMES[deckTheme.id] ?? THEMES.white
  const accent = accentOf(deckTheme)
  if (tone === 'invert') {
    const other = theme.id === 'navy' ? THEMES.white : THEMES.navy
    const a = readable(accent, other.colors.bg)
    const dark = luminance(other.colors.bg) < 0.2
    const deep = dark ? other.deep : deepOf(theme, accent, false)
    return { ...(dark ? other.colors : tinted(other.colors, a)), accent: a, accentInk: inkOn(a), deep, deepInk: inkOn(deep), deepAccent: accentOnDeep(a, deep), deepMark: accentOnDeep(a, deep, 3) }
  }
  if (tone === 'accent') {
    // 강조색이 바탕이 되면 글자는 그 위에서 읽히는 색, 강조는 글자색 그대로 굵게
    const ink = inkOn(accent)
    const deep = mix(accent, NIGHT, 0.5)
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
      deep,
      deepInk: inkOn(deep),
      deepAccent: inkOn(deep),
      deepMark: inkOn(deep),
    }
  }
  // 금빛처럼 밝은 강조색도 흰 바탕에서 숫자가 읽히게 (기본 강조색은 이미 넉넉해서 그대로)
  const a = readable(accent, theme.colors.bg)
  const dark = luminance(theme.colors.bg) < 0.2
  const deep = deepOf(theme, accent, dark)
  return { ...(dark ? theme.colors : tinted(theme.colors, a)), accent: a, accentInk: inkOn(a), deep, deepInk: inkOn(deep), deepAccent: accentOnDeep(accent, deep), deepMark: accentOnDeep(accent, deep, 3) }
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
    '--deep': c.deep,
    '--deep-ink': c.deepInk,
    '--deep-accent': c.deepAccent,
    '--deep-mark': c.deepMark,
    '--font-head': f.font,
    '--font-body': SANS,
    '--head-weight': f.weight,
    '--display-weight': f.weight + 100,
    '--head-tracking': f.tracking,
    '--glyph-k': f.glyph,
    '--tall': f.tall,
  } as CSSProperties
}
