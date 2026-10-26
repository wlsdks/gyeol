// 화살표 그림 하나: 두 쪽을 잇는 화살표(비교, 전과 후, 걱정과 대책)가 모두 이것을 그린다

/**
 * 짧은 줄기와 머리(→). 예전에는 점, 선, 꽉 찬 세모 머리를 이은 흔한 다이어그램 화살표가 떠 보여서 선 없는 가는 꺾쇠(›)만 두었는데,
 * 꺾쇠는 한눈에 화살표로 읽히지 않았다(사용자, docs/VISUAL-RULES.md 5). 줄기와 머리 모두 줄 선과 비슷한 가는 획(2.5), 끝은 각지게.
 * 칸마다 그림 크기(CSS의 width, height)만 정하고 굵기와 모양은 여기서 정한다. 컴포넌트 사이의 화살표 이음표
 * (blocks.tsx의 LinkGlyph)도 같은 그림이다. 정사각형이라 세로로 돌려 써도 자리가 같다
 */
export function ArrowMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M9 24H37M27 14L37 24L27 34" fill="none" stroke="currentColor" strokeLinecap="square" strokeWidth="2.5" />
    </svg>
  )
}
