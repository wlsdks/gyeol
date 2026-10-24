import type { Audience, DeckType, ItemKey, LayoutId, SlideOptions } from './types'

/*
 * 사내 발표의 골격. 윗분께 결정을 받는 보고만이 아니라 동료와 나누는 주간 보고, 다른 부서에 하는 팀 소개,
 * 사내 교육까지, 회사에서 PPT를 만드는 흔한 자리마다 하나씩 둔다.
 * 어느 구성이든 결론을 먼저 말하고(표지 다음에 한 장 요약이나 한 문장 메시지), 마지막 장에서 받을 것이나 남길 것을 분명히 한다.
 *
 * 장 안내(guide)는 편집기에서 장 옆에 짧게 보인다. 한 문장으로, 그 장을 채울 때 꼭 필요한 요령만 적는다.
 */

/** 듣는 사람에 따라 더 챙기거나 덜 챙기는 장. 장 수를 맞출 때 우선순위를 한 단계 올리거나 내린다 */
export type Focus = 'numbers' | 'detail' | 'context'

export interface Recipe {
  layout: LayoutId
  purpose: string
  /** 1은 항상 포함, 3부터 먼저 뺀다 */
  priority: 1 | 2 | 3
  /** 이 청중일 때만 포함. 없으면 모든 청중 */
  audience?: Audience[]
  /** 숫자 장, 세부 장, 배경 장. 듣는 사람(AUDIENCES의 up, down)에 따라 우선순위가 한 단계 오르내린다 */
  focus?: Focus
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
  /** 고르는 목록에 보이는 한 줄. 무엇을 하는 발표인지 짧게 */
  description: string
  /** 마법사에서 보여주는 이야기 흐름 */
  storyline: string[]
  /** 마법사의 발표 종류 미리 보기에 작은 그림으로 보일 장(장의 역할 이름). 이야기 흐름의 차례마다 하나 */
  showcase?: string[]
  defaultTitle: string
  /**
   * 마법사의 입력 예시. ask가 없는 발표(나누고 알리는 발표)는 결정 요청 대신 부제(lead)를 묻는다.
   * 결정받을 것이 없는 자리에서 '결정받고 싶은 것'을 물으면 무엇을 적을지 헷갈린다
   */
  examples: { title: string; ask?: string; lead?: string }
  recipes: Recipe[]
}

const ALL_BUT_EXEC: Audience[] = ['practitioner', 'peers', 'partners', 'mixed']

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
    guide: '이야기의 큰 흐름이 바뀌는 곳이에요.',
    fields: { title },
    hints: { lead },
  }
}

const cover: Recipe = { layout: 'cover', purpose: '표지', priority: 1, guide: '제목과 결정받을 것을 한 줄씩 적어요.' }

/** 결정을 받는 자리가 아닌 발표(나누고 알리는 발표)의 표지. 결정 요청 칸은 비워 두면 발표할 때 빠진다 */
const plainCover: Recipe = { ...cover, guide: '무엇에 관한 발표인지 제목에 담아요.', hints: { ask: '있으면 한 줄로, 없으면 비워 둬요' } }

/** 한 장 요약: 바쁜 분이 이 장만 보고도 판단할 수 있게 */
function summary(conclusion: string, labels: string[], bodies: string[]): Recipe {
  return {
    layout: 'summary',
    purpose: '한 장 요약',
    priority: 1,
    guide: '이 장만 봐도 알 수 있게, 줄마다 한두 문장으로 써요.',
    hints: { title: conclusion, ...rows('body', bodies) },
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
    guide: '추천안을 강조하고, 안마다 비용과 장단점을 적어요.',
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
    guide: '"잘 안 되면?"에 먼저 답해요.',
    fields: { leftTitle: '예상 위험', rightTitle: '대응 방안' },
    hints: { title: '이런 위험은 이렇게 대비해요', 'items.title': '일어날 수 있는 문제', 'items.body': '대응 방법', ...each(examples) },
  }
}

/**
 * 마지막 장: 받을 결정, 부탁, 남길 말. asks는 첫 줄이 가장 중요하고, 마지막 줄은 없으면 지워도 되는 칸이다.
 * bodies를 주지 않으면 결정 요청의 설명 칸(언제까지, 왜)으로 안내한다.
 */
function closing(
  purpose: string,
  title: string,
  priority: Recipe['priority'],
  guide: string,
  asks: string[],
  bodies = ['언제까지, 왜 필요한지', '언제까지, 왜 필요한지', '없으면 이 줄을 지워요'],
): Recipe {
  return {
    layout: 'closing',
    purpose,
    priority,
    guide,
    fields: { title },
    hints: {
      // 줄마다 붙인 안내가 먼저 쓰이고, 이것은 그 밖의 줄에. 예시는 첫 줄에만 맞아서 뺀다
      'items.title': asks[0].replace(/ \(예: .*\)$/, ''),
      'items.body': bodies[0],
      ...each({ title: asks, body: bodies }),
    },
  }
}

const decision = (asks: string[]) => closing('결정 요청', '결정해 주실 것', 1, '받을 결정과 기한을 분명히 적어요.', asks)

const agenda: Recipe = {
  layout: 'agenda',
  purpose: '목차',
  priority: 3,
  audience: ALL_BUT_EXEC,
  guide: '섹션 이름이 미리 들어가 있어요.',
  fields: { title: '보고 순서' },
}

// ---------- 제안하고 결정받기 ----------

const business: Blueprint = {
  type: 'business',
  name: '사업 제안',
  description: '새 사업이나 프로젝트를 승인받아요',
  storyline: ['배경', '제안', '효과', '결정 요청'],
  showcase: ['기회의 크기', '바뀌는 모습', '매출 전망', '결정 요청'],
  defaultTitle: '사업 제안',
  examples: { title: '중소 제조사 대상 구독형 품질 관리 사업 제안', ask: '시범 사업 예산 1.2억 원 승인' },
  recipes: [
    cover,
    summary(
      '한 줄 결론 (예: 구독형 서비스로 3년 안에 매출 30억 원)',
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
      guide: '"왜 지금?"에 한 문장으로 답해요.',
      hints: { title: '지금 이 사업을 해야 하는 이유를 한 문장으로', lead: '그렇게 보는 근거 (시장 변화, 고객 요구, 경쟁사 움직임)' },
    },
    {
      layout: 'kpi',
      purpose: '기회의 크기',
      priority: 2,
      focus: 'numbers',
      section: '배경',
      guide: '기회가 얼마나 큰지 숫자로, 출처와 함께 적어요.',
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
      focus: 'numbers',
      section: '배경',
      guide: '노릴 부분 하나를 강조해요. 비중은 저절로 계산돼요.',
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
      guide: '세 가지 이내로, 하지 않을 일도 적어요.',
      hints: {
        title: '무엇을 하자는 건지 한 문장으로',
        'items.title': '할 일',
        'items.body': '어떻게, 누가 하는지',
        ...each({
          title: ['구독형 서비스 출시', '대리점 판매 연계', '하지 않을 일'],
          body: ['어떻게, 누가 하는지', '어떻게, 누가 하는지', '이번에는 하지 않는 것 (예: 대기업 고객)'],
        }),
      },
    },
    {
      layout: 'compare',
      purpose: '바뀌는 모습',
      priority: 2,
      section: '제안',
      guide: '지금과 추진 후를 줄마다 나란히 놓아요.',
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
      guide: '얻는 것을 숫자로, 계산 근거와 함께 적어요.',
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
      focus: 'numbers',
      section: '효과와 비용',
      guide: '해마다 얼마를 버는지 보이면 회수 시점이 보여요.',
      hints: { title: '3년 차에 매출 12억 원', unit: '억 원', ...each({ title: ['1년 차', '2년 차', '3년 차'], value: ['4', '7', '12'] }) },
      items: 3,
    },
    {
      layout: 'kpi',
      purpose: '필요한 자원',
      priority: 2,
      section: '효과와 비용',
      guide: '예산, 인력, 기간을 숨기지 말고 먼저 보여요.',
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
      focus: 'detail',
      section: '실행 계획',
      guide: '중간 점검 시점을 넣어 두면 안심해요.',
      hints: {
        title: '6개월 안에 시범 운영까지',
        ...each({ meta: ['1개월 차', '2개월 차', '4개월 차', '6개월 차'], title: ['준비', '시범 운영', '중간 점검', '확대 결정'] }),
      },
    },
    risks(2, '실행 계획'),
    decision(['결정해 주실 일 (예: 시범 사업 예산 1.2억 원 승인)', '함께 정해 주실 일 (예: 전담 인력 3명)', '그 밖의 요청']),
  ],
}

const improve: Blueprint = {
  type: 'improve',
  name: '개선 제안',
  description: '일하는 방식이나 제도, 도구를 바꾸자고 해요',
  storyline: ['문제', '원인', '개선안', '효과'],
  showcase: ['문제의 크기', '원인', '바뀌는 절차', '기대 효과'],
  defaultTitle: '개선 제안',
  examples: { title: '견적 작성 방식 개선 제안', ask: '한 팀 시범 운영 승인' },
  recipes: [
    cover,
    summary(
      '한 줄 결론 (예: 견적 양식을 하나로 맞추면 작성 시간이 40% 줄어요)',
      ['지금의 문제', '개선안', '기대 효과', '요청 사항'],
      ['누가, 무엇 때문에 힘든지', '무엇을 어떻게 바꾸자는 건지', '바꾸면 얻는 것 (시간, 비용을 숫자로)', '결정해 주실 것'],
    ),
    section('문제', '지금 무엇이 문제인지'),
    {
      layout: 'statement',
      purpose: '지금의 문제',
      priority: 1,
      section: '문제',
      guide: '겪는 사람이 "맞아"라고 할 만큼 구체적으로 적어요.',
      hints: { title: '지금 가장 큰 문제를 한 문장으로', lead: '누가, 얼마나 자주 겪는지' },
    },
    {
      layout: 'bars',
      purpose: '문제의 크기',
      priority: 2,
      focus: 'numbers',
      section: '문제',
      items: 3,
      guide: '문제 때문에 드는 시간이나 비용을 막대로 보여요.',
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
      focus: 'context',
      section: '문제',
      guide: '왜 생기는지 짚으면 개선안이 왜 맞는지 보여요.',
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
      focus: 'detail',
      section: '개선안',
      guide: '효과와 하기 쉬운 정도로 나눠 무엇부터 할지 보여요.',
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
      guide: '지금 방식과 바뀐 방식을 줄마다 나란히 놓아요.',
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
      focus: 'detail',
      section: '개선안',
      guide: '가장 크게 바뀌는 단계 하나를 강조해요.',
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
      guide: '무엇이 얼마나 좋아지는지 숫자로 적어요.',
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
      guide: '작게 시작해서 넓히면 결정하기 쉬워요.',
      hints: {
        title: '한 팀에서 먼저 시작해요',
        ...each({ meta: ['1개월 차', '2개월 차', '3개월 차', '4개월 차'], title: ['한 팀 시범', '결과 점검', '본부 확대', '모든 팀 적용'] }),
      },
    },
    {
      layout: 'table',
      purpose: '할 일과 담당',
      priority: 3,
      focus: 'detail',
      section: '실행',
      guide: '누가 언제까지 무엇을 하는지 표로 정리해요.',
      fields: { h1: '과제', h2: '담당', h3: '기한', h4: '비고' },
      hints: { title: '네 가지를 2월까지 끝내요' },
    },
    risks(3, '실행', {
      title: ['새 방식이 익숙하지 않을 수 있어요', '바꾸는 동안 일이 밀릴 수 있어요', '효과가 예상보다 작을 수 있어요'],
      body: ['한 팀에서 먼저 써 보고 고쳐요', '바쁜 달을 피해 시작해요', '한 달 뒤 숫자로 점검해요'],
    }),
    decision(['결정해 주실 일 (예: 한 팀 시범 운영 승인)', '함께 정해 주실 일 (예: 시범 기간 2개월)', '그 밖의 요청']),
  ],
}

/** 검토 보고: 여러 안을 같은 기준으로 따져 보고 하나를 골라 결정받는다 (도구 도입, 업체 선정, 구매) */
const decide: Blueprint = {
  type: 'decide',
  name: '검토 보고',
  description: '여러 안을 비교해 하나를 결정받아요',
  storyline: ['배경', '안 비교', '평가', '결정'],
  showcase: ['지금의 불편', '안 비교', '기준별 평가', '결정 요청'],
  defaultTitle: '검토 보고',
  examples: { title: '협업 도구 도입 검토', ask: '협업 도구 B안 도입 승인' },
  recipes: [
    cover,
    summary(
      '한 줄 결론 (예: 세 안 중 B안이 비용 대비 효과가 가장 커요)',
      ['배경', '검토한 안', '추천안', '요청 사항'],
      ['왜 검토하게 됐는지', '어떤 안을 어떤 기준으로 봤는지', '추천하는 안과 그 이유', '결정해 주실 것 (예산, 시기)'],
    ),
    {
      layout: 'statement',
      purpose: '검토 배경',
      priority: 1,
      focus: 'context',
      guide: '왜 검토하게 됐는지 한 문장으로 적어요.',
      hints: { title: '검토하게 된 까닭을 한 문장으로', lead: '지금 무엇이 불편하거나 모자란지' },
    },
    {
      layout: 'kpi',
      purpose: '지금의 불편',
      priority: 3,
      focus: 'numbers',
      guide: '지금 드는 시간이나 비용을 숫자로 보여요.',
      hints: {
        title: '자료 찾는 데만 하루 1.5시간을 써요',
        'items.body': '어떻게 잰 숫자인지',
        ...each({ value: ['1.5시간', '4가지', '3,600만 원'], title: ['하루에 자료 찾는 시간', '따로 쓰는 도구', '한 해 도구 비용'] }),
      },
    },
    {
      layout: 'points',
      purpose: '검토 기준',
      priority: 2,
      focus: 'detail',
      guide: '안을 견줄 기준을 먼저 맞춰요.',
      hints: {
        title: '세 가지 기준으로 견줬어요',
        'items.title': '기준',
        'items.body': '무엇을 어떻게 봤는지',
        ...each({ title: ['비용', '쓰기 쉬움', '보안'], body: ['3년 동안 드는 돈', '익히는 데 걸리는 시간', '사내 보안 기준을 지키는지'] }),
      },
    },
    options('안 비교', 1, undefined, {
      title: '세 가지 안 중 B안을 추천해요',
      'items.body': '내용과 장단점을 한 줄에 하나씩',
      ...each({ value: ['연 1,800만 원', '연 2,400만 원', '연 4,000만 원'], meta: ['지금 도구 그대로', '새 도구 도입', '직접 만들기'] }),
    }),
    {
      layout: 'table',
      purpose: '기준별 평가',
      priority: 2,
      focus: 'detail',
      guide: '기준마다 안을 한 줄로 견줘요.',
      fields: { h1: '기준', h2: 'A안', h3: 'B안', h4: 'C안' },
      hints: {
        title: 'B안이 세 기준에서 고르게 좋아요',
        ...each({
          title: ['비용', '쓰기 쉬움', '보안', '도입 기간'],
          meta: ['가장 낮아요', '지금과 같아요', '기준에 맞아요', '바로'],
          value: ['중간이에요', '쉬워요', '기준에 맞아요', '1개월'],
          body: ['가장 높아요', '익히기 어려워요', '가장 좋아요', '6개월'],
        }),
      },
    },
    {
      layout: 'timeline',
      purpose: '도입 일정',
      priority: 3,
      focus: 'detail',
      guide: '결정 뒤 언제 무엇을 하는지 보여요.',
      hints: {
        title: '석 달 안에 모두 옮겨요',
        ...each({ meta: ['12월', '1월', '2월', '3월'], title: ['계약', '한 팀 시범', '모두 옮기기', '예전 도구 끝내기'] }),
      },
    },
    risks(3, undefined, {
      title: ['옮기는 동안 일이 밀릴 수 있어요', '익숙해지는 데 시간이 걸려요', '비용이 오를 수 있어요'],
      body: ['한 팀부터 옮겨요', '첫 달에 교육을 두 번 해요', '3년 가격을 계약에 넣어요'],
    }),
    decision(['결정해 주실 일 (예: B안 도입 승인)', '함께 정해 주실 일 (예: 도입 시기 1월)', '그 밖의 요청']),
  ],
}

const deal: Blueprint = {
  type: 'deal',
  name: '고객 제안 계획',
  description: '고객에게 낼 제안과 가격을 승인받아요',
  storyline: ['사업 기회', '제안 전략', '가격', '결정 요청'],
  showcase: ['사업 규모', '제안 내용', '가격 안', '결정 요청'],
  defaultTitle: '고객 제안 계획',
  examples: { title: '한빛제조 품질 관리 시스템 제안 계획', ask: '제안 가격 4.8억 원 승인' },
  recipes: [
    cover,
    summary(
      '한 줄 결론 (예: 4.8억 원에 제안하면 이익률 22%로 수주할 수 있어요)',
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
      guide: '고객이 지금 하려는 일을 한 문장으로 적어요.',
      hints: { title: '고객이 지금 하려는 일을 한 문장으로 (예: 한빛제조가 품질 관리 시스템 교체를 검토 중)', lead: '언제, 누가 결정하는지' },
    },
    {
      layout: 'kpi',
      purpose: '사업 규모',
      priority: 1,
      section: '사업 기회',
      guide: '얼마짜리 사업인지, 이익률과 함께 적어요.',
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
      focus: 'context',
      section: '사업 기회',
      guide: '앞서는 점과 밀리는 점을 솔직하게 적어요.',
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
      guide: '고객이 얻는 것을 세 가지 이내로 적어요.',
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
      focus: 'detail',
      section: '제안 전략',
      guide: '고객에게 보여 줄 화면이나 구성도를 넣어요.',
      hints: { title: '고객에게 보여줄 화면', body: '이 화면으로 고객이 무엇을 할 수 있는지' },
    },
    { layout: 'case', purpose: '비슷한 수주 사례', priority: 3, section: '제안 전략', guide: '비슷한 고객에게 수주한 사례가 있으면 넣어요.' },
    section('실행 계획', '수주까지 무엇을 할지'),
    {
      layout: 'timeline',
      purpose: '수주 일정',
      priority: 2,
      focus: 'detail',
      section: '실행 계획',
      guide: '고객이 결정하는 날을 꼭 넣어요.',
      hints: {
        title: '12월 계약이 목표예요',
        ...each({ meta: ['11월 1주', '11월 3주', '12월 1주', '12월 3주'], title: ['제안서 제출', '현장 시연', '가격 협상', '계약'] }),
      },
    },
    risks(2, '실행 계획', {
      title: ['경쟁사가 가격을 더 낮출 수 있어요', '고객 결정이 늦어질 수 있어요', '구축 인력이 모자랄 수 있어요'],
      body: ['협상 때 쓸 조건을 미리 정해 둬요', '단계를 나눠 먼저 계약해요', '다른 팀 지원을 미리 받아 둬요'],
    }),
    decision(['결정해 주실 일 (예: 제안 가격 4.8억 원 승인)', '함께 정해 주실 일 (예: 구축 인력 2명 지원)', '그 밖의 요청 (예: 협상에 쓸 할인 폭)']),
  ],
}

/** 연간·반기 계획: 지난 기간을 돌아보고, 다음 기간의 목표와 과제, 예산을 승인받는다 */
const plan: Blueprint = {
  type: 'plan',
  name: '연간·반기 계획',
  description: '목표와 중점 과제, 예산을 정해요',
  storyline: ['돌아보기', '목표', '과제', '일정'],
  showcase: ['올해 돌아보기', '내년 목표', '중점 과제', '분기별 일정'],
  defaultTitle: '사업 계획',
  examples: { title: '2027년 영업본부 사업 계획', ask: '내년 예산 12억 원과 인력 2명 승인' },
  recipes: [
    cover,
    summary(
      '한 줄 결론 (예: 내년 매출 580억 원, 신규 고객 20곳)',
      ['돌아보기', '목표', '중점 과제', '요청 사항'],
      ['올해 이룬 것과 모자란 것', '내년에 이룰 것 (숫자로)', '목표를 위해 할 일 세 가지', '결정해 주실 것 (예산, 인력)'],
    ),
    agenda,
    section('돌아보기', '올해 무엇을 이뤘는지'),
    {
      layout: 'scorecard',
      purpose: '올해 돌아보기',
      priority: 1,
      section: '돌아보기',
      guide: '올해 목표와 실적을 같은 단위로 적어요.',
      hints: {
        title: '네 목표 중 세 개를 이뤘어요',
        'items.title': '지표 이름',
        ...each({
          title: ['매출', '영업이익', '신규 고객', '재계약률'],
          meta: ['500억 원', '50억 원', '15곳', '90%'],
          value: ['512억 원', '47억 원', '17곳', '92%'],
        }),
      },
    },
    {
      layout: 'points',
      purpose: '올해 배운 점',
      priority: 3,
      focus: 'context',
      section: '돌아보기',
      guide: '내년 계획의 근거가 되는 것만 짚어요.',
      hints: {
        title: '내년에 이어갈 것과 고칠 것',
        'items.title': '배운 점',
        'items.body': '왜 그런지, 내년에 어떻게 할지',
        ...each({ title: ['큰 고객에 집중한 것이 통했어요', '신규 영업이 늦게 시작됐어요', '인력이 한 팀에 몰렸어요'] }),
      },
    },
    section('목표', '내년에 무엇을 이룰지'),
    {
      layout: 'kpi',
      purpose: '내년 목표',
      priority: 1,
      section: '목표',
      guide: '목표는 숫자로, 올해와 견줘 적어요.',
      hints: {
        title: '내년에 이룰 것',
        ...each({ value: ['580억 원', '20곳', '14%'], title: ['매출', '신규 고객', '영업이익률'], body: ['올해보다 13% 많이', '올해 17곳', '올해 9.2%'] }),
      },
    },
    {
      layout: 'versus',
      purpose: '올해와 내년',
      priority: 3,
      focus: 'numbers',
      section: '목표',
      guide: '분기마다 올해와 내년 목표를 나란히 놓아요.',
      fields: { metaTitle: '올해', valueTitle: '내년' },
      hints: {
        title: '분기마다 10% 넘게 늘려요',
        unit: '억 원',
        ...each({ title: ['1분기', '2분기', '3분기', '4분기'], meta: ['118', '124', '131', '139'], value: ['132', '140', '148', '160'] }),
      },
    },
    section('과제', '목표를 위해 무엇을 할지'),
    {
      layout: 'points',
      purpose: '중점 과제',
      priority: 1,
      section: '과제',
      guide: '과제는 세 가지 이내로, 맡을 곳과 함께 적어요.',
      hints: {
        title: '세 가지에 힘을 모아요',
        'items.title': '과제',
        'items.body': '무엇을, 누가, 어떻게',
        ...each({ title: ['신규 업종 진입', '구독 매출 늘리기', '영업 방식 바꾸기'] }),
      },
    },
    {
      layout: 'matrix',
      purpose: '과제 우선순위',
      priority: 3,
      focus: 'detail',
      section: '과제',
      guide: '효과와 하기 쉬운 정도로 나눠 무엇부터 할지 보여요.',
      fields: { yAxis: '실행하기 쉬움', xAxis: '효과가 큼' },
      hints: {
        title: '쉽고 효과가 큰 것부터 시작해요',
        'items.0.title': '틈틈이 하기',
        'items.1.title': '바로 하기',
        'items.2.title': '미루기',
        'items.3.title': '계획해서 하기',
      },
    },
    section('실행', '언제, 무엇으로 할지'),
    {
      layout: 'timeline',
      purpose: '분기별 일정',
      priority: 2,
      focus: 'detail',
      section: '실행',
      guide: '분기마다 끝낼 일을 하나씩 적어요.',
      hints: {
        title: '분기마다 하나씩 끝내요',
        ...each({ meta: ['1분기', '2분기', '3분기', '4분기'], title: ['조직 정비', '신규 업종 첫 계약', '구독 상품 출시', '연간 점검'] }),
      },
    },
    {
      layout: 'kpi',
      purpose: '필요한 예산과 인력',
      priority: 2,
      section: '실행',
      guide: '예산과 인력을 숨기지 말고 먼저 보여요.',
      hints: {
        title: '필요한 예산과 인력',
        ...each({ value: ['12억 원', '2명', '3억 원'], body: ['올해보다 1.5억 원 늘어요', '신규 업종 영업 담당', '구독 상품 개발'] }),
      },
      prefill: [{ title: '운영 예산' }, { title: '인력' }, { title: '투자' }],
    },
    risks(3, '실행', {
      title: ['경기가 나빠 매출이 줄 수 있어요', '신규 업종 영업이 늦을 수 있어요', '사람을 제때 뽑지 못할 수 있어요'],
      body: ['분기마다 목표를 다시 봐요', '협력사와 함께 영업해요', '내부 이동을 먼저 검토해요'],
    }),
    decision(['결정해 주실 일 (예: 내년 예산 12억 원 승인)', '함께 정해 주실 일 (예: 신규 인력 2명)', '그 밖의 요청']),
  ],
}

// ---------- 진행과 결과 보고하기 ----------

/** 주간·월간 업무 보고: 늘 하는 짧은 보고. 한 일, 이슈, 할 일을 빠르게 */
const weekly: Blueprint = {
  type: 'weekly',
  name: '주간·월간 업무 보고',
  description: '한 일과 할 일, 이슈를 알려요',
  storyline: ['진행', '숫자', '이슈', '할 일'],
  showcase: ['진행 현황', '주요 숫자', '이슈와 대응', '다음 할 일'],
  defaultTitle: '주간 업무 보고',
  examples: { title: '10월 4주 영업기획팀 주간 업무 보고', lead: '10월 21일 ~ 25일' },
  recipes: [
    plainCover,
    summary(
      '한 줄 요약 (예: 견적 자동화 1차 완료, 단가표 공유는 1주 늦어요)',
      ['한 일', '이슈', '할 일', '요청 사항'],
      ['이번에 끝낸 일 (중요한 것부터)', '막히거나 늦어지는 일', '다음에 할 일', '도움이 필요한 것 (없으면 이 줄을 지워요)'],
    ),
    {
      layout: 'progress',
      purpose: '진행 현황',
      priority: 1,
      guide: '늦어지는 일은 얼마나 늦는지 함께 적어요.',
      hints: { title: '다섯 과제 중 하나가 1주 늦어요' },
    },
    {
      layout: 'kpi',
      purpose: '주요 숫자',
      priority: 2,
      focus: 'numbers',
      guide: '지난번이나 목표와 견줘 적어요.',
      hints: {
        title: '이번 주 숫자',
        ...each({ value: ['38건', '4.2억 원', '92%'], title: ['보낸 견적', '수주', '납기 준수율'], body: ['지난주 31건', '월 목표의 45%', '목표 95%'] }),
      },
    },
    {
      layout: 'trend',
      purpose: '주별 추이',
      priority: 3,
      focus: 'numbers',
      guide: '흐름을 볼 숫자 하나만 골라요.',
      hints: {
        title: '견적이 4주째 늘고 있어요',
        unit: '건',
        ...each({ title: ['9월 3주', '9월 4주', '10월 1주', '10월 2주', '10월 3주', '10월 4주'], value: ['24', '27', '26', '30', '31', '38'] }),
      },
    },
    {
      layout: 'compare',
      purpose: '이슈와 대응',
      priority: 1,
      guide: '막힌 일과 어떻게 풀지를 줄마다 적어요.',
      fields: { leftTitle: '이슈', rightTitle: '대응' },
      hints: {
        title: '두 가지가 막혀 있어요',
        'items.title': '막히거나 늦어지는 일',
        'items.body': '어떻게 풀지, 언제까지',
        ...each({
          title: ['단가표 정리가 1주 늦어요', '견적 검토가 금요일에 몰려요', '새 양식을 쓰지 않는 팀이 있어요'],
          body: ['구매팀과 목요일에 마무리해요', '검토를 화요일과 금요일로 나눠요', '다음 주에 한 번 더 안내해요'],
        }),
      },
    },
    {
      layout: 'table',
      purpose: '다음 할 일',
      priority: 1,
      guide: '누가 언제까지 할지 함께 적어요.',
      fields: { h1: '할 일', h2: '담당', h3: '기한', h4: '비고' },
      hints: {
        title: '다음 주에 네 가지를 해요',
        ...each({
          title: ['단가표 공유 마무리', '견적 검토 나누기', '고객 방문 2곳', '월간 보고 준비'],
          meta: ['구매팀', '영업기획팀', '영업 2팀', '영업기획팀'],
          value: ['화요일', '수요일', '목요일', '금요일'],
        }),
      },
    },
    closing('요청 사항', '도움이 필요한 것', 2, '없으면 이 장을 빼도 돼요.', [
      '필요한 도움 (예: 단가 확인을 구매팀에 요청)',
      '함께 정해 주실 일',
      '그 밖의 요청',
    ]),
  ],
}

const report: Blueprint = {
  type: 'report',
  name: '실적 보고',
  description: '목표 대비 실적과 원인, 대책을 알려요',
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
      guide: '목표 대비 몇 퍼센트인지부터 보여요.',
      hints: {
        title: '이번 분기 목표의 112%를 달성했어요',
        ...each({
          value: ['112%', '131억 원', '4곳'],
          title: ['목표 달성률', '3분기 매출', '신규 고객'],
          body: ['목표와 실적 숫자', '지난 분기와 비교', '목표 5곳'],
        }),
      },
    },
    agenda,
    {
      layout: 'scorecard',
      purpose: '목표 대비 실적',
      priority: 1,
      guide: '목표에 못 미친 지표는 이유를 짧게 적어요.',
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
      focus: 'numbers',
      guide: '더한 것은 +, 뺀 것은 -로 적으면 실적이 계산돼요.',
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
      focus: 'numbers',
      guide: '목표선을 적으면 넘은 때가 한눈에 보여요.',
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
      focus: 'numbers',
      guide: '두 값을 나란히 적으면 증감이 계산돼요.',
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
      focus: 'detail',
      guide: '늦어지는 과제는 얼마나 늦는지 함께 적어요.',
      hints: { title: '다섯 과제 중 하나가 2주 늦어지고 있어요' },
    },
    {
      layout: 'funnel',
      purpose: '영업 단계별 현황',
      priority: 3,
      focus: 'detail',
      guide: '많이 빠지는 단계가 다음 계획의 근거가 돼요.',
      hints: { title: '제안까지 간 고객 다섯 중 한 곳이 계약했어요', unit: '곳' },
    },
    {
      layout: 'points',
      purpose: '잘된 점',
      priority: 2,
      guide: '실적을 만든 이유를 짚어요.',
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
      guide: '부족했던 점을 먼저 꺼내고 대책을 함께 적어요.',
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
      guide: '다음 기간에 무엇을 언제 할지 적어요.',
      hints: {
        title: '다음 분기 계획',
        ...each({ meta: ['10월', '11월', '12월', '1월'], title: ['신규 고객 2곳 방문', '재계약 협상', '연간 실적 점검', '내년 계획 보고'] }),
      },
    },
    closing('요청 사항', '요청 사항', 1, '없으면 이 장을 빼도 돼요.', ['필요한 지원 (예: 신규 인력 1명)', '함께 정해 주실 일', '그 밖의 요청']),
  ],
}

/** 결과 보고: 끝난 일(프로젝트, 시범 운영, 행사, 출장)의 성과와 배운 점, 남은 일 */
const result: Blueprint = {
  type: 'result',
  name: '결과 보고',
  description: '끝난 일의 성과와 배운 점을 정리해요',
  storyline: ['성과', '과정', '배운 점', '후속 과제'],
  showcase: ['목표 대비 결과', '진행 과정', '배운 점', '후속 과제'],
  defaultTitle: '결과 보고',
  examples: { title: '견적 자동화 시범 운영 결과 보고', ask: '본부 전체 확대 승인' },
  recipes: [
    cover,
    summary(
      '한 줄 결론 (예: 시범 운영으로 견적 시간을 40% 줄였어요)',
      ['목표', '결과', '배운 점', '후속 과제'],
      ['처음에 무엇을 하려 했는지', '무엇을 얼마나 이뤘는지 (숫자로)', '이어갈 것과 고칠 것', '남은 일과 요청 (예: 본부 전체로 확대)'],
    ),
    section('결과', '무엇을 얼마나 이뤘는지'),
    {
      layout: 'scorecard',
      purpose: '목표 대비 결과',
      priority: 1,
      section: '결과',
      guide: '처음 정한 목표와 결과를 같은 단위로 적어요.',
      hints: {
        title: '네 목표 중 세 개를 이뤘어요',
        'items.title': '목표',
        ...each({
          title: ['견적 한 건 시간', '참여 팀', '사용률', '비용'],
          meta: ['3.6시간', '3팀', '80%', '2,000만 원'],
          value: ['3.5시간', '3팀', '72%', '1,850만 원'],
        }),
      },
    },
    {
      layout: 'kpi',
      purpose: '핵심 성과',
      priority: 2,
      focus: 'numbers',
      section: '결과',
      guide: '가장 내세울 숫자 두세 개만 골라요.',
      hints: {
        title: '숫자로 보는 성과',
        ...each({
          value: ['40%', '1,200시간', '4.6점'],
          title: ['줄어든 견적 시간', '한 해에 아끼는 시간', '쓰는 사람 만족도'],
          body: ['6시간에서 3.6시간으로', '견적 건수로 계산', '5점 만점, 42명 응답'],
        }),
      },
    },
    section('과정', '어떻게 진행했는지'),
    {
      layout: 'timeline',
      purpose: '진행 과정',
      priority: 3,
      focus: 'detail',
      section: '과정',
      guide: '큰 고비만 짧게 적어요.',
      hints: { title: '넉 달 동안 이렇게 진행했어요', ...each({ meta: ['7월', '8월', '9월', '10월'], title: ['준비', '시범 운영', '보완', '마무리'] }) },
    },
    {
      layout: 'points',
      purpose: '잘된 점',
      priority: 2,
      section: '과정',
      guide: '다음에도 이어갈 것을 짚어요.',
      hints: {
        title: '잘된 이유',
        'items.title': '잘된 점',
        'items.body': '왜 잘됐는지',
        ...each({ title: ['한 팀에서 먼저 시작했어요', '매주 숫자로 점검했어요', '쓰는 사람과 함께 고쳤어요'] }),
      },
    },
    section('배운 점', '다음에는 어떻게 할지'),
    {
      layout: 'compare',
      purpose: '배운 점',
      priority: 1,
      section: '배운 점',
      guide: '아쉬웠던 점마다 다음에 어떻게 할지 적어요.',
      fields: { leftTitle: '아쉬웠던 점', rightTitle: '다음에는' },
      hints: {
        title: '다음에는 이렇게 해요',
        'items.title': '아쉬웠던 점',
        'items.body': '다음에 어떻게 할지',
        ...each({
          title: ['교육이 늦게 시작됐어요', '단가표 정리가 오래 걸렸어요', '사용률이 목표에 못 미쳤어요'],
          body: ['시작 전에 교육을 마쳐요', '구매팀과 먼저 정리해요', '쓰는 방법을 화면에 붙여요'],
        }),
      },
    },
    {
      layout: 'table',
      purpose: '후속 과제',
      priority: 1,
      section: '배운 점',
      guide: '남은 일을 누가 언제까지 할지 적어요.',
      fields: { h1: '과제', h2: '담당', h3: '기한', h4: '비고' },
      hints: {
        title: '네 가지가 남았어요',
        ...each({
          title: ['본부 전체로 넓히기', '단가표 매달 고치기', '사용률 다시 점검', '결과 공유회'],
          meta: ['영업기획팀', '구매팀', '영업기획팀', '영업본부'],
          value: ['1월', '매달', '12월', '11월'],
        }),
      },
    },
    closing('요청 사항', '요청 사항', 2, '받을 결정이나 지원이 있으면 적어요.', [
      '결정해 주실 일 (예: 본부 전체 확대 승인)',
      '함께 정해 주실 일 (예: 확대 예산)',
      '그 밖의 요청',
    ]),
  ],
}

/** 문제·장애 보고: 무슨 일이 있었는지, 영향, 원인, 한 일과 할 일. 결론(지금 상태)부터 */
const issue: Blueprint = {
  type: 'issue',
  name: '문제·장애 보고',
  description: '무슨 일인지, 원인과 대책을 알려요',
  storyline: ['영향', '경과', '원인', '대책'],
  showcase: ['영향', '경과', '원인', '재발 방지 대책'],
  defaultTitle: '문제 보고',
  examples: { title: '10월 21일 주문 시스템 장애 보고', ask: '재발 방지 예산 2,000만 원 승인' },
  recipes: [
    cover,
    summary(
      '한 줄 요약 (예: 주문 시스템이 2시간 멈췄고, 지금은 정상이에요)',
      ['무슨 일', '영향', '원인', '대책'],
      ['언제, 어디서, 무엇이 (한두 문장)', '누가 얼마나 영향을 받았는지 (숫자로)', '왜 일어났는지', '한 일과 할 일, 지금 상태'],
    ),
    {
      layout: 'kpi',
      purpose: '영향',
      priority: 1,
      guide: '영향을 숫자로, 확인한 시점과 함께 적어요.',
      hints: {
        title: '주문 1,240건이 늦어졌어요',
        ...each({
          value: ['2시간', '1,240건', '3곳'],
          title: ['멈춘 시간', '늦어진 주문', '항의한 고객사'],
          body: ['10월 21일 14:00~16:00', '모두 그날 처리', '담당자가 직접 연락'],
        }),
      },
    },
    {
      layout: 'timeline',
      purpose: '경과',
      priority: 2,
      focus: 'detail',
      guide: '알아챈 때부터 복구까지 시각을 적어요.',
      variant: 'steps',
      hints: {
        title: '두 시간 만에 복구했어요',
        ...each({ meta: ['14:00', '14:20', '15:10', '16:00'], title: ['처음 알아챔', '원인 찾음', '임시 조치', '정상 복구'] }),
      },
    },
    {
      layout: 'points',
      purpose: '원인',
      priority: 1,
      guide: '바로 원인과 그 뒤의 까닭까지 짚어요.',
      hints: {
        title: '저장 공간이 가득 찬 것을 몰랐어요',
        'items.title': '원인',
        'items.body': '왜 그랬는지',
        ...each({ title: ['저장 공간이 가득 찼어요', '경고가 울리지 않았어요', '점검표에 빠져 있었어요'] }),
      },
    },
    {
      layout: 'table',
      purpose: '재발 방지 대책',
      priority: 1,
      guide: '한 일과 할 일을 나눠, 담당과 기한을 적어요.',
      fields: { h1: '대책', h2: '담당', h3: '기한', h4: '상태' },
      hints: {
        title: '네 가지로 다시 일어나지 않게 해요',
        ...each({
          title: ['저장 공간 경고 켜기', '점검표에 넣기', '비상 연락망 고치기', '복구 훈련'],
          meta: ['IT운영팀', 'IT운영팀', '영업지원팀', 'IT운영팀'],
          value: ['10월 22일', '11월', '11월', '12월'],
          body: ['끝났어요', '진행 중', '진행 중', '예정'],
        }),
      },
    },
    closing('요청 사항', '요청 사항', 2, '대책에 필요한 결정이나 지원을 적어요.', [
      '결정해 주실 일 (예: 재발 방지 예산 승인)',
      '함께 정해 주실 일',
      '그 밖의 요청',
    ]),
  ],
}

// ---------- 알리고 나누기 ----------

/** 프로젝트 착수: 함께할 사람들과 목표, 범위, 일정, 역할을 맞춘다 */
const kickoff: Blueprint = {
  type: 'kickoff',
  name: '프로젝트 착수',
  description: '목표, 범위, 일정, 역할을 맞춰요',
  storyline: ['목표', '범위', '일정', '역할'],
  showcase: ['목표', '하는 일과 하지 않는 일', '일정', '역할과 담당'],
  defaultTitle: '프로젝트 착수 보고',
  examples: { title: '견적 자동화 프로젝트 착수 보고', ask: '추진 일정과 투입 인력 확정' },
  recipes: [
    cover,
    summary(
      '한 줄 요약 (예: 6개월 안에 견적 시간을 절반으로 줄여요)',
      ['왜', '목표', '범위', '일정'],
      ['이 프로젝트를 하는 이유', '끝났을 때 달라지는 것 (숫자로)', '하는 일과 하지 않는 일', '언제 시작해서 언제 끝나는지'],
    ),
    agenda,
    {
      layout: 'statement',
      purpose: '추진 배경',
      priority: 2,
      focus: 'context',
      guide: '왜 지금 이 일을 하는지 한 문장으로 적어요.',
      hints: { title: '이 프로젝트를 하는 이유를 한 문장으로', lead: '그렇게 보는 근거' },
    },
    {
      layout: 'kpi',
      purpose: '목표',
      priority: 1,
      guide: '끝났을 때 무엇으로 성공을 잴지 적어요.',
      hints: {
        title: '끝나면 이렇게 달라져요',
        ...each({
          value: ['50%', '3팀', '6개월'],
          title: ['줄일 견적 시간', '먼저 쓸 팀', '기간'],
          body: ['지금 6시간에서 3시간으로', '영업 1~3팀', '11월부터 4월까지'],
        }),
      },
    },
    {
      layout: 'compare',
      purpose: '하는 일과 하지 않는 일',
      priority: 1,
      guide: '하지 않는 일을 적어 두면 범위가 흔들리지 않아요.',
      fields: { leftTitle: '이번에 해요', rightTitle: '이번에는 안 해요' },
      hints: {
        title: '이번에 할 일과 하지 않을 일',
        'items.title': '하는 일',
        'items.body': '하지 않는 일',
        ...each({
          title: ['견적 양식 하나로 맞추기', '단가표 한곳에 모으기', '영업 1~3팀에 적용'],
          body: ['계약서 양식', '구매 시스템 바꾸기', '해외 영업팀'],
        }),
      },
    },
    {
      layout: 'timeline',
      purpose: '일정',
      priority: 1,
      guide: '중간 점검 날짜를 함께 정해요.',
      hints: { title: '4월에 모든 팀이 써요', ...each({ meta: ['11월', '12월', '2월', '4월'], title: ['착수', '설계 완료', '시범 운영', '모두 적용'] }) },
    },
    {
      layout: 'table',
      purpose: '역할과 담당',
      priority: 2,
      focus: 'detail',
      guide: '누가 무엇을 맡고, 얼마나 시간을 쓰는지 적어요.',
      fields: { h1: '역할', h2: '담당', h3: '시간', h4: '하는 일' },
      hints: {
        title: '네 팀이 함께해요',
        ...each({
          title: ['총괄', '설계', '개발', '현업 검증'],
          meta: ['영업기획팀', 'IT팀', 'IT팀', '영업 1팀'],
          value: ['50%', '100%', '100%', '20%'],
          body: ['일정과 결정', '화면과 흐름', '만들기와 시험', '써 보고 의견 내기'],
        }),
      },
    },
    {
      layout: 'process',
      purpose: '일하는 방식',
      priority: 3,
      focus: 'detail',
      guide: '언제 모이고 어디에 남기는지 정해요.',
      hints: {
        title: '매주 화요일에 모여 확인해요',
        ...each({ title: ['주간 회의', '진행 공유', '이슈 올리기', '월간 보고'], meta: ['매주 화요일', '매주 금요일', '생기는 대로', '매달 첫 주'] }),
      },
    },
    risks(2, undefined, {
      title: ['현업이 바빠 검증이 늦을 수 있어요', '할 일이 자꾸 늘 수 있어요', '기존 시스템과 맞지 않을 수 있어요'],
      body: ['검증 날짜를 미리 잡아 둬요', '더할 일은 주간 회의에서 정해요', '첫 달에 연결부터 시험해요'],
    }),
    closing('함께 정할 것', '오늘 정할 것', 1, '이 자리에서 정할 것을 분명히 적어요.', [
      '정해 주실 일 (예: 투입 인력 확정)',
      '함께 맞출 일 (예: 주간 회의 시간)',
      '그 밖의 요청',
    ]),
  ],
}

/** 조사·분석 보고: 시장, 경쟁사, 고객을 조사한 결과와 그래서 무엇을 할지 */
const research: Blueprint = {
  type: 'research',
  name: '조사·분석 보고',
  description: '시장, 경쟁사, 고객을 조사한 결과를 알려요',
  storyline: ['시장', '구성', '경쟁', '시사점'],
  showcase: ['시장 추이', '시장 구성', '경쟁사 위치', '시사점'],
  defaultTitle: '조사 보고',
  examples: { title: '중소 제조 품질 관리 시장 조사', ask: '시범 사업 검토 착수' },
  recipes: [
    cover,
    summary(
      '한 줄 결론 (예: 중소 제조 시장이 해마다 18%씩 커요)',
      ['조사 목적', '알게 된 것', '시사점', '제안'],
      ['무엇을 왜 조사했는지', '가장 중요한 발견 두세 가지', '그래서 우리에게 무슨 뜻인지', '다음에 할 일 (예: 시범 사업 검토)'],
    ),
    {
      layout: 'points',
      purpose: '조사 방법',
      priority: 3,
      focus: 'context',
      guide: '무엇을 얼마나 봤는지 적어 두면 믿고 들어요.',
      hints: {
        title: '세 가지로 조사했어요',
        'items.title': '방법',
        'items.body': '무엇을, 얼마나',
        ...each({ title: ['자료 조사', '고객 인터뷰', '설문'], body: ['협회 통계와 공시 자료', '중소 제조사 12곳', '담당자 140명 응답'] }),
      },
    },
    section('시장', '시장이 얼마나 크고 어떻게 움직이는지'),
    {
      layout: 'trend',
      purpose: '시장 추이',
      priority: 1,
      section: '시장',
      guide: '해마다의 숫자를 적고 출처를 함께 남겨요.',
      hints: {
        title: '5년 동안 시장이 두 배가 됐어요',
        unit: '억 원',
        ...each({ title: ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'], value: ['600', '700', '820', '960', '1,100', '1,200'] }),
      },
    },
    {
      layout: 'share',
      purpose: '시장 구성',
      priority: 2,
      focus: 'numbers',
      section: '시장',
      guide: '눈여겨볼 부분 하나를 강조해요.',
      hints: {
        title: '중소 제조가 시장의 절반이에요',
        unit: '억 원',
        ...each({ title: ['중소 제조', '대기업', '공공', '기타'], value: ['600', '360', '160', '80'] }),
      },
    },
    section('경쟁', '누가 어디쯤 있는지'),
    {
      layout: 'position',
      purpose: '경쟁사 위치',
      priority: 1,
      section: '경쟁',
      guide: '두 기준을 정하고 점수로 찍어요.',
      fields: { xAxis: '기능이 많음', yAxis: '도입이 빠름' },
      hints: { title: '빠르면서 기능도 많은 자리가 비어 있어요' },
    },
    {
      layout: 'table',
      purpose: '경쟁사 비교',
      priority: 3,
      focus: 'detail',
      section: '경쟁',
      guide: '견줄 항목을 같게 맞춰 한 줄씩 적어요.',
      fields: { h1: '회사', h2: '강점', h3: '가격', h4: '약점' },
      hints: {
        title: '세 회사 모두 도입이 느려요',
        ...each({
          title: ['A사', 'B사', 'C사', '우리'],
          meta: ['기능이 많아요', '값이 싸요', '대기업 사례가 많아요', '빨리 도입해요'],
          value: ['연 6,000만 원', '연 2,000만 원', '연 8,000만 원', '연 3,000만 원'],
          body: ['도입에 6개월', '분석 기능이 없어요', '중소기업엔 비싸요', '사례가 적어요'],
        }),
      },
    },
    section('시사점', '그래서 무엇을 할지'),
    {
      layout: 'points',
      purpose: '시사점',
      priority: 1,
      section: '시사점',
      guide: '조사 결과가 우리에게 무슨 뜻인지 적어요.',
      hints: {
        title: '중소 제조, 빠른 도입, 구독으로 가요',
        'items.title': '시사점',
        'items.body': '근거가 되는 숫자',
        ...each({ title: ['중소 제조부터 시작해요', '빠른 도입을 앞세워요', '값은 구독으로 받아요'] }),
      },
    },
    closing('다음에 할 일', '다음에 할 일', 2, '조사를 바탕으로 할 일이나 결정을 적어요.', [
      '정해 주실 일 (예: 시범 사업 검토 착수)',
      '함께 정해 주실 일',
      '그 밖의 요청',
    ]),
  ],
}

/** 지식 공유·교육: 사내 세미나, 배운 것 나누기, 새 도구나 방법 익히기. 결정이 아니라 기억할 것으로 끝난다 */
const study: Blueprint = {
  type: 'study',
  name: '지식 공유·교육',
  description: '배운 것과 일하는 요령을 나눠요',
  storyline: ['핵심', '전과 후', '방법', '정리'],
  showcase: ['핵심 내용', '전과 후', '따라 하는 순서', '정리'],
  defaultTitle: '지식 공유',
  examples: { title: '견적 자동 계산, 이렇게 쓰면 빨라요', lead: '영업본부 사내 세미나' },
  recipes: [
    plainCover,
    {
      layout: 'statement',
      purpose: '오늘의 한 줄',
      priority: 1,
      guide: '오늘 꼭 가져갈 한 가지를 먼저 말해요.',
      hints: { title: '오늘 꼭 전하고 싶은 한 가지를 한 문장으로', lead: '누구에게, 왜 도움이 되는지' },
    },
    { ...agenda, fields: { title: '오늘 다룰 것' } },
    {
      layout: 'points',
      purpose: '핵심 내용',
      priority: 1,
      guide: '세 가지 이내로, 한두 문장씩 적어요.',
      hints: {
        title: '세 가지만 기억하면 돼요',
        'items.title': '핵심',
        'items.body': '한두 문장 설명',
        ...each({ title: ['단가는 불러와요', '양식은 하나만', '검토는 한 번에'] }),
      },
    },
    {
      layout: 'compare',
      purpose: '전과 후',
      priority: 2,
      guide: '예전 방식과 새 방식을 줄마다 나란히 놓아요.',
      fields: { leftTitle: '예전에는', rightTitle: '이렇게 하면' },
      hints: {
        title: '이렇게 달라져요',
        'items.title': '예전 방식',
        'items.body': '새 방식',
        ...each({
          title: ['단가를 하나씩 찾아요', '합계를 손으로 맞춰요', '양식이 사람마다 달라요'],
          body: ['단가표에서 바로 불러와요', '합계가 저절로 맞아요', '한 양식으로 보내요'],
        }),
      },
    },
    {
      layout: 'process',
      purpose: '따라 하는 순서',
      priority: 1,
      guide: '처음 하는 사람이 따라 할 수 있게 단계로 적어요.',
      hints: {
        title: '네 단계면 견적이 끝나요',
        ...each({ title: ['고객 고르기', '품목 넣기', '할인 정하기', '보내기'], meta: ['1분', '3분', '1분', '1분'] }),
      },
    },
    {
      layout: 'imageText',
      purpose: '화면으로 보기',
      priority: 2,
      focus: 'detail',
      guide: '실제 화면을 넣고 어디를 보면 되는지 적어요.',
      hints: { title: '이 화면에서 시작해요', body: '어디를 누르고 무엇을 보면 되는지' },
    },
    {
      layout: 'case',
      purpose: '해 본 사례',
      priority: 3,
      guide: '먼저 써 본 팀의 결과가 있으면 넣어요.',
      hints: { client: '먼저 써 본 팀 (예: 영업 2팀)', title: '해 보니 얻은 것을 한 문장으로' },
    },
    closing(
      '정리',
      '오늘 기억할 것',
      1,
      '오늘 기억할 것을 세 줄로 정리해요.',
      ['기억할 것 (예: 단가는 단가표에서 불러와요)', '기억할 것 (예: 양식은 하나만 써요)', '더 알고 싶을 때 (예: 영업기획팀)'],
      ['한 줄 설명', '한 줄 설명', '없으면 이 줄을 지워요'],
    ),
  ],
}

/** 팀·업무 소개: 새로 온 분, 다른 부서, 인수인계 받을 분에게 팀이 하는 일과 함께 일하는 법을 알린다 */
const intro: Blueprint = {
  type: 'intro',
  name: '팀·업무 소개',
  description: '팀이 하는 일과 함께 일하는 법을 알려요',
  storyline: ['팀', '하는 일', '일하는 법', '연락'],
  showcase: ['숫자로 보는 팀', '하는 일', '일이 오가는 길', '이럴 때 찾아 주세요'],
  defaultTitle: '팀 소개',
  examples: { title: '영업기획팀을 소개해요', lead: '새로 오신 분께' },
  recipes: [
    plainCover,
    {
      layout: 'statement',
      purpose: '한 줄 소개',
      priority: 1,
      guide: '우리 팀을 한 문장으로 먼저 말해요.',
      hints: { title: '우리 팀을 한 문장으로 (예: 견적부터 계약까지 영업을 돕는 팀이에요)', lead: '누구를, 무엇으로 돕는지' },
    },
    {
      layout: 'kpi',
      purpose: '숫자로 보는 팀',
      priority: 2,
      focus: 'numbers',
      guide: '팀의 크기와 하는 일의 양을 숫자로 보여요.',
      hints: {
        title: '숫자로 보는 우리 팀',
        ...each({
          value: ['12명', '1,800건', '3팀'],
          title: ['함께 일하는 사람', '한 해에 보는 견적', '돕는 영업팀'],
          body: ['기획 8명, 분석 4명', '하루 7건 정도', '영업 1~3팀'],
        }),
      },
    },
    {
      layout: 'points',
      purpose: '하는 일',
      priority: 1,
      guide: '하는 일을 세 가지 이내로 적어요.',
      hints: {
        title: '세 가지 일을 해요',
        'items.title': '하는 일',
        'items.body': '무엇을, 누구를 위해',
        ...each({ title: ['견적과 단가 관리', '영업 숫자 분석', '제안서 돕기'] }),
      },
    },
    {
      layout: 'process',
      purpose: '일이 오가는 길',
      priority: 2,
      focus: 'detail',
      guide: '요청이 들어와서 답이 나가기까지를 단계로 적어요.',
      hints: {
        title: '요청부터 답까지 이틀이면 돼요',
        ...each({ title: ['요청 올리기', '담당 정하기', '검토', '답 보내기'], meta: ['요청한 분', '파트장, 그날', '담당, 하루', '담당, 그날'] }),
      },
    },
    {
      layout: 'table',
      purpose: '맡은 사람',
      priority: 2,
      focus: 'detail',
      guide: '업무마다 누구를 찾으면 되는지 적어요.',
      fields: { h1: '업무', h2: '담당', h3: '연락', h4: '비고' },
      hints: {
        title: '이 일은 이분께 물어보세요',
        ...each({
          title: ['견적 검토', '단가표', '실적 분석', '제안서'],
          meta: ['기획 1파트', '기획 2파트', '분석 파트', '기획 1파트'],
          value: ['내선 2101', '내선 2102', '내선 2103', '내선 2104'],
        }),
      },
    },
    {
      layout: 'timeline',
      purpose: '올해 계획',
      priority: 3,
      guide: '팀이 올해 바꾸려는 것을 짧게 적어요.',
      hints: {
        title: '올해 이렇게 바뀌어요',
        ...each({ meta: ['1분기', '2분기', '3분기', '4분기'], title: ['단가표 새로 짜기', '견적 자동 계산', '분석 화면 열기', '내년 계획'] }),
      },
    },
    closing(
      '이럴 때 찾아 주세요',
      '이럴 때 찾아 주세요',
      1,
      '언제, 어떻게 연락하면 되는지 적어요.',
      ['찾을 때 (예: 견적이나 단가가 궁금할 때)', '찾을 때 (예: 영업 숫자가 필요할 때)', '찾을 때 (예: 제안서를 같이 쓸 때)'],
      ['누구에게, 어떻게 연락하는지', '누구에게, 어떻게 연락하는지', '없으면 이 줄을 지워요'],
    ),
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
    { layout: 'statement', purpose: '메시지', priority: 1, guide: '가장 전하고 싶은 말을 적어요.' },
    { layout: 'points', purpose: '포인트', priority: 1, guide: '나란히 보여 줄 내용을 적어요.' },
    closing('결정 요청', '결정해 주실 것', 1, '받을 결정을 적어요. 없으면 이 장을 빼도 돼요.', ['결정해 주실 일', '함께 정해 주실 일', '그 밖의 요청']),
  ],
}

export const BLUEPRINTS: Record<DeckType, Blueprint> = {
  business,
  improve,
  decide,
  deal,
  plan,
  weekly,
  report,
  result,
  issue,
  kickoff,
  research,
  study,
  intro,
  blank,
}

/**
 * 마법사에서 고르는 묶음. 회사에서 PPT를 만드는 자리를 셋으로 나눴다:
 * 윗분께 결정을 받는 자리, 한 일을 알리는 자리, 알고 있는 것을 나누는 자리.
 * 묶음 안은 자주 쓰는 순서.
 */
export const DECK_GROUPS: { name: string; types: DeckType[] }[] = [
  { name: '제안하고 결정받기', types: ['business', 'improve', 'decide', 'deal', 'plan'] },
  { name: '진행과 결과 보고하기', types: ['weekly', 'report', 'result', 'issue'] },
  { name: '알리고 나누기', types: ['kickoff', 'research', 'study', 'intro'] },
]

/** 빈 발표를 뺀 모든 종류. 마법사의 묶음 순서 그대로 */
export const DECK_TYPES: DeckType[] = DECK_GROUPS.flatMap((g) => g.types)

/**
 * 듣는 사람. up은 더 챙기는 장(우선순위를 한 단계 올린다), down은 덜 챙기는 장(한 단계 내린다).
 * 우선순위 1인 장은 그대로 두고 2와 3 사이에서만 오르내린다.
 */
export const AUDIENCES: { id: Audience; name: string; description: string; up?: Focus[]; down?: Focus[] }[] = [
  { id: 'exec', name: '본부장·임원', description: '결론과 숫자 위주로, 장 수는 적게', up: ['numbers'], down: ['detail'] },
  { id: 'practitioner', name: '팀장', description: '근거와 실행 계획까지 자세히', up: ['detail'] },
  { id: 'peers', name: '팀 동료', description: '할 일과 진행 방법을 자세히', up: ['detail'], down: ['numbers'] },
  { id: 'partners', name: '다른 부서', description: '배경을 먼저 풀고, 부탁을 분명히', up: ['context'] },
  { id: 'mixed', name: '여러 분이 함께', description: '요약을 먼저, 자세한 내용은 뒤에' },
]

export const DURATIONS: { minutes: number; name: string }[] = [
  { minutes: 5, name: '5분' },
  { minutes: 10, name: '10분' },
  { minutes: 20, name: '20분' },
  { minutes: 30, name: '30분 이상' },
]

export const METHODS: { id: 'live' | 'remote' | 'send'; name: string; description: string }[] = [
  { id: 'live', name: '회의실 발표', description: '화면에 띄우고 말로 설명해요' },
  { id: 'remote', name: '화상 회의', description: '온라인 회의에서 화면을 공유해요' },
  { id: 'send', name: '자료로 보내기', description: '미리 보내서 혼자 읽게 해요' },
]
