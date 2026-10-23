// 생동감 모드에서 큰 숫자를 0부터 올린다. 발표 화면과 내보낸 HTML의 뷰어가 같은 함수를 쓴다.
// 뷰어에는 이 함수의 소스(toString)가 그대로 들어가므로, 바깥의 아무것도 참조하지 않게 쓴다.

/** 숫자가 하나만 있는 칸만 올린다. '3~4개월', 날짜처럼 숫자가 여럿이면 그대로 둔다. */
export function countUp(root: ParentNode, duration = 1000): () => void {
  const selector = '.kp-value, .cs-value, .pr-price, .br-value'
  const frames: number[] = []
  const restores: (() => void)[] = []
  const nodes = root.querySelectorAll(selector)
  for (let n = 0; n < nodes.length; n++) {
    const walker = document.createTreeWalker(nodes[n], NodeFilter.SHOW_TEXT)
    let node = walker.nextNode() as Text | null
    while (node && !/\d/.test(node.nodeValue || '')) node = walker.nextNode() as Text | null
    if (!node) continue
    const text = node.nodeValue || ''
    const all = text.match(/\d[\d,]*(\.\d+)?/g)
    if (!all || all.length !== 1) continue
    const m = /^(\D*)(\d[\d,]*)(\.\d+)?(.*)$/s.exec(text)
    if (!m) continue
    const target = parseFloat((m[2] + (m[3] || '')).replace(/,/g, ''))
    if (!(target > 0) || target >= 1e12) continue
    const decimals = m[3] ? m[3].length - 1 : 0
    const grouped = m[2].indexOf(',') >= 0
    const el = node
    const format = (v: number) => {
      let s = v.toFixed(decimals)
      if (grouped) {
        const parts = s.split('.')
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        s = parts.join('.')
      }
      return m[1] + s + m[4]
    }
    const host = (nodes[n] as Element).closest(".it") || (nodes[n] as Element)
    const delay = parseFloat(getComputedStyle(host).animationDelay) * 1000 || 0
    const start = performance.now() + Math.min(delay, 1200) + 150
    el.nodeValue = format(0)
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration))
      // 처음엔 빠르게, 끝에서 천천히 멈춘다
      el.nodeValue = t >= 1 ? text : format(target * (1 - Math.pow(2, -10 * t)))
      if (t < 1) frames[n] = requestAnimationFrame(tick)
    }
    frames[n] = requestAnimationFrame(tick)
    restores.push(() => {
      cancelAnimationFrame(frames[n])
      el.nodeValue = text
    })
  }
  return () => restores.forEach((r) => r())
}
