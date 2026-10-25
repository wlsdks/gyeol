import { describe, expect, it } from 'vitest'
import { cssSource } from '../slides/cssSource'
import { FRAME, HEAD, TEXT_SCALE } from './frame'

// 장의 틀은 CSS(slides.css)와 어림하는 코드(frame.ts)에 같이 있다. 한쪽만 바꾸면 부품 장의 자리 어림이 틀린다
describe('장의 틀', () => {
  const css = cssSource(new URL('../slides/slides.css', import.meta.url))
  const px = (name: string) => Number(new RegExp(`--${name}: (\\d+)px;`).exec(css)?.[1])

  it('옆과 위아래 여백이 CSS와 같다', () => {
    expect(px('pad-x')).toBe(FRAME.x)
    expect(px('pad-y')).toBe(FRAME.y)
    expect(px('body-gap')).toBe(FRAME.gap)
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

  // 규칙 하나의 몸(중괄호 안)
  const rule = (selector: string) => {
    const at = css.indexOf(`\n${selector} {`)
    expect(at, selector).toBeGreaterThanOrEqual(0)
    return css.slice(at, css.indexOf('}', at))
  }
  const num = (body: string, prop: string) => Number(new RegExp(`${prop}: ([\\d.]+)(px)?;`).exec(body)?.[1])

  it('제목과 부제의 크기, 너비, 줄 높이가 CSS와 같다 (부품 장 본문 높이 어림)', () => {
    expect(px('t-title')).toBe(HEAD.present.title)
    expect(px('t-lead')).toBe(HEAD.present.lead)
    const read = rule('.slide.d-read')
    expect(num(read, '--t-title')).toBe(HEAD.read.title)
    expect(num(read, '--t-lead')).toBe(HEAD.read.lead)
    expect(num(rule('.s-head'), 'max-width')).toBe(HEAD.titleW)
    expect(num(rule('.s-title'), 'line-height')).toBe(HEAD.titleLine)
    const lead = rule('.s-lead')
    expect(num(lead, 'max-width')).toBe(HEAD.leadW)
    expect(num(lead, 'line-height')).toBe(HEAD.leadLine)
    expect(num(lead, 'margin-top')).toBe(HEAD.between)
  })

  it('글자 크기 설정의 배율이 CSS와 같다', () => {
    expect(num(rule('.slide.sz-small'), '--scale')).toBe(TEXT_SCALE.small)
    expect(num(rule('.slide.sz-large'), '--scale')).toBe(TEXT_SCALE.large)
  })
})
