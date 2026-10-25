import { describe, expect, it } from 'vitest'
import { createDeck } from '../deck/generate'
import { copyDeck } from './copy'

const deck = () =>
  createDeck({ type: 'report', audience: 'mixed', minutes: 20, method: 'live', title: '분기 실적 보고', org: '기획팀', presenter: '이서연', theme: 'white' })

describe('발표 사본', () => {
  it('AI 공유를 켜 둔 발표를 복사해도 사본은 꺼진 채로 시작한다', () => {
    expect(copyDeck({ ...deck(), aiShare: true }, '사본').aiShare).toBe(false)
    expect(copyDeck({ ...deck(), aiShare: undefined }, '사본').aiShare).toBe(false)
  })

  it('새 id와 이름, 지금 시각으로 만들고 내용은 그대로', () => {
    const d = { ...deck(), createdAt: 1, updatedAt: 2 }
    const before = Date.now()
    const copy = copyDeck(d, '분기 실적 보고 사본')
    expect(copy.id).not.toBe(d.id)
    expect(copy.title).toBe('분기 실적 보고 사본')
    expect(copy.createdAt).toBeGreaterThanOrEqual(before)
    expect(copy.updatedAt).toBe(copy.createdAt)
    expect(copy.slides).toEqual(d.slides)
    expect(copy.theme).toEqual(d.theme)
    expect(copy.meta).toEqual(d.meta)
  })

  it('사본을 고쳐도 원래 발표는 바뀌지 않는다', () => {
    const d = deck()
    const copy = copyDeck(d, '사본')
    copy.slides[0].fields.title = '바꾼 제목'
    copy.meta.org = '다른 팀'
    expect(d.slides[0].fields.title).not.toBe('바꾼 제목')
    expect(d.meta.org).toBe('기획팀')
  })
})
