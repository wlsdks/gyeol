// 칸에 적은 글에서 숫자를 읽는다. 막대 길이, 달성률, 증감의 끝 값을 계산할 때만 쓰고 화면에는 사람이 적은 글을 그대로 보인다.

/** '131억 원', '1,200', '93%' → 131, 1200, 93. 숫자가 없으면 0 */
export function parseNumber(text: string): number {
  const n = parseFloat(text.replace(/,/g, '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
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
