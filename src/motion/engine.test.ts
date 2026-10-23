import { describe, expect, it } from 'vitest'
import { motionEngine } from './engine'

describe('움직임 엔진', () => {
  it('바깥의 아무것도 참조하지 않아서 소스만으로 다시 만들 수 있다 (내보낸 HTML에 소스가 그대로 들어간다)', () => {
    const rebuilt = new Function(`return (${motionEngine.toString()})`)() as typeof motionEngine
    const engine = rebuilt()
    expect(typeof engine.play).toBe('function')
    expect(typeof engine.swap).toBe('function')
  })
})
