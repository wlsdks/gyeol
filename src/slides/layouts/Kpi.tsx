// 레이아웃: 핵심 숫자 (kpi). 모양은 styles/kpi.css

import { variantOf } from '../../deck/layouts'
import { useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'
import { Head, useItems, useSharedUnits } from './parts'

export function Kpi() {
  const { slide } = useSlide()
  const items = useItems()
  // 하나 크게: 첫 숫자는 혼자 크고, 나머지끼리 한 크기
  const focus = variantOf(slide) === 'focus' && items.length > 1
  const units = useSharedUnits('value', focus ? (i) => i === 0 : undefined)
  return (
    <>
      <Head />
      <div className="s-body kp" data-n={items.length} style={{ '--n': items.length }}>
        {items.map((it, i) => (
          <div key={it.id} className="it kp-item">
            <IT i={i} k="title" className="kp-label" />
            <IT i={i} k="value" className="kp-value" oneLine numeral units={focus && i === 0 ? undefined : units} />
            <IT i={i} k="body" className="kp-body" multiline />
            <ItemTools i={i} />
          </div>
        ))}
      </div>
      <T k="source" className="s-source" />
    </>
  )
}
