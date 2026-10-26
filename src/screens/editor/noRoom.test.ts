import { describe, expect, it } from 'vitest'
import { narrowText, noRoomText } from './noRoom'

describe('넣을 수 없는 까닭의 말', () => {
  it('너비: 장 너비의 몫으로, 장 너비를 다 쓰는 것은 다 써야 한다고', () => {
    expect(noRoomText({ kind: 'narrow', span: 6 }, 'message', 'here').why).toBe('핵심 한 줄은 장 너비의 절반 이상이 있어야 해서, 여기에 끼우면 너무 좁아져요.')
    expect(noRoomText({ kind: 'narrow', span: 12 }, 'table', 'move').why).toBe('표는 장 너비를 다 써야 해서, 여기에 끼우면 너무 좁아져요.')
    expect(narrowText({ kind: 'block', type: 'table', minSpan: 12 })).toBe('표는 장 너비를 다 써야 해서 더 좁힐 수 없어요.')
    expect(narrowText({ kind: 'block', type: 'bars', minSpan: 4 })).toContain('장 너비의 3분의 1 이상이 있어야 해서')
  })
})
