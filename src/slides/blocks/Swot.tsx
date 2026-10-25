// 부품: 강점과 약점 (swot). 모양은 styles/blocks/swot.css

import { BLOCKS } from '../../deck/blocks'
import { useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'

const SWOT = ['S', 'W', 'O', 'T']

/** 강점과 약점(SWOT): 위는 안(강점, 약점), 아래는 밖(기회, 위협). 칸 이름 글자(S, W, O, T)는 옅게 */
export function Swot() {
  const { slide } = useSlide()
  const items = slide.items.slice(0, BLOCKS.swot.items!.max)
  return (
    <div className="bk-sw">
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <ul className="bk-sw-grid">
        {items.map((it, i) => (
          <li key={it.id} className="it bk-sw-q">
            <div className="bk-sw-top">
              <span className="bk-sw-k" aria-hidden="true">
                {SWOT[i]}
              </span>
              <IT i={i} k="title" className="bk-sw-t" />
            </div>
            <IT i={i} k="body" className="bk-sw-b" multiline />
            <ItemTools i={i} />
          </li>
        ))}
      </ul>
    </div>
  )
}
