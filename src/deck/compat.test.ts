import { describe, expect, it } from 'vitest'
import { useDeck } from '../store/deckStore'
import { BLOCK_EFFECT_IDS, BLOCK_FROM_IDS, BLOCK_LOOK_IDS, BLOCK_SPEED_IDS, BLOCK_TYPES, BLOCK_WHEN_IDS, BLOCKS } from './blocks'
import { sampleBlock } from './blockSamples'
import { DECK_TYPES } from './blueprints'
import { knownOnly, unknownParts } from './compat'
import { createDeck, makeSlide } from './generate'
import { createSampleDeck } from './sample'
import { showcaseSlides } from './showcase'
import { FONTS, fontOf } from './themes'
import type { Block, BlockRow, Deck, FontId, Slide } from './types'

const compose = (...blocks: Block[]): Slide => ({ ...makeSlide('compose'), rows: [{ id: 'r1', blocks }] })
const withSlides = (...slides: Slide[]): Deck => ({ ...createSampleDeck(), slides })

describe('새 버전에서 만든 발표 알아보기', () => {
  it('이 버전이 만드는 발표는 모두 그대로 연다', () => {
    expect(unknownParts(createSampleDeck())).toBe(0)
    expect(unknownParts(withSlides(...showcaseSlides()))).toBe(0)
    for (const type of DECK_TYPES) {
      const deck = createDeck({ type, audience: 'mixed', minutes: 30, method: 'live', title: '', org: '', presenter: '', theme: 'white' })
      expect(unknownParts(deck), type).toBe(0)
    }
    // 모든 부품의 모든 모양, 바탕, 움직임
    for (const type of BLOCK_TYPES) {
      const b = sampleBlock(type)
      for (const variant of BLOCKS[type].variants?.map((v) => v.id) ?? [undefined]) {
        for (const look of BLOCK_LOOK_IDS) {
          for (const effect of BLOCK_EFFECT_IDS) expect(unknownParts(withSlides(compose({ ...b, variant, look, effect }))), type).toBe(0)
        }
      }
    }
    // 나오는 때, 빠르기, 들어오는 쪽
    const t = sampleBlock('text')
    for (const when of BLOCK_WHEN_IDS) for (const speed of BLOCK_SPEED_IDS) for (const from of BLOCK_FROM_IDS) expect(unknownParts(withSlides(compose({ ...t, effect: 'rise', when, speed, from })))).toBe(0)
  })

  it('모르는 부품, 모양, 움직임, 장, 저장 형식을 센다', () => {
    const text = sampleBlock('text')
    const raw = (b: Record<string, unknown>) => b as unknown as Block
    expect(unknownParts(withSlides(compose(text, raw({ id: 'x', type: 'hologram', fields: { body: '글' }, items: [] }))))).toBe(1)
    expect(unknownParts(withSlides(compose(raw({ ...text, effect: 'spiral', look: 'glass' }))))).toBe(2)
    expect(unknownParts(withSlides(compose(raw({ ...text, when: 'later', speed: 'warp' }))))).toBe(2)
    expect(unknownParts(withSlides(compose(raw({ ...sampleBlock('bullets'), variant: 'cards3d' }))))).toBe(1)
    expect(unknownParts(withSlides(compose(raw({ ...sampleBlock('bullets'), items: [{ id: 'i', title: '하나', color: 'red' }] }))))).toBe(1)
    expect(unknownParts(withSlides({ ...makeSlide('kpi'), layout: 'roadmap' as Slide['layout'] }))).toBe(1)
    expect(unknownParts({ ...createSampleDeck(), version: 2 as 1 })).toBe(1)
    expect(unknownParts({ ...createSampleDeck(), theme: { id: 'forest' as 'white' } })).toBe(1)
    // 정한 개수(한 줄에 셋)를 넘는 부품: 예전 버전이면 빼고 저장한다
    expect(unknownParts(withSlides(compose(...[1, 2, 3, 4].map((n) => ({ ...text, id: `t${n}` })))))).toBe(1)
    // 줄과 부품에 새로 더한 값: 예전 버전이 고치면 빼고 저장하게 된다. 줄 높이 비중은 이 버전이 아는 범위만
    const rowsOf = (...rows: Record<string, unknown>[]) => withSlides({ ...makeSlide('compose'), rows: rows as unknown as BlockRow[] })
    expect(unknownParts(rowsOf({ id: 'r1', blocks: [text], tilt: 3 }))).toBe(1)
    expect(unknownParts(withSlides(compose(raw({ ...text, glow: true }))))).toBe(1)
    expect(unknownParts(rowsOf({ id: 'r1', blocks: [text], grow: 40 }, { id: 'r2', blocks: [{ ...text, id: 't2' }], grow: 60 }))).toBe(0)
    expect(unknownParts(rowsOf({ id: 'r1', blocks: [text], grow: 250 }))).toBe(1)
    // 이음표는 이 버전이 아는 모양만
    expect(unknownParts(rowsOf({ id: 'r1', blocks: [{ ...text, link: 'arrow' }, { ...text, id: 't2' }], link: 'plus' }, { id: 'r2', blocks: [{ ...text, id: 't3' }] }))).toBe(0)
    expect(unknownParts(rowsOf({ id: 'r1', blocks: [{ ...text, link: 'spiral' }, { ...text, id: 't2' }] }))).toBe(1)
    // 꼴이 망가진 값은 사람이 넣은 것이 아니라 세지 않는다
    expect(unknownParts(withSlides(compose(raw({ ...text, fields: { body: '글', bad: 3 } }))))).toBe(0)
  })

  it('모르는 발표 종류와 듣는 사람은 세지 않는다', () => {
    // 종류와 듣는 사람은 장을 처음 만들 때만 쓰고, 예전 버전도 고쳐 저장할 때 값을 그대로 둔다(잃는 글이 없다).
    // 이름은 내 발표 목록에서 비고, AI에게는 빈 발표와 '여러 분이 함께'로 보인다(share.test.ts)
    const meta = { ...createSampleDeck().meta, type: 'townhall', audience: 'board' } as unknown as Deck['meta']
    expect(unknownParts({ ...createSampleDeck(), meta })).toBe(0)
  })

  it('아는 것만 남긴 사본은 그대로 열리고, 아는 부품의 글은 다 남는다', () => {
    const text = { ...sampleBlock('text'), fields: { body: '남을 글' } }
    const deck = withSlides(
      makeSlide('cover'),
      compose(text, { id: 'x', type: 'hologram', fields: { body: '새 부품' }, items: [] } as unknown as Block),
      { ...makeSlide('kpi'), layout: 'roadmap' as Slide['layout'] },
    )
    const before = structuredClone(deck)
    const known = knownOnly(deck)
    expect(unknownParts(known)).toBe(0)
    expect(known.slides.map((s) => s.layout)).toEqual(['cover', 'compose'])
    expect(known.slides[1].rows?.[0].blocks).toEqual([text])
    expect(deck).toEqual(before)
  })

  it('모르는 글꼴은 세지 않는다: 기본 글꼴로 그리고, 값은 고칠 때까지 그대로 남는다', () => {
    // 글꼴은 그리는 법만 바뀌고 글이나 장을 잃지 않는다. 열지 못하게 막을 까닭이 없다
    for (const f of FONTS) expect(unknownParts({ ...createSampleDeck(), theme: { id: 'white', font: f.id } }), f.id).toBe(0)
    const newer = { ...createSampleDeck(), theme: { id: 'navy' as const, font: 'nanum' as FontId } }
    expect(unknownParts(newer)).toBe(0)
    expect(fontOf(newer.theme)).toBe('sans')
    expect(fontOf({ id: 'white', font: 'constructor' as FontId })).toBe('sans')
    useDeck.getState().open(newer)
    expect(useDeck.getState().deck?.theme.font).toBe('nanum')
    useDeck.getState().close()
  })

  it('편집기는 그런 발표를 열지 않고 들고만 있다', () => {
    const newer = withSlides(compose({ id: 'x', type: 'hologram', fields: { body: '새 부품' }, items: [] } as unknown as Block))
    useDeck.getState().open(newer)
    expect(useDeck.getState().deck).toBeNull()
    expect(useDeck.getState().newer).toBe(newer)
    const sample = createSampleDeck()
    useDeck.getState().open(sample)
    expect(useDeck.getState().deck?.id).toBe(sample.id)
    expect(useDeck.getState().newer).toBeNull()
    useDeck.getState().close()
  })
})
