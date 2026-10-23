export type LayoutId =
  | 'cover'
  | 'section'
  | 'agenda'
  | 'summary'
  | 'statement'
  | 'kpi'
  | 'scorecard'
  | 'bridge'
  | 'trend'
  | 'progress'
  | 'share'
  | 'process'
  | 'funnel'
  | 'table'
  | 'points'
  | 'compare'
  | 'matrix'
  | 'timeline'
  | 'case'
  | 'pricing'
  | 'imageText'
  | 'logos'
  | 'bars'
  | 'closing'
  /** 부품(블록)을 끌어다 놓아 꾸미는 장. 부품은 정해진 자리(줄과 칸)에만 들어간다 */
  | 'compose'

/** 윗분(팀장, 본부장)에게 하는 보고의 종류 */
export type DeckType = 'business' | 'deal' | 'improve' | 'report' | 'blank'
export type Audience = 'exec' | 'practitioner' | 'mixed'
export type Method = 'live' | 'remote' | 'send'
export type ThemeId = 'white' | 'navy' | 'serif'
/** 발표할 때의 움직임. 레이아웃마다 미리 짜 둔 순서로 움직이고, 사용자는 정도만 고른다. */
export type Motion = 'none' | 'calm' | 'lively'
/** 제목 글꼴. 없으면 테마의 글꼴 */
export type FontId = 'sans' | 'serif'
/** 발표 전체의 글자 크기 */
export type TextSize = 'small' | 'normal' | 'large'
/** 슬라이드 아래의 단락 지도와 쪽 번호 */
export type FooterMode = 'all' | 'page' | 'none'
/** 장을 넘길 때의 화면 전환. auto는 움직임 정도에 맞춘다 */
export type Transition = 'auto' | 'none' | 'fade' | 'slide' | 'zoom'
/** 장의 바탕. invert는 테마의 반대(밝은 테마면 어둡게), accent는 강조색 면 */
export type Tone = 'base' | 'invert' | 'accent'

export interface DeckTheme {
  id: ThemeId
  accent?: string
  font?: FontId
  size?: TextSize
  footer?: FooterMode
  transition?: Transition
}

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
  /** 강조할 항목 (0부터, -1은 강조 없음). 어느 레이아웃이 쓰는지는 LayoutSpec.highlight */
  highlight?: number
  /** 이미지와 설명: 이미지를 오른쪽에 */
  flip?: boolean
  /** 이미지와 설명: 자르지 않고 전체 보이기 */
  contain?: boolean
  /** 이 장만 다른 움직임. 없으면 발표 전체 설정을 따른다 */
  motion?: Motion
  /** 이 장의 바탕. 색 면 장(표지, 섹션, 마지막 장)에는 쓰지 않는다 */
  tone?: Tone
}

/** 부품 장만의 부품. 목록과 모양은 src/deck/blocks.ts */
export type NativeBlockType = 'message' | 'text' | 'bullets' | 'quote' | 'callout' | 'number' | 'delta' | 'goal' | 'image'

/** 장 레이아웃을 그대로 부품으로 쓰는 것. 칸과 그리는 법이 그 레이아웃과 같아서, 장을 부품 장으로 바꿔도 내용과 모습이 그대로다 */
export type LayoutBlockType = Extract<
  LayoutId,
  | 'summary'
  | 'points'
  | 'kpi'
  | 'scorecard'
  | 'bars'
  | 'bridge'
  | 'trend'
  | 'share'
  | 'funnel'
  | 'progress'
  | 'process'
  | 'timeline'
  | 'compare'
  | 'matrix'
  | 'pricing'
  | 'table'
  | 'logos'
  | 'agenda'
>

export type BlockType = NativeBlockType | LayoutBlockType

/** 부품의 바탕: 없음, 옅은 면, 진한 면 */
export type BlockLook = 'plain' | 'card' | 'bold'
/** 발표할 때 부품이 나타나는 모습. auto는 부품마다 짜 둔 움직임(숫자가 올라가고 막대가 자라는 것) */
export type BlockEffect = 'auto' | 'rise' | 'fade' | 'wipe' | 'pop' | 'blur' | 'none'

export interface Block {
  id: string
  type: BlockType
  fields: Record<string, string>
  items: Item[]
  /** 칸별 안내 문구. 없으면 부품 기본값 */
  hints?: Record<string, string>
  /** 없으면 부품마다 정한 기본 바탕 */
  look?: BlockLook
  /** 없으면 auto */
  effect?: BlockEffect
  /** 같은 부품 안의 모양 (레이아웃 부품은 그 레이아웃의 모양). 없으면 첫째 */
  variant?: string
  /** 강조할 항목 (0부터, -1은 없음). 없으면 부품마다 정한 기본 */
  highlight?: number
}

/** 부품 장의 한 줄. 칸 너비는 12를 나눈 값(spans)이고, 없거나 맞지 않으면 알아서 정한다 */
export interface BlockRow {
  id: string
  blocks: Block[]
  spans?: number[]
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
  /** 부품 장(compose)의 줄들. 다른 레이아웃에는 없다 */
  rows?: BlockRow[]
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
  theme: DeckTheme
  /** 없으면 'calm' */
  motion?: Motion
  slides: Slide[]
  /** AI(MCP)에게 이 발표의 모양을 보여 줄지. 사용자가 발표마다 직접 켠다. */
  aiShare?: boolean
}
