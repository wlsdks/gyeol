import { describe, expect, it } from 'vitest'
import { AUDIENCES, BLUEPRINTS, DECK_TYPES, DURATIONS } from './blueprints'
import { createDeck, planRecipes, targetCount } from './generate'

describe('planRecipes', () => {
  it('발표 시간에 맞는 장 수를 넘지 않는다', () => {
    for (const type of DECK_TYPES) {
      for (const { id: audience } of AUDIENCES) {
        for (const { minutes } of DURATIONS) {
          const plan = planRecipes(type, audience, minutes)
          const required = BLUEPRINTS[type].recipes.filter(
            (r) => r.priority === 1 && (!r.audience || r.audience.includes(audience)),
          ).length
          expect(plan.length).toBeLessThanOrEqual(Math.max(targetCount(minutes), required))
        }
      }
    }
  })

  it('우선순위 1인 장은 빼지 않는다', () => {
    const plan = planRecipes('proposal', 'exec', 10)
    expect(plan.map((r) => r.purpose)).toEqual(['표지', '핵심 요약', '고객의 과제', '해결 방안', '기대 효과', '투자 비용', '다음 단계'])
  })

  it('임원 대상이면 핵심 요약이 표지 바로 뒤에 온다', () => {
    const plan = planRecipes('proposal', 'exec', 30)
    expect(plan[1].purpose).toBe('핵심 요약')
    expect(plan.some((r) => r.layout === 'agenda')).toBe(false)
  })

  it('실무자 대상이면 제품 화면이 들어가고 핵심 요약은 빠진다', () => {
    const plan = planRecipes('proposal', 'practitioner', 45)
    expect(plan.some((r) => r.purpose === '제품 화면')).toBe(true)
    expect(plan.some((r) => r.purpose === '핵심 요약')).toBe(false)
  })

  it('섹션 구분 장은 모두 들어가거나 모두 빠진다', () => {
    for (const { minutes } of DURATIONS) {
      for (const { id: audience } of AUDIENCES) {
        const count = planRecipes('proposal', audience, minutes).filter((r) => r.layout === 'section').length
        expect([0, 4]).toContain(count)
      }
    }
  })
})

describe('createDeck', () => {
  it('표지 제목과 목차를 미리 채운다', () => {
    const deck = createDeck({
      type: 'proposal',
      audience: 'mixed',
      minutes: 45,
      method: 'live',
      title: '  MES 도입 제안  ',
      customer: '한빛제조',
      presenter: '',
      theme: 'white',
    })
    expect(deck.title).toBe('MES 도입 제안')
    expect(deck.slides[0].fields.title).toBe('MES 도입 제안')
    expect(deck.meta.customer).toBe('한빛제조')
    const agenda = deck.slides.find((s) => s.layout === 'agenda')
    expect(agenda?.items.map((i) => i.title)).toEqual(['고객의 과제', '해결 방안', '근거', '제안'])
  })

  it('제목을 비우면 발표 종류의 기본 제목을 쓴다', () => {
    const deck = createDeck({
      type: 'review',
      audience: 'exec',
      minutes: 20,
      method: 'send',
      title: '',
      customer: '',
      presenter: '',
      theme: 'navy',
    })
    expect(deck.title).toBe('성과 리뷰')
  })
})
