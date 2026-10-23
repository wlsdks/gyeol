import { useCallback, useEffect, useRef, useState } from 'react'
import type { Deck, Slide } from '../deck/types'
import { useDeck } from '../store/deckStore'
import type { AskError, AskId, AskRun } from './asks'
import { askRun, cancelAsk, publishShape, startAsk } from './client'
import { shapeDeckId, shapeSlideId, toShape } from './share'

const POLL_MS = 900

/** 하고 있는 부탁. id는 서버가 받기 전까지 빈 값 */
export interface AskJob extends AskRun {
  ask: AskId
  /** 장 부탁이면 그 장의 원래 id (화면에서 몇째 장인지 보여 주려고). 발표 전체면 null */
  slideId: string | null
}

export interface AiAsk {
  job: AskJob | null
  start(ask: AskId, slide: Slide | null): Promise<void>
  cancel(): void
  dismiss(): void
}

/** 'AI에게 부탁'. 로컬 서버가 이 PC의 Claude Code를 띄워 부탁을 전하고, 제안이 오면 알려 준다 */
export function useAiAsk(deck: Deck): AiAsk {
  const [job, setJob] = useState<AskJob | null>(null)
  const latest = useRef(deck)
  latest.current = deck
  // 서버가 받기 전에 그만두기를 누르면, 늦게 돌아온 응답이 부탁을 되살리지 않게
  const turn = useRef(0)

  const start = useCallback(async (ask: AskId, slide: Slide | null) => {
    const d = latest.current
    const mine = ++turn.current
    const base = { ask, slideId: slide?.id ?? null }
    const fail = (error: AskError) => mine === turn.current && setJob({ ...base, id: '', state: 'failed', step: 'starting', error })
    setJob({ ...base, id: '', state: 'running', step: 'starting' })
    // AI가 부탁을 들어주려면 모양을 봐야 한다. 부탁을 누른 것이 보여 주겠다는 뜻이라 공유를 켠다 (끄기는 위쪽 AI 단추에서)
    if (!d.aiShare) useDeck.getState().setAiShare(true)
    if (!(await publishShape(toShape(d)))) return void fail('not_shared')
    const run = await startAsk(ask, shapeDeckId(d), slide ? shapeSlideId(slide) : null)
    if (typeof run === 'string') return void fail(run)
    if (mine !== turn.current) return void cancelAsk(run.id)
    setJob({ ...base, ...run })
  }, [])

  const running = job?.state === 'running' ? job.id : ''
  useEffect(() => {
    if (!running) return
    let alive = true
    const t = window.setInterval(async () => {
      const run = await askRun(running)
      if (!alive) return
      setJob((j) => (j && j.id === running ? (run ? { ...j, ...run } : { ...j, state: 'failed', error: 'failed' }) : j))
    }, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [running])

  const cancel = useCallback(() => {
    turn.current++
    setJob((j) => {
      if (j?.id) void cancelAsk(j.id)
      return null
    })
  }, [])
  const dismiss = useCallback(() => setJob(null), [])

  return { job, start, cancel, dismiss }
}
