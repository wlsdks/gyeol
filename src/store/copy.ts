import { uid } from '../deck/generate'
import type { Deck } from '../deck/types'

/**
 * 발표의 사본(복제, 새 버전에서 만든 발표의 고칠 수 있는 사본, 버전을 새 발표로 꺼내기): 새 id, 새 이름, 지금 시각.
 * 사본은 늘 AI 공유를 끈 채로 시작한다. 공유는 발표마다 사람이 켜는 것이라, 공유하던 발표를 복제했다고
 * 사본까지 AI에게 보이면 안 된다.
 * 원래 발표와 장, 부품 배열을 같이 쓰지 않게 통째로 복사한다 (사본을 고쳐도 원래 발표가 바뀌지 않게)
 */
export function copyDeck(deck: Deck, title: string): Deck {
  const now = Date.now()
  return { ...structuredClone(deck), id: uid(), title, createdAt: now, updatedAt: now, aiShare: false }
}
