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

// ---------- 숫자와 단위 ----------
// 칸 둘 이상의 숫자로 계산하는 곳(증감, 달성률, 전환율, 합계)은 단위까지 읽어 같은 기준으로 바꾼 뒤 계산한다.
// 숫자만 뽑으면 '6분 → 40초'가 6 → 40(▲ 567%)이 되고, '1.2억 원 → 8,000만 원'이 1.2 → 8,000이 된다.
// 견줄 수 없는 단위끼리('3건 → 40%', '2명 → 5대')는 계산하지 않는다. 틀린 숫자를 보이느니 보이지 않는다

/** 숫자 바로 뒤의 자리. '3천만'처럼 겹쳐 쓰면 곱한다 */
const PLACES: Record<string, number> = { 십: 10, 백: 100, 천: 1e3, 만: 1e4, 억: 1e8, 조: 1e12 }

const DAY = 86_400
/** 한 달은 한 해의 12분의 1. 30일로 세면 '18개월 → 1년'이 33%가 아니라 32% 줄어든 것이 된다 */
const MONTH = (365 / 12) * DAY

/**
 * 기준이 여럿인 단위 무리와, 무리의 기준(초, g, m, 바이트)으로 바꾸는 배수.
 * 같은 무리는 단위가 달라도 견준다('6분'과 '40초', '1.2kg'과 '800g')
 */
const SCALED: Record<string, [kind: string, per: number]> = {
  ms: ['time', 1e-3],
  밀리초: ['time', 1e-3],
  초: ['time', 1],
  sec: ['time', 1],
  분: ['time', 60],
  min: ['time', 60],
  시간: ['time', 3600],
  일: ['time', DAY],
  주: ['time', 7 * DAY],
  주일: ['time', 7 * DAY],
  개월: ['time', MONTH],
  달: ['time', MONTH],
  년: ['time', 365 * DAY],
  mg: ['mass', 1e-3],
  g: ['mass', 1],
  kg: ['mass', 1e3],
  톤: ['mass', 1e6],
  mm: ['length', 1e-3],
  cm: ['length', 1e-2],
  m: ['length', 1],
  km: ['length', 1e3],
  KB: ['data', 1024],
  MB: ['data', 1024 ** 2],
  GB: ['data', 1024 ** 3],
  TB: ['data', 1024 ** 4],
}
/** 긴 단위부터 맞춰 본다 ('시간'을 '시'로, '개월'을 '개'로 읽지 않게) */
const SCALED_WORDS = Object.keys(SCALED).sort((a, b) => b.length - a.length)
const SCALED_KINDS = new Set(Object.values(SCALED).map(([kind]) => kind))

/** 같은 단위의 다른 표기 */
const ALIASES: Record<string, string> = {
  '％': '%',
  '%p': '%',
  '%포인트': '%',
  퍼센트: '%',
  프로: '%',
  $: '달러',
  '＄': '달러',
  '₩': '원',
  '￦': '원',
  '€': '유로',
  '¥': '엔',
  '£': '파운드',
}

/** 단위 뒤에 붙어도 단위가 바뀌지 않는 말 ('7분 이내', '3년간', '120건이상') */
const QUAL = '(?:이상|이하|이내|미만|초과|내외|안팎|정도|가량|남짓|쯤|간|째|씩|당|여)'
const ONLY_QUALS = new RegExp(`^${QUAL}+$`)
const END_QUALS = new RegExp(`${QUAL}+$`)

interface Unit {
  /** 단위 무리. 시간, 무게 같은 무리 이름이거나 적은 단위 그대로('건', '원') */
  kind: string
  /** 무리의 기준으로 바꾸는 배수 ('분'이면 60) */
  per: number
  /** 적은 단위 글 ('분', '억 원'의 '원') */
  text: string
}

/** 숫자 뒤 낱말의 단위. 단위가 아닌 말('이상', '정도')뿐이면 null */
function unitOf(word: string): Unit | null {
  if (!word || ONLY_QUALS.test(word)) return null
  for (const w of SCALED_WORDS) {
    if (!word.startsWith(w)) continue
    const rest = word.slice(w.length)
    // '분기', '일차', '년도', '주차'는 기간의 길이가 아니라 몇째인지라 적은 말 그대로 둔다
    if (!rest || ONLY_QUALS.test(rest)) return { kind: SCALED[w][0], per: SCALED[w][1], text: w }
  }
  const noun = word.replace(END_QUALS, '')
  return { kind: ALIASES[noun] ?? noun, per: 1, text: noun }
}

/** 숫자: 천 단위 쉼표, 소수 */
const NUMBER = /\d(?:[\d,]*\d)?(?:\.\d+)?|\.\d+/g
/** 숫자 뒤의 자리와 단위 낱말 ('억 원', '만원', '분', '%'). 낱말은 띄어쓰기나 문장 부호 앞까지 */
const AFTER = /^\s?([십백천]?[만억조]|[십백천])?\s?([^\s\d.,~∼()[\]{}<>/·|:;=+\-−–—≤≥]*)/
/** 숫자 앞의 빼기 표기. 글 처음이나 띄어쓰기, 괄호 뒤에만 ('A-3'의 붙임표는 빼기가 아니다). △는 회계에서 마이너스 */
const MINUS = /(?:^|[\s(])[-−–△▽▼]\s*$/
/** 숫자 앞의 화폐 기호 ('$1.2') */
const CURRENCY_BEFORE = /[$＄₩￦€¥£]\s*$/

interface Part {
  n: number
  /** 숫자 뒤의 자리 ('억'이면 1억) */
  place: number
  placeText: string
  unit: Unit | null
  start: number
  end: number
}

function partsOf(text: string): Part[] {
  const out: Part[] = []
  for (const m of text.matchAll(NUMBER)) {
    const start = m.index
    const after = AFTER.exec(text.slice(start + m[0].length))!
    const placeText = after[1] ?? ''
    const place = [...placeText].reduce((p, c) => p * PLACES[c], 1)
    out.push({ n: parseFloat(m[0].replace(/,/g, '')), place, placeText, unit: unitOf(after[2]), start, end: start + m[0].length + after[0].length })
  }
  return out
}

/** 앞 숫자에 이어 적은 더 작은 자리나 단위인지: '1억 2,000만 원', '1시간 30분', '2년 6개월' */
function joins(a: Part, b: Part, between: string): boolean {
  if (between.trim()) return false
  // 자리만 적은 숫자 뒤에는 더 작은 자리. 뒤에 자리도 단위도 없으면('2억 5,000') 5,000인지 5,000만인지 몰라서 잇지 않는다
  if (!a.unit) return a.place > 1 && b.place < a.place && (b.place > 1 || !!b.unit)
  return a.place === 1 && b.place === 1 && !!b.unit && SCALED_KINDS.has(a.unit.kind) && b.unit.kind === a.unit.kind && b.unit.per < a.unit.per
}

/** 칸에 적은 숫자 하나를 단위까지 읽은 것 */
export interface Amount {
  /** 무리의 기준으로 바꾼 값: '1.2억 원' → 120,000,000, '6분' → 360(초), '1시간 30분' → 5,400(초) */
  base: number
  /** 적은 숫자에 곱한 배수(자리 × 단위): '1.2억 원' → 1억, '6분' → 60. 이어 적은 값은 가장 큰 자리 것 */
  scale: number
  /** 자리 배수 ('억'이면 1억). 자리를 적지 않았으면 1 */
  place: number
  /** 단위 무리. 비었으면 단위 없이 적은 숫자('120', '1.2억') */
  kind: string
  /** 자리도 단위도 없이 숫자만 적었는지 ('120') */
  bare: boolean
  /** 숫자 뒤에 적은 자리와 단위 ('억 원', '분'). 계산한 값을 같은 꼴로 보일 때 붙인다 */
  suffix: string
}

function readOwn(text: string): Amount | null {
  const parts = partsOf(text)
  if (!parts.length) return null
  let k = 1
  while (k < parts.length && joins(parts[k - 1], parts[k], text.slice(parts[k - 1].end, parts[k].start))) k++
  // 이어 적은 것이 아닌 숫자가 더 있으면('3~5일', '2024년 120억', '120건(전년 100건)') 어느 숫자인지 몰라서 읽지 않는다
  if (k < parts.length) return null
  const first = parts[0]
  const last = parts[parts.length - 1]
  const lead = text.slice(0, first.start)
  // 자리만 적은 앞 숫자는 끝 숫자의 단위를 같이 쓴다 ('1억 2,000만 원'의 1억도 원). 단위가 없으면 앞의 화폐 기호('$1.2')
  const sign = CURRENCY_BEFORE.exec(lead)
  const unit = first.unit ?? last.unit ?? (sign ? unitOf(sign[0].trim()) : null)
  const per = (p: Part) => (p.unit ?? unit)?.per ?? 1
  const base = parts.reduce((s, p) => s + p.n * p.place * per(p), 0)
  const unitText = first.unit || last.unit ? unit!.text : ''
  return {
    base: MINUS.test(lead) ? -base : base,
    scale: first.place * per(first),
    place: first.place,
    kind: unit?.kind ?? '',
    bare: first.place === 1 && !unit,
    suffix: first.placeText && unitText ? `${first.placeText} ${unitText}` : first.placeText || unitText,
  }
}

/**
 * 칸의 숫자를 단위까지 읽는다. 숫자가 없거나 어느 숫자인지 모르면 null.
 * 단위 칸(unit)이 따로 있는 그림이면 숫자만 적은 값('7.2')은 그 단위('억 원')로, 자리만 적은 값('8,000만')은 그 단위 무리(원)로 읽는다
 */
export function readAmount(text: string, unit = ''): Amount | null {
  const own = readOwn(text)
  if (!own || own.kind || !unit.trim()) return own
  const u = readOwn(`1 ${unit.trim()}`)
  if (!u) return own
  if (own.bare) return { ...own, base: own.base * u.scale, scale: u.scale, place: u.place, kind: u.kind, bare: false, suffix: unit.trim() }
  const per = u.scale / u.place
  return { ...own, base: own.base * per, scale: own.scale * per, kind: u.kind }
}

/** 적은 숫자 그대로 ('131억 원' → 131, '▼ 1.5억 원' → −1.5, '1시간 30분' → 1.5). 숫자가 없거나 어느 숫자인지 모르면 null */
export function readNumber(text: string): number | null {
  const a = readOwn(text)
  return a && a.base / a.scale
}

/** 한쪽에만 적어도 다른 쪽을 같은 단위로 읽는 단위인지: 기준이 하나뿐인 단위('건', '원', '%') */
const single = (kind: string) => !SCALED_KINDS.has(kind)

/**
 * 두 값을 견줄 수 있는지. 단위 무리가 같거나, 한쪽만 단위를 적었고 그 단위가 기준이 하나뿐일 때('120 → 150건').
 * 한쪽만 '6분'이면 다른 쪽이 분인지 초인지, 한쪽만 '1.2억'이면 다른 쪽 '8,000'이 8,000인지 8,000만인지 몰라서 견주지 않는다
 */
function comparable(a: Amount, b: Amount): boolean {
  if (a.bare || b.bare) {
    const other = a.bare ? b : a
    return other.bare || (other.place === 1 && single(other.kind))
  }
  if (a.kind === b.kind) return true
  // 자리만 적은 쪽('8,000만')은 다른 쪽의 단위('1.2억 원')로 읽는다. %와는 섞지 않는다
  const other = !a.kind ? b : !b.kind ? a : null
  return !!other && single(other.kind) && other.kind !== '%'
}

/** 두 칸의 값을 같은 기준으로 읽는다 (전과 후, 목표와 실적). 견줄 수 없으면 null */
export function amountPair(a: string, b: string, unit = ''): { a: Amount; b: Amount; kind: string } | null {
  const x = readAmount(a, unit)
  const y = readAmount(b, unit)
  if (!x || !y || !comparable(x, y)) return null
  return { a: x, b: y, kind: x.kind || y.kind }
}

/**
 * 전과 후가 얼마나 바뀌었는지. 둘 다 %면 %p, 아니면 전 값에 대한 %.
 * 견줄 수 없는 단위이거나 전 값이 0이면 null (비율을 말할 수 없다)
 */
export function changeOf(before: string, after: string, unit = ''): { value: number; pp: boolean } | null {
  const p = amountPair(before, after, unit)
  if (!p) return null
  const d = p.b.base - p.a.base
  if (p.kind === '%') return { value: d, pp: true }
  if (p.a.base === 0) return null
  return { value: (d / Math.abs(p.a.base)) * 100, pp: false }
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
