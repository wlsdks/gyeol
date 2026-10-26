import { beforeEach, describe, expect, it } from 'vitest'
import { createDeck } from '../deck/generate'
import { undoLast, useDeck } from './deckStore'

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

  it('알림의 되돌리기는 그 뒤에 다른 것을 고쳤으면 되돌리지 않는다', () => {
    const id = useDeck.getState().deck!.slides[1].id
    useDeck.getState().removeSlide(id)
    const undo = undoLast()
    useDeck.getState().setTitle('바꾼 제목')
    expect(undo()).toBe(false)
    expect(useDeck.getState().deck?.title).toBe('바꾼 제목')
    expect(useDeck.getState().deck?.slides.some((s) => s.id === id)).toBe(false)
  })

  it('알림의 되돌리기는 기록에 남지 않는 설정이 바뀌어도 방금 바꾼 것을 되돌린다', () => {
    const id = useDeck.getState().deck!.slides[1].id
    useDeck.getState().removeSlide(id)
    const undo = undoLast()
    useDeck.getState().setAiShare(false)
    expect(undo()).toBe(true)
    expect(useDeck.getState().deck?.slides.some((s) => s.id === id)).toBe(true)
  })

  it('AI 공유를 켠 뒤 되돌려도 켜 둔 대로', () => {
    useDeck.getState().setAiShare(false)
    useDeck.getState().setTitle('바꾼 제목')
    useDeck.getState().setAiShare(true)
    useDeck.getState().undo()
    expect(useDeck.getState().deck?.aiShare).toBe(true)
  })
})

describe('되돌린 뒤 보는 장', () => {
  beforeEach(() => useDeck.getState().open(deck()))
  const slides = () => useDeck.getState().deck!.slides

  it('다른 장을 보다가 되돌리거나 다시 하면 바뀐 장으로 간다', () => {
    const [, , third, , , sixth] = slides()
    useDeck.getState().select(third.id)
    useDeck.getState().setField(third.id, 'title', '바꾼 제목')
    useDeck.getState().select(sixth.id)
    useDeck.getState().undo()
    expect(useDeck.getState().selectedId).toBe(third.id)
    useDeck.getState().select(sixth.id)
    useDeck.getState().redo()
    expect(useDeck.getState().selectedId).toBe(third.id)
  })

  it('넣은 장을 되돌리면 맨 앞 장이 아니라 그 앞 장을 고르고, 다시 하면 넣은 장을 고른다', () => {
    const at = slides()[4]
    useDeck.getState().addSlide('points', at.id)
    const added = useDeck.getState().selectedId
    useDeck.getState().undo()
    expect(useDeck.getState().selectedId).toBe(at.id)
    useDeck.getState().redo()
    expect(useDeck.getState().selectedId).toBe(added)
  })

  it('다른 장을 보다가 넣은 장을 되돌리면 넣은 자리의 앞 장으로 간다', () => {
    const at = slides()[4]
    useDeck.getState().addSlide('points', at.id)
    useDeck.getState().select(slides()[0].id)
    useDeck.getState().undo()
    expect(useDeck.getState().selectedId).toBe(at.id)
    // 곁의 장을 보고 있었으면 그대로
    useDeck.getState().redo()
    useDeck.getState().select(at.id)
    useDeck.getState().undo()
    expect(useDeck.getState().selectedId).toBe(at.id)
  })

  it('다른 장을 보다가 장 옮기기를 되돌리면 옮긴 장으로 가고, 옮긴 장을 보며 다시 하면 그대로', () => {
    const moved = slides()[5]
    useDeck.getState().moveSlide(5, 2)
    useDeck.getState().select(slides()[0].id)
    useDeck.getState().undo()
    expect(useDeck.getState().selectedId).toBe(moved.id)
    useDeck.getState().redo()
    expect(useDeck.getState().selectedId).toBe(moved.id)
  })

  it('테마를 되돌려도 보던 장 그대로', () => {
    const s = slides()[3]
    useDeck.getState().setTheme('navy')
    useDeck.getState().select(s.id)
    useDeck.getState().undo()
    expect(useDeck.getState().selectedId).toBe(s.id)
  })
})
