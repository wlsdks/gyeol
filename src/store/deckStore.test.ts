import { beforeEach, describe, expect, it } from 'vitest'
import { createDeck } from '../deck/generate'
import { useDeck } from './deckStore'

const deck = () =>
  createDeck({ type: 'report', audience: 'mixed', minutes: 20, method: 'live', title: '분기 실적 보고', org: '기획팀', presenter: '이서연', theme: 'white' })

describe('되돌리기', () => {
  beforeEach(() => useDeck.getState().open({ ...deck(), aiShare: true }))

  it('AI 공유를 끈 뒤 되돌리기, 다시 하기를 해도 꺼진 채로', () => {
    useDeck.getState().setTitle('바꾼 제목')
    useDeck.getState().setAiShare(false)
    useDeck.getState().undo()
    expect(useDeck.getState().deck?.title).toBe('분기 실적 보고')
    expect(useDeck.getState().deck?.aiShare).toBe(false)
    useDeck.getState().redo()
    expect(useDeck.getState().deck?.title).toBe('바꾼 제목')
    expect(useDeck.getState().deck?.aiShare).toBe(false)
  })

  it('색 고르기 창을 끄는 동안 바뀐 강조색은 되돌리기 한 번으로 돌아온다', () => {
    const before = useDeck.getState().deck?.theme.accent
    for (const c of ['#112233', '#223344', '#334455', '#445566']) useDeck.getState().setAccent(c)
    expect(useDeck.getState().past).toHaveLength(1)
    useDeck.getState().undo()
    expect(useDeck.getState().deck?.theme.accent).toBe(before)
  })

  it('AI 공유를 켠 뒤 되돌려도 켜 둔 대로', () => {
    useDeck.getState().setAiShare(false)
    useDeck.getState().setTitle('바꾼 제목')
    useDeck.getState().setAiShare(true)
    useDeck.getState().undo()
    expect(useDeck.getState().deck?.aiShare).toBe(true)
  })
})
