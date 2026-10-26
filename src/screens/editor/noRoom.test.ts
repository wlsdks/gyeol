import { describe, expect, it } from 'vitest'
import { narrowText, noRoomText } from './noRoom'

describe('넣을 수 없는 까닭의 말', () => {
  it('너비: 장 너비의 몫으로, 장 너비를 다 쓰는 것은 다 써야 한다고', () => {
    expect(noRoomText({ kind: 'narrow', span: 6 }, 'message', 'here').why).toBe('핵심 한 줄은 장 너비의 절반 이상이 있어야 해서, 여기에 끼우면 너무 좁아져요.')
    expect(noRoomText({ kind: 'narrow', span: 12 }, 'table', 'move').why).toBe('표는 장 너비를 다 써야 해서, 여기에 끼우면 너무 좁아져요.')
    expect(narrowText({ kind: 'block', type: 'table', minSpan: 12 })).toBe('표는 장 너비를 다 써야 해서 더 좁힐 수 없어요.')
    expect(narrowText({ kind: 'block', type: 'bars', minSpan: 4 })).toContain('장 너비의 3분의 1 이상이 있어야 해서')
  })

  it('맞바꾸기: 두 컴포넌트를 이름으로, 같은 컴포넌트끼리면 두', () => {
    expect(noRoomText({ kind: 'swap', type: 'table' }, 'number', 'move').why).toBe('큰 숫자와 표는 크기가 맞지 않아 자리를 맞바꿀 수 없어요.')
    expect(noRoomText({ kind: 'swap', type: 'number' }, 'number', 'move').why).toBe('두 큰 숫자는 크기가 맞지 않아 자리를 맞바꿀 수 없어요.')
  })
})
