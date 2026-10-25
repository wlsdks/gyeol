/**
 * 이 PC의 스크롤바 너비를 --sbw로 둔다. 맥(겹쳐 그리는 스크롤바)은 0, 윈도우는 17px 남짓이고 화면 배율에 따라 바뀐다.
 * 스크롤되는 칸은 scrollbar-gutter로 오른쪽에 스크롤바 자리를 잡는데, 그 자리를 여백 삼아 오른쪽 여백을 줄여 두면
 * 맥에서는 오른쪽만 좁고, 그대로 두면 윈도우에서 오른쪽만 넓었다. --sbw를 빼면 두 곳 모두 왼쪽과 같아 보인다
 */
export function watchScrollbar(): void {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;top:-200px;width:100px;height:100px;overflow:scroll;visibility:hidden'
  document.body.append(probe)
  const measure = () => document.documentElement.style.setProperty('--sbw', `${probe.offsetWidth - probe.clientWidth}px`)
  measure()
  // 화면 배율을 바꾸면 스크롤바의 CSS 너비도 바뀐다
  window.addEventListener('resize', measure)
}
