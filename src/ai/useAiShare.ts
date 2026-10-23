import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Deck } from '../deck/types'
import { aiStatus, fetchRequests, publishShape, sendResult, unshareDeck, type AiStatus } from './client'
import { requestFor, type ChangeRequest, type OpResult } from './ops'
import { toShape } from './share'

const POLL_MS = 2500

export interface AiShare {
  /** undefined: 확인 중, null: 이 화면에서는 쓸 수 없음 (html-maker 시작 파일로 켜지 않았을 때) */
  status: AiStatus | null | undefined
  /** 이 발표에 온, 아직 보지 않은 제안 */
  requests: ChangeRequest[]
  resolve(request: ChangeRequest, status: 'applied' | 'rejected', results: OpResult[]): Promise<void>
  /** 기다리지 않고 바로 다시 가져온다 (부탁한 제안이 막 왔을 때) */
  refresh(): void
}

/**
 * 공유를 켠 발표의 모양을 'AI 공유' 폴더에 올리고, AI가 보낸 제안을 가져온다.
 * 글은 모양에 들어가지 않으므로, 글만 고칠 때는 다시 올리지 않는다.
 */
export function useAiShare(deck: Deck): AiShare {
  const [status, setStatus] = useState<AiStatus | null | undefined>(undefined)
  const [requests, setRequests] = useState<ChangeRequest[]>([])
  const [nudge, setNudge] = useState(0)
  const shared = !!deck.aiShare
  const ready = !!status

  useEffect(() => {
    let alive = true
    aiStatus().then((s) => alive && setStatus(s))
    return () => {
      alive = false
    }
  }, [])

  // 수정 시각은 빼고 비교한다. 칸이 비었는지, 장 순서 같은 모양이 바뀔 때만 올린다.
  const key = useMemo(() => (shared ? JSON.stringify({ ...toShape(deck), updatedAt: 0 }) : null), [deck, shared])
  const published = useRef<string | null>(null)
  const latest = useRef(deck)
  latest.current = deck

  useEffect(() => {
    if (!ready) return
    if (!key) {
      if (published.current !== null) {
        published.current = null
        void unshareDeck(latest.current)
      }
      return
    }
    if (key === published.current) return
    const t = window.setTimeout(async () => {
      if (await publishShape(toShape(latest.current))) published.current = key
    }, 600)
    return () => window.clearTimeout(t)
  }, [key, ready])

  useEffect(() => {
    if (!ready || !shared) {
      setRequests([])
      return
    }
    let alive = true
    const tick = async () => {
      if (document.hidden) return
      const mine = (await fetchRequests()).filter((r) => requestFor(latest.current, r))
      if (!alive) return
      setRequests((prev) => (prev.map((r) => r.id).join() === mine.map((r) => r.id).join() ? prev : mine))
    }
    void tick()
    const t = window.setInterval(tick, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [ready, shared, deck.id, nudge])

  const refresh = useCallback(() => setNudge((n) => n + 1), [])

  const resolve = useCallback(async (request: ChangeRequest, result: 'applied' | 'rejected', results: OpResult[]) => {
    setRequests((prev) => prev.filter((r) => r.id !== request.id))
    await sendResult(request.id, result, results)
  }, [])

  return { status, requests, resolve, refresh }
}
