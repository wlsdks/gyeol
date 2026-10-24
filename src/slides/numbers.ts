// 칸에 적은 글에서 숫자를 읽는다. 막대 길이, 달성률, 증감의 끝 값을 계산할 때만 쓰고 화면에는 사람이 적은 글을 그대로 보인다.

/** '131억 원', '1,200', '93%' → 131, 1200, 93. 숫자가 없으면 0 */
export function parseNumber(text: string): number {
  const n = parseFloat(text.replace(/,/g, '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * 낮을수록 좋은 목표인지 ('7분 이하', '불량률 0.5% 미만', '≤ 3일'). 대기 시간, 비용, 불량처럼 줄여야 하는 지표는
 * 목표를 이렇게 적으므로, 이때는 실적이 목표보다 작아야 달성이고 달성률도 거꾸로(목표 ÷ 실적) 센다
 */
export function lowerIsBetter(target: string): boolean {
  return /이하|이내|미만|아래|[≤⩽<]/.test(target)
}

/**
 * 증감 값. ▲와 +는 더하기, ▼ △ − - 는 빼기.
 * 보고서에서 흔히 쓰는 표기(△는 회계에서 마이너스, 유니코드 빼기 기호 −)를 모두 받는다.
 */
export function parseDelta(text: string): number {
  const n = Math.abs(parseNumber(text))
  return /^[\s(]*[-−–△▽▼]/.test(text) ? -n : n
}

/** 계산한 값을 보이는 꼴: 천 단위 쉼표, 소수 둘째 자리까지 */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(n)
}

const NUMERIC_CELL = /^[+\-−–▲▼△]?\s?[\d.,]+\s?(%p?|배|건|명|곳|개|점|원|[천만억조]\s?원?|시간|kg|톤)?$/

/**
 * 짧은 숫자만 든 칸(금액, 비율, 건수). 표에서 이런 칸만 오른쪽에 맞춰 자릿수가 줄을 맞추게 한다.
 * '11월', '3분기' 같은 날짜와 시기는 글로 본다.
 */
export function isNumericCell(text: string): boolean {
  const t = text.trim()
  return t.length > 0 && t.length <= 12 && NUMERIC_CELL.test(t)
}

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

export type Grade = 'good' | 'mid' | 'bad'

/**
 * 평가표의 한 칸. 보고서에서 흔히 쓰는 말과 기호(좋음 보통 나쁨, 상 중 하, ○ △ ×)를 읽는다.
 * 읽을 수 없는 글('1.9억' 같은)은 null이라 표시 없이 그 글 그대로 보인다
 */
export function gradeOf(text: string): Grade | null {
  const t = text.trim()
  if (/^(좋음|좋다|좋아요|우수|상|높음|유리|가능|[◎○●Oo])$/.test(t)) return 'good'
  if (/^(보통|중|중간|[△◐])$/.test(t)) return 'mid'
  if (/^(나쁨|나쁘다|미흡|하|낮음|불리|불가|[×✕xX])$/.test(t)) return 'bad'
  return null
}

/** 평가표의 한 줄('좋음 보통 나쁨')을 안마다 나눈다. 띄어 쓰기나 쉼표로 */
export function gradesOf(text: string): string[] {
  return text.split(/[\s,·/|]+/).filter(Boolean)
}

/** 추진 일정의 기간 칸 이름. 띄어 쓰기나 쉼표로 나눈다. 너무 많으면 막대가 가늘어져서 열둘까지 */
export function colsOf(text: string): string[] {
  return text
    .split(/[\s,·/|]+/)
    .filter(Boolean)
    .slice(0, 12)
}

/**
 * 글에 나오는 기간 칸의 처음과 끝 ('12월~2월'이면 12월 칸부터 2월 칸까지).
 * '1월'이 '11월', '12월' 안에서 잡히지 않게 앞뒤에 숫자가 붙은 것은 칸 이름으로 보지 않는다
 */
export function spanIn(text: string, cols: string[]): [number, number] | null {
  const hit = cols.flatMap((c, i) => (new RegExp(`(?<!\\d)${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\d)`).test(text) ? [i] : []))
  return hit.length ? [Math.min(...hit), Math.max(...hit)] : null
}
