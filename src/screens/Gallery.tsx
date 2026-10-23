import { pageInfo } from '../deck/fields'
import { createDeck, emptyItem, makeSlide } from '../deck/generate'
import { LAYOUTS } from '../deck/layouts'
import { createSampleDeck, SAMPLE_LOGOS } from '../deck/sample'
import type { Deck, DeckType, Item, Slide, ThemeId } from '../deck/types'
import type { SlideMode } from '../slides/context'
import { pageProps, ScaledSlide, SlideCanvas } from '../slides/SlideCanvas'

// 개발용: 모든 레이아웃을 한 화면에 늘어놓고 디자인을 점검한다. #/gallery?theme=navy&mode=preview&set=blank&type=deal
// &variants=1 이면 장마다 레이아웃의 모든 모양을 늘어놓는다. &only=kpi,bars 처럼 레이아웃을 고를 수 있다.

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
  const slides =
    params.get('variants') === '1'
      ? picked.flatMap((s) => (LAYOUTS[s.layout].variants ?? [{ id: 'base' }]).map((v) => ({ ...s, id: `${s.id}-${v.id}`, variant: v.id })))
      : picked
  const deck = { ...base, slides }
  const info = pageInfo(deck.slides)
  return (
    <div className="gallery">
      {deck.slides.map((slide) => (
        <ScaledSlide key={slide.id} width={960} className="gallery-slide">
          <SlideCanvas
            deck={deck}
            slide={slide}
            mode={mode}
            {...pageProps(info, slide.id)}
          />
        </ScaledSlide>
      ))}
    </div>
  )
}
