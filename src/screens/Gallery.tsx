import { pageInfo } from '../deck/fields'
import { createDeck, emptyItem, makeSlide } from '../deck/generate'
import { createSampleDeck } from '../deck/sample'
import type { Deck, Item, Slide, ThemeId } from '../deck/types'
import type { SlideMode } from '../slides/context'
import { pageProps, ScaledSlide, SlideCanvas } from '../slides/SlideCanvas'

// 개발용: 모든 레이아웃을 한 화면에 늘어놓고 디자인을 점검한다. #/gallery?theme=navy&mode=preview&set=blank

function withItems(slide: Slide, items: Partial<Item>[], fields: Record<string, string> = {}): Slide {
  return { ...slide, fields: { ...slide.fields, ...fields }, items: items.map((it) => ({ ...emptyItem(), ...it })) }
}

function extraSlides(): Slide[] {
  return [
    withItems(
      makeSlide('bars'),
      [
        { title: '우리 제품', meta: '도입 6개월', value: '1.4%' },
        { title: '업계 평균', meta: '2025년 조사', value: '2.9%' },
        { title: '도입 전', meta: '한빛제조', value: '3.2%' },
      ],
      { title: '불량률은 업계 평균의 절반 수준이에요', lead: '같은 기간, 같은 공정 기준으로 비교했어요.' },
    ),
    withItems(makeSlide('kpi'), [{ value: '2.1억', title: '연간 절감 비용', body: '불량 처리와 보고 업무를 합친 금액' }], {
      title: '한 해에 이만큼 아낄 수 있어요',
    }),
    withItems(
      makeSlide('points'),
      [
        { title: '현장 진단', body: '지금 쓰는 검사 양식과 기록 방식을 그대로 옮겨요.' },
        { title: '시범 운영', body: '라인 두 곳에서 먼저 써 보고 고칠 점을 찾아요.' },
        { title: '전 라인 확대', body: '교육과 함께 모든 라인에 적용해요.' },
        { title: '운영 지원', body: '전담 매니저가 매달 결과를 함께 봐요.' },
      ],
      { title: '네 단계로 함께 진행해요' },
    ),
  ]
}

function galleryDeck(set: string, theme: ThemeId): Deck {
  if (set === 'blank') {
    const deck = createDeck({
      type: 'proposal',
      audience: 'mixed',
      minutes: 45,
      method: 'live',
      title: '',
      customer: '',
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
  const deck = galleryDeck(params.get('set') ?? 'sample', theme)
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
