// 부품(블록)으로 꾸미는 장. 사람이 부품을 고르고 끌어다 놓으면, 놓을 자리는 시스템이 정한다.
//
// 자리 규칙: 한 장에 줄은 셋까지, 한 줄에 칸은 셋까지, 부품은 여섯까지. 칸 너비는 12를 나눈 정해진 비율
// (1:1, 2:1, 1:2, 1:1:1, 2:1:1 ...) 가운데 하나다. 그래서 어디에 대충 놓아도 칸이 줄과 간격에 딱 맞고
// 삐뚤빼뚤해지지 않는다. 줄 높이는 똑같이 나눈다(잘리지 않을 높이는 지킨다).
//
// 칸의 자리는 측정하지 않고 계산한다. 같은 계산을 CSS calc()로 써서 편집 화면, 발표, 내보낸 HTML이
// 똑같이 그리고, 끌어다 놓는 동안 놓일 자리를 찾을 때도 이 계산을 쓴다(움직이는 중인 화면을 재지 않는다).

import { BLOCK_HEIGHTS } from './blockHeights'
import { emptyItem, uid, withDefaultOptions } from './generate'
import { hintFor, LAYOUTS, type FieldSpec, type LayoutSpec, type VariantSpec } from './layouts'
import type { Block, BlockEffect, BlockLook, BlockRow, BlockType, Item, LayoutBlockType, LayoutId, NativeBlockType, Slide } from './types'

export interface BlockSpec {
  type: BlockType
  name: string
  description: string
  /** 발표할 때 저절로 움직이는 모습. 부품 고르기 카드에 보인다 */
  motion: string
  /** 레이아웃 부품이면 그 레이아웃. 칸, 안내, 그리기, 움직임을 그 레이아웃 것 그대로 쓴다 */
  layout?: LayoutBlockType
  fields: FieldSpec[]
  items?: LayoutSpec['items']
  variants?: VariantSpec[]
  highlight?: LayoutSpec['highlight']
  /** 칸 너비(12 기준). 이보다 좁은 칸에는 넣지 않는다 */
  minSpan: number
  /** 이만큼은 되어야 보기 좋은 너비. 알아서 놓을 때와 비율을 고를 때 쓴다 */
  prefSpan: number
  look?: BlockLook
  /** 부품 고르기 그림과 장 모음 예시에 쓰는 지어낸 내용. 레이아웃 부품은 장 모음의 예시 장에서 가져온다 */
  sample?: { fields: Record<string, string>; items?: Partial<Item>[] }
}

/** 장의 머리(제목, 부제, 출처). 레이아웃 부품에서는 빼고, 부품 장의 머리로 쓴다 */
export const HEAD_KEYS = ['title', 'lead', 'source']

const NATIVE: Record<NativeBlockType, Omit<BlockSpec, 'type'>> = {
  message: {
    name: '핵심 한 줄',
    description: '윗분이 기억할 한 문장을 크게',
    motion: '낱말마다 차례로 올라와요',
    fields: [
      { key: 'text', label: '핵심 문장', hint: '윗분이 기억할 한 문장', multiline: true },
      { key: 'sub', label: '덧붙이는 말', hint: '뒷받침하는 한 줄', optional: true, multiline: true },
    ],
    minSpan: 6,
    prefSpan: 12,
    sample: { fields: { text: '12월에 계약하면 1분기부터 불량률을 절반으로 줄여요', sub: '시범 라인 3개월 결과 기준' } },
  },
  text: {
    name: '제목과 글',
    description: '소제목 아래 두세 문장',
    motion: '소제목, 글 차례로 올라와요',
    fields: [
      { key: 'label', label: '머리말', hint: '작은 머리말 (예: 대상)', optional: true },
      { key: 'heading', label: '소제목', hint: '요점 한 줄', optional: true, multiline: true },
      { key: 'body', label: '글', hint: '설명을 두세 문장으로', multiline: true },
    ],
    minSpan: 4,
    prefSpan: 6,
    sample: { fields: { heading: '검사 시간을 줄여요', body: '사람이 눈으로 보던 외관 검사를 카메라가 먼저 걸러요. 검사원은 의심되는 제품만 다시 봐요.' } },
  },
  bullets: {
    name: '점 목록',
    description: '요점을 줄마다 하나씩',
    motion: '줄마다 차례로 들어와요',
    fields: [{ key: 'heading', label: '소제목', hint: '목록의 요점 한 줄', optional: true }],
    items: {
      label: '줄',
      min: 1,
      max: 6,
      default: 3,
      fields: [
        { key: 'title', label: '요점', hint: '요점 한 줄', multiline: true },
        { key: 'body', label: '설명', hint: '덧붙이는 설명', optional: true, multiline: true },
      ],
    },
    minSpan: 4,
    prefSpan: 6,
    sample: {
      fields: { heading: '먼저 바꿀 것' },
      items: [{ title: '불량이 많은 3개 라인부터' }, { title: '검사 기록을 한곳에 모아요' }, { title: '분기마다 효과를 다시 봐요' }],
    },
  },
  quote: {
    name: '인용',
    description: '고객이나 현장의 한마디',
    motion: '따옴표가 먼저, 글이 뒤따라요',
    fields: [
      { key: 'quote', label: '인용할 말', hint: '그대로 옮길 한마디', multiline: true },
      { key: 'by', label: '말한 사람', hint: '누가 말했는지 (예: 고객사 품질팀장)', optional: true },
    ],
    minSpan: 4,
    prefSpan: 6,
    sample: { fields: { quote: '검사 기록이 남으니 고객 감사 준비가 훨씬 편해졌어요', by: '시범 공장 품질 담당' } },
  },
  callout: {
    name: '강조 상자',
    description: '결정 요청이나 꼭 알아야 할 것',
    motion: '면이 펼쳐지고 글이 올라와요',
    fields: [
      { key: 'label', label: '머리말', hint: '예: 결정 요청, 주의할 점', optional: true },
      { key: 'text', label: '강조할 내용', hint: '꼭 전할 내용을 한두 문장으로', multiline: true },
    ],
    minSpan: 3,
    prefSpan: 4,
    look: 'bold',
    sample: { fields: { label: '결정 요청', text: '시범 구축 인력 2명을 11월부터 지원해 주세요' } },
  },
  number: {
    name: '큰 숫자',
    description: '숫자 하나를 크게',
    motion: '숫자가 자리마다 굴러가 맞춰져요',
    fields: [
      { key: 'label', label: '무엇의 숫자', hint: '무엇의 숫자인지' },
      { key: 'value', label: '숫자', hint: '4.8억 원' },
      { key: 'note', label: '덧붙임', hint: '짧은 설명 (예: 3년이면 7.2억 원)', optional: true, multiline: true },
    ],
    minSpan: 3,
    prefSpan: 4,
    look: 'card',
    sample: { fields: { value: '4.8억 원', label: '첫해 예상 매출', note: '3년이면 7.2억 원' } },
  },
  delta: {
    name: '전과 후',
    description: '바뀌기 전과 뒤의 숫자, 얼마나 달라지는지',
    motion: '전에서 후로, 차이가 튀어나와요',
    fields: [
      { key: 'label', label: '무엇이 바뀌는지', hint: '무엇이 바뀌는지 (예: 불량률)' },
      { key: 'before', label: '전', hint: '3.2%' },
      { key: 'after', label: '후', hint: '1.1%' },
      { key: 'note', label: '덧붙임', hint: '기준 (예: 시범 라인 3개월)', optional: true },
    ],
    minSpan: 4,
    prefSpan: 6,
    look: 'card',
    sample: { fields: { label: '불량률', before: '3.2%', after: '1.1%', note: '시범 라인 3개월 결과' } },
  },
  goal: {
    name: '목표 대비',
    description: '목표에 얼마나 왔는지 막대로',
    motion: '막대가 목표를 향해 자라요',
    fields: [
      { key: 'label', label: '무엇의 목표', hint: '무엇의 목표인지 (예: 연간 수주)' },
      { key: 'value', label: '지금', hint: '7.2' },
      { key: 'target', label: '목표', hint: '10' },
      { key: 'unit', label: '단위', hint: '억 원', optional: true },
      { key: 'note', label: '덧붙임', hint: '짧은 설명', optional: true },
    ],
    minSpan: 4,
    prefSpan: 6,
    look: 'card',
    sample: { fields: { label: '연간 수주', value: '7.2', target: '10', unit: '억 원', note: '4분기 계약 3건이 남았어요' } },
  },
  ring: {
    name: '비율 원',
    description: '비율 하나를 원으로 크게 (달성률, 만족도)',
    motion: '원이 차오르며 숫자가 올라가요',
    variants: [
      { id: 'base', name: '원' },
      { id: 'gauge', name: '반원 게이지' },
    ],
    fields: [
      { key: 'label', label: '무엇의 비율', hint: '무엇의 비율인지 (예: 자동 검사 비율)' },
      { key: 'value', label: '비율', hint: '72%' },
      { key: 'note', label: '덧붙임', hint: '짧은 설명 (예: 지난해 41%)', optional: true, multiline: true },
    ],
    minSpan: 3,
    prefSpan: 4,
    look: 'card',
    sample: { fields: { label: '사람 손 없이 끝내는 검사', value: '72%', note: '지난해에는 41%였어요' } },
  },
  ratio: {
    name: '몇 중 몇',
    description: '전체 가운데 몇인지 점으로 (10곳 중 7곳)',
    motion: '점이 하나씩 채워져요',
    fields: [
      { key: 'label', label: '무엇을 센 것', hint: '무엇을 센 것인지 (예: 도입한 고객사)' },
      { key: 'value', label: '몇', hint: '7' },
      { key: 'total', label: '전체', hint: '10' },
      { key: 'unit', label: '단위', hint: '곳', optional: true },
      { key: 'note', label: '덧붙임', hint: '짧은 설명', optional: true, multiline: true },
    ],
    minSpan: 4,
    prefSpan: 6,
    look: 'card',
    sample: { fields: { label: '시범 뒤 도입을 정한 공장', value: '7', total: '10', unit: '곳', note: '나머지 3곳은 1분기에 정해요' } },
  },
  spark: {
    name: '숫자와 흐름',
    description: '지금 숫자와 그동안의 흐름을 작은 선으로',
    motion: '선이 그려지고 숫자가 올라가요',
    fields: [
      { key: 'label', label: '무엇의 숫자', hint: '무엇의 숫자인지 (예: 월 불량률)' },
      { key: 'value', label: '지금 숫자', hint: '1.1%' },
      { key: 'series', label: '흐름', hint: '3.2, 3.0, 2.1, 1.6, 1.1' },
      { key: 'note', label: '덧붙임', hint: '기간이나 기준 (예: 5월부터 9월까지)', optional: true },
    ],
    minSpan: 3,
    prefSpan: 4,
    look: 'card',
    sample: { fields: { label: '월 불량률', value: '1.1%', series: '3.2, 3.0, 2.1, 1.6, 1.3, 1.1', note: '4월부터 9월까지' } },
  },
  facts: {
    name: '개요',
    description: '기간, 예산, 담당처럼 항목과 내용을 짝지어',
    motion: '줄마다 선이 그어지며 들어와요',
    fields: [{ key: 'heading', label: '소제목', hint: '예: 사업 개요', optional: true }],
    items: {
      label: '줄',
      min: 1,
      max: 6,
      default: 4,
      fields: [
        { key: 'title', label: '항목', hint: '항목', hints: ['기간', '예산', '대상', '담당', '효과', '다음 보고'] },
        { key: 'body', label: '내용', hint: '내용 한 줄', multiline: true },
      ],
    },
    minSpan: 4,
    prefSpan: 6,
    sample: {
      fields: { heading: '사업 개요' },
      items: [
        { title: '기간', body: '11월부터 1월까지, 3개월' },
        { title: '예산', body: '2.4억 원 (카메라 1.6억, 설치 0.8억)' },
        { title: '대상', body: '불량이 많은 3개 라인' },
        { title: '담당', body: '품질팀 2명, 생산기술팀 1명' },
      ],
    },
  },
  risks: {
    name: '걱정과 대책',
    description: '윗분이 걱정할 만한 점과 막는 방법을 짝지어',
    motion: '걱정 다음에 대책이 따라 들어와요',
    fields: [{ key: 'heading', label: '소제목', hint: '예: 걱정되는 점과 대책', optional: true }],
    items: {
      label: '걱정',
      min: 1,
      max: 4,
      default: 3,
      fields: [
        { key: 'title', label: '걱정되는 점', hint: '걱정되는 점', multiline: true },
        { key: 'body', label: '대책', hint: '이렇게 막아요', multiline: true },
      ],
    },
    minSpan: 6,
    prefSpan: 12,
    sample: {
      fields: {},
      items: [
        { title: '설치하는 동안 라인이 멈춰요', body: '주말 이틀씩 나눠 설치해 평일 생산은 그대로' },
        { title: '카메라가 불량을 놓칠 수 있어요', body: '첫 달은 사람 검사와 같이 돌려 놓친 것을 맞춰 봐요' },
        { title: '현장이 새 방식을 낯설어해요', body: '라인마다 담당 1명을 먼저 가르쳐 옆에서 돕게 해요' },
      ],
    },
  },
  swot: {
    name: '강점과 약점',
    description: '강점, 약점, 기회, 위협을 네 칸에 (SWOT)',
    motion: '네 칸이 차례로 나타나요',
    fields: [{ key: 'heading', label: '소제목', hint: '예: 우리 제안의 강점과 약점', optional: true }],
    items: {
      label: '칸',
      min: 4,
      max: 4,
      default: 4,
      fields: [
        { key: 'title', label: '칸 이름', hint: '칸 이름', hints: ['강점', '약점', '기회', '위협'] },
        {
          key: 'body',
          label: '내용',
          hint: '한두 줄로',
          hints: ['우리가 잘하는 것', '우리가 모자란 것', '밖에서 오는 좋은 일', '밖에서 오는 걱정거리'],
          multiline: true,
        },
      ],
    },
    minSpan: 6,
    prefSpan: 12,
    sample: {
      fields: { heading: '우리 제안의 강점과 약점' },
      items: [
        { title: '강점', body: '불량 원인까지 분석해 주는 곳은 우리뿐이에요' },
        { title: '약점', body: '경쟁사보다 첫해 비용이 0.9억 원 많아요' },
        { title: '기회', body: '고객사가 내년에 품질 투자를 늘리기로 했어요' },
        { title: '위협', body: '경쟁사가 가격을 더 낮출 수 있어요' },
      ],
    },
  },
  faq: {
    name: '예상 질문',
    description: '받을 만한 질문과 짧은 답을 미리',
    motion: '질문이 먼저, 답이 뒤따라요',
    fields: [{ key: 'heading', label: '소제목', hint: '예: 예상 질문', optional: true }],
    items: {
      label: '질문',
      min: 1,
      max: 4,
      default: 3,
      fields: [
        { key: 'title', label: '질문', hint: '받을 만한 질문', hints: ['왜 지금 해야 하나요?', '비용은 언제 되찾나요?', '다른 공장에도 쓸 수 있나요?', '안 하면 어떻게 되나요?'], multiline: true },
        { key: 'body', label: '답', hint: '짧은 답', multiline: true },
      ],
    },
    minSpan: 6,
    prefSpan: 12,
    sample: {
      fields: {},
      items: [
        { title: '왜 지금 해야 하나요?', body: '1분기에 고객 감사가 있어서 그 전에 검사 기록을 갖춰야 해요' },
        { title: '비용은 언제 되찾나요?', body: '불량 처리비가 줄어 14개월이면 설치비를 되찾아요' },
        { title: '다른 공장에도 쓸 수 있나요?', body: '같은 카메라를 써서 설정만 바꾸면 돼요' },
      ],
    },
  },
  checks: {
    name: '준비 상황',
    description: '할 일마다 완료, 진행 중, 지연, 예정을 표시',
    motion: '줄마다 표시가 찍혀요',
    fields: [{ key: 'heading', label: '소제목', hint: '예: 준비 상황', optional: true }],
    items: {
      label: '할 일',
      min: 1,
      max: 6,
      default: 4,
      fields: [
        { key: 'title', label: '할 일', hint: '할 일', hints: ['예산 승인', '업체 고르기', '라인 설치', '현장 교육', '효과 점검', '결과 보고'] },
        { key: 'body', label: '상태', hint: '완료, 진행 중, 지연, 예정', hints: ['완료', '완료', '진행 중', '예정', '예정', '예정'], optional: true },
        { key: 'meta', label: '담당과 기한', hint: '담당, 기한', optional: true },
      ],
    },
    minSpan: 4,
    prefSpan: 6,
    sample: {
      fields: { heading: '준비 상황' },
      items: [
        { title: '예산 승인', body: '완료', meta: '경영기획팀, 10월' },
        { title: '카메라 업체 고르기', body: '완료', meta: '구매팀, 10월' },
        { title: '시범 라인 설치', body: '진행 중', meta: '생산기술팀, 11월' },
        { title: '현장 교육', body: '1주 지연', meta: '품질팀, 11월' },
      ],
    },
  },
  gantt: {
    name: '추진 일정',
    description: '할 일마다 언제부터 언제까지 하는지 막대로 (간트 차트)',
    motion: '막대가 차례로 그어져요',
    fields: [
      { key: 'heading', label: '소제목', hint: '예: 추진 일정', optional: true },
      { key: 'cols', label: '기간 칸', hint: '11월 12월 1월 2월 3월' },
      { key: 'now', label: '지금', hint: '지금이 어느 칸인지 (예: 12월)', optional: true },
    ],
    items: {
      label: '할 일',
      min: 1,
      max: 6,
      default: 4,
      fields: [
        { key: 'title', label: '할 일', hint: '할 일', hints: ['업체 고르기', '라인 설치', '현장 교육', '효과 점검', '결과 보고', '넓히기'] },
        { key: 'body', label: '기간', hint: '예: 12월~2월', hints: ['11월', '11월~12월', '1월', '2월~3월', '3월', '3월'] },
        { key: 'meta', label: '담당', hint: '담당', optional: true },
      ],
    },
    minSpan: 8,
    prefSpan: 12,
    sample: {
      fields: { heading: '추진 일정', cols: '11월 12월 1월 2월 3월', now: '12월' },
      items: [
        { title: '카메라 업체 고르기', body: '11월', meta: '구매팀' },
        { title: '시범 라인 설치', body: '11월~12월', meta: '생산기술팀' },
        { title: '현장 교육', body: '1월', meta: '품질팀' },
        { title: '효과 점검과 보고', body: '2월~3월', meta: '경영기획팀' },
      ],
    },
  },
  people: {
    name: '맡은 사람',
    description: '누가 무엇을 맡는지 (추진 체계)',
    motion: '사람마다 차례로 나타나요',
    variants: [
      { id: 'row', name: '나란히' },
      { id: 'list', name: '목록' },
    ],
    fields: [{ key: 'heading', label: '소제목', hint: '예: 추진 체계', optional: true }],
    items: {
      label: '사람',
      min: 1,
      max: 4,
      default: 3,
      fields: [
        { key: 'title', label: '이름', hint: '이름과 직급' },
        { key: 'meta', label: '역할', hint: '역할', hints: ['사업 총괄', '현장 설치', '품질 검증', '예산 관리'] },
        { key: 'body', label: '맡은 일', hint: '맡은 일 한 줄', optional: true, multiline: true },
      ],
    },
    minSpan: 6,
    prefSpan: 12,
    sample: {
      fields: {},
      items: [
        { title: '한도윤 책임', meta: '사업 총괄', body: '일정과 예산, 윗분 보고' },
        { title: '서지우 선임', meta: '현장 설치', body: '라인마다 카메라 설치와 시험' },
        { title: '문하린 선임', meta: '품질 검증', body: '사람 검사와 결과 맞춰 보기' },
      ],
    },
  },
  image: {
    name: '그림',
    description: '화면, 현장 사진, 도면',
    motion: '걷히듯 나타나요',
    variants: [
      { id: 'cover', name: '꽉 채우기' },
      { id: 'contain', name: '전체 보이기' },
    ],
    fields: [
      { key: 'image', label: '그림', hint: '보여 줄 그림', image: true },
      { key: 'caption', label: '설명', hint: '그림 아래 한 줄', optional: true },
    ],
    minSpan: 3,
    prefSpan: 6,
    sample: { fields: { caption: '시범 라인에 단 검사 카메라' } },
  },
}

/** 레이아웃 부품의 칸 크기와 움직임. 칸은 그 레이아웃의 것에서 머리(제목, 부제, 출처)만 뺀다 */
const FROM_LAYOUT: Record<LayoutBlockType, { minSpan: number; prefSpan: number; motion: string; look?: BlockLook }> = {
  summary: { minSpan: 8, prefSpan: 12, motion: '줄마다 차례로 들어와요' },
  points: { minSpan: 8, prefSpan: 12, motion: '하나씩 차례로 올라와요' },
  kpi: { minSpan: 6, prefSpan: 12, motion: '숫자가 자리마다 굴러가 맞춰져요' },
  scorecard: { minSpan: 8, prefSpan: 12, motion: '실적 막대가 목표까지 자라요' },
  bars: { minSpan: 6, prefSpan: 8, motion: '막대가 차례로 자라요' },
  versus: { minSpan: 6, prefSpan: 8, motion: '두 막대가 나란히 자라고, 선은 차례로 그려져요' },
  bridge: { minSpan: 8, prefSpan: 12, motion: '막대가 하나씩 쌓여요' },
  trend: { minSpan: 6, prefSpan: 8, motion: '선이 왼쪽부터 그려져요' },
  share: { minSpan: 6, prefSpan: 8, motion: '조각이 차례로 채워져요' },
  funnel: { minSpan: 6, prefSpan: 8, motion: '단계마다 줄어들며 내려와요' },
  progress: { minSpan: 8, prefSpan: 12, motion: '진행 막대가 차올라요' },
  process: { minSpan: 8, prefSpan: 12, motion: '점이 맺히고 다음 단계로 선이 이어져요' },
  timeline: { minSpan: 8, prefSpan: 12, motion: '선을 따라 차례로 나타나요' },
  compare: { minSpan: 8, prefSpan: 12, motion: '두 면이 차례로 들어와요' },
  matrix: { minSpan: 6, prefSpan: 8, motion: '네 칸이 차례로 나타나요' },
  position: { minSpan: 8, prefSpan: 12, motion: '점이 하나씩 제자리에 내려앉아요' },
  pricing: { minSpan: 8, prefSpan: 12, motion: '안마다 차례로 올라와요' },
  table: { minSpan: 8, prefSpan: 12, motion: '줄마다 차례로 들어와요' },
  logos: { minSpan: 6, prefSpan: 12, motion: '로고가 차례로 나타나요' },
  agenda: { minSpan: 6, prefSpan: 8, motion: '항목이 차례로 들어와요' },
}

export const LAYOUT_BLOCKS = Object.keys(FROM_LAYOUT) as LayoutBlockType[]

export const isLayoutBlock = (type: string): type is LayoutBlockType => type in FROM_LAYOUT

function layoutBlockSpec(type: LayoutBlockType): BlockSpec {
  const l = LAYOUTS[type]
  return {
    type,
    name: l.name,
    description: l.description,
    layout: type,
    fields: l.fields.filter((f) => !HEAD_KEYS.includes(f.key)),
    items: l.items,
    variants: l.variants,
    highlight: l.highlight,
    ...FROM_LAYOUT[type],
  }
}

export const BLOCKS: Record<BlockType, BlockSpec> = {
  ...(Object.fromEntries(Object.entries(NATIVE).map(([type, spec]) => [type, { type, ...spec }])) as Record<NativeBlockType, BlockSpec>),
  ...(Object.fromEntries(LAYOUT_BLOCKS.map((t) => [t, layoutBlockSpec(t)])) as Record<LayoutBlockType, BlockSpec>),
}

export const BLOCK_TYPES = Object.keys(BLOCKS) as BlockType[]

/** 부품 고르기의 묶음. 모든 부품이 꼭 한 번씩 (테스트가 확인) */
/** 부품 묶음. short는 부품 고르기의 묶음 단추(한 줄에 다 들어가게 짧게), description은 묶음 제목 밑의 한 줄 */
export const BLOCK_GROUPS: { name: string; short: string; description: string; types: BlockType[] }[] = [
  { name: '글과 메시지', short: '글', description: '결론 한 줄, 설명, 목록, 인용, 예상 질문', types: ['message', 'text', 'bullets', 'quote', 'callout', 'faq', 'summary', 'points'] },
  { name: '숫자', short: '숫자', description: '큰 숫자, 전과 후, 목표 대비, 비율', types: ['number', 'delta', 'goal', 'ring', 'ratio', 'spark', 'kpi', 'scorecard'] },
  { name: '차트', short: '차트', description: '막대, 두 값 비교, 추이, 비중, 증감, 깔때기', types: ['bars', 'versus', 'trend', 'share', 'bridge', 'funnel'] },
  { name: '흐름과 일정', short: '일정', description: '할 일, 일정표, 단계, 진행률, 순서', types: ['checks', 'gantt', 'process', 'timeline', 'progress', 'agenda'] },
  { name: '비교와 표', short: '비교', description: '표, 두 안 비교, 우선순위, 위치, 가격안', types: ['facts', 'risks', 'swot', 'compare', 'matrix', 'position', 'pricing', 'table'] },
  { name: '그림과 사람', short: '그림', description: '사진, 화면, 담당자, 고객사 로고', types: ['image', 'people', 'logos'] },
]

export const BLOCK_LOOKS: { id: BlockLook; name: string }[] = [
  { id: 'plain', name: '바탕 없음' },
  { id: 'card', name: '옅은 면' },
  { id: 'bold', name: '진한 면' },
]

export const BLOCK_EFFECTS: { id: BlockEffect; name: string; description: string }[] = [
  { id: 'auto', name: '알아서', description: '부품에 맞게: 숫자는 올라가고, 막대는 자라고, 선은 그려져요' },
  { id: 'rise', name: '올라오기', description: '아래에서 살짝 올라와요' },
  { id: 'fade', name: '나타나기', description: '제자리에서 천천히 보여요' },
  { id: 'wipe', name: '펼치기', description: '왼쪽에서 오른쪽으로 걷히듯' },
  { id: 'slide', name: '밀려오기', description: '오른쪽에서 밀려 들어와요' },
  { id: 'pop', name: '튀어나오기', description: '작게 시작해 통통 튀며 커져요' },
  { id: 'zoom', name: '다가오기', description: '조금 크게 시작해 제자리로 다가와요' },
  { id: 'flip', name: '세우기', description: '누워 있다가 일어서듯 세워져요' },
  { id: 'blur', name: '초점 맞추기', description: '흐릿했다가 또렷해져요' },
  { id: 'none', name: '없음', description: '처음부터 보여요' },
]

export const BLOCK_LOOK_IDS = BLOCK_LOOKS.map((l) => l.id)
export const BLOCK_EFFECT_IDS = BLOCK_EFFECTS.map((e) => e.id)

export const MAX_ROWS = 3
export const MAX_IN_ROW = 3
export const MAX_BLOCKS = 6
/** 칸 사이 간격 (1920 기준 px). CSS의 --bk-gap과 같다 */
export const BLOCK_GAP = 48

/** 한 줄의 부품 수마다 고를 수 있는 칸 너비 */
export const COMBOS: Record<number, number[][]> = {
  1: [[12]],
  2: [
    [6, 6],
    [8, 4],
    [4, 8],
  ],
  3: [
    [4, 4, 4],
    [6, 3, 3],
    [3, 6, 3],
    [3, 3, 6],
  ],
}

// 가져온 파일에는 아무 값이나 있을 수 있어서 정해진 값이 아니면 기본값으로 읽는다
export const lookOf = (b: Pick<Block, 'type' | 'look'>): BlockLook => (b.look && BLOCK_LOOK_IDS.includes(b.look) ? b.look : (BLOCKS[b.type].look ?? 'plain'))
export const effectOf = (b: Pick<Block, 'effect'>): BlockEffect => (b.effect && BLOCK_EFFECT_IDS.includes(b.effect) ? b.effect : 'auto')

export function makeBlock(type: BlockType): Block {
  const spec = BLOCKS[type]
  const count = spec.items?.default ?? 0
  // 레이아웃 부품은 그 레이아웃의 장을 새로 만들 때와 같은 기본값 (안 비교는 가운데 안을 추천으로)
  const highlight = spec.layout ? withDefaultOptions(spec.layout, {}, count).highlight : undefined
  return { id: uid(), type, fields: {}, items: Array.from({ length: count }, emptyItem), ...(highlight !== undefined ? { highlight } : {}) }
}

export function blockCount(rows: BlockRow[]): number {
  return rows.reduce((n, r) => n + r.blocks.length, 0)
}

export function allBlocks(rows: BlockRow[]): Block[] {
  return rows.flatMap((r) => r.blocks)
}

/** 부품 장의 부품이 보이는 항목. 최대 개수를 넘는 항목은 지우지 않고 숨긴다 */
export function blockItems(block: Block): Item[] {
  return block.items.slice(0, BLOCKS[block.type].items?.max ?? 0)
}

/** 부품의 칸 안내. 부품 장만의 부품은 부품마다 정한 안내를 깔고, 사람이나 AI가 고친 안내를 덮는다 */
function nativeHints(block: Block): Record<string, string> {
  const spec = BLOCKS[block.type]
  const out: Record<string, string> = {}
  for (const f of spec.fields) out[f.key] = f.hint
  for (const f of spec.items?.fields ?? []) {
    out[`items.${f.key}`] = f.hint
    // 자리마다 다른 안내 (개요의 기간, 예산...). 사람이 그 칸의 안내를 고쳤으면 고친 것을 쓴다
    if (!block.hints?.[`items.${f.key}`]) f.hints?.forEach((h, i) => (out[`items.${i}.${f.key}`] = h))
  }
  return { ...out, ...block.hints }
}

/**
 * 부품 하나를 장처럼 보이게 한 것. 슬라이드의 칸 그리기(T, IT, 그림 칸)와 레이아웃 그리기를 그대로 쓰려고
 * 부품의 칸과 항목을 장의 칸과 항목 자리에 놓는다. 레이아웃 부품은 그 레이아웃의 장이 된다.
 */
export function blockSlide(outer: Slide, block: Block): Slide {
  const layout = BLOCKS[block.type].layout
  return {
    ...outer,
    layout: layout ?? 'compose',
    fields: block.fields,
    items: block.items,
    hints: layout ? (block.hints ?? {}) : nativeHints(block),
    variant: block.variant,
    options: { ...outer.options, highlight: block.highlight },
    rows: undefined,
  }
}

export function variantOfBlock(block: Block): string {
  const variants = BLOCKS[block.type].variants
  if (!variants?.length) return 'base'
  return variants.some((v) => v.id === block.variant) ? block.variant! : variants[0].id
}

/**
 * 부품에서 비어 있으면 편집할 때도 접어 두는 칸: 채우지 않아도 되는 칸. 항목 칸은 키가 'items.키'.
 * 부품은 발표할 때의 높이에 맞춰 놓으므로, 편집할 때 빈 안내를 다 펼치면 이웃 부품을 덮는다.
 * 고른 부품의 '칸 더하기'로 연다. 발표 전체의 값($소속 같은)은 부품 밖에서 적으므로 뺀다
 */
export function foldableFields(type: BlockType): { key: string; label: string; item: boolean }[] {
  const spec = BLOCKS[type]
  return [
    ...spec.fields.filter((f) => f.optional && !f.named && !f.image && !f.key.startsWith('$')).map((f) => ({ key: f.key, label: f.label, item: false })),
    ...(spec.items?.fields ?? []).filter((f) => f.optional && !f.image).map((f) => ({ key: `items.${f.key}`, label: f.label, item: true })),
  ]
}

/** 칸에 붙이는 data-field 앞머리. 같은 장의 다른 부품과 칸 이름이 겹치지 않게 */
export const blockFieldPrefix = (blockId: string) => `b.${blockId}.`

export interface BlockMissing {
  block: string
  key: string
  item?: number
  label: string
}

/** 이 부품에서 비어 있는 꼭 채울 칸 */
export function blockMissing(block: Block): BlockMissing[] {
  const spec = BLOCKS[block.type]
  const out: BlockMissing[] = []
  for (const f of spec.fields) {
    if (f.optional || f.key.startsWith('$')) continue
    if (!(block.fields[f.key] ?? '').trim()) out.push({ block: block.id, key: f.key, label: `${spec.name}의 ${f.label}` })
  }
  if (spec.items) {
    // '예상 질문 질문 1'처럼 부품 이름이 항목 이름으로 끝나면 항목 이름은 한 번만
    const label = spec.items.label
    const itemName = (i: number) => (spec.name.endsWith(label) ? `${spec.name} ${i + 1}` : `${spec.name} ${label} ${i + 1}`)
    blockItems(block).forEach((item, i) => {
      for (const f of spec.items!.fields) {
        if (f.optional) continue
        if (!item[f.key].trim()) out.push({ block: block.id, key: f.key, item: i, label: `${itemName(i)}의 ${f.label}` })
      }
    })
  }
  return out
}

// ---------- 장을 부품 장으로, 부품 장을 다시 장으로 ----------

/** 표지와 단락 장은 색 면과 자리가 정해진 장이라 부품 장으로 바꾸지 않는다 */
export const canCompose = (layout: LayoutId) => layout !== 'cover' && layout !== 'section' && layout !== 'compose'

const pick = (fields: Record<string, string>, keys: string[]) => Object.fromEntries(keys.filter((k) => fields[k]?.trim()).map((k) => [k, fields[k]]))
const newBlock = (type: BlockType, fields: Record<string, string> = {}, items: Item[] = [], extra: Partial<Block> = {}): Block => ({ id: uid(), type, fields, items, ...extra })
const newRow = (...blocks: (Block | null)[]): BlockRow => ({ id: uid(), blocks: blocks.filter((b): b is Block => !!b) })

/**
 * 지금 장을 같은 내용의 부품 장으로. 사람이 적은 글은 하나도 버리지 않는다: 제목, 부제, 출처는 장의 머리로,
 * 나머지 칸과 항목은 부품으로 옮긴다. 대부분은 같은 레이아웃의 부품 하나가 되어 모습도 그대로다.
 */
export function composeFrom(slide: Slide): Slide {
  if (!canCompose(slide.layout)) return slide
  const f = slide.fields
  const hintsOf = (keep: (k: string) => boolean) => Object.fromEntries(Object.entries(slide.hints).filter(([k]) => keep(k)))
  const headHints = hintsOf((k) => HEAD_KEYS.includes(k))
  let fields: Record<string, string>
  let rows: BlockRow[]
  switch (slide.layout) {
    case 'statement':
      fields = {}
      rows = [newRow(newBlock('message', { ...(f.title?.trim() ? { text: f.title } : {}), ...(f.lead?.trim() ? { sub: f.lead } : {}) }))]
      break
    case 'imageText': {
      fields = pick(f, ['title'])
      const img = newBlock('image', pick(f, ['image']), [], slide.options.contain ? { variant: 'contain' } : {})
      const txt = newBlock('text', pick(f, ['body']))
      rows = [slide.options.flip ? newRow(txt, img) : newRow(img, txt)]
      break
    }
    case 'case': {
      fields = pick(f, ['title'])
      const text = newBlock('text', { ...(f.client ? { label: f.client } : {}), ...pick(f, ['body']) })
      const image = f.image ? newBlock('image', { image: f.image }, [], { variant: 'contain' }) : null
      const numbers = slide.items.length ? newBlock('kpi', {}, slide.items, { variant: 'cards' }) : null
      const quote = f.quote?.trim() ? newBlock('quote', { quote: f.quote }) : null
      rows = [newRow(text, image), newRow(numbers, quote)].filter((r) => r.blocks.length > 0)
      break
    }
    case 'closing':
      fields = pick(f, ['title'])
      rows = slide.items.length ? [newRow(newBlock('bullets', {}, slide.items))] : []
      break
    default: {
      fields = pick(f, HEAD_KEYS)
      const rest = Object.fromEntries(Object.entries(f).filter(([k]) => !HEAD_KEYS.includes(k)))
      const hints = hintsOf((k) => !HEAD_KEYS.includes(k))
      rows = [
        newRow(
          newBlock(slide.layout as LayoutBlockType, rest, slide.items, {
            ...(slide.variant ? { variant: slide.variant } : {}),
            ...(slide.options.highlight !== undefined ? { highlight: slide.options.highlight } : {}),
            ...(Object.keys(hints).length ? { hints } : {}),
          }),
        ),
      ]
    }
  }
  const { tone, motion } = slide.options
  return {
    ...slide,
    layout: 'compose',
    fields,
    items: [],
    hints: headHints,
    variant: undefined,
    options: { ...(tone ? { tone } : {}), ...(motion ? { motion } : {}) },
    rows,
  }
}

/** 레이아웃 부품 하나뿐인 부품 장을 그 레이아웃의 장으로 되돌린다. 그럴 수 없으면 null */
export function unwrapCompose(slide: Slide, layout: LayoutId): Slide | null {
  const blocks = allBlocks(slide.rows ?? [])
  if (slide.layout !== 'compose' || blocks.length !== 1 || blocks[0].type !== layout) return null
  const b = blocks[0]
  return {
    ...slide,
    layout,
    fields: { ...pick(slide.fields, HEAD_KEYS), ...b.fields },
    items: b.items,
    hints: { ...slide.hints, ...b.hints },
    variant: b.variant,
    options: { ...slide.options, ...(b.highlight !== undefined ? { highlight: b.highlight } : {}) },
    rows: undefined,
  }
}

// 그 너비로는 높이가 아무리 높아도 잘리는 부품(blockHeights.ts의 999)도 그 너비에 넣지 않는다
const fits = (blocks: Block[], combo: number[]) => combo.every((s, i) => s >= BLOCKS[blocks[i].type].minSpan && blockMinH(blocks[i], s) < NO_FIT)
const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i])

/**
 * 이 부품들을 한 줄에 놓을 때의 칸 너비. 지금 너비가 맞으면 그대로, 아니면 넓어야 하는 부품에 넓은 칸을 준다.
 * 어떤 비율로도 들어가지 않으면 null (그 줄에는 넣을 수 없다)
 */
export function fitSpans(blocks: Block[], spans?: number[]): number[] | null {
  const combos = COMBOS[blocks.length]
  if (!combos) return null
  if (spans && combos.some((c) => same(c, spans)) && fits(blocks, spans)) return spans
  let best: number[] | null = null
  let bestScore = -Infinity
  for (const c of combos) {
    if (!fits(blocks, c)) continue
    // 바라는 너비를 얼마나 채우는지가 먼저, 같으면 똑같이 나눈 쪽
    const score = c.reduce((n, s, i) => n + Math.min(s, BLOCKS[blocks[i].type].prefSpan), 0) * 10 - (c.every((s) => s === c[0]) ? 0 : 1)
    if (score > bestScore) {
      best = c
      bestScore = score
    }
  }
  return best
}

/** 한 줄의 칸 너비: 저장된 값이 맞으면 그것, 아니면 알아서 */
export function spansOf(row: BlockRow): number[] {
  return fitSpans(row.blocks, row.spans) ?? row.blocks.map(() => 12 / Math.max(1, row.blocks.length))
}

/** 이 줄에서 고를 수 있는 칸 너비들 (칸 사이를 끌어 비율을 바꿀 때) */
export function spanChoices(row: BlockRow): number[][] {
  return (COMBOS[row.blocks.length] ?? []).filter((c) => fits(row.blocks, c))
}

// ---------- 자리 계산 ----------

/** 부품 장에서 나올 수 있는 칸 너비 (COMBOS에 있는 것) */
const SPANS = [3, 4, 6, 8, 12]
/** blockHeights.ts에서 그 너비로는 860px로도 안 되는 것 */
const NO_FIT = 999

/**
 * 잘리지는 않아도 너무 낮으면 보기 나쁜 부품의 바닥 높이. 차트는 막대와 선이 납작해지고, 원과 그림은 띠처럼 작아진다.
 * 잰 높이(blockHeights.ts)는 '잘리지 않는' 높이라서 이것과 견줘 큰 쪽을 쓴다
 */
const FLOOR: Partial<Record<BlockType, (variant: string) => number>> = {
  // 세로 막대는 숫자와 이름 자리를 빼고 남는 높이가 막대라서, 낮으면 글은 멀쩡해도 막대가 거의 사라진다
  bars: (v) => (v === 'columns' ? 340 : 0),
  // 선 차트는 낮으면 선이 납작한 띠가 되고, 점 위아래의 숫자가 이름 줄로 내려앉는다
  versus: (v) => (v === 'lines' ? 420 : 360),
  bridge: () => 380,
  trend: () => 380,
  share: (v) => (v === 'donut' ? 380 : 320),
  ring: () => 220,
  ratio: () => 220,
  spark: () => 240,
  matrix: () => 380,
  // 점과 이름표가 판 위에 흩어져서, 낮으면 이름표끼리 비킬 자리가 없다 (편집할 때는 점수 줄까지 붙는다)
  position: () => 460,
  swot: () => 420,
  image: () => 200,
}
/** 항목이 셋 이상인 부품: 칸이 230px 밑이면 글자가 가장 작은 단계(--bk-h 0.68)로 떨어져 빽빽해진다. 로고는 그림이라 빼고 */
const LIST_FLOOR = 240

/**
 * 부품을 이 너비(12칸 중 몇 칸)에 놓을 때 잘리지 않는 가장 낮은 칸 높이(캔버스 px).
 * 모양, 바탕(그대로 / 카드와 강조색 면), 항목 수, 너비마다 갤러리에서 잰 값(blockHeights.ts)에 보기 좋은 바닥을 더한다.
 * 줄 높이는 이보다 낮아지지 않고, 모두 합쳐 장에 들어가지 않으면 그 자리에는 넣지 않는다. 그 너비로 안 되면 NO_FIT 이상.
 */
export function blockMinH(block: Block, span: number): number {
  const spec = BLOCKS[block.type]
  const variant = variantOfBlock(block)
  const n = spec.items ? blockItems(block).length : 0
  const table = BLOCK_HEIGHTS[`${block.type}.${variant}.${lookOf(block) === 'plain' ? 'plain' : 'card'}`]
  // 잰 너비가 아니면 그보다 넓은 것 가운데 가장 가까운 것 (없으면 가장 넓은 것)
  const at = SPANS.find((x) => x >= span && table?.[x]) ?? [...SPANS].reverse().find((x) => table?.[x])
  const hs = at !== undefined ? table?.[at] : undefined
  // 아직 재지 않은 부품 (새로 만들고 갤러리에서 재기 전): 넉넉하게
  const measured = hs?.length ? hs[Math.min(n, hs.length - 1)] : 400
  if (measured >= NO_FIT) return measured
  return Math.max(measured, FLOOR[block.type]?.(variant) ?? 0, n >= 3 && block.type !== 'logos' ? LIST_FLOOR : 0)
}

/** 부품 고르기 그림처럼 놓일 너비를 모를 때: 보기 좋은 너비에 놓았을 때 */
export const blockPrefH = (block: Block) => blockMinH(block, BLOCKS[block.type].prefSpan)

const rowMinH = (row: BlockRow) => {
  const spans = spansOf(row)
  return Math.max(0, ...row.blocks.map((b, i) => blockMinH(b, spans[i])))
}

/** 한 칸의 자리: 몇째 줄, 12칸 격자의 어디서부터 몇 칸 */
export interface CellBox {
  block: Block
  rowId: string
  row: number
  rows: number
  /** 줄 안에서 몇째 칸 */
  col: number
  cols: number
  start: number
  span: number
}

export function cellBoxes(rows: BlockRow[]): CellBox[] {
  const out: CellBox[] = []
  rows.forEach((row, r) => {
    const spans = spansOf(row)
    let start = 0
    row.blocks.forEach((block, c) => {
      out.push({ block, rowId: row.id, row: r, rows: rows.length, col: c, cols: row.blocks.length, start, span: spans[c] })
      start += spans[c]
    })
  })
  return out
}

/**
 * 부품 장의 본문 상자: 12칸 격자. 줄 높이는 똑같이 나눈다(위아래 줄이 1:1, 세 줄이면 1:1:1). 부품마다 비중을 두어 나누면
 * 남는 높이가 무거운 줄로 몰려 장마다 줄 높이가 제각각이 된다. 다만 잘리지 않을 높이 밑으로는 줄이지 않고,
 * 그 줄이 더 가져간 만큼을 나머지 줄이 다시 똑같이 나눈다.
 * 계산은 브라우저의 격자가 한다. 그래서 내보낸 HTML도 자바스크립트 없이 같은 자리에 그려진다.
 */
export function areaStyle(rows: BlockRow[]): Record<string, string> {
  // --bk-sq: 놓은 뒤에 내용이 늘어 줄들이 장보다 높아지면 slides/fitBlocks.ts가 줄 높이를 같은 비율로 낮춘다
  return { gridTemplateRows: rows.map((r) => `minmax(calc(${rowMinH(r)}px * var(--bk-sq, 1)), 1fr)`).join(' ') }
}

export function cellStyle(b: CellBox): Record<string, string> {
  return { gridRow: String(b.row + 1), gridColumn: `${b.start + 1} / span ${b.span}` }
}

/**
 * 줄마다의 높이(px). 격자의 minmax(최소, 1fr)와 같은 계산이다: 똑같이 나눠 최소보다 낮아지는 줄은
 * 최소에 묶고, 남은 높이를 나머지 줄이 다시 똑같이 나눈다. 끌어다 놓는 동안 놓일 자리를 찾을 때 쓴다.
 */
export function rowHeights(rows: BlockRow[], areaH: number, gap = BLOCK_GAP): number[] {
  const free = areaH - Math.max(0, rows.length - 1) * gap
  const mins = rows.map(rowMinH)
  const fixed = new Set<number>()
  for (;;) {
    const rest = rows.length - fixed.size
    const restH = free - [...fixed].reduce((a, i) => a + mins[i], 0)
    const each = rest > 0 ? Math.max(0, restH) / rest : 0
    const next = mins.findIndex((m, i) => !fixed.has(i) && each < m)
    if (next < 0) return mins.map((m, i) => (fixed.has(i) ? m : each))
    fixed.add(next)
  }
}

/** 줄들을 잘리지 않게 놓는 데 드는 높이: 줄마다 가장 낮은 높이와 줄 사이 */
export function needH(rows: BlockRow[], gap = BLOCK_GAP): number {
  return rows.reduce((a, r) => a + rowMinH(r), 0) + Math.max(0, rows.length - 1) * gap
}

/** 모든 줄이 잘리지 않고 장에 들어가는지 */
export function fitsHeight(rows: BlockRow[], areaH: number, gap = BLOCK_GAP): boolean {
  return needH(rows, gap) <= areaH + 1
}

/** 부품 하나를 바꾼 줄들. 바뀐 부품이 지금 너비에 들어가지 않으면 그 줄의 너비를 다시 고른다 (놓을 때와 같은 규칙) */
export function changeRows(rows: BlockRow[], blockId: string, fn: (b: Block) => Block): BlockRow[] {
  return rows.map((r) => {
    if (!r.blocks.some((b) => b.id === blockId)) return r
    const blocks = r.blocks.map((b) => (b.id === blockId ? fn(b) : b))
    return { ...r, blocks, spans: fitSpans(blocks, r.spans) ?? r.spans }
  })
}

/** 부품 하나를 바꾸면(항목 더하기, 모양이나 바탕 바꾸기) 장에 들어가지 않을 때 그 까닭. 들어가면 null */
export function changeIssue(rows: BlockRow[], blockId: string, fn: (b: Block) => Block, areaH: number): NoRoom | null {
  const next = changeRows(rows, blockId, fn)
  return fitsHeight(next, areaH) ? null : { kind: 'height', need: Math.round(needH(next)), room: Math.round(areaH) }
}

/** 부품 하나를 바꿔도(항목 더하기, 모양 바꾸기) 모든 줄이 장에 들어가는지 */
export function fitsWith(rows: BlockRow[], blockId: string, fn: (b: Block) => Block, areaH: number): boolean {
  return !changeIssue(rows, blockId, fn, areaH)
}

/** 자리가 모자라 항목을 더하거나 모양을 바꿀 수 없을 때의 안내 */
export const NO_ROOM = '장에 자리가 모자라요. 다른 부품을 빼거나 다음 장으로 나눠 보세요'

/** 제목, 부제 한 줄의 높이와 한 줄에 드는 너비 (slides.css의 .s-title, .s-lead). 보내는 자료(d-read)는 한 단계 작다 */
const HEAD_TYPE = {
  present: { title: 72, lead: 36 },
  read: { title: 64, lead: 32 },
}
/** 글자 하나의 평균 너비(글자 크기의 몫). 한글과 띄어쓰기를 섞은 제목을 재어 정한 값이다 */
const EM_PER_CHAR = 0.67

/** 이 크기의 글이 이 너비에서 몇 줄인지 */
const lineCount = (text: string, fs: number, width: number) => Math.max(1, Math.ceil(([...text].length * EM_PER_CHAR * fs) / width))

/**
 * 부품 장 본문 상자의 높이 어림 (발표 화면 기준: 비운 제목과 부제는 자리를 차지하지 않는다. edit면 편집 화면 기준).
 * 슬라이드가 그려져 있지 않아 잴 수 없을 때(문서 보기, 시험) 쓴다. 제목은 길이에 따라 글자가 작아지고(fields.tsx의 fit, 24자와 40자)
 * 1560px을 넘으면 줄이 바뀐다. 부제는 1320px, 제목과 부제 사이 28, 머리 아래 64. 발표 설정(글자 크기, 보내는 자료)도 본다
 */
export function composeAreaH(slide: Slide, look?: { meta?: { method?: string }; theme?: { size?: string } }, edit?: boolean): number {
  // 편집 화면은 비운 제목과 부제에도 안내를 보여서 그만큼 본문이 낮다
  const title = slide.fields.title?.trim() || (edit ? hintFor('compose', slide.hints ?? {}, 'title') : '')
  const lead = slide.fields.lead?.trim() || (edit ? hintFor('compose', slide.hints ?? {}, 'lead') : '')
  const type = look?.meta?.method === 'send' ? HEAD_TYPE.read : HEAD_TYPE.present
  const scale = look?.theme?.size === 'small' ? 0.92 : look?.theme?.size === 'large' ? 1.08 : 1
  const n = [...title].length
  const tfs = type.title * scale * (n > 40 ? 0.7 : n > 24 ? 0.84 : 1)
  const lfs = type.lead * scale
  const titleH = title ? lineCount(title, tfs, 1560) * tfs * 1.2 : 0
  const leadH = lead ? lineCount(lead, lfs, 1320) * lfs * 1.48 : 0
  const head = titleH + leadH + (title && lead ? 28 : 0)
  return Math.floor(1080 - 100 - 140 - (head ? head + 64 : 0))
}

/** 항목을 하나 더한 부품. 보이는 항목 수(max) 뒤에 숨은 항목이 있으면 그 앞에 넣는다 */
export function withItem(b: Block): Block {
  const max = BLOCKS[b.type].items?.max ?? 0
  const visible = Math.min(b.items.length, max)
  if (visible >= max) return b
  const items = [...b.items]
  items.splice(visible, 0, emptyItem())
  return { ...b, items }
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 칸마다의 자리를 px로 (본문 상자 크기 기준). 부품 id로 찾는다 */
export function cellRects(rows: BlockRow[], size: { w: number; h: number }, gap = BLOCK_GAP): Map<string, Rect> {
  const colW = (size.w - 11 * gap) / 12
  const heights = rowHeights(rows, size.h, gap)
  const tops = heights.map((_, i) => heights.slice(0, i).reduce((a, h) => a + h + gap, 0))
  const out = new Map<string, Rect>()
  for (const b of cellBoxes(rows)) {
    out.set(b.block.id, { x: b.start * (colW + gap), y: tops[b.row], w: b.span * colW + (b.span - 1) * gap, h: heights[b.row] })
  }
  return out
}

// ---------- 넣기, 빼기, 놓을 자리 ----------

export type DropTarget = { kind: 'row'; index: number } | { kind: 'cell'; row: number; index: number }

export const sameTarget = (a: DropTarget | null, b: DropTarget | null) =>
  !!a && !!b && a.kind === b.kind && (a.kind === 'row' ? a.index === (b as typeof a).index : a.row === (b as typeof a).row && a.index === (b as typeof a).index)

/** 그 자리에 부품을 넣은 줄들. 넣을 수 없는 자리면 null */
export function insertAt(rows: BlockRow[], target: DropTarget, block: Block, rowId = uid()): BlockRow[] | null {
  if (blockCount(rows) >= MAX_BLOCKS) return null
  if (target.kind === 'row') {
    if (rows.length >= MAX_ROWS || target.index < 0 || target.index > rows.length) return null
    return [...rows.slice(0, target.index), { id: rowId, blocks: [block] }, ...rows.slice(target.index)]
  }
  const row = rows[target.row]
  if (!row || row.blocks.length >= MAX_IN_ROW || target.index < 0 || target.index > row.blocks.length) return null
  const blocks = [...row.blocks]
  blocks.splice(target.index, 0, block)
  const spans = fitSpans(blocks)
  if (!spans) return null
  return rows.map((r, i) => (i === target.row ? { ...r, blocks, spans } : r))
}

/** 부품을 뺀 줄들. 빈 줄은 없애고, 남은 칸은 너비를 다시 고른다 */
export function removeBlock(rows: BlockRow[], blockId: string): BlockRow[] {
  return rows.flatMap((r) => {
    if (!r.blocks.some((b) => b.id === blockId)) return [r]
    const blocks = r.blocks.filter((b) => b.id !== blockId)
    return blocks.length ? [{ ...r, blocks, spans: fitSpans(blocks) ?? undefined }] : []
  })
}

/** 부품이 지금 있는 자리 (옮기기를 시작할 때 처음 자리) */
export function targetOf(rows: BlockRow[], blockId: string): DropTarget | null {
  for (let r = 0; r < rows.length; r++) {
    const c = rows[r].blocks.findIndex((b) => b.id === blockId)
    if (c < 0) continue
    return rows[r].blocks.length === 1 ? { kind: 'row', index: r } : { kind: 'cell', row: r, index: c }
  }
  return null
}

/** 놓을 수 있을지 따져 볼 모든 자리 (읽는 차례대로): 줄 사이마다 새 줄, 줄마다 부품 사이 */
function allTargets(rows: BlockRow[]): DropTarget[] {
  const out: DropTarget[] = []
  for (let r = 0; r <= rows.length; r++) {
    out.push({ kind: 'row', index: r })
    if (r === rows.length) break
    for (let c = 0; c <= rows[r].blocks.length; c++) out.push({ kind: 'cell', row: r, index: c })
  }
  return out
}

/**
 * 그 자리에 넣을 수 없는 까닭. 화면에 보이는 문구는 편집기가 이것으로 만든다 (screens/editor/noRoom.ts).
 * full: 한 장의 부품 수, rows: 줄 수, row-full: 한 줄의 부품 수, narrow: 그 줄에 끼우면 칸이 너무 좁아진다,
 * height: 넣으면 줄들이 장보다 높아진다 (need: 잘리지 않는 데 드는 높이, room: 본문 높이)
 */
export type NoRoom =
  | { kind: 'full' }
  | { kind: 'rows' }
  | { kind: 'row-full' }
  | { kind: 'narrow'; span: number }
  | { kind: 'height'; need: number; room: number }

/** 그 자리에 넣을 수 없는 까닭. 넣을 수 있으면 null */
export function whyNot(rows: BlockRow[], target: DropTarget, block: Block, areaH?: number): NoRoom | null {
  if (blockCount(rows) >= MAX_BLOCKS) return { kind: 'full' }
  if (target.kind === 'row' && rows.length >= MAX_ROWS) return { kind: 'rows' }
  if (target.kind === 'cell' && (rows[target.row]?.blocks.length ?? 0) >= MAX_IN_ROW) return { kind: 'row-full' }
  const next = insertAt(rows, target, block, 'x')
  if (!next) return { kind: 'narrow', span: BLOCKS[block.type].minSpan }
  if (areaH !== undefined && !fitsHeight(next, areaH)) return { kind: 'height', need: Math.round(needH(next)), room: Math.round(areaH) }
  return null
}

/** 넣을 수 있는 모든 자리 (읽는 차례대로). 본문 높이를 주면 넣고 나서도 잘리지 않는 자리만 */
export function validTargets(rows: BlockRow[], block: Block, areaH?: number): DropTarget[] {
  return allTargets(rows).filter((t) => !whyNot(rows, t, block, areaH))
}

/**
 * 이 장 어디에도 넣을 수 없을 때 그 까닭 하나. 넣을 수 있으면 null.
 * 높이만 모자란 자리가 있으면 그 가운데 가장 덜 모자란 것(무엇을 줄이면 되는지 알려 줄 수 있어서), 아니면 칸 수
 */
export function placeIssue(rows: BlockRow[], block: Block, areaH?: number): NoRoom | null {
  const why = allTargets(rows).map((t) => whyNot(rows, t, block, areaH))
  if (why.some((w) => !w)) return null
  const all = why.filter((w): w is NoRoom => !!w)
  const tall = all.filter((w) => w.kind === 'height').sort((a, b) => a.need - b.need)[0]
  return all.find((w) => w.kind === 'full') ?? tall ?? all.find((w) => w.kind === 'narrow') ?? { kind: 'rows' }
}

/**
 * 눌러서 넣을 때 알아서 고르는 자리: 마지막 줄 끝에 놓아도 모두 보기 좋은 너비가 되면 그 옆에,
 * 아니면 새 줄. 새 줄이 들어가지 않으면 마지막 줄 끝. 다 안 되면 넣을 수 있는 첫 자리.
 */
export function autoTarget(rows: BlockRow[], block: Block, areaH?: number): DropTarget | null {
  const valid = validTargets(rows, block, areaH)
  const ok = (t: DropTarget) => valid.some((v) => sameTarget(v, t))
  if (!rows.length) return valid[0] ?? null
  const last = rows.length - 1
  const beside: DropTarget = { kind: 'cell', row: last, index: rows[last].blocks.length }
  const placed = insertAt(rows, beside, block, 'x')
  if (placed && ok(beside)) {
    const row = placed[last]
    const spans = spansOf(row)
    if (row.blocks.every((b, i) => spans[i] >= BLOCKS[b.type].prefSpan)) return beside
  }
  const below: DropTarget = { kind: 'row', index: rows.length }
  if (ok(below)) return below
  // 새 줄이 들어가지 않으면 보기 좋은 너비가 아니어도 마지막 줄 끝에 (앞에 끼워 넣으면 읽는 차례가 뒤바뀐다)
  if (placed && ok(beside)) return beside
  return valid[0] ?? null
}

/**
 * 끌고 있는 곳에서 놓을 자리. 부품을 뺀 채로 고정해 둔 자리(base)를 기준으로 본다.
 * 칸의 위·아래 가장자리면 새 줄, 왼쪽·오른쪽 반이면 그 옆 칸. 그 자리에 넣을 수 없으면 다른 쪽으로,
 * 그래도 안 되면 넣을 수 있는 자리 가운데 가장 가까운 곳. 그래서 대충 놓아도 늘 정해진 자리에 들어간다.
 */
export function dropTarget(
  base: BlockRow[],
  block: Block,
  p: { x: number; y: number },
  size: { w: number; h: number },
  gap = BLOCK_GAP,
  current?: DropTarget | null,
): DropTarget | null {
  const valid = validTargets(base, block, size.h)
  if (!valid.length) return null
  const ok = (t: DropTarget) => valid.some((v) => sameTarget(v, t))
  if (!base.length) return valid[0]
  // 끄는 동안 화면에는 놓일 자리를 넣은 모습이 보이는데, 아래의 자리 찾기는 끄는 부품을 뺀 모습으로 잰다.
  // 손이 지금 보이는 자리 안에 있으면 바꾸지 않는다(보이는 칸 안에서 손을 움직였는데 자리가 다른 데로 튀지 않게)
  if (current && ok(current)) {
    const r = slotRect(base, current, block, size, gap)
    if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return current
  }
  for (const t of wantedTargets(base, p, size, gap)) if (ok(t)) return t

  // 그 둘레에 자리가 없으면 넣을 수 있는 자리 가운데 놓일 칸이 가장 가까운 곳
  let best: DropTarget | null = null
  let bestD = Infinity
  for (const t of valid) {
    const pr = cellRects(insertAt(base, t, block, 'x')!, size, gap).get(block.id)!
    const d = Math.hypot(p.x - (pr.x + pr.w / 2), p.y - (pr.y + pr.h / 2))
    if (d < bestD) {
      best = t
      bestD = d
    }
  }
  return best
}

/** 이 자리에 놓으면 끄는 부품이 들어갈 칸 (장 본문 px) */
export function slotRect(base: BlockRow[], t: DropTarget, block: Block, size: { w: number; h: number }, gap = BLOCK_GAP): Rect | null {
  const rows = insertAt(base, t, block, 'x')
  return rows ? (cellRects(rows, size, gap).get(block.id) ?? null) : null
}

/** 손 아래의 자리 (넣을 수 있는지와 상관없이). 끄는 동안 '여기는 왜 안 되는지'를 알려 줄 때 */
export function pointerTarget(base: BlockRow[], p: { x: number; y: number }, size: { w: number; h: number }, gap = BLOCK_GAP): DropTarget {
  return base.length ? wantedTargets(base, p, size, gap)[0] : { kind: 'row', index: 0 }
}

/** 손 아래에서 바라는 자리들 (먼저 바라는 차례대로) */
function wantedTargets(base: BlockRow[], p: { x: number; y: number }, size: { w: number; h: number }, gap: number): DropTarget[] {
  // 가장 가까운 칸과 그 안에서의 위치(0~1)
  const rects = cellRects(base, size, gap)
  let near: { box: CellBox; r: Rect; d: number } | null = null
  for (const box of cellBoxes(base)) {
    const r = rects.get(box.block.id)!
    const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w))
    const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h))
    const d = Math.hypot(dx, dy)
    if (!near || d < near.d) near = { box, r, d }
  }
  const { box, r } = near!
  const u = Math.min(1, Math.max(0, (p.x - r.x) / r.w))
  const v = Math.min(1, Math.max(0, (p.y - r.y) / r.h))
  const above: DropTarget = { kind: 'row', index: box.row }
  const below: DropTarget = { kind: 'row', index: box.row + 1 }
  const left: DropTarget = { kind: 'cell', row: box.row, index: box.col }
  const right: DropTarget = { kind: 'cell', row: box.row, index: box.col + 1 }
  return v < 0.28 ? [above, u < 0.5 ? left : right, below] : v > 0.72 ? [below, u < 0.5 ? left : right, above] : u < 0.5 ? [left, v < 0.5 ? above : below, right] : [right, v < 0.5 ? above : below, left]
}

/** 칸 사이를 끌어 놓은 곳(줄 너비에 대한 몫)에 가장 가까운 비율 */
export function spansAt(row: BlockRow, gutter: number, frac: number): number[] {
  const choices = spanChoices(row)
  let best = spansOf(row)
  let bestD = Infinity
  for (const c of choices) {
    const edge = c.slice(0, gutter + 1).reduce((a, b) => a + b, 0) / 12
    const d = Math.abs(edge - frac)
    if (d < bestD - 1e-6) {
      best = c
      bestD = d
    }
  }
  return best
}

/** 읽는 차례대로 한 칸 앞이나 뒤로 (끌기 어려울 때) */
export function shiftBlock(rows: BlockRow[], blockId: string, dir: -1 | 1): BlockRow[] {
  const flat = allBlocks(rows)
  const i = flat.findIndex((b) => b.id === blockId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= flat.length) return rows
  const swapped = [...flat]
  ;[swapped[i], swapped[j]] = [swapped[j], swapped[i]]
  // 줄 모양은 그대로 두고 부품만 자리를 바꾼다. 넓이가 맞지 않으면 칸 너비를 다시 고른다
  let k = 0
  return rows.map((r) => {
    const blocks = r.blocks.map(() => swapped[k++])
    return { ...r, blocks, spans: fitSpans(blocks, r.spans) ?? fitSpans(blocks) ?? undefined }
  })
}

/** 같은 내용의 부품 (새 id) */
export function copyBlock(b: Block): Block {
  return { ...b, id: uid(), fields: { ...b.fields }, items: b.items.map((it) => ({ ...it, id: uid() })), hints: b.hints && { ...b.hints } }
}

// ---------- 파일에서 읽은 부품 장 바로잡기 ----------

const ITEM_KEYS = ['title', 'body', 'value', 'meta', 'image'] as const
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const strings = (v: unknown): Record<string, string> =>
  isRecord(v) ? Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string')) : {}

/**
 * 가져온 파일이나 예전 저장본의 줄과 부품을 정해진 꼴로 맞춘다. 모르는 부품은 빼고, 개수는 정한 만큼만.
 * 글은 지우지 않는다: 꼴이 맞지 않는 값만 버린다. 그래서 몇 번을 거쳐도 결과가 같다.
 * lost를 주면 버린 것 중 사람이 넣었을 것(이 버전이 모르는 부품, 모양, 움직임, 칸과 정한 개수를 넘는 부품)을 센다.
 * 새 버전에서 만든 발표를 이 버전이 알아보는 데 쓴다 (compat.ts)
 */
export function cleanRows(rows: unknown, lost?: { n: number }): BlockRow[] {
  if (!Array.isArray(rows)) return []
  const drop = (n = 1) => lost && (lost.n += n)
  let left = MAX_BLOCKS
  const out: BlockRow[] = []
  for (const r of rows) {
    if (!isRecord(r) || !Array.isArray(r.blocks)) continue
    if (out.length >= MAX_ROWS) {
      drop(r.blocks.length)
      continue
    }
    const blocks: Block[] = []
    for (const b of r.blocks) {
      if (!isRecord(b) || typeof b.id !== 'string') continue
      if (blocks.length >= MAX_IN_ROW || left <= 0 || !(BLOCK_TYPES as unknown[]).includes(b.type)) {
        drop()
        continue
      }
      const type = b.type as BlockType
      const items = Array.isArray(b.items)
        ? b.items.filter(isRecord).map((it) => {
            const item = { id: typeof it.id === 'string' ? it.id : uid() } as Item
            for (const k of ITEM_KEYS) item[k] = typeof it[k] === 'string' ? (it[k] as string) : ''
            drop(Object.keys(it).filter((k) => k !== 'id' && !(ITEM_KEYS as readonly string[]).includes(k)).length)
            return item
          })
        : []
      const block: Block = { id: b.id, type, fields: strings(b.fields), items }
      if (isRecord(b.hints)) block.hints = strings(b.hints)
      if ((BLOCK_LOOK_IDS as unknown[]).includes(b.look)) block.look = b.look as BlockLook
      else if (b.look !== undefined) drop()
      if ((BLOCK_EFFECT_IDS as unknown[]).includes(b.effect)) block.effect = b.effect as BlockEffect
      else if (b.effect !== undefined) drop()
      if (typeof b.variant === 'string' && BLOCKS[type].variants?.some((v) => v.id === b.variant)) block.variant = b.variant
      else if (b.variant !== undefined) drop()
      if (Number.isInteger(b.highlight)) block.highlight = b.highlight as number
      blocks.push(block)
      left--
    }
    if (!blocks.length) continue
    const row: BlockRow = { id: typeof r.id === 'string' ? r.id : uid(), blocks }
    if (Array.isArray(r.spans) && r.spans.length === blocks.length && r.spans.every((n) => Number.isInteger(n))) {
      // 정해진 비율이 아니면 버리고 기본 비율로
      if (spanChoices(row).some((c) => c.join() === (r.spans as number[]).join())) row.spans = r.spans as number[]
    }
    out.push(row)
  }
  return out
}

/**
 * 발표를 열 때: 부품 장의 줄을 바로잡는다. 부품 장에서 다른 레이아웃으로 바꾼 장도 줄을 남겨 둔다
 * (부품 장으로 되돌리면 다시 보이게. 사람이 적은 글을 버리지 않는다)
 */
export function cleanDeckRows<T extends { slides: Slide[] }>(deck: T): T {
  if (!deck.slides.some((s) => s.layout === 'compose' || s.rows !== undefined)) return deck
  return { ...deck, slides: deck.slides.map((s) => (s.layout === 'compose' || s.rows !== undefined ? { ...s, rows: cleanRows(s.rows) } : s)) }
}

/**
 * 그릴 수 있는 부품만. 새 버전에서 만든 발표의 모르는 부품은 그리지 않는다
 * (그런 발표는 편집기가 열지 않지만, 내 발표 목록의 작은 그림은 그린다)
 */
export function knownRows(rows: BlockRow[]): BlockRow[] {
  const known = (b: Block) => BLOCK_TYPES.includes(b.type)
  if (rows.every((r) => r.blocks.every(known))) return rows
  return rows.map((r) => ({ ...r, blocks: r.blocks.filter(known), spans: undefined })).filter((r) => r.blocks.length)
}
