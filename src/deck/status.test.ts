import { describe, expect, it } from 'vitest'
import { laneOf, laneRows } from './status'

describe('상태별 모양의 단 (laneOf, laneRows)', () => {
  it('상태 글이 먼저, 못 읽으면 진행률로, 그것도 없으면 예정', () => {
    expect(laneOf('2주 지연', 40)).toBe('late')
    expect(laneOf('검토 중', 100)).toBe('done')
    expect(laneOf('', 0)).toBe('todo')
    expect(laneOf('', null)).toBe('todo')
  })

  it('가장 많이 모인 단의 과제 수', () => {
    const doing = { state: '', value: '50%' }
    expect(laneRows([doing, doing, doing, { state: '완료', value: '' }])).toBe(3)
    expect(laneRows([{ state: '완료', value: '' }, { state: '지연', value: '' }])).toBe(1)
    expect(laneRows([])).toBe(1)
  })
})
