// 레이아웃: 안 비교 (pricing). 모양은 styles/pricing.css

import { highlightOf } from '../../deck/layouts'
import { cx } from '../../lib/cx'
import { useSlide } from '../context'
import { IT, ItemTools } from '../fields'
import { Head, useItems, useSharedUnits } from './parts'

export function Pricing() {
  const { slide } = useSlide()
  const items = useItems()
  const units = useSharedUnits('value')
  const highlight = highlightOf(slide)
  return (
    <>
      <Head />
      <div className="s-body pr" data-n={items.length}>
        {items.map((it, i) => (
          <div key={it.id} className={cx('it pr-plan', highlight === i && 'is-hl')}>
            <div className="pr-top">
              <IT i={i} k="title" className="pr-name" />
              {highlight === i && <span className="pr-tag">추천</span>}
            </div>
            <IT i={i} k="value" className="pr-price" oneLine numeral units={units} />
            <IT i={i} k="meta" className="pr-meta" />
            <IT i={i} k="body" className="pr-body" multiline />
            <ItemTools i={i} />
          </div>
        ))}
      </div>
    </>
  )
}
