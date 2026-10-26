// 위아래로 늘어선 목록을 끌어 차례를 바꿀 때(장 목록, 나오는 차례, 움직임 편집의 시간표) 같이 쓰는 dnd-kit 조정

import type { Modifier } from '@dnd-kit/core'

/**
 * 끄는 것을 위아래로만, 그리고 목록이 스크롤되는 칸의 보이는 곳 안에서만 움직인다.
 * 칸 밖으로 끌면 끄는 것이 그만큼 칸의 스크롤 높이를 늘려서, 칸 끝에 대고 있으면 저절로 스크롤이 실제 끝을 넘어 빈 곳으로
 * 끝없이 이어졌다(칸에 끄는 것 하나만 남았다). 보이는 곳은 늘 내용 안이라 스크롤 높이가 늘지 않고, 저절로 스크롤은 손의 자리로
 * 움직여서 그대로 실제 끝까지 간다.
 * 끄는 것의 화면 자리는 끌기 시작할 때의 자리(activeNodeRect)에 transform을 더한 곳이다: 칸이 스크롤된 만큼은 dnd-kit이
 * 따로 더해 손 밑에 둔다
 */
export const keepInList: Modifier = ({ transform, activeNodeRect, scrollableAncestorRects }) => {
  const box = scrollableAncestorRects[0]
  if (!activeNodeRect || !box) return { ...transform, x: 0 }
  const y = Math.min(Math.max(transform.y, box.top - activeNodeRect.top), box.bottom - activeNodeRect.bottom)
  return { ...transform, x: 0, y }
}

/**
 * 칸 끝의 저절로 스크롤: 칸 높이의 10% 띠 안에서, 끝에 닿으면 초당 1000px(dnd-kit의 기본은 20% 띠, 초당 2000px).
 * 기본값으로는 칸 끝 가까이의 줄을 잡아 조금만 움직여도 목록이 곧바로 0.2초에 200px씩 굴러, 세 줄짜리 나오는 차례에서는
 * 바라던 자리를 지나쳐 맨 끝에 놓였다
 */
export const LIST_AUTO_SCROLL = { threshold: { x: 0, y: 0.1 }, acceleration: 5 }
