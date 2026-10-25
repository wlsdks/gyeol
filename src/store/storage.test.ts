import { describe, expect, it } from 'vitest'
import { createDeck } from '../deck/generate'
import type { Deck } from '../deck/types'
import { decodeDeckFile, encodeDeckFile, fileStamp, safeFileName } from './deckFile'
import { reconcile } from './reconcile'
import { deckSignature, slideSignatures, versionChanges, type DeckVersion } from './versions'

const deck = () =>
  createDeck({ type: 'deal', audience: 'mixed', minutes: 20, method: 'live', title: '품질 관리 제안 계획', org: '영업 2팀', presenter: '김민준', theme: 'white' })

const version = (d: Deck): DeckVersion => ({
  id: 'v',
  deckId: d.id,
  createdAt: 0,
  name: '',
  named: false,
  title: d.title,
  slideCount: d.slides.length,
  signature: deckSignature(d),
  slides: slideSignatures(d),
})

describe('작업 파일', () => {
  it('저장한 그대로 다시 읽힌다 (발표자 노트 포함)', () => {
    const d = deck()
    d.slides[0].notes = '첫 장에서 고객 이름을 꼭 부른다'
    expect(decodeDeckFile(encodeDeckFile(d))).toEqual(d)
  })

  it('다른 JSON이나 깨진 파일은 열지 않는다', () => {
    expect(decodeDeckFile('{"slides":[]}')).toBeNull()
    expect(decodeDeckFile('not json')).toBeNull()
  })

  it('파일 이름에 쓸 수 없는 글자를 뺀다', () => {
    expect(safeFileName('예시: 한빛/제조 *제안*?')).toBe('예시 한빛 제조 제안')
    expect(safeFileName('   ')).toBe('제목 없는 발표')
    // 윈도우에서 만들 수 없는 이름
    expect(safeFileName('CON')).toBe('CON 발표')
    expect(safeFileName('nul.txt')).toBe('nul.txt 발표')
    expect(safeFileName('보고서...')).toBe('보고서')
    expect(safeFileName('한'.normalize('NFD'))).toBe('한')
  })

  it('시각 표기는 이름순 정렬이 시간순이 된다', () => {
    expect(fileStamp(new Date(2026, 9, 3, 9, 5).getTime())).toBe('2026-10-03 09-05')
  })
})

describe('버전 비교', () => {
  it('수정 시각만 바뀌면 같은 내용으로 본다', () => {
    const d = deck()
    expect(deckSignature({ ...d, updatedAt: d.updatedAt + 1000 })).toBe(deckSignature(d))
    expect(deckSignature({ ...d, aiShare: !d.aiShare })).toBe(deckSignature(d))
  })

  it('발표 전체의 움직임만 바꿔도 다른 내용으로 본다', () => {
    const d = deck()
    expect(deckSignature({ ...d, motion: 'lively' })).not.toBe(deckSignature({ ...d, motion: 'calm' }))
    expect(deckSignature({ ...d, motion: 'lively' })).not.toBe(deckSignature(d))
  })

  it('예전에 저장한 버전의 서명과 같다 (움직임을 고르지 않은 발표)', () => {
    // 예전 서명: 제목, 정보, 테마, 장 넷만 넣은 FNV-1a. 이미 저장된 버전과 견주므로 바뀌면 안 된다
    const old = (d: Deck) => {
      const text = JSON.stringify([d.title, d.meta, d.theme, d.slides])
      let h = 2166136261
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i)
        h = Math.imul(h, 16777619)
      }
      return `${text.length}:${(h >>> 0).toString(36)}`
    }
    const d = deck()
    delete d.motion
    expect(deckSignature(d)).toBe(old(d))
  })

  it('고친 장, 더한 장, 뺀 장을 찾는다', () => {
    const before = deck()
    const after: Deck = structuredClone(before)
    after.slides[1].fields.title = '바뀐 제목'
    const removed = after.slides.pop()!
    after.slides.push({ ...structuredClone(removed), id: 'new-slide', purpose: '새 장' })

    const c = versionChanges(version(after), version(before))
    expect(c.changed).toEqual([before.slides[1].purpose])
    expect(c.added).toEqual(['새 장'])
    expect(c.removed).toEqual([removed.purpose])
  })

  it('내용이 같으면 바뀐 것이 없다', () => {
    const d = deck()
    expect(versionChanges(version(d), version(structuredClone(d)))).toEqual({ changed: [], added: [], removed: [] })
  })
})

describe('두 벌 맞추기 (브라우저와 보관 폴더)', () => {
  const at = (d: Deck, updatedAt: number, title = d.title): Deck => ({ ...d, updatedAt, title })

  it('더 최근에 고친 쪽을 남긴다', () => {
    const d = deck()
    expect(reconcile(at(d, 1), at(d, 2, '다른 PC에서 고친 제목'))).toEqual({ action: 'take', backup: true })
    expect(reconcile(at(d, 2), at(d, 1))).toEqual({ action: 'write' })
    expect(reconcile(at(d, 1), at(d, 1))).toEqual({ action: 'none' })
  })

  it('파일이 더 최근이어도 내용이 같으면 버전을 남기지 않는다', () => {
    const d = deck()
    expect(reconcile(at(d, 1), at(d, 2))).toEqual({ action: 'take', backup: false })
  })

  it('한쪽에만 있으면 그쪽을 다른 쪽으로 옮긴다', () => {
    const d = deck()
    expect(reconcile(undefined, d)).toEqual({ action: 'take', backup: false })
    expect(reconcile(d, undefined)).toEqual({ action: 'write' })
    expect(reconcile(undefined, undefined)).toEqual({ action: 'none' })
  })
})
