import { describe, expect, it } from 'vitest'
import { josa, particle } from './noRoom'

describe('조사', () => {
  it('받침을 보고 붙인다', () => {
    expect(josa('발표 전체', '은', '는')).toBe('발표 전체는')
    expect(josa('결론', '은', '는')).toBe('결론은')
  })

  it('따옴표 뒤에서는 그 앞 글자로 본다', () => {
    expect(`3장 ‘시장 규모’${particle('3장 ‘시장 규모’', '은', '는')}`).toBe('3장 ‘시장 규모’는')
    expect(particle('분기 실적 보고', '을', '를')).toBe('를')
    expect(particle('추진 일정', '을', '를')).toBe('을')
  })

  it("'으로/로'는 ㄹ 받침 뒤에도 '로'", () => {
    expect(particle('자동 저장', '으로', '로')).toBe('으로')
    expect(particle('본부장 보고본', '으로', '로')).toBe('으로')
    expect(particle('서울', '으로', '로')).toBe('로')
    expect(particle('2안', '으로', '로')).toBe('으로')
  })

  it('숫자는 읽는 소리로', () => {
    expect(particle('2026년 3', '을', '를')).toBe('을')
    expect(particle('버전 2', '을', '를')).toBe('를')
    expect(particle('1', '으로', '로')).toBe('로')
  })
})
