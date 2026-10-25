// 부품: 점 목록 (bullets)

import { BLOCKS } from '../../deck/blocks'
import { useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'

export function Bullets() {
  const { slide } = useSlide()
  const items = slide.items.slice(0, BLOCKS.bullets.items!.max)
  return (
    <div className="bk-bl">
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <ul className="bk-list" data-n={items.length}>
        {items.map((it, i) => (
          <li key={it.id} className="it bk-li">
            <span className="bk-dot" aria-hidden="true" />
            <div className="bk-li-text">
              <IT i={i} k="title" className="bk-li-t" multiline />
              <IT i={i} k="body" className="bk-li-b" multiline />
            </div>
            <ItemTools i={i} />
          </li>
        ))}
      </ul>
    </div>
  )
}
