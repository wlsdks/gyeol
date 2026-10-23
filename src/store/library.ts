import { createStore, del, entries, get, set } from 'idb-keyval'
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
    await set(deck.id, deck, store)
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
