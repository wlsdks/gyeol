// 진행 현황과 준비 상황이 같이 쓰는 과제의 상태 읽기. 그리기(slides)와 부품 높이 고르기(blocks/sizing.ts)가 같이 쓴다

export type Status = 'done' | 'doing' | 'late' | 'todo'

export const STATUS_NAMES: Record<Status, string> = { done: '완료', doing: '진행 중', late: '지연', todo: '예정' }

/**
 * 과제의 상태. 사람이 적은 상태 글을 먼저 읽고, 비어 있으면 진행률로 짐작한다(100%는 완료, 0%는 예정).
 * 읽을 수 없는 글('검토 중' 같은)은 null이라 색 없이 그 글 그대로 보인다.
 */
export function statusOf(text: string, pct: number | null): Status | null {
  const t = text.replace(/\s/g, '')
  if (t) {
    if (/지연|늦|위험|차질|보류|중단|밀림|미달/.test(t)) return 'late'
    if (/완료|끝|마침|마감됨|종료/.test(t)) return 'done'
    if (/예정|대기|준비|시작전|착수전/.test(t)) return 'todo'
    if (/진행|하는중|착수|추진/.test(t)) return 'doing'
    return null
  }
  if (pct === null) return null
  return pct >= 100 ? 'done' : pct <= 0 ? 'todo' : 'doing'
}

/** 상태별 모양에서 과제가 들어가는 단: 상태 글로, 못 읽으면 진행률로 짐작하고, 그것도 없으면 예정 */
export function laneOf(state: string, pct: number | null): Status {
  return statusOf(state, pct) ?? statusOf('', pct) ?? 'todo'
}

/** 진행률 글('80%', '80')의 숫자. 단을 짐작할 때만 써서 단위는 보지 않는다 */
function pctOf(text: string): number | null {
  const m = /-?\d+(?:\.\d+)?/.exec(text.replace(/,/g, ''))
  return m ? Math.max(0, Math.min(100, Number(m[0]))) : null
}

/**
 * 상태별 모양에서 가장 많이 모인 단의 과제 수. 단마다 과제가 위아래로 쌓여서 높이와 짜임은 항목 수가 아니라 이 수가 정한다
 * (과제 다섯이 모두 진행 중이면 단 하나가 다섯 줄이다)
 */
export function laneRows(tasks: { state: string; value: string }[]): number {
  const counts: Partial<Record<Status, number>> = {}
  for (const t of tasks) {
    const lane = laneOf(t.state, pctOf(t.value))
    counts[lane] = (counts[lane] ?? 0) + 1
  }
  return Math.max(1, ...Object.values(counts))
}
