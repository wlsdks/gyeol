import type { ItemKey, LayoutId } from './types'

export interface FieldSpec {
  /** 슬라이드 칸 이름. `$`로 시작하면 덱 단위 값(고객사, 발표자 등) */
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

export interface LayoutSpec {
  id: LayoutId
  name: string
  description: string
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
    description: '발표 제목과 고객사, 발표자',
    fields: [
      { key: 'title', label: '발표 제목', hint: '발표 제목', multiline: true },
      { key: 'lead', label: '부제', hint: '한 줄 부제', optional: true },
      { key: '$customer', label: '고객사', hint: '고객사 이름', optional: true },
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
    fields: [title('목차')],
    items: {
      label: '목차 항목',
      min: 2,
      max: 6,
      default: 4,
      fields: [{ key: 'title', label: '항목', hint: '다룰 내용' }],
    },
  },
  statement: {
    id: 'statement',
    name: '한 문장 메시지',
    description: '가장 중요한 말을 크게',
    fields: [
      { key: 'title', label: '메시지', hint: '전하고 싶은 메시지를 한 문장으로', multiline: true },
      lead(),
    ],
  },
  kpi: {
    id: 'kpi',
    name: '핵심 숫자',
    description: '숫자 2~4개를 크게',
    fields: [title('숫자들이 말해 주는 결론')],
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
    description: '지금과 바뀐 뒤를 줄마다 비교',
    fields: [
      title('비교해서 보여줄 결론'),
      { key: 'leftTitle', label: '왼쪽 머리말', hint: '지금' },
      { key: 'rightTitle', label: '오른쪽 머리말', hint: '도입 후' },
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
    name: '고객 사례',
    description: '다른 고객이 얻은 결과',
    fields: [
      { key: 'client', label: '고객', hint: '고객사 또는 업종' },
      { key: 'title', label: '결과', hint: '고객이 얻은 결과를 한 문장으로', multiline: true },
      { key: 'body', label: '내용', hint: '어떤 과제를 어떻게 해결했는지', multiline: true },
      { key: 'quote', label: '고객의 말', hint: '고객의 한마디', multiline: true, optional: true },
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
    name: '요금제',
    description: '요금제 1~3개 비교',
    fields: [title('비용을 요약하는 제목')],
    items: {
      label: '요금제',
      min: 1,
      max: 3,
      default: 3,
      fields: [
        { key: 'title', label: '이름', hint: '요금제 이름' },
        { key: 'value', label: '가격', hint: '월 50만 원' },
        { key: 'meta', label: '기준', hint: '사용자 10명 기준', optional: true },
        { key: 'body', label: '포함 내용', hint: '포함 내용을 한 줄에 하나씩', multiline: true },
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
    name: '고객 로고',
    description: '함께한 고객사 로고 모음',
    fields: [title('함께한 고객'), lead('한 줄 설명')],
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
    fields: [title('비교가 말해 주는 결론'), lead()],
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
    name: '마지막 장',
    description: '다음 단계와 연락처',
    fields: [
      title('다음 단계'),
      { key: '$presenter', label: '발표자', hint: '발표자 이름', optional: true },
      { key: '$contact', label: '연락처', hint: '이메일 또는 전화번호', optional: true },
    ],
    items: {
      label: '다음 단계',
      min: 0,
      max: 3,
      default: 3,
      fields: [
        { key: 'title', label: '단계', hint: '함께 할 다음 일' },
        { key: 'body', label: '설명', hint: '언제, 누가', optional: true },
      ],
    },
  },
}

export const LAYOUT_ORDER: LayoutId[] = [
  'statement',
  'kpi',
  'points',
  'compare',
  'bars',
  'timeline',
  'case',
  'pricing',
  'imageText',
  'logos',
  'agenda',
  'section',
  'cover',
  'closing',
]

/** 칸의 안내 문구. 슬라이드에 지정된 값이 우선이다. */
export function hintFor(
  layout: LayoutId,
  hints: Record<string, string>,
  key: string,
  itemKey?: ItemKey,
): string {
  const path = itemKey ? `items.${itemKey}` : key
  if (hints[path]) return hints[path]
  const spec = LAYOUTS[layout]
  if (itemKey) return spec.items?.fields.find((f) => f.key === itemKey)?.hint ?? ''
  return spec.fields.find((f) => f.key === key)?.hint ?? ''
}
