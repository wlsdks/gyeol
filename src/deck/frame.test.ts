import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FRAME } from './frame'

// 장의 틀은 CSS(slides.css)와 어림하는 코드(frame.ts)에 같이 있다. 한쪽만 바꾸면 부품 장의 자리 어림이 틀린다
describe('장의 틀', () => {
  const css = readFileSync(new URL('../slides/slides.css', import.meta.url), 'utf8')
  const px = (name: string) => Number(new RegExp(`--${name}: (\\d+)px;`).exec(css)?.[1])

  it('옆과 위아래 여백이 CSS와 같다', () => {
    expect(px('pad-x')).toBe(FRAME.x)
    expect(px('pad-y')).toBe(FRAME.y)
  })

  it('본문 상자 아래의 띠가 CSS와 같다', () => {
    const calc = /--pad-bottom: calc\(([^;]+)\);/.exec(css)?.[1] ?? ''
    const sum = calc.split('+').reduce((a, part) => {
      const t = part.trim()
      const v = /^var\(--([\w-]+)\)$/.exec(t)
      return a + (v ? px(v[1]) : Number(/^(\d+)px$/.exec(t)?.[1]))
    }, 0)
    expect(sum).toBe(FRAME.bottom)
  })
})
