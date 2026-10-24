import type { ItemKey, LayoutId, Slide } from './types'

export interface FieldSpec {
  /** 슬라이드 칸 이름. `$`로 시작하면 덱 단위 값(소속, 발표자 등) */
  key: string
  label: string
  hint: string
  multiline?: boolean
  optional?: boolean
  /** 비워 두면 정해진 이름(목표, 실적 같은)으로 보이는 칸. 부품 안에서도 접지 않는다 */
  named?: boolean
  image?: boolean
}

export interface ItemFieldSpec {
  key: ItemKey
  label: string
  hint: string
  /** 항목 자리마다 다른 안내 (2×2의 네 칸처럼 자리에 뜻이 있을 때) */
  hints?: string[]
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
  /** 항목 하나를 강조할 수 있으면 그 이름과, 고르지 않았을 때 강조할 항목(-1은 없음, 'last'는 마지막 항목) */
  highlight?: { label: string; fallback: number | 'last' }
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
    variants: [
      { id: 'base', name: '오른쪽 결정 요청' },
      { id: 'band', name: '아래 띠' },
      { id: 'full', name: '색 면' },
    ],
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
    variants: [
      { id: 'base', name: '색 면' },
      { id: 'plain', name: '바탕' },
    ],
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
      fields: [{ key: 'title', label: '항목', hint: '다룰 내용', hints: ['배경', '제안', '효과와 비용', '실행 계획', '위험과 대응', '요청 사항'] }],
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
        { key: 'title', label: '이름', hint: '줄 이름', hints: ['배경', '제안', '기대 효과', '요청 사항', '일정'] },
        { key: 'body', label: '내용', hint: '한두 문장', multiline: true },
      ],
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
        { key: 'value', label: '숫자', hint: '30%', hints: ['4.8억 원', '3년', '22%', '120곳'] },
        { key: 'title', label: '이름', hint: '지표 이름', hints: ['예상 매출', '계약 기간', '예상 이익률', '대상 고객'] },
        { key: 'body', label: '설명', hint: '짧은 설명', multiline: true, optional: true },
      ],
    },
  },
  scorecard: {
    id: 'scorecard',
    name: '목표 대비 실적',
    description: '지표마다 목표와 실적, 달성률을 한 표로',
    highlight: { label: '강조할 지표', fallback: -1 },
    fields: [
      title('실적을 요약하는 한 문장'),
      { key: 'metaTitle', label: '목표 머리말', hint: '목표', optional: true, named: true },
      { key: 'valueTitle', label: '실적 머리말', hint: '실적', optional: true, named: true },
      source,
    ],
    items: {
      label: '지표',
      min: 2,
      max: 6,
      default: 4,
      fields: [
        { key: 'title', label: '지표', hint: '지표 이름', hints: ['매출', '영업이익', '신규 고객', '재계약률', '이익률', '방문 건수'] },
        { key: 'meta', label: '목표', hint: '117억 원', hints: ['117억 원', '14억 원', '5곳', '90%', '12%', '300건'] },
        { key: 'value', label: '실적', hint: '131억 원', hints: ['131억 원', '15.2억 원', '4곳', '93%', '11%', '320건'] },
        { key: 'body', label: '설명', hint: '짧은 설명이나 원인', optional: true },
      ],
    },
  },
  bridge: {
    id: 'bridge',
    name: '증감 요인',
    description: '처음 값에서 끝 값까지, 무엇이 얼마나 더하고 뺐는지',
    fields: [
      title('증감을 요약하는 한 문장'),
      { key: 'startTitle', label: '처음 이름', hint: '목표', optional: true, named: true },
      { key: 'startValue', label: '처음 값', hint: '117' },
      { key: 'endTitle', label: '끝 이름', hint: '실적', optional: true, named: true },
      { key: 'unit', label: '단위', hint: '억 원', optional: true },
      source,
    ],
    items: {
      label: '요인',
      min: 1,
      max: 6,
      default: 3,
      fields: [
        { key: 'title', label: '요인', hint: '요인 이름', hints: ['신규 고객', '단가 인상', '기존 고객 이탈', '환율', '할인', '기타'] },
        { key: 'value', label: '증감', hint: '+9', hints: ['+9', '+7', '-2', '+3', '-1', '+1'] },
        { key: 'meta', label: '보충', hint: '짧은 설명', optional: true },
      ],
    },
  },
  trend: {
    id: 'trend',
    name: '추이',
    description: '달마다, 분기마다 숫자가 어떻게 움직였는지 선으로',
    variants: [
      { id: 'base', name: '선' },
      { id: 'area', name: '면' },
    ],
    highlight: { label: '강조할 점', fallback: 'last' },
    fields: [
      title('흐름이 말해 주는 결론'),
      lead(),
      { key: 'unit', label: '단위', hint: '억 원', optional: true },
      { key: 'target', label: '목표선', hint: '120', optional: true },
      source,
    ],
    items: {
      label: '점',
      min: 3,
      max: 12,
      default: 6,
      fields: [
        { key: 'title', label: '시기', hint: '시기', hints: ['4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월', '1월', '2월', '3월'] },
        { key: 'value', label: '숫자', hint: '120', hints: ['96', '101', '99', '108', '117', '131', '126', '134', '140', '138', '145', '152'] },
      ],
    },
  },
  progress: {
    id: 'progress',
    name: '진행 현황',
    description: '과제마다 얼마나 됐는지와 완료, 진행 중, 지연, 예정 상태',
    fields: [title('진행 상황을 요약하는 한 문장'), source],
    items: {
      label: '과제',
      min: 1,
      max: 7,
      default: 5,
      fields: [
        { key: 'title', label: '과제', hint: '과제 이름', hints: ['견적 자동 계산', '단가표 공유', '승인 단계 줄이기', '현장 교육', '효과 점검', '양식 정리', '결과 보고'] },
        { key: 'meta', label: '담당과 기한', hint: '담당, 기한', optional: true, hints: ['영업기획팀, 10월', '구매팀, 11월', '영업본부, 11월', '교육팀, 12월', '영업기획팀, 1월', '영업기획팀, 1월', '영업본부, 2월'] },
        { key: 'value', label: '진행률', hint: '80%', hints: ['100%', '80%', '40%', '20%', '0%', '50%', '0%'] },
        {
          key: 'body',
          label: '상태',
          hint: '완료, 진행 중, 지연, 예정',
          optional: true,
          hints: ['완료', '진행 중', '2주 지연', '진행 중', '예정', '진행 중', '예정'],
        },
      ],
    },
  },
  share: {
    id: 'share',
    name: '구성비',
    description: '전체를 나눈 비중 (매출 구성, 비용 구성, 시장 점유)',
    variants: [
      { id: 'base', name: '띠' },
      { id: 'donut', name: '도넛' },
    ],
    highlight: { label: '강조할 항목', fallback: 0 },
    fields: [title('구성이 말해 주는 결론'), { key: 'unit', label: '단위', hint: '억 원', optional: true }, source],
    items: {
      label: '항목',
      min: 2,
      max: 6,
      default: 4,
      fields: [
        { key: 'title', label: '항목', hint: '항목 이름', hints: ['제조', '유통', '금융', '공공', '기타', '그 밖'] },
        { key: 'value', label: '숫자', hint: '48', hints: ['48', '31', '14', '7', '5', '3'] },
        { key: 'meta', label: '보충', hint: '짧은 설명', optional: true },
      ],
    },
  },
  process: {
    id: 'process',
    name: '단계 흐름',
    description: '일이 어떤 순서로 흘러가는지 (업무 절차, 바뀌는 절차)',
    variants: [
      { id: 'base', name: '화살표' },
      { id: 'cards', name: '칸' },
    ],
    highlight: { label: '강조할 단계', fallback: -1 },
    fields: [title('흐름을 요약하는 한 문장'), lead()],
    items: {
      label: '단계',
      min: 2,
      max: 6,
      default: 4,
      fields: [
        { key: 'title', label: '단계', hint: '단계 이름', hints: ['요청 접수', '견적 작성', '검토와 승인', '고객에게 보내기', '계약', '사후 관리'] },
        {
          key: 'meta',
          label: '담당과 시간',
          hint: '담당, 걸리는 시간',
          optional: true,
          hints: ['영업 담당, 당일', '영업 담당, 하루', '팀장, 반나절', '영업 담당, 당일', '영업본부, 사흘', '고객지원팀'],
        },
        {
          key: 'body',
          label: '설명',
          hint: '이 단계에서 하는 일',
          multiline: true,
          optional: true,
          hints: ['고객 요청을 시스템에 남겨요', '단가표로 견적을 바로 계산해요', '한 번에 검토하고 승인해요', '정해진 양식으로 보내요', '계약 조건을 확정해요', '쓰는 모습을 살펴요'],
        },
      ],
    },
  },
  funnel: {
    id: 'funnel',
    name: '깔때기',
    description: '단계를 거치며 얼마나 남는지 (영업 단계, 고객 전환). 전환율은 저절로 계산돼요',
    highlight: { label: '강조할 단계', fallback: 'last' },
    fields: [title('전환을 요약하는 한 문장'), { key: 'unit', label: '단위', hint: '건', optional: true }, source],
    items: {
      label: '단계',
      min: 2,
      max: 6,
      default: 4,
      fields: [
        { key: 'title', label: '단계', hint: '단계 이름', hints: ['첫 만남', '제안', '협상', '계약', '재계약', '추천'] },
        { key: 'value', label: '숫자', hint: '120', hints: ['120', '48', '20', '9', '6', '3'] },
        { key: 'meta', label: '보충', hint: '짧은 설명', optional: true },
      ],
    },
  },
  table: {
    id: 'table',
    name: '표',
    description: '줄과 칸으로 정리해요 (실행 과제, 항목별 비교). 비운 칸은 발표할 때 빠져요',
    highlight: { label: '강조할 줄', fallback: -1 },
    fields: [
      title('표가 말해 주는 결론'),
      { key: 'h1', label: '첫째 칸 머리말', hint: '과제' },
      { key: 'h2', label: '둘째 칸 머리말', hint: '담당', optional: true },
      { key: 'h3', label: '셋째 칸 머리말', hint: '기한', optional: true },
      { key: 'h4', label: '넷째 칸 머리말', hint: '비고', optional: true },
      source,
    ],
    items: {
      label: '줄',
      min: 1,
      max: 7,
      default: 4,
      fields: [
        { key: 'title', label: '첫째 칸', hint: '과제 이름', hints: ['견적 양식 통일', '단가표 공유', '승인 단계 줄이기', '효과 점검'] },
        { key: 'meta', label: '둘째 칸', hint: '담당', hints: ['영업기획팀', '구매팀', '영업본부', '영업기획팀'], optional: true },
        { key: 'value', label: '셋째 칸', hint: '기한', hints: ['11월', '12월', '1월', '2월'], optional: true },
        {
          key: 'body',
          label: '넷째 칸',
          hint: '짧은 설명',
          hints: ['팀마다 다른 양식을 하나로', '분기마다 새로 올림', '세 단계를 두 단계로', '견적 시간을 다시 잼'],
          multiline: true,
          optional: true,
        },
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
  matrix: {
    id: 'matrix',
    name: '2×2 우선순위',
    description: '두 기준으로 나눈 네 칸. 무엇부터 할지 보여요',
    highlight: { label: '먼저 할 칸', fallback: 1 },
    fields: [
      title('어느 칸부터 할지 한 문장으로'),
      { key: 'yAxis', label: '세로 기준', hint: '위로 갈수록 (예: 실행하기 쉬움)' },
      { key: 'xAxis', label: '가로 기준', hint: '오른쪽으로 갈수록 (예: 효과가 큼)' },
    ],
    items: {
      label: '칸',
      min: 4,
      max: 4,
      default: 4,
      fields: [
        { key: 'title', label: '칸 이름', hint: '칸 이름', hints: ['왼쪽 위 칸 이름', '오른쪽 위 칸 이름', '왼쪽 아래 칸 이름', '오른쪽 아래 칸 이름'] },
        { key: 'body', label: '내용', hint: '이 칸에 드는 과제', multiline: true },
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
    // 지나온 단계까지 선을 채워서 어디까지 왔는지 보여 준다. 계획만 보여 줄 때는 '없음'
    highlight: { label: '지금 단계', fallback: -1 },
    fields: [title('일정을 요약하는 제목')],
    items: {
      label: '단계',
      min: 2,
      max: 6,
      default: 4,
      fields: [
        { key: 'meta', label: '시기', hint: '시기', hints: ['1개월 차', '2개월 차', '4개월 차', '6개월 차', '9개월 차', '12개월 차'] },
        { key: 'title', label: '단계', hint: '단계 이름', hints: ['준비', '시범 운영', '중간 점검', '확대', '안정화', '마무리'] },
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
        { key: 'value', label: '숫자', hint: '40%', hints: ['40%', '3개월'] },
        { key: 'title', label: '이름', hint: '지표 이름', hints: ['검사 시간 단축', '구축 기간', '처리량'] },
      ],
    },
  },
  pricing: {
    id: 'pricing',
    name: '안 비교',
    description: '두세 가지 안이나 가격을 나란히, 추천안 강조',
    variants: [
      { id: 'base', name: '카드' },
      { id: 'rows', name: '표' },
    ],
    highlight: { label: '추천 표시', fallback: -1 },
    fields: [title('어느 안을 추천하는지 한 문장으로')],
    items: {
      label: '안',
      min: 1,
      max: 3,
      default: 3,
      fields: [
        { key: 'title', label: '이름', hint: '안 이름', hints: ['A안', 'B안', 'C안'] },
        { key: 'value', label: '비용', hint: '1.2억 원', hints: ['0.6억 원', '1.2억 원', '2.5억 원'] },
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
    variants: [
      { id: 'base', name: '가로 막대' },
      { id: 'columns', name: '세로 막대' },
    ],
    highlight: { label: '강조할 막대', fallback: 0 },
    // 단위는 막대마다 되풀이하지 않고 위에 한 번만
    fields: [title('비교가 말해 주는 결론'), lead(), { key: 'unit', label: '단위', hint: '억 원', optional: true }, source],
    items: {
      label: '막대',
      min: 2,
      max: 6,
      default: 4,
      fields: [
        { key: 'title', label: '항목', hint: '항목 이름' },
        { key: 'value', label: '숫자', hint: '120', hints: ['96', '104', '131', '117', '88', '120'] },
        { key: 'meta', label: '보충', hint: '보충 설명', optional: true },
      ],
    },
  },
  versus: {
    id: 'versus',
    name: '두 값 비교',
    description: '작년과 올해, 계획과 실적처럼 두 값을 항목마다 나란히',
    variants: [
      { id: 'base', name: '묶은 막대' },
      { id: 'lines', name: '두 선' },
    ],
    highlight: { label: '강조할 항목', fallback: -1 },
    fields: [
      title('비교가 말해 주는 결론'),
      lead(),
      { key: 'metaTitle', label: '앞 값 이름', hint: '작년', optional: true, named: true },
      { key: 'valueTitle', label: '뒤 값 이름', hint: '올해', optional: true, named: true },
      { key: 'unit', label: '단위', hint: '억 원', optional: true },
      source,
    ],
    items: {
      label: '항목',
      min: 2,
      max: 8,
      default: 4,
      fields: [
        { key: 'title', label: '항목', hint: '항목 이름', hints: ['1분기', '2분기', '3분기', '4분기', '5월', '6월', '7월', '8월'] },
        { key: 'meta', label: '앞 값', hint: '96', hints: ['96', '104', '118', '121', '110', '115', '120', '125'] },
        { key: 'value', label: '뒤 값', hint: '112', hints: ['112', '109', '131', '138', '126', '130', '141', '150'] },
      ],
    },
  },
  closing: {
    id: 'closing',
    name: '결정 요청',
    description: '결정해 주실 것과 언제까지 필요한지',
    variants: [
      { id: 'base', name: '색 면' },
      { id: 'plain', name: '바탕' },
    ],
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
  compose: {
    id: 'compose',
    name: '부품으로 꾸미기',
    description: '부품을 골라 끌어다 놓으면 알맞은 자리에 들어가요',
    fields: [
      { key: 'title', label: '제목', hint: '이 장의 결론 한 줄 (비우면 부품만 보여요)', multiline: true, optional: true },
      lead(),
      source,
    ],
  },
}

/** 색 면을 쓰는 장. 하단 쪽 번호를 넣지 않고, 장마다 바탕을 바꾸지 않는다(색 면이 싫으면 '바탕' 모양을 고른다). */
export const BOLD_LAYOUTS: LayoutId[] = ['cover', 'section', 'closing']

export const LAYOUT_ORDER: LayoutId[] = [
  'compose',
  'summary',
  'statement',
  'points',
  'kpi',
  'scorecard',
  'bridge',
  'trend',
  'progress',
  'share',
  'process',
  'funnel',
  'table',
  'compare',
  'matrix',
  'pricing',
  'bars',
  'versus',
  'timeline',
  'imageText',
  'case',
  'logos',
  'agenda',
  'section',
  'cover',
  'closing',
]

/** AI가 제안으로 고를 수 있는 레이아웃. 부품 장은 사람이 직접 부품을 골라 꾸미는 장이라 뺀다 */
export const AI_LAYOUTS: LayoutId[] = LAYOUT_ORDER.filter((id) => id !== 'compose')

/** 쓰임으로 묶은 레이아웃. 장 추가 메뉴와 장 모음 화면에 이 묶음과 순서로 보인다. 모든 레이아웃이 한 번씩 들어간다. */
export const LAYOUT_GROUPS: { name: string; description: string; layouts: LayoutId[] }[] = [
  { name: '자유롭게 꾸미기', description: '부품을 골라 끌어다 놓아요', layouts: ['compose'] },
  { name: '결론과 메시지', description: '하고 싶은 말을 먼저', layouts: ['summary', 'statement', 'points'] },
  { name: '숫자와 차트', description: '실적, 규모, 변화를 숫자로', layouts: ['kpi', 'scorecard', 'bars', 'versus', 'bridge', 'trend', 'share', 'funnel'] },
  { name: '진행과 계획', description: '언제, 어떤 순서로', layouts: ['progress', 'timeline', 'process'] },
  { name: '비교와 선택', description: '여러 안을 나란히 놓고 고르기', layouts: ['compare', 'matrix', 'pricing', 'table'] },
  { name: '자료와 사례', description: '화면, 사례, 고객사', layouts: ['imageText', 'case', 'logos'] },
  { name: '시작과 끝', description: '표지, 목차, 단락, 마지막 장', layouts: ['cover', 'agenda', 'section', 'closing'] },
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
  if (itemKey) {
    const f = spec.items?.fields.find((x) => x.key === itemKey)
    return (index !== undefined && f?.hints?.[index]) || f?.hint || ''
  }
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

/** 강조할 항목. 고르지 않았으면 레이아웃의 기본값, 강조가 없는 레이아웃이면 -1 */
export function highlightOf(slide: Pick<Slide, 'layout' | 'options' | 'items'>): number {
  const spec = LAYOUTS[slide.layout]
  if (!spec.highlight) return -1
  if (slide.options.highlight !== undefined) return slide.options.highlight
  // 추이의 마지막 점처럼 '지금'을 강조하는 장은 항목 수가 바뀌어도 늘 마지막을 따라간다
  if (spec.highlight.fallback === 'last') return Math.min(slide.items.length, spec.items?.max ?? 0) - 1
  return spec.highlight.fallback
}
