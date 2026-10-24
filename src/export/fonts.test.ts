import { describe, expect, it } from 'vitest'
import { FONTS, themeStyle } from '../deck/themes'
import { fontFamiliesOf, parseRanges, rangeHits } from './fonts'

/** 글꼴 목록(CSS font-family)의 첫 이름 */
const first = (stack: unknown) => String(stack).split(',')[0].trim().replace(/^['"]|['"]$/g, '')

describe('내보낸 파일에 넣는 글꼴', () => {
  it('글꼴 짝마다 제목과 본문 글꼴, 대신 그릴 Pretendard를 모두 넣는다', () => {
    for (const f of FONTS) {
      const theme = { id: 'white' as const, font: f.id }
      const style = themeStyle(theme) as Record<string, unknown>
      const families = fontFamiliesOf(theme)
      expect(families.test(first(style['--font-head'])), `${f.id} 제목`).toBe(true)
      expect(families.test(first(style['--font-body'])), `${f.id} 본문`).toBe(true)
      expect(families.test('Pretendard Variable'), f.id).toBe(true)
    }
    // 쓰지 않는 글꼴은 넣지 않는다
    expect(fontFamiliesOf({ id: 'white' }).test('Hahmlet Variable')).toBe(false)
    expect(fontFamiliesOf({ id: 'white', font: 'suit' }).test('Noto Serif KR Variable')).toBe(false)
  })

  it('쓴 글자가 든 조각만 고른다', () => {
    expect(parseRanges('U+AC00-AC0F, U+0041')).toEqual([
      [0xac00, 0xac0f],
      [0x41, 0x41],
    ])
    expect(rangeHits('U+AC00-AC0F', [0xac01])).toBe(true)
    expect(rangeHits('U+AC00-AC0F', [0x41])).toBe(false)
    // 범위가 없는 글꼴(SUIT)은 늘 넣는다
    expect(rangeHits('', [0x41])).toBe(true)
  })
})
