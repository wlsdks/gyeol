/**
 * 장의 틀. slides.css의 --pad-x, --pad-y, --pad-bottom과 같은 값이다(frame.test.ts가 맞는지 본다).
 * 글과 그림은 옆으로 x, 위아래로 y 안에만 그린다. 위는 제목 글자의 윗선, 아래는 하단 표시의 아랫선이 틀선에 닿는다.
 * bottom은 본문 상자 아래의 띠(하단 표시, 출처 한 줄, 그 사이 간격)까지 더한 높이. gap은 제목 아래에서 본문 상자까지(--body-gap).
 * 장이 그려져 있지 않아 잴 수 없을 때(문서 보기, 시험, 바뀌기 전의 부품 장) 본문 상자를 어림할 때 쓴다.
 */
export const FRAME = { x: 120, y: 72, bottom: 187, gap: 72 } as const

/**
 * 장 맨 위 제목을 글자 윗선으로 틀에 맞추며 올리는 만큼(글자 크기 배율). 글꼴마다 조금 다른데(고딕 0.155, 명조 0.19)
 * 어림은 넉넉하게(본문 상자를 낮게) 잡으려고 작은 쪽
 */
export const TITLE_TRIM = 0.155

/**
 * 장의 머리(제목, 부제). slides.css의 --t-title, --t-lead(보내는 자료 .d-read는 한 단계 작다), .s-head와 .s-lead의 너비,
 * 줄 높이, 제목과 부제 사이와 같은 값이다(frame.test.ts가 본다). 부품 장의 본문 높이를 어림할 때 쓴다(composeAreaH)
 */
export const HEAD = {
  present: { title: 62, lead: 36 },
  read: { title: 52, lead: 30 },
  titleW: 1560,
  leadW: 1320,
  titleLine: 1.2,
  leadLine: 1.48,
  between: 28,
} as const

/** 발표 전체의 글자 크기(작게, 크게)의 배율. slides.css의 .sz-small, .sz-large의 --scale과 같다 */
export const TEXT_SCALE = { small: 0.92, large: 1.2 } as const
