import type { Audience, DeckType, LayoutId } from './types'

export interface Recipe {
  layout: LayoutId
  purpose: string
  /** 1은 항상 포함, 3부터 먼저 뺀다 */
  priority: 1 | 2 | 3
  /** 이 청중일 때만 포함. 없으면 모든 청중 */
  audience?: Audience[]
  /** 같은 묶음은 함께 넣거나 뺀다 */
  group?: string
  section?: string
  guide: string
  hints?: Record<string, string>
  /** 미리 채워 두는 값 (구조에 해당하는 글자만) */
  fields?: Record<string, string>
  items?: number
}

export interface Blueprint {
  type: DeckType
  name: string
  description: string
  /** 마법사에서 보여주는 이야기 흐름 */
  storyline: string[]
  defaultTitle: string
  recipes: Recipe[]
}

const ALL_BUT_EXEC: Audience[] = ['practitioner', 'mixed']
const EXEC_FIRST: Audience[] = ['exec', 'mixed']

function section(title: string, lead: string): Recipe {
  return {
    layout: 'section',
    purpose: `섹션: ${title}`,
    priority: 3,
    group: 'sections',
    section: title,
    guide: '이야기의 큰 단락이 바뀌는 곳이에요. 청중이 지금 어디쯤인지 알 수 있어요.',
    fields: { title },
    hints: { lead },
  }
}

const cover: Recipe = {
  layout: 'cover',
  purpose: '표지',
  priority: 1,
  guide: '고객사 이름을 넣으면 이 고객을 위해 준비한 자료라는 게 바로 보여요.',
}

function closing(guide: string, steps: string): Recipe {
  return {
    layout: 'closing',
    purpose: '다음 단계',
    priority: 1,
    guide,
    fields: { title: '다음 단계' },
    hints: { 'items.title': steps },
  }
}

const proposal: Blueprint = {
  type: 'proposal',
  name: '신규 고객 제안',
  description: '처음 만나는 고객에게 해결 방법을 제안해요',
  storyline: ['과제', '해결', '근거', '제안'],
  defaultTitle: '제안서',
  recipes: [
    cover,
    {
      layout: 'kpi',
      purpose: '핵심 요약',
      priority: 1,
      audience: EXEC_FIRST,
      guide: '임원은 결론을 먼저 듣고 싶어 해요. 이 제안으로 얻는 효과를 숫자 3개로 보여주세요.',
      hints: { title: '이 제안으로 얻는 것', 'items.value': '30%', 'items.title': '줄어드는 비용' },
    },
    {
      layout: 'agenda',
      purpose: '목차',
      priority: 3,
      audience: ALL_BUT_EXEC,
      guide: '오늘 이야기할 순서예요. 섹션 이름이 미리 들어가 있어요.',
      fields: { title: '오늘 이야기할 내용' },
    },
    section('고객의 과제', '지금 겪고 있는 문제'),
    {
      layout: 'statement',
      purpose: '고객의 과제',
      priority: 1,
      section: '고객의 과제',
      guide: '고객이 "맞아, 그게 문제야"라고 고개를 끄덕일 문제를 한 문장으로 적어 주세요.',
      hints: {
        title: '지금 고객이 겪는 가장 큰 문제를 한 문장으로',
        lead: '그 문제가 왜 중요한지 한두 문장',
      },
    },
    {
      layout: 'compare',
      purpose: '바뀌는 모습',
      priority: 2,
      section: '고객의 과제',
      guide: '지금의 방식과 도입 후의 방식을 줄마다 나란히 놓으면 차이가 한눈에 보여요.',
      fields: { leftTitle: '지금', rightTitle: '도입 후' },
      hints: { title: '무엇이 어떻게 바뀌는지', 'items.title': '지금의 방식', 'items.body': '도입 후의 방식' },
    },
    section('해결 방안', '우리가 제안하는 방법'),
    {
      layout: 'points',
      purpose: '해결 방안',
      priority: 1,
      section: '해결 방안',
      guide: '앞에서 말한 문제를 어떻게 풀어 주는지 세 가지로 정리해 주세요.',
      hints: { title: '문제를 푸는 세 가지 방법', 'items.title': '해결 방법' },
    },
    {
      layout: 'imageText',
      purpose: '제품 화면',
      priority: 2,
      audience: ALL_BUT_EXEC,
      section: '해결 방안',
      guide: '실무자는 실제로 어떻게 쓰는지 궁금해해요. 제품 화면을 보여주세요.',
      hints: { title: '실제로 이렇게 써요' },
    },
    {
      layout: 'kpi',
      purpose: '기대 효과',
      priority: 1,
      section: '해결 방안',
      guide: '도입하면 무엇이 얼마나 좋아지는지 숫자로 보여주세요. 근거가 있는 숫자만 쓰세요.',
      hints: { title: '도입하면 이렇게 달라져요', 'items.value': '40%', 'items.title': '단축되는 시간' },
    },
    section('근거', '믿을 수 있는 이유'),
    {
      layout: 'case',
      purpose: '유사 고객 사례',
      priority: 2,
      section: '근거',
      guide: '비슷한 업종이나 규모의 고객 사례가 가장 설득력 있어요.',
    },
    {
      layout: 'logos',
      purpose: '함께한 고객',
      priority: 3,
      section: '근거',
      guide: '고객이 알 만한 회사 로고를 모아 보여주세요.',
      fields: { title: '함께한 고객' },
    },
    section('제안', '구체적인 진행 방법'),
    {
      layout: 'timeline',
      purpose: '도입 일정',
      priority: 2,
      section: '제안',
      guide: '언제 무엇을 하는지 보이면 고객이 다음 결정을 내리기 쉬워요.',
      hints: { title: '도입 일정', 'items.meta': '1개월 차' },
    },
    {
      layout: 'pricing',
      purpose: '투자 비용',
      priority: 1,
      section: '제안',
      guide: '추천하는 요금제를 강조해 두면 고객이 고르기 쉬워요.',
      hints: { title: '투자 비용' },
    },
    closing('미팅 뒤에 바로 할 일을 정해 두면 다음 미팅이 잡혀요.', '함께 할 다음 일 (예: 실무 미팅)'),
  ],
}

const product: Blueprint = {
  type: 'product',
  name: '제품 소개',
  description: '제품이 무엇이고 왜 좋은지 알려요',
  storyline: ['문제', '제품', '효과', '도입'],
  defaultTitle: '제품 소개',
  recipes: [
    cover,
    {
      layout: 'agenda',
      purpose: '목차',
      priority: 3,
      audience: ALL_BUT_EXEC,
      guide: '오늘 이야기할 순서예요.',
      fields: { title: '오늘 이야기할 내용' },
    },
    {
      layout: 'statement',
      purpose: '한 문장 소개',
      priority: 1,
      guide: '제품을 처음 듣는 사람도 이해할 수 있게 한 문장으로 소개해 주세요.',
      hints: { title: '제품을 한 문장으로 소개해 주세요', lead: '누구를 위한 제품인지' },
    },
    {
      layout: 'compare',
      purpose: '해결하는 문제',
      priority: 2,
      guide: '제품이 없을 때와 있을 때를 나란히 보여주세요.',
      fields: { leftTitle: '제품 없이', rightTitle: '제품과 함께' },
      hints: { title: '이런 문제를 해결해요' },
    },
    {
      layout: 'points',
      purpose: '핵심 기능',
      priority: 1,
      guide: '가장 중요한 기능 세 가지만 고르세요. 많을수록 기억에 덜 남아요.',
      hints: { title: '핵심 기능', 'items.title': '기능 이름' },
    },
    {
      layout: 'imageText',
      purpose: '제품 화면',
      priority: 1,
      guide: '실제 화면을 보여주면 설명이 훨씬 짧아져요.',
      hints: { title: '실제로 이렇게 써요' },
    },
    {
      layout: 'kpi',
      purpose: '도입 효과',
      priority: 2,
      guide: '도입한 고객이 얻은 효과를 숫자로 보여주세요.',
      hints: { title: '도입한 고객이 얻은 효과' },
    },
    {
      layout: 'case',
      purpose: '고객 사례',
      priority: 2,
      guide: '실제 고객의 이야기와 숫자를 함께 보여주세요.',
    },
    {
      layout: 'logos',
      purpose: '도입 고객',
      priority: 3,
      guide: '이미 쓰고 있는 회사들을 보여주세요.',
      fields: { title: '이미 쓰고 있는 곳' },
    },
    {
      layout: 'pricing',
      purpose: '요금',
      priority: 2,
      guide: '추천하는 요금제를 강조해 두면 고객이 고르기 쉬워요.',
      hints: { title: '요금' },
    },
    {
      layout: 'timeline',
      purpose: '도입 절차',
      priority: 3,
      guide: '도입까지 어떤 단계를 거치는지 보여주세요.',
      hints: { title: '도입 절차', 'items.meta': '1주 차' },
    },
    closing('체험이나 다음 미팅처럼 바로 할 수 있는 일을 적어 주세요.', '함께 할 다음 일 (예: 무료 체험)'),
  ],
}

const review: Blueprint = {
  type: 'review',
  name: '성과 리뷰',
  description: '지난 기간의 성과를 고객과 함께 점검해요',
  storyline: ['성과', '분석', '개선', '계획'],
  defaultTitle: '성과 리뷰',
  recipes: [
    cover,
    {
      layout: 'kpi',
      purpose: '핵심 성과',
      priority: 1,
      guide: '이번 기간에 가장 중요한 성과를 숫자로 먼저 보여주세요.',
      hints: { title: '이번 분기 핵심 성과', 'items.value': '+18%', 'items.title': '지표 이름' },
    },
    {
      layout: 'agenda',
      purpose: '목차',
      priority: 3,
      audience: ALL_BUT_EXEC,
      guide: '오늘 점검할 순서예요.',
      fields: { title: '오늘 점검할 내용' },
    },
    {
      layout: 'bars',
      purpose: '주요 지표',
      priority: 1,
      guide: '기간별이나 항목별 숫자를 막대로 비교해 보여주세요.',
      hints: { title: '주요 지표 추이', 'items.title': '1분기' },
    },
    {
      layout: 'compare',
      purpose: '목표와 실적',
      priority: 2,
      guide: '처음 세운 목표와 실제 결과를 줄마다 나란히 놓아 보세요.',
      fields: { leftTitle: '목표', rightTitle: '실적' },
      hints: { title: '목표 대비 실적', 'items.title': '목표', 'items.body': '실적' },
    },
    {
      layout: 'points',
      purpose: '잘된 점',
      priority: 2,
      guide: '성과를 만든 원인을 짚어 주면 다음에도 이어갈 수 있어요.',
      hints: { title: '잘된 점' },
    },
    {
      layout: 'points',
      purpose: '개선할 점',
      priority: 2,
      guide: '숨기기보다 먼저 꺼내고 해결 방법을 함께 제시하면 신뢰가 쌓여요.',
      hints: { title: '개선할 점', 'items.title': '개선할 점', 'items.body': '원인과 해결 방법' },
    },
    {
      layout: 'timeline',
      purpose: '다음 계획',
      priority: 1,
      guide: '다음 기간에 무엇을 언제 할지 보여주세요.',
      hints: { title: '다음 분기 계획', 'items.meta': '11월' },
    },
    {
      layout: 'statement',
      purpose: '요청 사항',
      priority: 2,
      guide: '고객에게 부탁하거나 함께 정해야 할 일을 분명하게 적어 주세요.',
      hints: { title: '함께 정해야 할 일을 한 문장으로' },
    },
    closing('다음 리뷰 날짜와 그 전까지 할 일을 정해 두세요.', '다음 리뷰 전까지 할 일'),
  ],
}

const company: Blueprint = {
  type: 'company',
  name: '회사 소개',
  description: '우리 회사가 어떤 곳인지 알려요',
  storyline: ['소개', '숫자', '사업', '고객'],
  defaultTitle: '회사 소개',
  recipes: [
    cover,
    {
      layout: 'statement',
      purpose: '한 문장 소개',
      priority: 1,
      guide: '회사가 하는 일을 한 문장으로 적어 주세요. 업계 용어보다 쉬운 말이 좋아요.',
      hints: { title: '우리 회사를 한 문장으로', lead: '어떤 고객을 돕는지' },
    },
    {
      layout: 'kpi',
      purpose: '숫자로 보는 회사',
      priority: 1,
      guide: '고객 수, 업력, 직원 수처럼 회사를 보여주는 숫자를 골라 주세요.',
      hints: { title: '숫자로 보는 회사', 'items.value': '1,200곳', 'items.title': '고객사' },
    },
    {
      layout: 'timeline',
      purpose: '연혁',
      priority: 2,
      guide: '중요한 이정표만 골라 주세요.',
      hints: { title: '걸어온 길', 'items.meta': '2019' },
    },
    {
      layout: 'points',
      purpose: '사업 영역',
      priority: 1,
      guide: '주요 사업을 두세 가지로 나눠 보여주세요.',
      hints: { title: '하는 일', 'items.title': '사업 이름' },
    },
    {
      layout: 'imageText',
      purpose: '대표 제품',
      priority: 2,
      guide: '대표 제품이나 서비스 화면을 보여주세요.',
      hints: { title: '대표 제품' },
    },
    {
      layout: 'logos',
      purpose: '주요 고객',
      priority: 2,
      guide: '고객이 알 만한 회사 로고를 모아 보여주세요.',
      fields: { title: '함께하는 고객' },
    },
    {
      layout: 'case',
      purpose: '대표 사례',
      priority: 3,
      guide: '가장 자랑하고 싶은 사례 하나를 보여주세요.',
    },
    closing('궁금한 점을 물어볼 수 있는 연락처를 꼭 남겨 주세요.', '함께 할 다음 일'),
  ],
}

const blank: Blueprint = {
  type: 'blank',
  name: '빈 발표',
  description: '처음부터 직접 구성해요',
  storyline: [],
  defaultTitle: '새 발표',
  recipes: [
    cover,
    {
      layout: 'statement',
      purpose: '메시지',
      priority: 1,
      guide: '가장 전하고 싶은 말을 적어 주세요.',
    },
    {
      layout: 'points',
      purpose: '포인트',
      priority: 1,
      guide: '나란히 보여줄 내용을 적어 주세요.',
    },
    closing('발표가 끝난 뒤 할 일을 적어 주세요.', '함께 할 다음 일'),
  ],
}

export const BLUEPRINTS: Record<DeckType, Blueprint> = { proposal, product, review, company, blank }
export const DECK_TYPES: DeckType[] = ['proposal', 'product', 'review', 'company']

export const AUDIENCES: { id: Audience; name: string; description: string }[] = [
  { id: 'exec', name: '임원·의사결정자', description: '결론을 먼저, 장 수는 적게' },
  { id: 'practitioner', name: '실무 담당자', description: '목차와 제품 화면 같은 세부 내용까지' },
  { id: 'mixed', name: '함께 참석', description: '결론을 먼저 말하고 세부 내용도 담아요' },
]

export const DURATIONS: { minutes: number; name: string }[] = [
  { minutes: 10, name: '10분' },
  { minutes: 20, name: '20분' },
  { minutes: 30, name: '30분' },
  { minutes: 45, name: '45분 이상' },
]

export const METHODS: { id: 'live' | 'remote' | 'send'; name: string; description: string }[] = [
  { id: 'live', name: '현장 발표', description: '회의실 화면에 띄우고 말로 설명해요' },
  { id: 'remote', name: '화면 공유', description: '온라인 회의에서 화면을 공유해요' },
  { id: 'send', name: '보내는 자료', description: '메일로 보내서 혼자 읽게 해요' },
]
