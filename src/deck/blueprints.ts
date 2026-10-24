import type { Audience, DeckType, ItemKey, LayoutId, SlideOptions } from './types'

/*
 * 보고의 골격. 영업 대표가 팀장, 본부장 같은 윗분에게 "이 사업을 이렇게 하자"고 보고하고 결정을 받는 자리를 위한 구성이다.
 * 어느 보고든 한 장 요약으로 결론을 먼저 말하고, 마지막 장에서 결정해 주실 것을 분명히 한다.
 */

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
  /** 칸 안내. `items.title`은 모든 항목, `items.0.title`은 첫 항목에만 */
  hints?: Record<string, string>
  /** 미리 채워 두는 값 (구조에 해당하는 글자만) */
  fields?: Record<string, string>
  /** 항목마다 미리 채워 두는 값 (구조에 해당하는 글자만, 예: 'A안') */
  prefill?: Partial<Record<ItemKey, string>>[]
  items?: number
  /** 처음 쓸 모양. 없으면 레이아웃의 기본 모양 */
  variant?: string
  /** 처음 정해 두는 장 옵션 (예: 강조할 단계) */
  options?: SlideOptions
}

export interface Blueprint {
  type: DeckType
  name: string
  description: string
  /** 마법사에서 보여주는 이야기 흐름 */
  storyline: string[]
  /** 마법사의 보고 종류 카드에 작은 그림으로 보일 장(장의 역할 이름). 이야기 흐름의 차례마다 하나 */
  showcase?: string[]
  defaultTitle: string
  /** 마법사의 입력 예시 */
  examples: { title: string; ask: string }
  recipes: Recipe[]
}

const ALL_BUT_EXEC: Audience[] = ['practitioner', 'mixed']

/** 항목마다 다른 안내 문구 */
function rows(key: ItemKey, hints: string[]): Record<string, string> {
  return Object.fromEntries(hints.map((h, i) => [`items.${i}.${key}`, h]))
}

/**
 * 여러 칸의 항목별 안내. 같은 예시가 줄마다 되풀이되면 무엇을 적을지 알기 어렵고 가짜처럼 보여서,
 * 줄마다 다른 예시로 한 장 전체가 말이 되게 한다.
 */
function each(hints: Partial<Record<ItemKey, string[]>>): Record<string, string> {
  return Object.assign({}, ...Object.entries(hints).map(([key, list]) => rows(key as ItemKey, list ?? [])))
}

function section(title: string, lead: string): Recipe {
  return {
    layout: 'section',
    purpose: `섹션: ${title}`,
    priority: 3,
    group: 'sections',
    section: title,
    guide: '이야기의 큰 흐름이 바뀌는 곳이에요. 보고 받는 분이 지금 어디쯤인지 알 수 있어요.',
    fields: { title },
    hints: { lead },
  }
}

const cover: Recipe = {
  layout: 'cover',
  purpose: '표지',
  priority: 1,
  guide: '제목만 보고도 무엇을 하자는 보고인지 알 수 있게 쓰세요. 결정 요청 칸에 결정받고 싶은 것을 한 줄로 적어 두면 윗분이 처음부터 그 판단을 염두에 두고 들어요.',
}

/** 한 장 요약: 바쁜 윗분이 이 장만 보고도 판단할 수 있게 */
function summary(labels: string[], bodies: string[]): Recipe {
  return {
    layout: 'summary',
    purpose: '한 장 요약',
    priority: 1,
    guide: '윗분은 결론부터 듣고 싶어 해요. 이 장만 보고도 판단할 수 있게 줄마다 한두 문장으로 쓰고, 숫자가 있으면 숫자로 쓰세요.',
    hints: { title: '한 줄 결론 (예: 구독형 서비스로 3년 안에 매출 30억 원)', ...rows('body', bodies) },
    prefill: labels.map((title) => ({ title })),
    items: labels.length,
  }
}

function options(purpose: string, priority: Recipe['priority'], sectionName: string | undefined, hints: Record<string, string>): Recipe {
  return {
    layout: 'pricing',
    purpose,
    priority,
    section: sectionName,
    guide: '방법을 두세 가지 놓고 추천안을 강조하면 윗분은 고르기만 하면 돼요. 안마다 비용과 장단점을 적으세요.',
    hints,
    prefill: [{ title: 'A안' }, { title: 'B안' }, { title: 'C안' }],
  }
}

const RISKS = {
  title: ['예산이 늘어날 수 있어요', '일정이 늦어질 수 있어요', '맡을 사람이 모자랄 수 있어요'],
  body: ['단계마다 나눠 쓰고 점검해요', '중간 점검 날짜를 미리 정해 둬요', '협력사 인력을 미리 잡아 둬요'],
}

function risks(priority: Recipe['priority'], sectionName?: string, examples: Partial<Record<ItemKey, string[]>> = RISKS): Recipe {
  return {
    layout: 'compare',
    purpose: '위험과 대응',
    priority,
    section: sectionName,
    guide: '윗분이 가장 많이 묻는 건 "잘 안 되면?"이에요. 먼저 꺼내고 대응 방법을 함께 적으면 신뢰가 쌓여요.',
    fields: { leftTitle: '예상 위험', rightTitle: '대응 방안' },
    hints: { title: '이런 위험은 이렇게 대비해요', 'items.title': '일어날 수 있는 문제', 'items.body': '대응 방법', ...each(examples) },
  }
}

/** asks: 첫 줄은 가장 중요한 결정, 뒤로 갈수록 덜 중요한 요청. 마지막 줄은 없으면 지워도 되는 칸이다. */
function decision(guide: string, asks: string[]): Recipe {
  return {
    layout: 'closing',
    purpose: '결정 요청',
    priority: 1,
    guide,
    fields: { title: '결정해 주실 것' },
    hints: {
      'items.title': '결정해 주실 일',
      'items.body': '언제까지, 왜 필요한지',
      ...each({ title: asks, body: ['언제까지, 왜 필요한지', '언제까지, 왜 필요한지', '없으면 이 줄을 지워요'] }),
    },
  }
}

const agenda: Recipe = {
  layout: 'agenda',
  purpose: '목차',
  priority: 3,
  audience: ALL_BUT_EXEC,
  guide: '오늘 보고할 순서예요. 섹션 이름이 미리 들어가 있어요.',
  fields: { title: '보고 순서' },
}

const business: Blueprint = {
  type: 'business',
  name: '사업 제안',
  description: '새 사업이나 프로젝트를 하자고 제안하고 승인받아요',
  storyline: ['배경', '제안', '효과', '결정 요청'],
  showcase: ['기회의 크기', '바뀌는 모습', '매출 전망', '결정 요청'],
  defaultTitle: '사업 제안',
  examples: { title: '중소 제조사 대상 구독형 품질 관리 사업 제안', ask: '시범 사업 예산 1.2억 원 승인' },
  recipes: [
    cover,
    summary(
      ['배경', '제안', '기대 효과', '요청 사항'],
      ['왜 지금 이 사업을 해야 하는지', '무엇을 어떻게 하자는 건지', '얻는 것 (매출, 비용을 숫자로)', '결정해 주실 것 (예산, 인력)'],
    ),
    agenda,
    section('배경', '왜 지금 이 사업을 해야 하는지'),
    {
      layout: 'statement',
      purpose: '추진 배경',
      priority: 1,
      section: '배경',
      guide: '"그래서 왜 지금?"이라는 질문에 먼저 답하는 장이에요. 시장 변화, 고객 요구, 놓치고 있는 기회를 한 문장으로 적어 주세요.',
      hints: { title: '지금 이 사업을 해야 하는 이유를 한 문장으로', lead: '그렇게 보는 근거 (시장 변화, 고객 요구, 경쟁사 움직임)' },
    },
    {
      layout: 'kpi',
      purpose: '기회의 크기',
      priority: 2,
      section: '배경',
      guide: '시장 규모나 잠재 고객 수처럼 기회가 얼마나 큰지 숫자로 보여주세요. 출처를 설명 칸에 적어 두면 질문에 답하기 쉬워요.',
      hints: {
        title: '숫자로 보는 기회',
        'items.body': '출처와 기준 연도',
        ...each({ value: ['1,200억 원', '3,400곳', '18%'], title: ['국내 시장 규모', '대상 기업 수', '해마다 크는 비율'] }),
      },
    },
    {
      layout: 'share',
      purpose: '시장 구성',
      priority: 3,
      section: '배경',
      guide: '시장이나 고객이 어떻게 나뉘는지 보여주고, 우리가 노릴 부분 하나를 강조하세요. 금액으로 적으면 비중은 저절로 계산돼요.',
      hints: {
        title: '중소 제조가 시장의 절반이에요',
        unit: '억 원',
        ...each({ title: ['중소 제조', '대기업', '공공', '기타'], value: ['600', '360', '160', '80'] }),
      },
    },
    section('제안', '무엇을 어떻게 할지'),
    {
      layout: 'points',
      purpose: '제안 내용',
      priority: 1,
      section: '제안',
      guide: '무엇을 하자는 건지 세 가지 이내로 정리해 주세요. 하지 않을 일도 분명히 하면 범위에 대한 질문이 줄어요.',
      hints: {
        title: '무엇을 하자는 건지 한 문장으로',
        'items.title': '할 일',
        'items.body': '어떻게, 누가 하는지',
        ...each({ title: ['구독형 서비스 출시', '대리점 판매 연계', '하지 않을 일'], body: ['어떻게, 누가 하는지', '어떻게, 누가 하는지', '이번에는 하지 않는 것 (예: 대기업 고객)'] }),
      },
    },
    {
      layout: 'compare',
      purpose: '바뀌는 모습',
      priority: 2,
      section: '제안',
      guide: '지금과 추진 후를 줄마다 나란히 놓으면 차이가 한눈에 보여요.',
      fields: { leftTitle: '지금', rightTitle: '추진 후' },
      hints: {
        title: '추진하면 이렇게 달라져요',
        'items.title': '지금의 모습',
        'items.body': '추진 후의 모습',
        ...each({
          title: ['한 번 팔고 끝나요', '고객이 문제를 겪어야 연락이 와요', '해마다 매출이 들쭉날쭉해요'],
          body: ['다달이 구독료를 받아요', '먼저 이상을 알려 줘요', '매달 매출이 쌓여요'],
        }),
      },
    },
    options('추진 방안 비교', 2, '제안', {
      title: '세 가지 방안 중 B안을 추천해요',
      'items.body': '할 일과 장단점을 한 줄에 하나씩',
      ...each({ value: ['0.6억 원', '1.2억 원', '2.5억 원'], meta: ['3개월, 2명', '6개월, 3명', '12개월, 6명'] }),
    }),
    section('효과와 비용', '얼마를 들여 무엇을 얻는지'),
    {
      layout: 'kpi',
      purpose: '기대 효과',
      priority: 1,
      section: '효과와 비용',
      guide: '추진하면 무엇을 얼마나 얻는지 숫자로 보여주세요. 계산 근거를 설명 칸에 적어 두세요.',
      hints: {
        title: '추진하면 얻는 것',
        'items.body': '계산 근거',
        ...each({ value: ['30억 원', '120곳', '2년'], title: ['3년 누적 매출', '구독 고객 수', '투자 회수 기간'] }),
      },
    },
    {
      layout: 'bars',
      purpose: '매출 전망',
      priority: 3,
      section: '효과와 비용',
      guide: '해마다 얼마를 벌 수 있는지 막대로 보여주면 회수 시점이 보여요.',
      hints: { title: '3년 차에 매출 12억 원', unit: '억 원', ...each({ title: ['1년 차', '2년 차', '3년 차'], value: ['4', '7', '12'] }) },
      items: 3,
    },
    {
      layout: 'kpi',
      purpose: '필요한 자원',
      priority: 2,
      section: '효과와 비용',
      guide: '예산, 인력, 기간을 숨기지 말고 먼저 보여주세요. 결정에 꼭 필요한 정보예요.',
      hints: {
        title: '필요한 예산과 인력',
        ...each({ value: ['1.2억 원', '3명', '6개월'], body: ['어디에 쓰는지', '어느 팀에서 몇 명이 맡는지', '언제부터 언제까지'] }),
      },
      prefill: [{ title: '예산' }, { title: '인력' }, { title: '기간' }],
    },
    section('실행 계획', '언제, 어떻게 진행할지'),
    {
      layout: 'timeline',
      purpose: '추진 일정',
      priority: 2,
      section: '실행 계획',
      guide: '언제 무엇을 하는지 보이면 결정이 쉬워져요. 중간 점검 시점을 넣어 두면 더 안심해요.',
      hints: {
        title: '6개월 안에 시범 운영까지',
        ...each({ meta: ['1개월 차', '2개월 차', '4개월 차', '6개월 차'], title: ['준비', '시범 운영', '중간 점검', '확대 결정'] }),
      },
    },
    risks(2, '실행 계획'),
    decision('오늘 받아야 할 결정을 분명하게 적어 주세요. 언제까지 필요한지 함께 쓰면 결정이 미뤄지지 않아요.', [
      '결정해 주실 일 (예: 시범 사업 예산 1.2억 원 승인)',
      '함께 정해 주실 일 (예: 전담 인력 3명)',
      '그 밖의 요청',
    ]),
  ],
}

const deal: Blueprint = {
  type: 'deal',
  name: '고객 제안 계획',
  description: '어느 고객에게 무엇을 얼마에 제안할지 보고하고 승인받아요',
  storyline: ['사업 기회', '제안 전략', '가격', '결정 요청'],
  showcase: ['사업 규모', '제안 내용', '가격 안', '결정 요청'],
  defaultTitle: '고객 제안 계획',
  examples: { title: '한빛제조 품질 관리 시스템 제안 계획', ask: '제안 가격 4.8억 원 승인' },
  recipes: [
    cover,
    summary(
      ['사업 기회', '제안 내용', '예상 매출', '요청 사항'],
      ['어느 고객의 어떤 사업인지', '무엇을 얼마에 제안할지', '매출과 이익률', '결정해 주실 것 (가격, 인력)'],
    ),
    agenda,
    section('사업 기회', '어떤 고객의 어떤 사업인지'),
    {
      layout: 'statement',
      purpose: '사업 기회',
      priority: 1,
      section: '사업 기회',
      guide: '고객이 지금 무엇을 하려는지, 왜 우리에게 기회인지 한 문장으로 적어 주세요.',
      hints: {
        title: '고객이 지금 하려는 일을 한 문장으로 (예: 한빛제조가 품질 관리 시스템 교체를 검토 중)',
        lead: '언제, 누가 결정하는지',
      },
    },
    {
      layout: 'kpi',
      purpose: '사업 규모',
      priority: 1,
      section: '사업 기회',
      guide: '이 사업이 얼마짜리인지 숫자로 보여주세요. 매출만큼 이익률도 중요하게 봐요.',
      hints: {
        title: '숫자로 보는 사업 규모',
        'items.body': '계산 기준',
        ...each({ value: ['4.8억 원', '3년', '22%'], body: ['첫해 구축비 기준', '유지보수 포함 금액', '본부 평균과 비교'] }),
      },
      prefill: [{ title: '예상 매출' }, { title: '계약 기간' }, { title: '예상 이익률' }],
    },
    {
      layout: 'compare',
      purpose: '경쟁 상황',
      priority: 2,
      section: '사업 기회',
      guide: '누구와 경쟁하는지, 우리가 어디서 앞서고 어디서 밀리는지 솔직하게 적어 주세요.',
      fields: { leftTitle: '경쟁사', rightTitle: '우리' },
      hints: {
        title: '경쟁사보다 앞서는 점',
        'items.title': '경쟁사의 강점이나 조건',
        'items.body': '우리의 강점이나 대응',
        ...each({
          title: ['가격이 더 낮아요', '구축에 6개월 걸려요', '고객과 오래 거래했어요'],
          body: ['원인 분석까지 들어 있어요', '3개월, 라인을 세우지 않아요', '같은 업종 사례가 2곳 있어요'],
        }),
      },
    },
    section('제안 전략', '무엇을 어떻게 제안할지'),
    {
      layout: 'points',
      purpose: '제안 내용',
      priority: 1,
      section: '제안 전략',
      guide: '고객에게 무엇을 제안할지, 고객이 무엇을 얻는지 세 가지 이내로 정리해 주세요.',
      hints: {
        title: '고객에게 제안할 내용',
        'items.title': '제안 항목',
        'items.body': '고객이 얻는 것',
        ...each({ title: ['AI 외관 검사', '불량 원인 분석', '3개 라인부터'] }),
      },
    },
    options('가격 안', 1, '제안 전략', {
      title: '추천 가격은 B안 4.8억 원이에요',
      'items.body': '포함 범위와 조건을 한 줄에 하나씩',
      ...each({ value: ['3.9억 원', '4.8억 원', '6.5억 원'], meta: ['이익률 9%', '이익률 22%', '이익률 25%'] }),
    }),
    {
      layout: 'imageText',
      purpose: '제안할 솔루션',
      priority: 3,
      audience: ALL_BUT_EXEC,
      section: '제안 전략',
      guide: '고객에게 보여줄 제품 화면이나 구성도를 넣어 주세요.',
      hints: { title: '고객에게 보여줄 화면', body: '이 화면으로 고객이 무엇을 할 수 있는지' },
    },
    {
      layout: 'case',
      purpose: '비슷한 수주 사례',
      priority: 3,
      section: '제안 전략',
      guide: '비슷한 고객에게 수주한 사례가 있으면 승인받기 쉬워요.',
    },
    section('실행 계획', '수주까지 무엇을 할지'),
    {
      layout: 'timeline',
      purpose: '수주 일정',
      priority: 2,
      section: '실행 계획',
      guide: '제안서 제출부터 계약까지 날짜를 적어 주세요. 고객이 결정하는 날을 꼭 넣으세요.',
      hints: {
        title: '12월 계약이 목표예요',
        ...each({ meta: ['11월 1주', '11월 3주', '12월 1주', '12월 3주'], title: ['제안서 제출', '현장 시연', '가격 협상', '계약'] }),
      },
    },
    risks(2, '실행 계획', {
      title: ['경쟁사가 가격을 더 낮출 수 있어요', '고객 결정이 늦어질 수 있어요', '구축 인력이 모자랄 수 있어요'],
      body: ['협상 때 쓸 조건을 미리 정해 둬요', '단계를 나눠 먼저 계약해요', '다른 팀 지원을 미리 받아 둬요'],
    }),
    decision('오늘 받아야 할 결정을 분명하게 적어 주세요. 가격, 할인 폭, 투입 인력처럼 위에서 정해 줘야 하는 것들이에요.', [
      '결정해 주실 일 (예: 제안 가격 4.8억 원 승인)',
      '함께 정해 주실 일 (예: 구축 인력 2명 지원)',
      '그 밖의 요청 (예: 협상에 쓸 할인 폭)',
    ]),
  ],
}

const improve: Blueprint = {
  type: 'improve',
  name: '개선 제안',
  description: '일하는 방식이나 제도, 도구를 바꾸자고 제안해요',
  storyline: ['문제', '원인', '개선안', '효과'],
  showcase: ['문제의 크기', '원인', '바뀌는 절차', '기대 효과'],
  defaultTitle: '개선 제안',
  examples: { title: '견적 작성 방식 개선 제안', ask: '한 팀 시범 운영 승인' },
  recipes: [
    cover,
    summary(
      ['지금의 문제', '개선안', '기대 효과', '요청 사항'],
      ['누가, 무엇 때문에 힘든지', '무엇을 어떻게 바꾸자는 건지', '바꾸면 얻는 것 (시간, 비용을 숫자로)', '결정해 주실 것'],
    ),
    section('문제', '지금 무엇이 문제인지'),
    {
      layout: 'statement',
      purpose: '지금의 문제',
      priority: 1,
      section: '문제',
      guide: '문제를 겪는 사람이 "맞아, 그게 문제야"라고 할 만큼 구체적으로 적어 주세요.',
      hints: { title: '지금 가장 큰 문제를 한 문장으로', lead: '누가, 얼마나 자주 겪는지' },
    },
    {
      layout: 'bars',
      purpose: '문제의 크기',
      priority: 2,
      section: '문제',
      items: 3,
      guide: '문제 때문에 드는 시간이나 비용을 막대로 보여주면 심각성이 바로 전해져요.',
      hints: {
        title: '견적 한 건에 평균 6시간이 들어요',
        'items.title': '항목',
        unit: '시간',
        ...each({ title: ['자료 찾기', '단가 계산', '검토와 승인'], value: ['2.5', '2', '1.5'] }),
      },
    },
    {
      layout: 'points',
      purpose: '원인',
      priority: 3,
      section: '문제',
      guide: '문제가 왜 생기는지 짚으면 개선안이 왜 맞는지 설득하기 쉬워요.',
      hints: {
        title: '문제가 생기는 이유',
        'items.title': '원인',
        'items.body': '왜 그런지, 얼마나 자주 그런지',
        ...each({ title: ['양식이 팀마다 달라요', '단가표가 흩어져 있어요', '승인이 세 단계예요'] }),
      },
    },
    section('개선안', '어떻게 바꿀지'),
    {
      layout: 'matrix',
      purpose: '과제 우선순위',
      priority: 3,
      section: '개선안',
      guide: '고칠 거리가 여럿이면 효과와 실행하기 쉬운 정도로 나눠, 무엇부터 할지 보여주세요.',
      fields: { yAxis: '실행하기 쉬움', xAxis: '효과가 큼' },
      hints: {
        title: '쉽고 효과가 큰 것부터 시작해요',
        'items.0.title': '틈틈이 하기',
        'items.1.title': '바로 하기',
        'items.2.title': '미루기',
        'items.3.title': '계획해서 하기',
      },
    },
    {
      layout: 'compare',
      purpose: '바뀌는 모습',
      priority: 1,
      section: '개선안',
      guide: '지금 방식과 바뀐 방식을 줄마다 나란히 놓으면 차이가 한눈에 보여요.',
      fields: { leftTitle: '지금', rightTitle: '개선 후' },
      hints: {
        title: '이렇게 바꾸자고 제안해요',
        'items.title': '지금의 방식',
        'items.body': '바뀐 방식',
        ...each({
          title: ['팀마다 다른 양식으로 써요', '단가를 메일로 물어봐요', '승인에 사흘 걸려요'],
          body: ['한 가지 양식으로 써요', '단가표에서 바로 찾아요', '하루 안에 승인해요'],
        }),
      },
    },
    {
      layout: 'process',
      purpose: '바뀌는 절차',
      priority: 2,
      section: '개선안',
      guide: '바뀐 뒤 일이 흘러가는 순서를 단계로 보여주세요. 가장 크게 바뀌는 단계 하나를 강조하면 무엇이 달라지는지 바로 보여요.',
      options: { highlight: 2 },
      hints: { title: '견적이 나가기까지 네 단계, 이틀이면 돼요', lead: '지금은 같은 일에 닷새가 걸려요' },
    },
    options('방안 비교', 3, '개선안', {
      title: '세 가지 방안 중 B안을 추천해요',
      'items.body': '할 일과 장단점을 한 줄에 하나씩',
      ...each({ value: ['500만 원', '2,000만 원', '6,000만 원'], meta: ['1개월', '3개월', '6개월'] }),
    }),
    {
      layout: 'kpi',
      purpose: '기대 효과',
      priority: 1,
      section: '개선안',
      guide: '바꾸면 무엇이 얼마나 좋아지는지 숫자로 보여주세요.',
      hints: {
        title: '바꾸면 얻는 것',
        'items.body': '계산 근거',
        ...each({ value: ['40%', '3.6시간', '1,200시간'], title: ['줄어드는 시간', '견적 한 건에 드는 시간', '한 해에 아끼는 시간'] }),
      },
    },
    section('실행', '언제, 어떻게 바꿀지'),
    {
      layout: 'timeline',
      purpose: '실행 계획',
      priority: 2,
      section: '실행',
      guide: '작게 시작해서 넓히는 계획이면 결정하기 훨씬 쉬워요.',
      hints: {
        title: '한 팀에서 먼저 시작해요',
        ...each({ meta: ['1개월 차', '2개월 차', '3개월 차', '4개월 차'], title: ['한 팀 시범', '결과 점검', '본부 확대', '모든 팀 적용'] }),
      },
    },
    {
      layout: 'table',
      purpose: '할 일과 담당',
      priority: 3,
      section: '실행',
      guide: '누가 언제까지 무엇을 하는지 표로 정리해 두면, 결정한 뒤 바로 움직일 수 있어요.',
      fields: { h1: '과제', h2: '담당', h3: '기한', h4: '비고' },
      hints: { title: '네 가지를 2월까지 끝내요' },
    },
    risks(3, '실행', {
      title: ['새 방식이 익숙하지 않을 수 있어요', '바꾸는 동안 일이 밀릴 수 있어요', '효과가 예상보다 작을 수 있어요'],
      body: ['한 팀에서 먼저 써 보고 고쳐요', '바쁜 달을 피해 시작해요', '한 달 뒤 숫자로 점검해요'],
    }),
    decision('바꾸는 데 필요한 승인이나 지원을 분명하게 적어 주세요.', [
      '결정해 주실 일 (예: 한 팀 시범 운영 승인)',
      '함께 정해 주실 일 (예: 시범 기간 2개월)',
      '그 밖의 요청',
    ]),
  ],
}

const report: Blueprint = {
  type: 'report',
  name: '진행·실적 보고',
  description: '맡은 일의 실적과 진행 상황을 보고하고 지원을 요청해요',
  storyline: ['실적', '분석', '대책', '계획'],
  showcase: ['핵심 실적', '증감 요인', '문제와 대책', '다음 계획'],
  defaultTitle: '실적 보고',
  examples: { title: '3분기 영업 실적 보고', ask: '신규 인력 1명 충원' },
  recipes: [
    cover,
    {
      layout: 'kpi',
      purpose: '핵심 실적',
      priority: 1,
      guide: '가장 중요한 숫자를 먼저 보여주세요. 목표 대비 몇 퍼센트인지가 가장 먼저 궁금한 숫자예요.',
      hints: {
        title: '이번 분기 목표의 112%를 달성했어요',
        ...each({ value: ['112%', '131억 원', '4곳'], title: ['목표 달성률', '3분기 매출', '신규 고객'], body: ['목표와 실적 숫자', '지난 분기와 비교', '목표 5곳'] }),
      },
    },
    agenda,
    {
      layout: 'scorecard',
      purpose: '목표 대비 실적',
      priority: 1,
      guide: '지표마다 목표와 실적을 같은 단위로 적으면 달성률은 저절로 계산돼요. 목표에 못 미친 지표는 설명 칸에 이유를 짧게 적어 주세요.',
      hints: {
        title: '네 지표 중 세 개가 목표를 넘었어요',
        'items.title': '지표 이름',
        ...each({
          title: ['매출', '영업이익', '신규 고객', '재계약률'],
          meta: ['117억 원', '14억 원', '5곳', '90%'],
          value: ['131억 원', '15.2억 원', '4곳', '93%'],
        }),
      },
    },
    {
      layout: 'bridge',
      purpose: '증감 요인',
      priority: 2,
      guide: '목표와 실적의 차이가 어디서 왔는지 요인별로 보여주세요. 더한 것은 +, 뺀 것은 -로 적으면 실적은 저절로 계산돼요.',
      fields: { startTitle: '목표', endTitle: '실적' },
      hints: {
        title: '목표보다 14억 원 더 팔았어요',
        startValue: '117',
        unit: '억 원',
        ...each({ title: ['신규 고객', '단가 인상', '기존 고객 이탈'], value: ['+9', '+7', '-2'] }),
      },
    },
    {
      layout: 'trend',
      purpose: '기간별 실적',
      priority: 2,
      guide: '달마다 실적을 적으면 선으로 이어져 흐름이 보여요. 목표선을 적으면 넘은 때가 한눈에 보이고, 마지막 달이 강조돼요.',
      hints: {
        title: '여름부터 매출이 꾸준히 늘었어요',
        unit: '억 원',
        target: '115',
        ...each({ title: ['4월', '5월', '6월', '7월', '8월', '9월'], value: ['96', '101', '99', '108', '117', '131'] }),
      },
    },
    {
      layout: 'versus',
      purpose: '작년 대비',
      priority: 3,
      guide: '항목마다 작년과 올해 숫자를 나란히 적으면 몇 % 늘고 줄었는지 저절로 계산돼요. 계획과 실적처럼 다른 두 값도 이름만 바꿔 쓰면 돼요.',
      hints: {
        title: '3분기부터 작년보다 20% 넘게 늘었어요',
        unit: '억 원',
        ...each({ title: ['1분기', '2분기', '3분기', '4분기'], meta: ['96', '101', '108', '117'], value: ['104', '98', '131', '136'] }),
      },
    },
    {
      layout: 'progress',
      purpose: '과제 진행 현황',
      priority: 2,
      guide: '과제마다 진행률과 상태(완료, 진행 중, 지연, 예정)를 적어 주세요. 늦어지는 과제는 숨기지 말고 얼마나 늦는지 적으면 신뢰가 쌓여요.',
      hints: { title: '다섯 과제 중 하나가 2주 늦어지고 있어요' },
    },
    {
      layout: 'funnel',
      purpose: '영업 단계별 현황',
      priority: 3,
      guide: '첫 만남부터 계약까지 단계마다 고객 수를 적으면 단계 사이 전환율이 저절로 계산돼요. 가장 많이 빠지는 단계가 다음 계획의 근거가 돼요.',
      hints: { title: '제안까지 간 고객 다섯 중 한 곳이 계약했어요', unit: '곳' },
    },
    {
      layout: 'points',
      purpose: '잘된 점',
      priority: 2,
      guide: '실적을 만든 이유를 짚으면 다음에도 이어갈 수 있어요.',
      hints: {
        title: '실적을 만든 이유',
        'items.title': '잘된 점',
        'items.body': '왜 잘됐는지',
        ...each({ title: ['기존 고객 재계약', '새 업종 진입', '제안 기간 단축'] }),
      },
    },
    {
      layout: 'compare',
      purpose: '문제와 대책',
      priority: 1,
      guide: '부족했던 점을 먼저 꺼내고 대책을 함께 적으면 신뢰가 쌓여요.',
      fields: { leftTitle: '문제', rightTitle: '대책' },
      hints: {
        title: '부족했던 점과 대책',
        'items.title': '부족했던 점',
        'items.body': '대책',
        ...each({
          title: ['신규 고객이 목표보다 1곳 적어요', '제안서 준비에 시간이 많이 들어요', '큰 계약이 다음 분기로 밀렸어요'],
          body: ['4분기에 2곳을 더 만나요', '제안서 양식을 하나로 맞춰요', '12월 계약에 맞춰 일정을 당겨요'],
        }),
      },
    },
    {
      layout: 'timeline',
      purpose: '다음 계획',
      priority: 1,
      guide: '다음 기간에 무엇을 언제 할지 보여주세요.',
      hints: {
        title: '다음 분기 계획',
        ...each({ meta: ['10월', '11월', '12월', '1월'], title: ['신규 고객 2곳 방문', '재계약 협상', '연간 실적 점검', '내년 계획 보고'] }),
      },
    },
    {
      ...decision('필요한 지원이 있으면 분명하게 적어 주세요. 없으면 이 장을 발표에서 빼도 돼요.', [
        '필요한 지원 (예: 신규 인력 1명)',
        '함께 정해 주실 일',
        '그 밖의 요청',
      ]),
      purpose: '요청 사항',
      fields: { title: '요청 사항' },
    },
  ],
}

const blank: Blueprint = {
  type: 'blank',
  name: '빈 발표',
  description: '처음부터 직접 구성해요',
  storyline: [],
  defaultTitle: '새 발표',
  examples: { title: '하반기 팀 운영 계획 보고', ask: '하반기 교육 예산 승인' },
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
    decision('오늘 받아야 할 결정을 적어 주세요.', ['결정해 주실 일', '함께 정해 주실 일', '그 밖의 요청']),
  ],
}

export const BLUEPRINTS: Record<DeckType, Blueprint> = { business, deal, improve, report, blank }
export const DECK_TYPES: DeckType[] = ['business', 'deal', 'improve', 'report']

export const AUDIENCES: { id: Audience; name: string; description: string }[] = [
  { id: 'exec', name: '본부장·임원', description: '결론과 숫자를 먼저, 장 수는 적게' },
  { id: 'practitioner', name: '팀장', description: '근거와 실행 계획까지 자세히' },
  { id: 'mixed', name: '여러 분이 함께', description: '요약을 먼저 보여주고 자세한 내용은 뒤에' },
]

export const DURATIONS: { minutes: number; name: string }[] = [
  { minutes: 5, name: '5분' },
  { minutes: 10, name: '10분' },
  { minutes: 20, name: '20분' },
  { minutes: 30, name: '30분 이상' },
]

export const METHODS: { id: 'live' | 'remote' | 'send'; name: string; description: string }[] = [
  { id: 'live', name: '회의실 발표', description: '회의실 화면에 띄우고 말로 설명해요' },
  { id: 'remote', name: '화상 회의', description: '온라인 회의에서 화면을 공유해요' },
  { id: 'send', name: '보고서로 보내기', description: '미리 보내서 혼자 읽게 해요' },
]
