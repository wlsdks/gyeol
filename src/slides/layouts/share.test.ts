import { describe, expect, it } from 'vitest'
import { unitsOf } from './Share'

// 구성비 100칸: 칸 하나가 1%. 어떤 비중이어도 모두 100칸이고, 0인 항목은 칸이 없다

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('100칸 나누기', () => {
  it('내림하고 남는 칸은 소수점 아래가 큰 항목부터', () => {
    // 44.3, 29.8, 16.0, 9.9 → 44, 30, 16, 10
    expect(unitsOf([44.3, 29.8, 16, 9.9])).toEqual([44, 30, 16, 10])
  })

  it('셋으로 똑같이 나누어도 100칸', () => {
    const u = unitsOf([100 / 3, 100 / 3, 100 / 3])
    expect(sum(u)).toBe(100)
    expect(Math.max(...u) - Math.min(...u)).toBeLessThanOrEqual(1)
  })

  it('비중이 0이면 남는 칸을 받지 않는다', () => {
    const u = unitsOf([0, 99.5, 0.5])
    expect(u[0]).toBe(0)
    expect(sum(u)).toBe(100)
  })

  it('숫자를 넣기 전(모두 0)에는 칠할 칸이 없다', () => {
    expect(sum(unitsOf([0, 0, 0]))).toBe(0)
  })

  it('아주 작은 비중이 여럿이어도 모두 더하면 100', () => {
    for (const pcts of [[97, 0.6, 0.6, 0.6, 0.6, 0.6], [50.5, 49.5], [12.34, 23.45, 34.56, 29.65]]) expect(sum(unitsOf(pcts))).toBe(100)
  })
})
