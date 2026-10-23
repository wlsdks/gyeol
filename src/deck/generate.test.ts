import { describe, expect, it } from 'vitest'
import { AUDIENCES, BLUEPRINTS, DECK_TYPES, DURATIONS } from './blueprints'
import { createDeck, planRecipes, targetCount } from './generate'
import { hintFor } from './layouts'

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
    const plan = planRecipes('business', 'exec', 5)
    expect(plan.map((r) => r.purpose)).toEqual(['표지', '한 장 요약', '추진 배경', '제안 내용', '기대 효과', '결정 요청'])
  })

  it('어느 보고든 한 장 요약이 표지 바로 뒤에 오고 결정 요청으로 끝난다', () => {
    for (const type of ['business', 'deal', 'improve'] as const) {
      const plan = planRecipes(type, 'mixed', 20)
      expect(plan[1].purpose).toBe('한 장 요약')
      expect(plan[plan.length - 1].purpose).toBe('결정 요청')
    }
  })

  it('본부장·임원 대상이면 목차와 세부 화면을 뺀다', () => {
    const exec = planRecipes('deal', 'exec', 30)
    const manager = planRecipes('deal', 'practitioner', 30)
    expect(exec.some((r) => r.layout === 'agenda')).toBe(false)
    expect(exec.some((r) => r.purpose === '제안할 솔루션')).toBe(false)
    expect(manager.some((r) => r.purpose === '제안할 솔루션')).toBe(true)
  })

  it('섹션 구분 장은 모두 들어가거나 모두 빠진다', () => {
    for (const type of DECK_TYPES) {
      const total = BLUEPRINTS[type].recipes.filter((r) => r.layout === 'section').length
      for (const { minutes } of DURATIONS) {
        for (const { id: audience } of AUDIENCES) {
          const count = planRecipes(type, audience, minutes).filter((r) => r.layout === 'section').length
          expect([0, total]).toContain(count)
        }
      }
    }
  })
})

describe('createDeck', () => {
  const input = {
    type: 'business' as const,
    audience: 'mixed' as const,
    minutes: 30,
    method: 'live' as const,
    title: '  구독형 품질 관리 사업 제안  ',
    org: '영업 2팀',
    presenter: '',
    ask: '시범 사업 예산 1.2억 원 승인',
    theme: 'white' as const,
  }

  it('표지 제목, 결정 요청, 목차를 미리 채운다', () => {
    const deck = createDeck(input)
    expect(deck.title).toBe('구독형 품질 관리 사업 제안')
    expect(deck.slides[0].fields.title).toBe('구독형 품질 관리 사업 제안')
    expect(deck.slides[0].fields.ask).toBe('시범 사업 예산 1.2억 원 승인')
    expect(deck.meta.org).toBe('영업 2팀')
    const agenda = deck.slides.find((s) => s.layout === 'agenda')
    expect(agenda?.items.map((i) => i.title)).toEqual(['배경', '제안', '효과와 비용', '실행 계획'])
  })

  it('한 장 요약은 줄 이름을 미리 넣고 줄마다 다른 안내를 단다', () => {
    const summary = createDeck(input).slides[1]
    expect(summary.items.map((i) => i.title)).toEqual(['배경', '제안', '기대 효과', '요청 사항'])
    expect(summary.items.every((i) => i.body === '')).toBe(true)
    expect(hintFor(summary.layout, summary.hints, 'body', 'body', 0)).toBe('왜 지금 이 사업을 해야 하는지')
    expect(hintFor(summary.layout, summary.hints, 'body', 'body', 3)).toBe('결정해 주실 것 (예산, 인력)')
  })

  it('제목을 비우면 보고 종류의 기본 제목을 쓴다', () => {
    const deck = createDeck({ ...input, type: 'report', title: '', ask: '' })
    expect(deck.title).toBe('실적 보고')
    expect(deck.slides[0].fields.ask).toBeUndefined()
  })
})
