import { placeHalos } from '../slides/halos'

/*
 * 개발용: 편집 화면의 칸 점검. #/gallery?mode=edit … → 콘솔에서 checkEdit()
 * 칸끼리 겹치는 것(레이아웃이 칸 자리를 잘못 잡은 것)과, 칸에 두른 면끼리 겹치는 것(halos.ts가 못 막은 것)을 찾는다.
 */
export async function checkEdit(): Promise<{ slides: number; fields: number; problems: string[] }> {
  await document.fonts.ready
  await new Promise((r) => setTimeout(r, 300))
  const problems: string[] = []
  let fields = 0
  const slides = [...document.querySelectorAll<HTMLElement>('.slide.m-edit')]
  slides.forEach((slide, i) => {
    const boxes = placeHalos(slide)
    fields += boxes.length
    const name = [...slide.classList].filter((c) => c.startsWith('l-') || c.startsWith('va-')).join(' ')
    const label = (el: HTMLElement) => el.querySelector('.ed-hint')?.textContent?.slice(0, 16) || [...el.classList].find((c) => c !== 'ed' && c !== 'is-empty') || '?'
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        const p = boxes[a]
        const q = boxes[b]
        const ox = Math.min(p.r, q.r) - Math.max(p.l, q.l)
        const oy = Math.min(p.b, q.b) - Math.max(p.t, q.t)
        if (ox > 2 && oy > 2) {
          problems.push(`${i + 1}번 장 ${name}: 칸 '${label(p.el)}'와 '${label(q.el)}'가 겹쳐요`)
          continue
        }
        // 두른 면까지 넣어 겹치는지
        const hx = Math.min(p.r + p.h[1], q.r + q.h[1]) - Math.max(p.l - p.h[3], q.l - q.h[3])
        const hy = Math.min(p.b + p.h[2], q.b + q.h[2]) - Math.max(p.t - p.h[0], q.t - q.h[0])
        if (hx > 2 && hy > 2) problems.push(`${i + 1}번 장 ${name}: '${label(p.el)}'와 '${label(q.el)}'의 면이 겹쳐요`)
      }
    }
  })
  return { slides: slides.length, fields, problems }
}
