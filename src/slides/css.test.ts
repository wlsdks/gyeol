import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BLOCK_GAP, LINK_PAD } from '../deck/blocks'

// CSS와 코드가 서로 기대는 약속. 어긋나도 오류 없이 모양만 틀어져서(글자 크기 설정이 먹지 않거나 자리 어림이 틀린다) 테스트로 본다
const read = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const slides = read('slides.css')
const blocks = read('blocks.css')

/** 괄호 밖의 구분자로 자른다 (:is(a, b) 안의 쉼표에서 자르지 않게) */
function split(text: string, seps: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of text) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (depth === 0 && seps.includes(ch)) {
      if (cur.trim()) out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** 중첩 없는 규칙 { 선택자, 몸 } 모두 (@container 안의 규칙도) */
const rules = (css: string) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }))

/** 선택자가 가리키는 요소(맨 끝 묶음)의 클래스. :not()과 :has() 안은 그 요소의 클래스가 아니라 뺀다 */
function subjectClasses(selector: string): string[] {
  const last = split(selector, ' >+~').at(-1) ?? ''
  const own = last.replace(/:(not|has)\((?:[^()]|\([^()]*\))*\)/g, '')
  return [...own.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1])
}

describe('글자 칸 목록 (slides.css의 --fs 규칙)', () => {
  // 글자 크기를 --fs × 배율(글자 크기 설정, 부품 칸 맞추기)로 정하는 규칙의 선택자에 든 클래스
  const listed = new Set(
    rules(slides)
      .filter((r) => r.body.includes('font-size') && r.body.includes('calc(var(--fs) * var(--fit, 1)'))
      .flatMap((r) => [...r.selector.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1])),
  )
  // 제목 칸(.s-title과 같이 쓴다)과 한 줄 칸(oneLine을 주면 .one-line이 붙는다)은 그 클래스의 규칙이 크기를 정한다
  const OWN_RULE = new Set(['ag-title', 'ix-title', 'pm-num'])

  it('--fs를 정하는 칸은 모두 목록에 있다 (없으면 글자 크기 설정과 부품 칸 맞추기가 먹지 않는다)', () => {
    const missing: string[] = []
    for (const r of [...rules(slides), ...rules(blocks)]) {
      if (!/(^|[;\s])--fs\s*:/.test(r.body)) continue
      for (const sel of split(r.selector, ',')) {
        if (sel.startsWith('@')) continue
        const classes = subjectClasses(sel)
        if (!classes.some((c) => listed.has(c) || OWN_RULE.has(c))) missing.push(sel)
      }
    }
    expect(missing).toEqual([])
  })
})

describe('부품 장의 간격', () => {
  const px = (name: string) => Number(new RegExp(`--${name}: (\\d+)px;`).exec(blocks)?.[1])

  it('칸 사이와 이음표 자리가 CSS와 같다 (자리 계산이 CSS calc()와 같은 값을 쓴다)', () => {
    expect(px('bk-gap')).toBe(BLOCK_GAP)
    expect(px('lk-pad')).toBe(LINK_PAD)
  })
})
