/**
 * 부품 장에서 칸에 다 들어가지 않는 부품을 잘리지 않게 맞춘다.
 * 부품을 놓을 때는 잘리지 않는 자리만 고르지만, 놓은 뒤에 항목을 더하거나 글을 길게 쓰면 넘칠 수 있다.
 *
 * 1. 줄마다의 가장 낮은 높이를 더해도 본문 상자보다 높으면, 줄 높이를 같은 비율로 낮춘다(--bk-sq).
 * 2. 그래도 칸 안의 글이 넘치는 부품은 글자를 단계로 줄인다(--bk-fit). 단계라서 같은 장의 비슷한 칸끼리 크기가 같다.
 *
 * 앱과 내보낸 HTML(export/viewer.ts가 소스를 그대로 넣는다)이 같이 쓴다. 그래서 바깥의 이름을 쓰지 않는다.
 */
export function fitBlocks(root: ParentNode): void {
  const steps = [0.92, 0.84, 0.76, 0.68]
  const areas = root instanceof HTMLElement && root.classList.contains('bk-area') ? [root] : Array.from(root.querySelectorAll<HTMLElement>('.bk-area'))
  for (const area of areas) {
    const cells = Array.from(area.children).filter((c) => c instanceof HTMLElement && c.classList.contains('bk')) as HTMLElement[]
    area.style.removeProperty('--bk-sq')
    for (const c of cells) c.style.removeProperty('--bk-fit')
    // 안 보이는 장(자리를 재지 못한다)은 건너뛴다
    if (!cells.length || !area.clientHeight) continue
    const rows = Number(area.dataset.rows) || 1
    const gaps = (parseFloat(getComputedStyle(area).rowGap) || 0) * (rows - 1)
    const need = area.scrollHeight - gaps
    const room = area.clientHeight - gaps
    if (need > room + 1) area.style.setProperty('--bk-sq', Math.max(0.4, room / need).toFixed(3))
    for (const c of cells) {
      const inner = c.querySelector<HTMLElement>(':scope > .bk-in')
      if (!inner) continue
      for (const k of steps) {
        if (inner.scrollHeight <= inner.clientHeight + 2 && inner.scrollWidth <= inner.clientWidth + 2) break
        c.style.setProperty('--bk-fit', String(k))
      }
    }
  }
}
