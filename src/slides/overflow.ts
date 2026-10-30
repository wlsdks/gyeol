/**
 * 편집기가 '글이 넘쳤어요', '자리가 모자라요'를 띄울지 보는 곳. 편집기(SlideStage.tsx의 useOverflow), 장 목록의 그림,
 * 개발용 점검(screens/checkEdit.ts)이 같이 쓴다: 따로 두면 점검이 통과해도 편집기는 넘쳤다고 알렸다.
 */

/** 글이 넘칠 수 있는 상자: 장 전체와 레이아웃의 본문 칸, 부품의 안쪽 */
const BOXES = '.s-body, .ix-text, .cs-main, .cs-side, .cl-main, .cv-main, .ag, .bk-in'

/** 넘친 칸 하나: 칸의 id(.ed-input의 data-field)와 화면에 보이는 칸 이름 */
export interface OverField {
  id: string
  label: string
}

/**
 * 장의 글이 넘쳤는지와 넘친 칸들. 넘친 칸은 넘친 상자의 아래 끝(장 전체는 오른쪽 끝도) 밖으로 나간 글 칸이다.
 * 예전에는 넘쳤다는 것만 알려서, 어느 칸을 줄여야 하는지 장을 뒤져 찾아야 했다
 */
export function overflowAt(root: HTMLElement): { over: boolean; fields: OverField[] } {
  const boxes = [root, ...root.querySelectorAll<HTMLElement>(BOXES)]
  // 빈칸의 옅은 면(.ed-halo)은 글보다 조금 넓게 깔려서 맨 아래 칸이면 상자 밖으로 나온다. 글이 넘친 것이 아니니 재는 동안만 숨긴다
  root.classList.add('is-measuring')
  // 항목 빼기 버튼이 칸 오른쪽으로 살짝 나와 있어서, 가로 넘침은 슬라이드 전체만 본다.
  const wide = root.scrollWidth - root.clientWidth > 4
  const tall = boxes.filter((el) => el.scrollHeight - el.clientHeight > 4)
  const fields: OverField[] = []
  if (wide || tall.length) {
    const right = root.getBoundingClientRect().right
    const bottoms = tall.map((b) => [b, b.getBoundingClientRect().bottom] as const)
    for (const input of root.querySelectorAll<HTMLElement>('.ed > .ed-input[data-field]')) {
      const r = input.parentElement!.getBoundingClientRect()
      if (!r.width && !r.height) continue
      const out = (wide && r.right > right + 1) || bottoms.some(([b, bottom]) => b.contains(input) && r.bottom > bottom + 1)
      if (out) fields.push({ id: input.dataset.field!, label: input.getAttribute('aria-label') || '' })
    }
  }
  root.classList.remove('is-measuring')
  return { over: wide || tall.length > 0, fields }
}

export function slideOverflow(root: HTMLElement): 'over' | null {
  return overflowAt(root).over ? 'over' : null
}
