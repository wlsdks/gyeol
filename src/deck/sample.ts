import { createDeck, emptyItem } from './generate'
import type { Deck, Item, Slide } from './types'

// 처음 쓰는 사람이 완성된 모습을 볼 수 있는 예시 발표. 회사와 숫자는 모두 지어낸 것이다.

function svg(body: string, w = 360, h = 120): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`
}

function wordmark(name: string, shape: string): string {
  return svg(
    `${shape}<text x="96" y="74" font-family="Pretendard Variable, Apple SD Gothic Neo, sans-serif" font-size="40" font-weight="800" letter-spacing="-1" fill="#1d2330">${name}</text>`,
  )
}

const LOGOS = [
  wordmark('대성정밀', '<rect x="24" y="36" width="52" height="52" rx="10" fill="#1d2330"/>'),
  wordmark('한결테크', '<circle cx="50" cy="62" r="27" fill="#1d2330"/>'),
  wordmark('누리소재', '<path d="M24 88 L50 36 L76 88 Z" fill="#1d2330"/>'),
  wordmark('선진화학', '<rect x="24" y="36" width="52" height="52" rx="26" fill="none" stroke="#1d2330" stroke-width="10"/>'),
  wordmark('동해전자', '<path d="M24 36h52v18H42v34H24z" fill="#1d2330"/>'),
  wordmark('미래모빌', '<path d="M24 88V36l26 26 26-26v52" fill="none" stroke="#1d2330" stroke-width="10"/>'),
  wordmark('바른식품', '<rect x="24" y="36" width="22" height="52" fill="#1d2330"/><rect x="54" y="52" width="22" height="36" fill="#1d2330"/>'),
  wordmark('세움건설', '<path d="M24 88h52V36z" fill="#1d2330"/>'),
]

const DASHBOARD = svg(
  `<rect width="1600" height="1000" fill="#eef1f6"/>
  <rect x="0" y="0" width="1600" height="72" fill="#ffffff"/>
  <rect x="40" y="24" width="140" height="24" rx="6" fill="#1d2330"/>
  <rect x="1320" y="22" width="240" height="28" rx="14" fill="#e3e7ee"/>
  <rect x="40" y="112" width="360" height="180" rx="16" fill="#ffffff"/>
  <rect x="424" y="112" width="360" height="180" rx="16" fill="#ffffff"/>
  <rect x="808" y="112" width="360" height="180" rx="16" fill="#ffffff"/>
  <rect x="1192" y="112" width="368" height="180" rx="16" fill="#ffffff"/>
  <rect x="72" y="144" width="120" height="16" rx="8" fill="#c5ccd8"/>
  <rect x="72" y="196" width="200" height="52" rx="10" fill="#2350e8"/>
  <rect x="456" y="144" width="120" height="16" rx="8" fill="#c5ccd8"/>
  <rect x="456" y="196" width="160" height="52" rx="10" fill="#1d2330"/>
  <rect x="840" y="144" width="120" height="16" rx="8" fill="#c5ccd8"/>
  <rect x="840" y="196" width="180" height="52" rx="10" fill="#1d2330"/>
  <rect x="1224" y="144" width="120" height="16" rx="8" fill="#c5ccd8"/>
  <rect x="1224" y="196" width="140" height="52" rx="10" fill="#e5484d"/>
  <rect x="40" y="316" width="1000" height="644" rx="16" fill="#ffffff"/>
  <polyline points="88,860 200,800 312,820 424,700 536,720 648,610 760,640 872,520 984,480" fill="none" stroke="#2350e8" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/>
  <polyline points="88,900 200,880 312,890 424,850 536,860 648,830 760,840 872,800 984,790" fill="none" stroke="#c5ccd8" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>
  <rect x="88" y="356" width="220" height="20" rx="10" fill="#c5ccd8"/>
  <rect x="1064" y="316" width="496" height="644" rx="16" fill="#ffffff"/>
  ${[0, 1, 2, 3, 4, 5]
    .map(
      (i) =>
        `<rect x="1096" y="${372 + i * 92}" width="200" height="18" rx="9" fill="#c5ccd8"/><rect x="1096" y="${402 + i * 92}" width="${380 - i * 46}" height="14" rx="7" fill="${i === 0 ? '#e5484d' : '#2350e8'}" opacity="${1 - i * 0.12}"/>`,
    )
    .join('')}`,
  1600,
  1000,
)

type Fill = { fields?: Record<string, string>; items?: Partial<Item>[] }

const CONTENT: Record<string, Fill> = {
  표지: { fields: { lead: '한빛제조 평택 공장을 위한 스마트 품질 관리 제안' } },
  '핵심 요약': {
    fields: { title: '이 제안으로 얻는 것' },
    items: [
      { value: '48%', title: '불량률 감소', body: '6개월 시범 운영 평균' },
      { value: '3개월', title: '전 라인 도입 기간', body: '현장 중단 없이 단계별로' },
      { value: '2.1억', title: '연간 절감 비용', body: '불량 처리와 보고 업무 기준' },
    ],
  },
  '고객의 과제': {
    fields: {
      title: '검사 기록이 종이에 남아 있어, 불량의 원인을 찾는 데 평균 6일이 걸립니다',
      lead: '원인을 찾는 동안에도 같은 불량이 계속 나오고, 그 비용은 모두 현장이 떠안고 있습니다.',
    },
  },
  '바뀌는 모습': {
    fields: { title: '기록부터 보고까지, 손이 덜 가는 방식으로 바뀝니다' },
    items: [
      { title: '검사 결과를 종이에 적고 나중에 옮겨 적음', body: '태블릿으로 바로 입력, 모든 라인이 실시간으로 모임' },
      { title: '불량 원인을 찾는 데 평균 6일', body: '설비와 자재별 원인을 당일에 확인' },
      { title: '월말마다 엑셀로 보고서 작성', body: '보고서가 자동으로 만들어짐' },
    ],
  },
  '해결 방안': {
    fields: { title: '세 가지로 불량을 줄입니다' },
    items: [
      { title: '실시간 검사 기록', body: '현장에서 태블릿으로 입력하면 모든 라인의 결과가 바로 한곳에 모입니다.' },
      { title: '원인 자동 분석', body: '설비, 자재, 작업 시간대별로 불량이 몰리는 곳을 찾아 알려 줍니다.' },
      { title: '즉시 알림', body: '기준을 벗어나는 순간 담당자의 휴대폰으로 알림이 갑니다.' },
    ],
  },
  '제품 화면': {
    fields: {
      title: '라인별 불량 현황을 한 화면에서 봅니다',
      body: '품질팀은 아침마다 이 화면 하나로 어제의 불량과 원인을 확인합니다. 빨간색으로 표시된 설비부터 점검하면 됩니다.',
      image: DASHBOARD,
    },
  },
  '기대 효과': {
    fields: { title: '도입하면 이렇게 달라져요' },
    items: [
      { value: '48%', title: '불량률 감소', body: '시범 운영 6개월 평균' },
      { value: '1일', title: '원인 파악 시간', body: '기존 평균 6일' },
      { value: '120시간', title: '매달 줄어드는 보고 업무', body: '품질팀 4명 기준' },
    ],
  },
  '유사 고객 사례': {
    fields: {
      client: '자동차 부품 제조, 대성정밀',
      title: '도입 4개월 만에 불량률이 3.2%에서 1.4%로 줄었습니다',
      body: '라인 6개에서 하루 2만 개의 부품을 검사하던 대성정밀은 종이 기록 때문에 불량 원인을 늦게 찾았습니다. 시범 라인 2개에서 시작해 3개월 만에 전 라인으로 넓혔습니다.',
      quote: '이제는 불량이 나오면 그날 바로 원인을 압니다.\n대성정밀 품질팀장',
      image: LOGOS[0],
    },
    items: [
      { value: '56%', title: '불량률 감소' },
      { value: '4개월', title: '투자 회수 기간' },
    ],
  },
  '함께한 고객': {
    fields: { title: '제조 현장 120곳이 함께하고 있어요', lead: '자동차 부품, 전자, 화학, 식품 공장에서 쓰고 있어요.' },
    items: LOGOS.map((image) => ({ image })),
  },
  '도입 일정': {
    fields: { title: '3개월이면 전 라인에서 쓸 수 있어요' },
    items: [
      { meta: '1주 차', title: '현장 진단', body: '검사 항목과 기록 방식 확인' },
      { meta: '2~4주 차', title: '시스템 준비', body: '검사 양식과 알림 기준 설정' },
      { meta: '5~8주 차', title: '시범 운영', body: '라인 2개에서 먼저 사용' },
      { meta: '3개월 차', title: '전 라인 확대', body: '교육과 함께 모든 라인 적용' },
    ],
  },
  '투자 비용': {
    fields: { title: '라인 수에 맞춰 고르실 수 있어요' },
    items: [
      { title: '기본', value: '월 120만 원', meta: '라인 2개 기준', body: '실시간 검사 기록\n기본 리포트\n이메일 지원' },
      { title: '표준', value: '월 280만 원', meta: '라인 5개 기준', body: '기본의 모든 기능\n원인 자동 분석\n즉시 알림\n전담 매니저' },
      { title: '확장', value: '별도 협의', meta: '라인 6개 이상', body: '표준의 모든 기능\n사내 시스템 연동\n현장 교육' },
    ],
  },
  '다음 단계': {
    items: [
      { title: '현장 진단 일정 잡기', body: '11월 첫째 주, 평택 공장' },
      { title: '시범 라인 고르기', body: '품질팀과 함께' },
      { title: '시범 운영 시작', body: '11월 중' },
    ],
  },
}

function fill(slide: Slide): Slide {
  const content = CONTENT[slide.purpose]
  if (!content) return slide
  return {
    ...slide,
    fields: { ...slide.fields, ...content.fields },
    items: content.items ? content.items.map((it) => ({ ...emptyItem(), ...it })) : slide.items,
  }
}

export function createSampleDeck(): Deck {
  const deck = createDeck({
    type: 'proposal',
    audience: 'mixed',
    minutes: 45,
    method: 'live',
    title: '제조 현장의 불량률을 절반으로 줄이는 방법',
    customer: '한빛제조',
    presenter: '김민준 매니저',
    theme: 'white',
  })
  return {
    ...deck,
    title: '예시: 한빛제조 품질 관리 제안',
    meta: { ...deck.meta, contact: 'minjun.kim@dataworks.kr' },
    slides: deck.slides.map(fill),
  }
}
