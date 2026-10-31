import { describe, expect, it } from 'vitest'
import { autoPlace, boardFit, composeAreaH, isArranged, makeBlock, moveAt, removeBlock, tiles } from '../blocks'
import { sampleBlock } from '../blockSamples'
import { aspectOf } from './images'
import type { Block, BlockType, Slide } from '../types'

const H = composeAreaH({ fields: { title: '제목' } } as unknown as Slide)
const block = (type: BlockType, id: string = type): Block => ({ ...makeBlock(type), id })
/** 차례대로 눌러 넣은 판 (편집기의 '넣기') */
const board = (...bs: Block[]): Block[] => bs.reduce<Block[]>((out, b) => autoPlace(out, b, H) ?? out, [])
const at = (bs: Block[], id: string) => bs.find((b) => b.id === id)!.at!

describe('짜임 틀 고르기', () => {
  it('큰 숫자와 짧은 설명은 본문의 양쪽에 나란히 놓는다', () => {
    const number = { ...block('number', 'n'), fields: { label: '평균 처리 시간', value: '2.4일' } }
    const text = { ...block('text', 't'), fields: { body: '접수 경로를 하나로 합쳐 담당자가 요청을 바로 확인해요.' } }
    const bs = board(number, text)
    expect(tiles(bs)).toBe(true)
    expect(at(bs, 'n').y).toBe(at(bs, 't').y)
    expect(at(bs, 't').x).toBeGreaterThan(at(bs, 'n').x)
  })
  it('로고 모음 다음에 넣은 숫자 둘은 한 줄에 나란히, 로고 위에 선다 (숫자가 답)', () => {
    const logos = sampleBlock('logos')
    const bs = board({ ...logos, id: 'l' }, { ...sampleBlock('stat'), id: 's1' }, { ...sampleBlock('stat'), id: 's2' })
    expect(tiles(bs)).toBe(true)
    expect(at(bs, 's1').y).toBe(at(bs, 's2').y)
    expect(at(bs, 's1').h).toBe(at(bs, 's2').h)
    expect(at(bs, 's1').y).toBeLessThan(at(bs, 'l').y)
  })

  it('소제목 묶음 둘은 소제목마다 그 아래 부품 위에 선다', () => {
    const bs = board(block('heading', 'h1'), block('points', 'p'), block('heading', 'h2'), block('bullets', 'b'))
    expect(tiles(bs)).toBe(true)
    for (const [h, b] of [
      ['h1', 'p'],
      ['h2', 'b'],
    ]) {
      expect(at(bs, b).y).toBe(at(bs, h).y + at(bs, h).h)
      expect(at(bs, b).x).toBe(at(bs, h).x)
    }
  })

  it('알아서 짠 판은 넣고 빼면 원래 판으로 돌아간다', () => {
    const bs = board(block('number', 'n'), block('bullets', 'l'))
    const added = autoPlace(bs, block('trend', 't'), H)!
    expect(removeBlock(added, 't', H).map((b) => b.at)).toEqual(bs.map((b) => b.at))
  })

  it('사람이 옮긴 판은 다시 고르지 않는다', () => {
    const bs = board(block('number', 'n'), block('bullets', 'l'), block('trend', 't'))
    const fit = boardFit(H, bs)
    expect(isArranged(bs, fit, H, aspectOf)).toBe(true)
    const moved = moveAt(bs, 'n', { kind: 'spot', spot: { at: null, side: 'right' } }, H)!
    expect(isArranged(moved, boardFit(H, moved), H, aspectOf)).toBe(false)
    // 새 부품을 넣어도 옮긴 숫자는 오른쪽 끝 그대로
    const next = autoPlace(moved, block('text', 'x'), H)!
    expect(at(next, 'n').x + at(next, 'n').w).toBe(12)
  })
})
