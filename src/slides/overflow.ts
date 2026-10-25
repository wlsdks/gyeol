/**
 * 편집기가 '글이 넘쳤어요', '자리가 모자라요'를 띄울지 보는 곳. 편집기(Editor.tsx의 useOverflow)와
 * 개발용 점검(screens/checkEdit.ts)이 같이 쓴다: 따로 두면 점검이 통과해도 편집기는 넘쳤다고 알렸다.
 */
export function slideOverflow(root: HTMLElement): 'over' | 'tight' | null {
  const boxes = [root, ...root.querySelectorAll<HTMLElement>('.s-body, .ix-text, .cs-main, .cs-side, .cl-main, .cv-main, .ag, .bk-in')]
  // 빈칸의 옅은 면(.ed-halo)은 글보다 조금 넓게 깔려서 맨 아래 칸이면 상자 밖으로 나온다. 글이 넘친 것이 아니니 재는 동안만 숨긴다
  root.classList.add('is-measuring')
  // 항목 빼기 버튼이 칸 오른쪽으로 살짝 나와 있어서, 가로 넘침은 슬라이드 전체만 본다.
  const over = root.scrollWidth - root.clientWidth > 4 || boxes.some((el) => el.scrollHeight - el.clientHeight > 4)
  root.classList.remove('is-measuring')
  const tight = [...root.querySelectorAll<HTMLElement>('.bk-area')].some((a) => a.style.getPropertyValue('--bk-sq'))
  return over ? 'over' : tight ? 'tight' : null
}
