import { emptyItem, makeSlide } from './generate'
import { createSampleDeck, SAMPLE_LOGOS } from './sample'
import type { Item, Slide } from './types'

/*
 * 레이아웃마다 내용을 채운 예시 장. 장 모음 화면과 개발용 갤러리가 같이 쓴다.
 * 예시 발표(sample.ts)에 없는 레이아웃을 채운다. 회사, 사람, 숫자는 모두 지어낸 것이다.
 */

export function withItems(slide: Slide, items: Partial<Item>[], fields: Record<string, string> = {}): Slide {
  return { ...slide, fields: { ...slide.fields, ...fields }, items: items.map((it) => ({ ...emptyItem(), ...it })) }
}

export function withOptions(slide: Slide, options: Slide['options']): Slide {
  return { ...slide, options: { ...slide.options, ...options } }
}

export function extraSlides(): Slide[] {
  return [
    withOptions(withItems(
      makeSlide('bars'),
      [
        { title: '1분기', meta: '억 원', value: '96' },
        { title: '2분기', meta: '억 원', value: '104' },
        { title: '3분기', meta: '억 원', value: '131' },
        { title: '목표', meta: '억 원', value: '117' },
      ],
      { title: '3분기 매출이 목표보다 12% 많았어요', lead: '영업 2팀, 수주 확정 기준', source: '영업관리 시스템, 9월 말 기준' },
    ), { highlight: 2 }),
    withItems(
      makeSlide('scorecard'),
      [
        { title: '매출', meta: '117억 원', value: '131억 원', body: '신규 고객 2곳 수주' },
        { title: '영업이익', meta: '14억 원', value: '15.2억 원' },
        { title: '신규 고객', meta: '5곳', value: '4곳', body: '1곳은 4분기로 넘어감' },
        { title: '재계약률', meta: '90%', value: '93%' },
      ],
      { title: '네 지표 중 세 개가 목표를 넘었어요', source: '영업관리 시스템, 9월 말 기준' },
    ),
    withItems(
      makeSlide('bridge'),
      [
        { title: '신규 고객', value: '+9', meta: '2곳 수주' },
        { title: '단가 인상', value: '+7' },
        { title: '기존 고객 이탈', value: '-2', meta: '1곳 해지' },
      ],
      {
        title: '신규 고객과 단가로 목표보다 14억 원 더 팔았어요',
        startTitle: '목표',
        startValue: '117',
        endTitle: '실적',
        unit: '억 원',
        source: '영업관리 시스템, 9월 말 기준',
      },
    ),
    withItems(
      makeSlide('trend'),
      [
        { title: '4월', value: '96' },
        { title: '5월', value: '101' },
        { title: '6월', value: '99' },
        { title: '7월', value: '108' },
        { title: '8월', value: '117' },
        { title: '9월', value: '131' },
      ],
      { title: '여름부터 매출이 꾸준히 늘었어요', lead: '신규 고객 2곳이 8월부터 반영됐어요', unit: '억 원', target: '115', source: '영업관리 시스템, 9월 말 기준' },
    ),
    withItems(
      makeSlide('progress'),
      [
        { title: '견적 자동 계산', meta: '영업기획팀, 10월', value: '100%', body: '완료' },
        { title: '단가표 공유', meta: '구매팀, 11월', value: '80%', body: '진행 중' },
        { title: '승인 단계 줄이기', meta: '영업본부, 11월', value: '40%', body: '2주 지연' },
        { title: '현장 교육', meta: '교육팀, 12월', value: '20%', body: '진행 중' },
        { title: '효과 점검', meta: '영업기획팀, 1월', value: '0%', body: '예정' },
      ],
      { title: '다섯 과제 중 하나가 2주 늦어지고 있어요', source: '10월 3주 기준' },
    ),
    withItems(
      makeSlide('share'),
      [
        { title: '제조', value: '58', meta: '신규 2곳 포함' },
        { title: '유통', value: '39' },
        { title: '금융', value: '21' },
        { title: '공공', value: '13' },
      ],
      { title: '매출의 절반 가까이가 제조에서 나와요', unit: '억 원', source: '영업관리 시스템, 9월 말 기준' },
    ),
    withOptions(withItems(
      makeSlide('process'),
      [
        { title: '요청 접수', meta: '영업 담당, 당일', body: '고객 요청을 시스템에 남겨요' },
        { title: '견적 작성', meta: '영업 담당, 하루', body: '단가표로 견적을 바로 계산해요' },
        { title: '검토와 승인', meta: '팀장, 반나절', body: '세 단계를 한 번으로 줄여요' },
        { title: '고객에게 보내기', meta: '영업 담당, 당일', body: '정해진 양식으로 보내요' },
      ],
      { title: '견적이 나가기까지 네 단계, 이틀이면 돼요', lead: '지금은 같은 일에 닷새가 걸려요' },
    ), { highlight: 2 }),
    withItems(
      makeSlide('funnel'),
      [
        { title: '첫 만남', value: '120', meta: '전시회와 소개' },
        { title: '제안', value: '48' },
        { title: '협상', value: '20' },
        { title: '계약', value: '9', meta: '평균 4.8억 원' },
      ],
      { title: '제안까지 간 고객 다섯 중 한 곳이 계약했어요', unit: '곳', source: '영업관리 시스템, 1~9월' },
    ),
    withOptions(withItems(
      makeSlide('table'),
      [
        { title: '견적 양식 통일', meta: '영업기획팀', value: '11월', body: '팀마다 다른 양식을 하나로' },
        { title: '단가표 공유', meta: '구매팀', value: '12월', body: '분기마다 새로 올림' },
        { title: '승인 단계 줄이기', meta: '영업본부', value: '1월', body: '세 단계를 두 단계로' },
        { title: '효과 점검', meta: '영업기획팀', value: '2월', body: '견적 한 건에 드는 시간을 다시 잼' },
      ],
      { title: '네 가지를 2월까지 끝내요', h1: '과제', h2: '담당', h3: '기한', h4: '비고' },
    ), { highlight: 0 }),
    withItems(
      makeSlide('table'),
      [
        { title: '수도권', meta: '58억 원', value: '+14%', body: '신규 고객 2곳' },
        { title: '충청권', meta: '31억 원', value: '+6%' },
        { title: '영남권', meta: '27억 원', value: '−3%', body: '큰 계약 1건이 4분기로' },
        { title: '호남권', meta: '15억 원', value: '+2%' },
        { title: '합계', meta: '131억 원', value: '+7%' },
      ],
      { title: '수도권이 전체 성장을 이끌었어요', h1: '권역', h2: '3분기 매출', h3: '지난해보다', h4: '비고', source: '영업관리 시스템, 9월 말 기준' },
    ),
    withItems(
      makeSlide('matrix'),
      [
        { title: '틈틈이 하기', body: '견적 양식 통일, 단가표 공유 폴더' },
        { title: '바로 하기', body: '견적 자동 계산, 승인 단계 줄이기' },
        { title: '미루기', body: '외부 견적 시스템 도입' },
        { title: '계획해서 하기', body: '고객사별 단가 이력 관리' },
      ],
      { title: '쉽고 효과가 큰 두 가지부터 시작해요', yAxis: '실행하기 쉬움', xAxis: '효과가 큼' },
    ),
    withItems(makeSlide('kpi'), [{ value: '112%', title: '3분기 목표 달성률', body: '목표 117억 원, 실적 131억 원' }], {
      title: '3분기 목표를 넘겼어요',
    }),
    withItems(
      makeSlide('case'),
      [
        { value: '38%', title: '검사 시간 단축' },
        { value: '3개월', title: '구축 기간' },
      ],
      {
        client: '자동차 부품사 대성정밀',
        title: '같은 구성으로 작년에 수주해서 3개월 만에 구축했어요',
        body: '검사 자동화와 원인 분석을 함께 제안했고, 경쟁사보다 15% 비쌌지만 구축 기간으로 설득했어요.',
        quote: '라인을 세우지 않고 바꿀 수 있다는 점이 결정적이었어요.',
        image: SAMPLE_LOGOS[0],
      },
    ),
    withItems(
      makeSlide('logos'),
      SAMPLE_LOGOS.map((image) => ({ image })),
      { title: '함께한 제조 고객사' },
    ),
  ]
}

/** 예시 발표의 장과 덧붙인 예시 장. 모든 레이아웃이 적어도 한 번 나온다. */
export function showcaseSlides(): Slide[] {
  return [...createSampleDeck().slides, ...extraSlides()]
}
