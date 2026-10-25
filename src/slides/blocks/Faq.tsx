// 부품: 예상 질문 (faq). 모양은 styles/blocks/faq.css

import { BLOCKS } from '../../deck/blocks'
import { useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'

/** 예상 질문: 질문과 짧은 답 */
export function Faq() {
  const { slide } = useSlide()
  const items = slide.items.slice(0, BLOCKS.faq.items!.max)
  return (
    <div className="bk-qa">
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <dl className="bk-qa-list" data-n={items.length}>
        {items.map((it, i) => (
          <div key={it.id} className="it bk-qa-item">
            <dt className="bk-qa-q">
              <span className="bk-qa-k" aria-hidden="true">
                Q
              </span>
              <IT i={i} k="title" className="bk-qa-qt" multiline />
            </dt>
            <dd className="bk-qa-a">
              <IT i={i} k="body" className="bk-qa-at" multiline />
            </dd>
            <ItemTools i={i} />
          </div>
        ))}
      </dl>
    </div>
  )
}
