// 부품: 개요 (facts). 모양은 styles/blocks/facts.css

import { BLOCKS } from '../../deck/blocks'
import { useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'

/** 개요: 항목과 내용을 짝지은 줄 */
export function Facts() {
  const { slide } = useSlide()
  const items = slide.items.slice(0, BLOCKS.facts.items!.max)
  return (
    <div className="bk-fc">
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <dl className="bk-fc-list" data-n={items.length}>
        {items.map((it, i) => (
          <div key={it.id} className="it bk-fc-row">
            <IT i={i} k="title" as="dt" className="bk-fc-k" />
            <IT i={i} k="body" as="dd" className="bk-fc-v" multiline />
            <ItemTools i={i} />
          </div>
        ))}
      </dl>
    </div>
  )
}
