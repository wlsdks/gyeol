import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { createSampleDeck } from '../deck/sample'
import { exportCsp, fontText, parseDeckData } from './exportHtml'
import { VIEWER_JS } from './viewer'

// 시험에서는 CSS를 읽지 않아(빈 글) 장 CSS 대신 content로 글자를 그리는 규칙 하나를 둔다
vi.mock('../slides/blocks.css?inline', () => ({ default: ".fn-rate::before { content: '↓'; } .qt::before { content: '\\201C'; }" }))

describe('내보낸 HTML의 CSP', () => {
  it('어떤 주소로도 연결하지 못하고, 스크립트는 들어 있는 뷰어 하나만 돈다', async () => {
    const csp = await exportCsp()
    const rules = new Map(csp.split('; ').map((r) => [r.split(' ')[0], r.split(' ').slice(1)]))
    expect(rules.get('default-src')).toEqual(["'none'"])
    const hash = createHash('sha256').update(VIEWER_JS).digest('base64')
    expect(rules.get('script-src')).toEqual([`'sha256-${hash}'`])
    expect(rules.get('base-uri')).toEqual(["'none'"])
    expect(rules.get('form-action')).toEqual(["'none'"])
    // 연결(connect-src)은 따로 열지 않아 default-src 'none'을 따른다
    expect(rules.has('connect-src')).toBe(false)
    // 그림, 글꼴, 영상은 파일 안에 든 것만
    for (const r of ['img-src', 'font-src', 'media-src']) expect(rules.get(r)!.every((s) => s === 'data:' || s === 'blob:'), r).toBe(true)
    expect(csp).not.toMatch(/https?:|\*|'unsafe-eval'|'self'/)
    expect(rules.get('script-src')).not.toContain("'unsafe-inline'")
  })
})

describe('HTML 파일에서 덱 되살리기', () => {
  it('내보낸 덱은 새 발표로 되살린다', () => {
    const deck = createSampleDeck()
    const back = parseDeckData(JSON.stringify(deck))
    expect(back?.slides).toEqual(deck.slides)
    expect(back?.id).not.toBe(deck.id)
  })

  it('.deck 파일과 같은 꼴이 아니면 받지 않는다', () => {
    const deck = createSampleDeck()
    for (const raw of ['', '{', 'null', '5', '"deck"', '[]', '{}', JSON.stringify({ ...deck, slides: {} }), JSON.stringify({ ...deck, meta: null }), JSON.stringify({ ...deck, theme: undefined }), JSON.stringify({ ...deck, id: 7 })]) {
      expect(parseDeckData(raw), raw.slice(0, 40)).toBeNull()
    }
  })
})

describe('내보낸 HTML의 글꼴', () => {
  it('CSS가 그리는 글자(퍼널 전환율의 ↓)가 든 조각도 고른다', () => {
    // 글에는 없고 CSS의 content로만 그리는 글자: 빼면 그 글자만 든 조각이 빠져 내보낸 파일에서 다른 글꼴로 그려졌다
    const text = fontText('<div class="fn-rate">40%</div>', '발표')
    for (const ch of ['↓', '“', '40%', '발표']) expect(text).toContain(ch)
    expect(text).not.toContain('<')
  })
})
