import { createDeck, emptyItem } from './generate'
import type { Deck, Item, Slide } from './types'

// 처음 쓰는 사람이 완성된 모습을 볼 수 있는 예시 보고. 회사, 사람, 숫자는 모두 지어낸 것이다.

function svg(body: string, w = 360, h = 120): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`
}

function wordmark(name: string, shape: string): string {
  return svg(
    `${shape}<text x="96" y="74" font-family="Pretendard Variable, Apple SD Gothic Neo, sans-serif" font-size="40" font-weight="800" letter-spacing="-1" fill="#1d2330">${name}</text>`,
  )
}

/** 개발용 레이아웃 모음에서도 쓰는 예시 로고 */
export const SAMPLE_LOGOS = [
  wordmark('대성정밀', '<rect x="24" y="36" width="52" height="52" rx="10" fill="#1d2330"/>'),
  wordmark('한결테크', '<circle cx="50" cy="62" r="27" fill="#1d2330"/>'),
  wordmark('누리소재', '<path d="M24 88 L50 36 L76 88 Z" fill="#1d2330"/>'),
  wordmark('선진화학', '<rect x="24" y="36" width="52" height="52" rx="26" fill="none" stroke="#1d2330" stroke-width="10"/>'),
  wordmark('동해전자', '<path d="M24 36h52v18H42v34H24z" fill="#1d2330"/>'),
  wordmark('미래모빌', '<path d="M24 88V36l26 26 26-26v52" fill="none" stroke="#1d2330" stroke-width="10"/>'),
  wordmark('바른식품', '<rect x="24" y="36" width="22" height="52" fill="#1d2330"/><rect x="54" y="52" width="22" height="36" fill="#1d2330"/>'),
  wordmark('세움건설', '<path d="M24 88h52V36z" fill="#1d2330"/>'),
]

export const SAMPLE_DASHBOARD = svg(
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

// 영업 2팀 김민준 매니저가 영업본부장에게 하는 수주 제안 계획 보고
const CONTENT: Record<string, Fill> = {
  표지: {
    fields: {
      lead: '수주 전략과 제안 가격 승인 요청',
      ask: '제안 가격 4.8억 원과 시범 구축 인력 2명 승인',
    },
  },
  '한 장 요약': {
    fields: { title: '한빛제조 품질 관리 사업, 12월 계약을 목표로 4.8억 원에 제안하겠습니다' },
    items: [
      { title: '사업 기회', body: '한빛제조가 평택 공장 검사 시스템 교체를 검토 중이고, 12월에 업체를 정해요.' },
      { title: '제안 내용', body: 'AI 외관 검사와 불량 원인 분석을 묶어 불량이 많은 3개 라인에 먼저 구축해요.' },
      { title: '예상 매출', body: '첫해 4.8억 원, 3년 유지보수를 더하면 7.2억 원이에요. 이익률은 22%예요.' },
      { title: '요청 사항', body: '제안 가격 4.8억 원 승인, 시범 구축 인력 2명 지원' },
    ],
  },
  '섹션: 사업 기회': { fields: { lead: '한빛제조가 앞둔 결정' } },
  '사업 기회': {
    fields: {
      title: '한빛제조가 12월에 평택 공장 품질 검사 시스템을 바꿔요',
      lead: '지금 시스템의 유지보수가 내년 3월에 끝나서 품질팀장이 연내에 업체를 정하려고 해요. 최종 결정은 공장장이 해요.',
    },
  },
  '사업 규모': {
    fields: { title: '첫해 4.8억 원, 3년이면 7.2억 원 규모예요' },
    items: [
      { title: '예상 매출', value: '4.8억 원', body: '첫해 구축비, 3개 라인 기준' },
      { title: '계약 기간', value: '3년', body: '유지보수 포함 총 7.2억 원' },
      { title: '예상 이익률', value: '22%', body: '본부 평균 18%보다 높아요' },
    ],
  },
  '경쟁 상황': {
    fields: { title: '가격은 높지만 구축 기간과 사례로 앞서요' },
    items: [
      { title: '대명시스템이 3.9억 원을 낼 것으로 보여요', body: '4.8억 원이지만 불량 원인 분석까지 들어 있어요' },
      { title: '구축에 6개월, 그동안 라인을 세워야 해요', body: '3개월, 라인을 세우지 않고 구축해요' },
      { title: '같은 업종 구축 사례가 없어요', body: '자동차 부품사 2곳에 구축했어요' },
    ],
  },
  '섹션: 제안 전략': { fields: { lead: '무엇을 얼마에 제안할지' } },
  '제안 내용': {
    fields: { title: '검사 자동화와 원인 분석을 묶어서 제안해요' },
    items: [
      { title: 'AI 외관 검사', body: '사람이 하던 외관 검사를 카메라와 AI로 바꿔 검사 시간을 절반으로 줄여요.' },
      { title: '불량 원인 분석', body: '검사 결과를 공정 데이터와 묶어 어느 공정에서 불량이 생기는지 보여줘요.' },
      { title: '3개 라인부터', body: '불량이 가장 많은 3개 라인에 먼저 구축하고, 효과를 확인한 뒤 넓혀요.' },
    ],
  },
  '가격 안': {
    fields: { title: '추천 가격은 B안 4.8억 원이에요' },
    items: [
      { title: 'A안', value: '3.9억 원', meta: '이익률 9%', body: '경쟁사 가격에 맞춤\n원인 분석 빼고 검사만\n수주 가능성은 높지만 남는 게 적어요' },
      { title: 'B안', value: '4.8억 원', meta: '이익률 22%', body: '검사 자동화와 원인 분석 함께\n3개 라인 먼저 구축\n가격 차이는 구축 기간으로 설득' },
      { title: 'C안', value: '6.5억 원', meta: '이익률 25%', body: '8개 라인 전체를 한 번에\n고객 예산을 넘을 가능성이 커요' },
    ],
  },
  '제안할 솔루션': {
    fields: {
      title: '고객에게 보여줄 품질 대시보드',
      body: '라인별 불량률과 원인 공정을 한 화면에서 봐요. 11월 3주 현장 시연 때 시범 라인 데이터로 보여줄 예정이에요.',
      image: SAMPLE_DASHBOARD,
    },
  },
  '섹션: 실행 계획': { fields: { lead: '수주까지 할 일' } },
  '수주 일정': {
    fields: { title: '12월 계약이 목표예요' },
    items: [
      { meta: '11월 1주', title: '제안서 제출', body: '품질팀장에게 직접 전달' },
      { meta: '11월 3주', title: '현장 시연', body: '평택 공장 시범 라인에서' },
      { meta: '12월 1주', title: '가격 협상', body: '구매팀과' },
      { meta: '12월 3주', title: '계약', body: '공장장 최종 결정' },
    ],
  },
  '위험과 대응': {
    fields: { title: '이런 위험은 이렇게 대비해요' },
    items: [
      { title: '경쟁사가 가격을 더 낮출 수 있어요', body: '유지보수 1년 무상을 협상 카드로 준비해요' },
      { title: '시범 구축 인력이 부족해요', body: '기술팀 2명을 11월부터 지원받아야 해요' },
      { title: '고객 예산 확정이 늦어질 수 있어요', body: '두 번에 나눠 구축해서 첫해 비용을 낮춘 안을 준비해요' },
    ],
  },
  '결정 요청': {
    items: [
      { title: '제안 가격 4.8억 원 승인', body: '11월 1주 제안서 제출 전까지' },
      { title: '시범 구축 인력 2명 지원', body: '기술팀, 11월부터 3개월' },
      { title: '유지보수 1년 무상 카드 사용', body: '가격 협상에서 필요할 때만' },
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
    type: 'deal',
    audience: 'mixed',
    minutes: 30,
    method: 'live',
    title: '한빛제조 평택 공장 품질 관리 제안 계획',
    org: '영업 2팀',
    presenter: '김민준 매니저',
    theme: 'white',
  })
  return {
    ...deck,
    title: '예시: 한빛제조 품질 관리 제안 계획',
    meta: { ...deck.meta, contact: '내선 2417' },
    slides: deck.slides.map(fill),
  }
}
