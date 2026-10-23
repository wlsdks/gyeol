import { pageInfo } from '../deck/fields'
import { createDeck, emptyItem, makeSlide } from '../deck/generate'
import { createSampleDeck, SAMPLE_LOGOS } from '../deck/sample'
import type { Deck, DeckType, Item, Slide, ThemeId } from '../deck/types'
import type { SlideMode } from '../slides/context'
import { pageProps, ScaledSlide, SlideCanvas } from '../slides/SlideCanvas'

// 개발용: 모든 레이아웃을 한 화면에 늘어놓고 디자인을 점검한다. #/gallery?theme=navy&mode=preview&set=blank&type=deal

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
      { title: '3분기 매출이 목표보다 12% 많았어요', lead: '영업 2팀, 수주 확정 기준' },
    ), { highlight: 2 }),
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
  const deck = galleryDeck(params.get('set') ?? 'sample', theme, params)
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
