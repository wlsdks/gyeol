import { describe, expect, it } from 'vitest'
import { formatNumber, parseDelta, parseNumber } from './numbers'

describe('숫자 읽기', () => {
  it('단위와 쉼표가 붙은 값에서 숫자만 읽는다', () => {
    expect(parseNumber('131억 원')).toBe(131)
    expect(parseNumber('1,200억 원')).toBe(1200)
    expect(parseNumber('15.2억 원')).toBe(15.2)
    expect(parseNumber('93%')).toBe(93)
    expect(parseNumber('')).toBe(0)
    expect(parseNumber('미정')).toBe(0)
  })

  it('증감은 보고서에서 쓰는 더하기, 빼기 표기를 모두 받는다', () => {
    expect(parseDelta('+9')).toBe(9)
    expect(parseDelta('9')).toBe(9)
    expect(parseDelta('▲9')).toBe(9)
    expect(parseDelta('-2')).toBe(-2)
    expect(parseDelta('−2')).toBe(-2)
    expect(parseDelta('△2')).toBe(-2)
    expect(parseDelta('▼ 1.5억 원')).toBe(-1.5)
    expect(parseDelta('(-3)')).toBe(-3)
  })

  it('계산한 값은 천 단위 쉼표와 소수 둘째 자리까지', () => {
    expect(formatNumber(131)).toBe('131')
    expect(formatNumber(1234.567)).toBe('1,234.57')
  })
})
