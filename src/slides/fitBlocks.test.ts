import { describe, expect, it } from 'vitest'
import * as fit from './fitBlocks'

describe('부품 장 글자 맞추기', () => {
  it('바깥의 이름을 쓰지 않는다 (내보낸 HTML에 blockFitter의 소스만 들어간다)', () => {
    const src = fit.blockFitter.toString()
    // 이 파일이 내보내는 다른 이름을 안에서 부르면 내보낸 HTML에서는 없는 이름이라 맞추기가 멈춘다
    for (const name of Object.keys(fit).filter((k) => k !== 'blockFitter')) expect(src, name).not.toMatch(new RegExp(`\\b${name}\\b`))
    const rebuilt = new Function(`return (${src})`)() as typeof fit.blockFitter
    expect(Object.keys(rebuilt())).toEqual(['fit', 'lines', 'over', 'labels', 'figures', 'drawn'])
  })
})
