// 부품(블록)으로 꾸미는 장. 사람이 부품을 고르고 끌어다 놓으면, 놓을 자리는 시스템이 정한다.
//
// 자리 규칙: 한 장에 줄은 셋까지, 한 줄에 칸은 셋까지, 부품은 여섯까지. 칸 너비는 12를 나눈 정해진 비율
// (1:1, 2:1, 1:2, 1:1:1, 2:1:1 ...) 가운데 하나다. 그래서 어디에 대충 놓아도 칸이 줄과 간격에 딱 맞고
// 삐뚤빼뚤해지지 않는다. 줄마다 잘리지 않을 높이를 주고, 남는 높이는 줄마다 똑같이 나눠 준다.
//
// 칸의 자리는 측정하지 않고 계산한다. 같은 계산을 CSS calc()로 써서 편집 화면, 발표, 내보낸 HTML이
// 똑같이 그리고, 끌어다 놓는 동안 놓일 자리를 찾을 때도 이 계산을 쓴다(움직이는 중인 화면을 재지 않는다).
//
// 부품 장의 코드는 blocks/ 폴더에 일마다 나눠 두고, 여기서 한꺼번에 내보낸다(가져다 쓰는 곳은 이 파일만 본다).

export * from './blocks/catalog'
export * from './blocks/native'
export * from './blocks/links'
export * from './blocks/rules'
export * from './blocks/cells'
export * from './blocks/convert'
export * from './blocks/sizing'
export * from './blocks/images'
export * from './blocks/place'
export * from './blocks/clean'
