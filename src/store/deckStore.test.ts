import { beforeEach, describe, expect, it } from 'vitest'
import { createDeck } from '../deck/generate'
import { useDeck } from './deckStore'

const deck = () =>
  createDeck({ type: 'report', audience: 'mixed', minutes: 20, method: 'live', title: '분기 실적 보고', org: '기획팀', presenter: '이서연', theme: 'white' })

describe('AI 공유는 되돌리기로 바뀌지 않는다', () => {
  beforeEach(() => useDeck.getState().open({ ...deck(), aiShare: true }))

  it('공유를 끈 뒤 되돌리기, 다시 하기를 해도 꺼진 채로', () => {
    useDeck.getState().setTitle('바꾼 제목')
    useDeck.getState().setAiShare(false)
    useDeck.getState().undo()
    expect(useDeck.getState().deck?.title).toBe('분기 실적 보고')
    expect(useDeck.getState().deck?.aiShare).toBe(false)
    useDeck.getState().redo()
    expect(useDeck.getState().deck?.title).toBe('바꾼 제목')
    expect(useDeck.getState().deck?.aiShare).toBe(false)
  })

  it('공유를 켠 뒤 되돌려도 켜 둔 대로', () => {
    useDeck.getState().setAiShare(false)
    useDeck.getState().setTitle('바꾼 제목')
    useDeck.getState().setAiShare(true)
    useDeck.getState().undo()
    expect(useDeck.getState().deck?.aiShare).toBe(true)
  })
})
