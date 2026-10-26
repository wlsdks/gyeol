import { createStore, del, entries, get, promisifyRequest } from 'idb-keyval'
import type { Deck } from '../deck/types'

// 덱은 이 브라우저의 IndexedDB에만 저장한다. 서버로 보내지 않는다.
const store = createStore('html-maker', 'decks')

export async function listDecks(): Promise<Deck[]> {
  try {
    const all = await entries<string, Deck>(store)
    return all.map(([, deck]) => deck).sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

export async function loadDeck(id: string): Promise<Deck | undefined> {
  try {
    return await get<Deck>(id, store)
  } catch {
    return undefined
  }
}

export async function saveDeck(deck: Deck): Promise<boolean> {
  try {
    // 넣고 바로 맺는다(commit). 맺기를 브라우저에 맡기면 넣은 결과가 돌아온 뒤에야 맺어서, 창을 닫거나 새로 고치는 순간(pagehide)에
    // 부른 저장은 그 사이 페이지가 사라져 버려졌다: 쓰고 0.4초 안에 닫으면 쓴 글이 없어졌다
    await store('readwrite', (s) => {
      s.put(deck, deck.id)
      s.transaction.commit?.()
      return promisifyRequest(s.transaction)
    })
    return true
  } catch {
    return false
  }
}

export async function deleteDeck(id: string): Promise<void> {
  try {
    await del(id, store)
  } catch {
    // 지우지 못해도 화면 목록에서는 빠진다
  }
}
