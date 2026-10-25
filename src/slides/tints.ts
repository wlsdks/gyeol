/**
 * 차트 조각의 색 단계: 강조색을 바탕에 섞은 농담(진한 것부터)과, 강조하지 않는 조각의 회색 농담.
 * 구성비와 쌓은 막대가 같은 단계를 써서 장을 넘겨도 '두 번째 조각'이 같은 색이다.
 * 조각의 style에 바로 넣는다: .slide에 CSS 변수로 두면 그 자리의 바탕으로 섞여, 바탕이 다른 부품(카드, 강조색 면)
 * 안에서는 장의 바탕색과 섞인 색이 된다
 */
const ACCENT_STEPS = [100, 66, 44, 28, 18, 12]
const GREY_STEPS = [64, 46, 32, 22, 15]

/** 나눌 수 있는 조각 수: 강조색 농담이 서로 구별되는 데까지 */
export const TINT_COUNT = ACCENT_STEPS.length

// 어두운 바탕은 단계를 따로 둔다(base.css의 --ta-*, --tg-*): 검정에 12~32%를 섞으면 sRGB 13~29라 프로젝터에서는 바탕과 같은
// 검정으로 보였다. 여기의 숫자는 흰 바탕의 단계이자 변수가 없을 때의 값
export const accentTint = (i: number) => {
  const k = i % ACCENT_STEPS.length
  return `color-mix(in srgb, var(--accent) var(--ta-${k}, ${ACCENT_STEPS[k]}%), var(--bg))`
}

export const greyTint = (i: number) => {
  const k = i % GREY_STEPS.length
  return `color-mix(in srgb, var(--ink-3) var(--tg-${k}, ${GREY_STEPS[k]}%), var(--bg))`
}
