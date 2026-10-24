import { BLOCK_LOOK_IDS, BLOCKS, BLOCK_TYPES } from '../deck/blocks'
import { sampleBlock } from '../deck/blockSamples'
import { pageInfo } from '../deck/fields'
import { createDeck, makeSlide } from '../deck/generate'
import { LAYOUTS } from '../deck/layouts'
import { createSampleDeck } from '../deck/sample'
import { extraSlides, withItems, withOptions } from '../deck/showcase'
import type { BlockLook, BlockType, Deck, DeckTheme, DeckType, Slide, ThemeId, Tone } from '../deck/types'
import type { SlideMode } from '../slides/context'
import type { SlideActions } from '../slides/context'
import { pageProps, ScaledSlide, SlideCanvas } from '../slides/SlideCanvas'
import { fitBlocks } from '../slides/fitBlocks'
import { motionEngine } from '../motion/engine'
import { checkCombos, comboSlides } from './combos'
import { checkEdit } from './checkEdit'
import { clashes, failingHeights, heightsSource, measureAll, measureBlocks, mergeHeights, spanWidth } from './measureBlocks'

// 개발용: 모든 레이아웃을 한 화면에 늘어놓고 디자인을 점검한다. #/gallery?theme=navy&mode=preview&set=blank&type=deal
// &set=blocks 는 부품마다 넓은 칸과 좁은 칸에 넣어 본 부품 장. &types=ring,ratio 처럼 부품을 고르고, &bv=list 처럼 부품의 모양을 고를 수 있다.
// &fill=max 는 항목을 가장 많이, &fill=3 처럼 숫자면 그만큼(정한 범위 안에서). &bl=plain|card 는 부품의 바탕을 모두 그것으로 (잘리지 않는 높이를 잴 때, measureBlocks.ts)
// &variants=1 이면 장마다 레이아웃의 모든 모양을 늘어놓는다. &only=kpi,bars 처럼 레이아웃을 고를 수 있다.
// &tone=invert|accent 는 모든 장의 바탕을, &font=serif &size=large &footer=page &accent=C2410C 는 발표 전체 설정을 바꿔 본다.
// &hl=2 는 강조할 항목(일정은 지금 단계)을 고를 수 있는 장 모두에 같은 번호를 준다.
// set=edge 는 차트 장이 무너지기 쉬운 값(음수, 빈 값, 많은 항목, 같은 값)만 모아 본다.
// set=combos&seed=1&n=60 은 규칙이 받아들인 부품 조합을 seed마다 정해진 차례로 만들어 본다 (combos.ts의 checkCombos).

/** set=edge: 차트 장이 무너지기 쉬운 값들 (음수, 빈 값, 많은 항목, 모두 같은 값, 긴 이름) */
function edgeSlides(): Slide[] {
  const trend = (title: string, values: string[], fields: Record<string, string> = {}) =>
    withItems(makeSlide('trend'), values.map((value, i) => ({ title: `${i + 1}월`, value })), { title, ...fields })
  return [
    trend('성장률이 마이너스에서 돌아섰어요', ['-3%', '-1.5%', '△0.5%', '1%', '2.5%', '4%'], { unit: '%', target: '3' }),
    trend('열두 달 흐름', ['96', '101', '99', '108', '117', '131', '126', '134', '140', '138', '145', '152'], { unit: '억 원' }),
    trend('빈 달이 있어요', ['96', '', '99', '108', '', '131']),
    trend('값이 모두 같아요', ['50', '50', '50', '50']),
    trend('0부터 시작해요', ['0', '12', '30', '41', '38', '60'], { unit: '건' }),
    withItems(
      makeSlide('progress'),
      [
        { title: '거래처별 단가 이력을 한곳에 모으고 분기마다 다시 확인하기', meta: '영업기획팀과 구매팀, 12월 말', value: '100%' },
        { title: '견적 양식 통일', value: '65%', body: '검토 중' },
        { title: '승인 단계 줄이기', value: '30%', body: '보류' },
        { title: '현장 교육', value: '0%' },
        { title: '효과 점검', value: '' },
        { title: '결과 보고', value: '10%', body: '착수' },
        { title: '내년 계획', value: '0%', body: '시작 전' },
      ],
      { title: '일곱 과제, 상태를 비운 칸은 진행률로 짐작해요', source: '10월 3주 기준' },
    ),
    withItems(
      makeSlide('share'),
      [
        { title: '제조', value: '40%' },
        { title: '유통', value: '35%' },
        { title: '금융', value: '15%' },
        { title: '공공', value: '6%' },
        { title: '기타', value: '3%' },
        { title: '해외 시범 사업', value: '1%' },
      ],
      { title: '비율로 적은 여섯 항목', source: '9월 말 기준' },
    ),
    withOptions(withItems(
      makeSlide('share'),
      [
        { title: '인건비', value: '3,200' },
        { title: '장비', value: '0.4' },
        { title: '교육', value: '' },
      ],
      { title: '강조 없이, 아주 작은 조각과 빈 값', unit: '만 원' },
    ), { highlight: -1 }),
    withOptions(withItems(
      makeSlide('process'),
      [
        { title: '요청 접수', meta: '영업 담당', body: '고객 요청을 남겨요' },
        { title: '현장 확인과 사진 기록', body: '설치 자리를 직접 보고 사진으로 남겨 견적에 붙여요' },
        { title: '견적', meta: '영업 담당, 하루' },
        { title: '검토와 승인' },
        { title: '계약', meta: '영업본부, 사흘', body: '계약 조건을 확정해요' },
        { title: '사후 관리', body: '쓰는 모습을 살펴요' },
      ],
      { title: '여섯 단계, 긴 이름과 빈 칸' },
    ), { highlight: 5 }),
    withItems(
      makeSlide('funnel'),
      [
        { title: '홈페이지 방문', value: '12,400' },
        { title: '자료 내려받기', value: '1,860' },
        { title: '상담 신청', value: '310' },
        { title: '현장 방문', value: '' },
        { title: '제안', value: '42' },
        { title: '계약', value: '3', meta: '평균 1.2억 원' },
      ],
      { title: '여섯 단계, 큰 차이와 빈 값', unit: '건' },
    ),
  ]
}

/**
 * 부품마다 두 장: 혼자 한 줄을 다 쓸 때와, 가장 좁은 칸에 다른 부품과 함께 낮은 줄에 들어갈 때.
 * 무너지기 쉬운 것은 좁고 낮은 칸이다.
 */
function blockSlides(fill: string | null, only?: string[], variant?: string | null, look?: string | null): Slide[] {
  return BLOCK_TYPES.flatMap((type, n) => {
    if (only && !only.includes(type)) return []
    const spec = BLOCKS[type]
    const sample = sampleBlock(type)
    // &fill=max: 항목을 가장 많이 넣었을 때, &fill=3: 세 개. 예시 항목을 되풀이해 채운다
    const count = !spec.items ? 0 : fill === 'max' ? spec.items.max : Math.min(spec.items.max, Math.max(spec.items.min, Number(fill) || 0))
    const items =
      count && sample.items.length
        ? Array.from({ length: count }, (_, i) => ({ ...sample.items[i % sample.items.length], id: `${type}-it${i}` }))
        : sample.items
    // &bv=list: 그 모양이 있는 부품은 그 모양으로
    const v = variant && spec.variants?.some((x) => x.id === variant) ? { variant } : {}
    const lk = BLOCK_LOOK_IDS.find((x) => x === look) ? { look: look as BlockLook } : {}
    const b = (id: string) => ({ ...sample, ...v, ...lk, items, id: `${type}-${id}` })
    const filler = (id: string, t: BlockType) => ({ ...sampleBlock(t), id: `${type}-${id}` })
    const narrow = 12 - spec.minSpan
    const partner: BlockType = narrow >= 6 ? 'bullets' : narrow >= 4 ? 'callout' : 'number'
    return [
      { ...makeSlide('compose'), id: `bk-${n}-a`, fields: { title: `${spec.name}: 한 줄을 다 쓸 때` }, rows: [{ id: 'r1', blocks: [b('a')] }] },
      {
        ...makeSlide('compose'),
        id: `bk-${n}-b`,
        fields: { title: `${spec.name}: 좁은 칸, 낮은 줄` },
        rows: [
          { id: 'r1', blocks: [filler('m', 'message')] },
          { id: 'r2', blocks: narrow > 0 ? [b('b'), filler('p', partner)] : [b('b')], spans: narrow > 0 ? [spec.minSpan, narrow] : [12] },
          ...(narrow > 0 ? [] : [{ id: 'r3', blocks: [filler('n1', 'number'), filler('n2', 'number'), filler('n3', 'callout')] }]),
        ],
      },
      // 4칸까지 좁아지는 부품은 셋이 나란히 들어갈 때도
      ...(spec.minSpan <= 4
        ? [
            {
              ...makeSlide('compose'),
              id: `bk-${n}-c`,
              fields: { title: `${spec.name}: 셋이 나란히` },
              rows: [
                { id: 'r1', blocks: [filler('m', 'message')] },
                { id: 'r2', blocks: [b('c1'), b('c2'), b('c3')], spans: [4, 4, 4] },
              ],
            },
          ]
        : []),
    ]
  })
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
  if (set === 'edge') return { ...deck, theme: { id: theme }, slides: edgeSlides() }
  if (set === 'blocks') return { ...deck, theme: { id: theme }, slides: blockSlides(params.get('fill'), params.get('types')?.split(','), params.get('bv'), params.get('bl')) }
  if (set === 'combos') return { ...deck, theme: { id: theme }, slides: comboSlides(Number(params.get('seed')) || 1, Number(params.get('n')) || 40, { theme: { size: params.get('size') ?? undefined } }, params.get('mode') === 'edit').map((c) => c.slide) }
  return { ...deck, theme: { id: theme }, slides: [...deck.slides, ...extraSlides()] }
}

/** 편집 보기에서 칸을 편집기처럼 그리려고 (적어도 바뀌지 않는다) */
const NO_ACTIONS: SlideActions = { setField() {}, setItem() {}, removeItem() {}, updateBlock() {} }

export function Gallery() {
  const params = new URLSearchParams(location.hash.split('?')[1] ?? '')
  // 부품의 잘리지 않는 높이를 재는 도구 (measureBlocks.ts). 콘솔에서 await measureBlocks()
  if (params.get('set') === 'blocks') Object.assign(window, { measureAll, measureBlocks, mergeHeights, heightsSource, clashes, failingHeights, spanWidth, fitBlocks })
  // 부품 조합 시험 (combos.ts). 콘솔에서 await checkCombos()
  if (params.get('set') === 'combos') Object.assign(window, { checkCombos, comboSlides })
  // 편집 칸 점검 (checkEdit.ts). mode=edit에서 콘솔로 await checkEdit()
  if (params.get('mode') === 'edit') Object.assign(window, { checkEdit })
  // 움직임 보기: 콘솔에서 playSlide(0, 'lively')로 그 장을 발표할 때처럼 움직인다
  Object.assign(window, { playSlide: (i: number, level: 'calm' | 'lively' = 'calm') => motionEngine().play(document.querySelectorAll('.slide')[i], level) })
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
            actions={mode === 'edit' ? NO_ACTIONS : undefined}
            {...pageProps(info, origin.get(slide.id) ?? slide.id)}
          />
        </ScaledSlide>
      ))}
    </div>
  )
}
