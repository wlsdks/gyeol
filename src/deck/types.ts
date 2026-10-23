export type LayoutId =
  | 'cover'
  | 'section'
  | 'agenda'
  | 'summary'
  | 'statement'
  | 'kpi'
  | 'points'
  | 'compare'
  | 'timeline'
  | 'case'
  | 'pricing'
  | 'imageText'
  | 'logos'
  | 'bars'
  | 'closing'

/** 윗분(팀장, 본부장)에게 하는 보고의 종류 */
export type DeckType = 'business' | 'deal' | 'improve' | 'report' | 'blank'
export type Audience = 'exec' | 'practitioner' | 'mixed'
export type Method = 'live' | 'remote' | 'send'
export type ThemeId = 'white' | 'navy' | 'serif'
/** 발표할 때의 움직임. 레이아웃마다 미리 짜 둔 순서로 움직이고, 사용자는 정도만 고른다. */
export type Motion = 'none' | 'calm' | 'lively'

/** 덱 단위 값. 슬라이드에서는 `$org`처럼 `$`를 붙여 참조한다. */
export type MetaKey = 'org' | 'presenter' | 'date' | 'contact' | 'logo'

export interface Item {
  id: string
  title: string
  body: string
  value: string
  meta: string
  image: string
}

export type ItemKey = Exclude<keyof Item, 'id'>

export interface SlideOptions {
  /** 안 비교, 막대 비교에서 강조할 항목 (0부터, -1은 강조 없음) */
  highlight?: number
  /** 이미지와 설명: 이미지를 오른쪽에 */
  flip?: boolean
  /** 이미지와 설명: 자르지 않고 전체 보이기 */
  contain?: boolean
}

export interface Slide {
  id: string
  layout: LayoutId
  /** 이 장의 역할. 슬라이드 목록과 도움말에 보인다. */
  purpose: string
  /** 하단에 보이는 섹션 이름 */
  section: string
  fields: Record<string, string>
  items: Item[]
  /** 칸별 안내 문구. 키는 `title`, `items.value` 같은 형태. 없으면 레이아웃 기본값을 쓴다. */
  hints: Record<string, string>
  /** 이 장을 어떻게 채우면 좋은지에 대한 설명 */
  guide: string
  notes: string
  options: SlideOptions
  /** 같은 레이아웃 안의 모양. 레이아웃마다 정해 둔 것 중 하나이고, 없으면 첫째 모양 */
  variant?: string
  hidden?: boolean
}

export interface DeckMeta {
  type: DeckType
  audience: Audience
  duration: number
  method: Method
  /** 발표자 소속 (예: 영업 2팀) */
  org: string
  presenter: string
  date: string
  contact: string
  logo: string
}

export interface Deck {
  id: string
  version: 1
  title: string
  createdAt: number
  updatedAt: number
  meta: DeckMeta
  theme: { id: ThemeId; accent?: string }
  /** 없으면 'calm' */
  motion?: Motion
  slides: Slide[]
  /** AI(MCP)에게 이 발표의 모양을 보여 줄지. 사용자가 발표마다 직접 켠다. */
  aiShare?: boolean
}
