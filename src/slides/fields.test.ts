import { describe, expect, it } from 'vitest'
import { cssSource } from './cssSource'
import { minusSigns, numberUnits, splitNumber, textUnits, UNIT_K } from './fields'

// 숫자의 꼴은 그릴 때만 바꾼다 (docs/DESIGN.md '숫자의 꼴'). 저장한 글은 이 함수들을 거치지 않는다
describe('숫자의 꼴', () => {
  it('큰 숫자는 숫자와 단위로 나눈다', () => {
    expect(splitNumber('40%')).toEqual({ num: '40', unit: '%' })
    expect(splitNumber('3.6시간')).toEqual({ num: '3.6', unit: '시간' })
    expect(splitNumber('1,200시간')).toEqual({ num: '1,200', unit: '시간' })
    expect(splitNumber('4.8억 원')).toEqual({ num: '4.8', unit: '억 원' })
    expect(splitNumber('−3%')).toEqual({ num: '−3', unit: '%' })
    expect(splitNumber('+12%p')).toEqual({ num: '+12', unit: '%p' })
    expect(splitNumber('2~3배')).toEqual({ num: '2~3', unit: '배' })
  })

  it('숫자 하나와 단위의 꼴이 아니면 나누지 않는다', () => {
    expect(splitNumber('1200')).toBeNull()
    expect(splitNumber('3년 6개월')).toBeNull()
    expect(splitNumber('약 30억 원')).toBeNull()
    expect(splitNumber('미정')).toBeNull()
    expect(splitNumber('')).toBeNull()
  })

  it('숫자 앞의 붙임표만 빼기 기호로 바꾼다', () => {
    expect(minusSigns('-3%')).toBe('−3%')
    expect(minusSigns('작년보다 -12.5%')).toBe('작년보다 −12.5%')
    expect(minusSigns('(-3)')).toBe('(−3)')
    expect(minusSigns('–2')).toBe('−2')
    // 날짜, 번호, 범위의 붙임표와 숫자가 아닌 말 앞의 붙임표는 그대로
    expect(minusSigns('2026-10-25')).toBe('2026-10-25')
    expect(minusSigns('A-1 라인')).toBe('A-1 라인')
    expect(minusSigns('3-4월')).toBe('3-4월')
    expect(minusSigns('- 목록')).toBe('- 목록')
  })

  it('단위를 작게 그리면 폭도 그만큼 좁게 어림한다', () => {
    expect(numberUnits('1,200시간')).toBeLessThan(textUnits('1,200시간'))
    expect(numberUnits('1200')).toBe(textUnits('1200'))
    // 단위가 작아진 만큼만 줄어든다: 숫자 폭 + 단위 폭 × 비율
    const whole = textUnits('40%')
    const num = textUnits('40')
    expect(numberUnits('40%')).toBeCloseTo(num + (whole - num) * UNIT_K, 5)
  })

  it('단위의 크기가 CSS와 같다', () => {
    const css = cssSource(new URL('./slides.css', import.meta.url))
    const rule = /\.slide \.u \{[^}]*font-size: calc\(1em \/ ([\d.]+)\);/.exec(css)
    expect(rule).not.toBeNull()
    expect(1 / Number(rule![1])).toBeCloseTo(UNIT_K, 6)
  })
})
