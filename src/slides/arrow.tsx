// 화살표 그림 하나: 두 쪽을 잇는 화살표(비교, 전과 후, 걱정과 대책)가 모두 이것을 그린다

/**
 * 가는 꺾쇠 하나(›): 점, 선, 꽉 찬 세모 머리를 이은 화살표는 흔한 다이어그램 그림이라 괘선과 글자로 짠 지면에서 떠 보였다(사용자 의견).
 * 선 없이 꺾쇠만 두면 쪽 사이의 빈자리가 선 노릇을 하고, 꺾쇠가 읽는 쪽을 가리킨다. 굵기는 줄 선과 비슷한 2.5, 끝은 각지게.
 * 칸마다 그림 크기(CSS의 width, height)만 정하고 굵기와 모양은 여기서 정한다. 컴포넌트 사이의 화살표 이음표
 * (blocks.tsx의 LinkGlyph)도 같은 그림이다. 정사각형이라 세로로 돌려 써도 자리가 같다
 */
export function ArrowMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M19 12L31 24L19 36" fill="none" stroke="currentColor" strokeLinecap="square" strokeWidth="2.5" />
    </svg>
  )
}
