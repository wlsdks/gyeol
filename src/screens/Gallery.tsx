import { pageInfo } from '../deck/fields'
import { createDeck, emptyItem, makeSlide } from '../deck/generate'
import { LAYOUTS } from '../deck/layouts'
import { createSampleDeck, SAMPLE_LOGOS } from '../deck/sample'
import type { Deck, DeckTheme, DeckType, Item, Slide, ThemeId, Tone } from '../deck/types'
import type { SlideMode } from '../slides/context'
import { pageProps, ScaledSlide, SlideCanvas } from '../slides/SlideCanvas'

// 개발용: 모든 레이아웃을 한 화면에 늘어놓고 디자인을 점검한다. #/gallery?theme=navy&mode=preview&set=blank&type=deal
// &variants=1 이면 장마다 레이아웃의 모든 모양을 늘어놓는다. &only=kpi,bars 처럼 레이아웃을 고를 수 있다.
// &tone=invert|accent 는 모든 장의 바탕을, &font=serif &size=large &footer=page &accent=C2410C 는 발표 전체 설정을 바꿔 본다.
// &hl=2 는 강조할 항목(일정은 지금 단계)을 고를 수 있는 장 모두에 같은 번호를 준다.

function withItems(slide: Slide, items: Partial<Item>[], fields: Record<string, string> = {}): Slide {
  return { ...slide, fields: { ...slide.fields, ...fields }, items: items.map((it) => ({ ...emptyItem(), ...it })) }
}

function withOptions(slide: Slide, options: Slide['options']): Slide {
  return { ...slide, options: { ...slide.options, ...options } }
}

function extraSlides(): Slide[] {
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

function galleryDeck(set: string, theme: ThemeId, params: URLSearchParams): Deck {
  if (set === 'blank') {
    const deck = createDeck({
      type: (params.get('type') as DeckType | null) ?? 'business',
      audience: 'mixed',
      minutes: 30,
      method: 'live',
      title: '',
      org: '',
      presenter: '',
      theme,
    })
    return deck
  }
  const deck = createSampleDeck()
  return { ...deck, theme: { id: theme }, slides: [...deck.slides, ...extraSlides()] }
}

export function Gallery() {
  const params = new URLSearchParams(location.hash.split('?')[1] ?? '')
  const theme = (params.get('theme') ?? 'white') as ThemeId
  const mode = (params.get('mode') ?? 'final') as SlideMode
  const base = galleryDeck(params.get('set') ?? 'sample', theme, params)
  const only = params.get('only')?.split(',')
  const picked = only ? base.slides.filter((s) => only.includes(s.layout)) : base.slides
  // 모양마다 늘어놓은 장은 원래 장의 쪽 번호와 단락을 그대로 쓴다. 단락이 겹쳐 세지지 않게
  const origin = new Map<string, string>()
  const slides =
    params.get('variants') === '1'
      ? picked.flatMap((s) =>
          (LAYOUTS[s.layout].variants ?? [{ id: 'base' }]).map((v) => {
            origin.set(`${s.id}-${v.id}`, s.id)
            return { ...s, id: `${s.id}-${v.id}`, variant: v.id }
          }),
        )
      : picked
  const tone = params.get('tone') as Tone | null
  const hl = params.get('hl')
  const look: Partial<DeckTheme> = {}
  for (const k of ['font', 'size', 'footer'] as const) {
    const v = params.get(k)
    if (v) (look as Record<string, string>)[k] = v
  }
  const accent = params.get('accent')
  if (accent) look.accent = `#${accent}`
  const deck = {
    ...base,
    theme: { ...base.theme, ...look },
    slides: slides.map((s) => ({
      ...s,
      options: {
        ...s.options,
        ...(tone ? { tone } : {}),
        ...(hl !== null && LAYOUTS[s.layout].highlight ? { highlight: Number(hl) } : {}),
      },
    })),
  }
  const info = pageInfo(picked)
  return (
    <div className="gallery">
      {deck.slides.map((slide) => (
        <ScaledSlide key={slide.id} width={960} className="gallery-slide">
          <SlideCanvas
            deck={deck}
            slide={slide}
            mode={mode}
            {...pageProps(info, origin.get(slide.id) ?? slide.id)}
          />
        </ScaledSlide>
      ))}
    </div>
  )
}
