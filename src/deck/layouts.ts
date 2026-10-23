import type { ItemKey, LayoutId } from './types'

export interface FieldSpec {
  /** 슬라이드 칸 이름. `$`로 시작하면 덱 단위 값(소속, 발표자 등) */
  key: string
  label: string
  hint: string
  multiline?: boolean
  optional?: boolean
  image?: boolean
}

export interface ItemFieldSpec {
  key: ItemKey
  label: string
  hint: string
  multiline?: boolean
  optional?: boolean
  image?: boolean
}

/** 같은 칸을 다르게 놓은 모양. 내용은 그대로 두고 배치만 바뀐다. */
export interface VariantSpec {
  id: string
  name: string
}

export interface LayoutSpec {
  id: LayoutId
  name: string
  description: string
  /** 첫째가 기본 모양. 없으면 한 가지 모양뿐 */
  variants?: VariantSpec[]
  fields: FieldSpec[]
  items?: {
    label: string
    min: number
    max: number
    default: number
    fields: ItemFieldSpec[]
  }
}

const title = (hint: string): FieldSpec => ({ key: 'title', label: '제목', hint })
/** 숫자 장 아래의 출처·기준. 윗분이 "이 숫자 어디서 나왔어요?"를 묻지 않게 */
const source: FieldSpec = { key: 'source', label: '출처', hint: '출처나 기준 시점 (예: 영업관리 시스템, 9월 말 기준)', optional: true }
const lead = (hint = '제목을 뒷받침하는 한두 문장'): FieldSpec => ({
  key: 'lead',
  label: '부제',
  hint,
  multiline: true,
  optional: true,
})

export const LAYOUTS: Record<LayoutId, LayoutSpec> = {
  cover: {
    id: 'cover',
    name: '표지',
    description: '보고 제목과 결정 요청, 발표자',
    fields: [
      { key: 'title', label: '발표 제목', hint: '발표 제목', multiline: true },
      { key: 'lead', label: '부제', hint: '한 줄 부제', optional: true },
      { key: 'ask', label: '결정 요청', hint: '결정받고 싶은 것을 한 줄로', multiline: true, optional: true },
      { key: '$org', label: '소속', hint: '소속 (예: 영업 2팀)', optional: true },
      { key: '$presenter', label: '발표자', hint: '발표자 이름', optional: true },
      { key: '$date', label: '날짜', hint: '발표 날짜', optional: true },
      { key: '$logo', label: '회사 로고', hint: '회사 로고', optional: true, image: true },
    ],
  },
  section: {
    id: 'section',
    name: '섹션 구분',
    description: '이야기의 큰 단락을 나눠요',
    fields: [title('이번 단락의 제목'), lead('이 단락에서 다룰 내용')],
  },
  agenda: {
    id: 'agenda',
    name: '목차',
    description: '오늘 다룰 순서',
    variants: [
      { id: 'base', name: '목록' },
      { id: 'columns', name: '나란히' },
    ],
    fields: [title('목차')],
    items: {
      label: '목차 항목',
      min: 2,
      max: 6,
      default: 4,
      fields: [{ key: 'title', label: '항목', hint: '다룰 내용' }],
    },
  },
  summary: {
    id: 'summary',
    name: '한 장 요약',
    description: '결론과 줄마다의 요점을 한 장에',
    variants: [
      { id: 'base', name: '줄' },
      { id: 'grid', name: '칸' },
    ],
    fields: [{ key: 'title', label: '결론', hint: '한 줄 결론', multiline: true }],
    items: {
      label: '줄',
      min: 2,
      max: 5,
      default: 4,
      fields: [
        { key: 'title', label: '이름', hint: '배경' },
        { key: 'body', label: '내용', hint: '한두 문장', multiline: true },
      ],
    },
  },
  statement: {
    id: 'statement',
    name: '한 문장 메시지',
    description: '가장 중요한 말을 크게',
    variants: [
      { id: 'base', name: '바탕' },
      { id: 'bold', name: '색 면' },
    ],
    fields: [
      { key: 'title', label: '메시지', hint: '전하고 싶은 메시지를 한 문장으로', multiline: true },
      lead(),
    ],
  },
  kpi: {
    id: 'kpi',
    name: '핵심 숫자',
    description: '숫자 2~4개를 크게',
    variants: [
      { id: 'base', name: '나란히' },
      { id: 'focus', name: '하나 크게' },
      { id: 'cards', name: '카드' },
    ],
    fields: [title('숫자들이 말해 주는 결론'), source],
    items: {
      label: '숫자',
      min: 1,
      max: 4,
      default: 3,
      fields: [
        { key: 'value', label: '숫자', hint: '30%' },
        { key: 'title', label: '이름', hint: '지표 이름' },
        { key: 'body', label: '설명', hint: '짧은 설명', multiline: true, optional: true },
      ],
    },
  },
  points: {
    id: 'points',
    name: '핵심 포인트',
    description: '나란히 놓는 2~4가지',
    variants: [
      { id: 'base', name: '줄' },
      { id: 'columns', name: '세로 칸' },
      { id: 'tiles', name: '타일' },
    ],
    fields: [title('포인트들을 묶는 제목'), lead()],
    items: {
      label: '포인트',
      min: 2,
      max: 4,
      default: 3,
      fields: [
        { key: 'title', label: '이름', hint: '포인트 이름' },
        { key: 'body', label: '설명', hint: '한두 문장 설명', multiline: true },
      ],
    },
  },
  compare: {
    id: 'compare',
    name: '비교',
    description: '두 가지를 줄마다 나란히 (지금과 바뀐 뒤, 위험과 대응)',
    variants: [
      { id: 'base', name: '두 면' },
      { id: 'table', name: '표' },
    ],
    fields: [
      title('비교해서 보여줄 결론'),
      { key: 'leftTitle', label: '왼쪽 머리말', hint: '지금' },
      { key: 'rightTitle', label: '오른쪽 머리말', hint: '바뀐 뒤' },
    ],
    items: {
      label: '비교 줄',
      min: 2,
      max: 5,
      default: 3,
      fields: [
        { key: 'title', label: '왼쪽', hint: '지금의 모습' },
        { key: 'body', label: '오른쪽', hint: '바뀐 뒤의 모습' },
      ],
    },
  },
  timeline: {
    id: 'timeline',
    name: '일정',
    description: '단계별 순서와 시기',
    variants: [
      { id: 'base', name: '가로' },
      { id: 'steps', name: '세로' },
    ],
    fields: [title('일정을 요약하는 제목')],
    items: {
      label: '단계',
      min: 2,
      max: 6,
      default: 4,
      fields: [
        { key: 'meta', label: '시기', hint: '1개월 차' },
        { key: 'title', label: '단계', hint: '단계 이름' },
        { key: 'body', label: '설명', hint: '이 단계에서 하는 일', multiline: true, optional: true },
      ],
    },
  },
  case: {
    id: 'case',
    name: '사례',
    description: '비슷한 사례와 그 결과',
    fields: [
      { key: 'client', label: '대상', hint: '고객사, 업종 또는 부서' },
      { key: 'title', label: '결과', hint: '얻은 결과를 한 문장으로', multiline: true },
      { key: 'body', label: '내용', hint: '어떤 과제를 어떻게 해결했는지', multiline: true },
      { key: 'quote', label: '한마디', hint: '담당자나 고객의 한마디', multiline: true, optional: true },
      { key: 'image', label: '로고 또는 사진', hint: '로고', optional: true, image: true },
    ],
    items: {
      label: '성과 숫자',
      min: 0,
      max: 3,
      default: 2,
      fields: [
        { key: 'value', label: '숫자', hint: '40%' },
        { key: 'title', label: '이름', hint: '지표 이름' },
      ],
    },
  },
  pricing: {
    id: 'pricing',
    name: '안 비교',
    description: '두세 가지 안이나 가격을 나란히, 추천안 강조',
    fields: [title('어느 안을 추천하는지 한 문장으로')],
    items: {
      label: '안',
      min: 1,
      max: 3,
      default: 3,
      fields: [
        { key: 'title', label: '이름', hint: 'A안' },
        { key: 'value', label: '비용', hint: '1.2억 원' },
        { key: 'meta', label: '조건', hint: '기간, 인력 같은 조건', optional: true },
        { key: 'body', label: '내용', hint: '내용과 장단점을 한 줄에 하나씩', multiline: true },
      ],
    },
  },
  imageText: {
    id: 'imageText',
    name: '이미지와 설명',
    description: '제품 화면이나 사진과 설명',
    fields: [
      title('이미지가 보여주는 것'),
      { key: 'body', label: '설명', hint: '이미지를 설명하는 두세 문장', multiline: true },
      { key: 'image', label: '이미지', hint: '이미지', image: true },
    ],
  },
  logos: {
    id: 'logos',
    name: '로고 모음',
    description: '고객사나 협력사 로고 모음',
    fields: [title('로고들을 묶는 제목'), lead('한 줄 설명')],
    items: {
      label: '로고',
      min: 2,
      max: 12,
      default: 8,
      fields: [
        { key: 'image', label: '로고', hint: '로고', image: true },
        { key: 'title', label: '이름', hint: '회사 이름', optional: true },
      ],
    },
  },
  bars: {
    id: 'bars',
    name: '막대 비교',
    description: '숫자를 막대 길이로 비교',
    fields: [title('비교가 말해 주는 결론'), lead(), source],
    items: {
      label: '막대',
      min: 2,
      max: 6,
      default: 4,
      fields: [
        { key: 'title', label: '항목', hint: '항목 이름' },
        { key: 'value', label: '숫자', hint: '120' },
        { key: 'meta', label: '보충', hint: '단위나 보충 설명', optional: true },
      ],
    },
  },
  closing: {
    id: 'closing',
    name: '결정 요청',
    description: '결정해 주실 것과 언제까지 필요한지',
    fields: [
      title('결정해 주실 것'),
      { key: '$presenter', label: '발표자', hint: '발표자 이름', optional: true },
      { key: '$contact', label: '연락처', hint: '이메일이나 내선 번호', optional: true },
    ],
    items: {
      label: '요청',
      min: 0,
      max: 3,
      default: 3,
      fields: [
        { key: 'title', label: '요청', hint: '결정해 주실 일' },
        { key: 'body', label: '설명', hint: '언제까지, 왜 필요한지', optional: true },
      ],
    },
  },
}

export const LAYOUT_ORDER: LayoutId[] = [
  'summary',
  'statement',
  'points',
  'kpi',
  'compare',
  'pricing',
  'bars',
  'timeline',
  'imageText',
  'case',
  'logos',
  'agenda',
  'section',
  'cover',
  'closing',
]

/** 칸의 안내 문구. 항목 하나에 붙은 안내, 슬라이드에 지정된 안내, 레이아웃 기본값 순으로 쓴다. */
export function hintFor(
  layout: LayoutId,
  hints: Record<string, string>,
  key: string,
  itemKey?: ItemKey,
  index?: number,
): string {
  if (itemKey && index !== undefined && hints[`items.${index}.${itemKey}`]) return hints[`items.${index}.${itemKey}`]
  const path = itemKey ? `items.${itemKey}` : key
  if (hints[path]) return hints[path]
  const spec = LAYOUTS[layout]
  if (itemKey) return spec.items?.fields.find((f) => f.key === itemKey)?.hint ?? ''
  return spec.fields.find((f) => f.key === key)?.hint ?? ''
}

/** 이 레이아웃의 모양 id들. 한 가지뿐이면 ['base'] */
export function variantIds(layout: LayoutId): string[] {
  return LAYOUTS[layout].variants?.map((v) => v.id) ?? ['base']
}

/** 이 장의 모양. 레이아웃에 없는 값이면 첫째 모양 */
export function variantOf(slide: { layout: LayoutId; variant?: string }): string {
  const variants = LAYOUTS[slide.layout].variants
  if (!variants?.length) return 'base'
  return variants.some((v) => v.id === slide.variant) ? slide.variant! : variants[0].id
}
