// 화살표 그림 하나: 두 쪽을 잇는 화살표(비교, 전과 후, 걱정과 대책)가 모두 이것을 그린다

/**
 * 선과 꽉 찬 세모 머리: 흐름(flow.css)의 잇는 선과 같은 머리다. 예전에는 선 끝에 꺾쇠를 얹은 흔한 아이콘이라
 * 글자 화살표(→)를 쳐 넣은 것처럼 보였다. 잇는 선의 점(보내는 쪽)은 없다: 점은 상자 가장자리에 붙는 선에만 두고,
 * 이 화살표는 두 쪽 사이에 혼자 선다(작은 줄 화살표에 점까지 넣으면 뭉개져 보였다).
 * 칸마다 그림 크기(CSS의 width, height)만 정하고 굵기와 모양은 여기서 정한다:
 * 칸마다 선 굵기를 따로 두면(2, 3) 같은 화살표가 장마다 다른 무게로 보였다. 컴포넌트 사이의 화살표 이음표
 * (blocks.tsx의 LinkGlyph)도 같은 그림이다. 정사각형이라 세로로 돌려 써도 자리가 같다
 */
export function ArrowMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M4 24H30" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      <path d="M26 14L46 24L26 34Z" fill="currentColor" stroke="none" />
    </svg>
  )
}
