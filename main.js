// 이 페이지의 움직임은 하나뿐이다: '발표할 때 움직여요'의 작은 장이 화면에 들어오면 한 번 재생된다.
// 컴퓨터에서 '동작 줄이기'를 켜 두었거나 스크립트가 없으면 다 보인 모습 그대로 둔다.
(() => {
  const demo = document.querySelector('[data-demo]')
  if (!demo || !('IntersectionObserver' in window)) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const replay = document.querySelector('[data-replay]')
  const values = [...demo.querySelectorAll('[data-to]')]
  let timers = []
  let frames = []

  // 막대가 자라는 동안 숫자도 0부터 올라간다. 끝은 늘 원래 숫자
  function count(el, delay) {
    const to = Number(el.dataset.to)
    const dur = 950
    timers.push(
      setTimeout(() => {
        const start = performance.now()
        const tick = (now) => {
          const k = Math.min(1, (now - start) / dur)
          const eased = 1 - Math.pow(1 - k, 4)
          el.textContent = String(Math.round(to * eased))
          if (k < 1) frames.push(requestAnimationFrame(tick))
        }
        frames.push(requestAnimationFrame(tick))
      }, delay),
    )
  }

  function play() {
    timers.forEach(clearTimeout)
    frames.forEach(cancelAnimationFrame)
    timers = []
    frames = []
    demo.classList.remove('is-play')
    values.forEach((v) => (v.textContent = '0'))
    // 처음 모습을 한 번 그린 뒤에 재생해야 전환이 걸린다
    void demo.offsetWidth
    demo.classList.add('is-play')
    values.forEach((v, i) => count(v, 450 + i * 110))
  }

  demo.classList.add('is-armed')
  const seen = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      seen.disconnect()
      play()
      if (replay) replay.hidden = false
    },
    { threshold: 0.6 },
  )
  seen.observe(demo)
  replay?.addEventListener('click', play)
})()
