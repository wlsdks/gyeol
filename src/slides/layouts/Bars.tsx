// 레이아웃: 막대 비교 (bars). 모양은 styles/bars.css

import { readField } from '../../deck/fields'
import { highlightOf, hintFor } from '../../deck/layouts'
import type { Slide } from '../../deck/types'
import { cx } from '../../lib/cx'
import { useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'
import { readNumber, seriesIn } from '../numbers'
import { Head, useItems, useUnitOpen } from './parts'

/** 숫자를 넣기 전, 편집할 때 흐리게 보여 줄 예시 길이. 어떤 모양의 장인지 알아보게만 한다. */
const DEMO_BARS = [64, 78, 100, 86, 72, 92]

/** 예시 숫자가 막대마다 있으면 그 비율로, 없으면 정해 둔 길이로. 안내 글의 숫자와 막대 길이가 맞아야 덜 어색하다. */
function demoBars(slide: Slide, n: number): number[] {
  const hinted = Array.from({ length: n }, (_, i) => readNumber(hintFor(slide.layout, slide.hints, 'value', 'value', i)) ?? 0)
  const top = Math.max(0, ...hinted)
  if (top > 0 && hinted.every((v) => v > 0)) return hinted.map((v) => (v / top) * 100)
  return Array.from({ length: n }, (_, i) => DEMO_BARS[i % DEMO_BARS.length])
}

export function Bars() {
  const { slide, meta, mode } = useSlide()
  const items = useItems()
  const unit = readField(slide, meta, 'unit').trim()
  const unitOpen = useUnitOpen(unit)
  // 막대끼리 길이를 견주므로 한 기준으로 ('1.2억', '9,500만')
  const values = seriesIn(
    items.map((it) => it.value),
    unit,
  ).values.map((v) => v ?? 0)
  const max = Math.max(0, ...values)
  const demo = mode !== 'final' && max <= 0
  const demoP = demo ? demoBars(slide, items.length) : []
  const highlight = highlightOf(slide)
  return (
    <>
      <Head lead />
      <div className="s-body br-wrap">
        {unitOpen && (
          <p className="br-top">
            <span className="br-unit">
              단위: <T k="unit" as="span" oneLine />
            </span>
          </p>
        )}
        <div className="br" data-n={items.length}>
          {items.map((it, i) => {
            const pct = demo ? demoP[i] : max > 0 && values[i] > 0 ? Math.max(2, (values[i] / max) * 100) : 0
            return (
              // 길이는 --p(0~100)로만 넘긴다. 가로 막대는 너비, 세로 막대는 높이로 쓴다.
              <div
                key={it.id}
                className={cx('it br-row', highlight === i && 'is-hl', demo && 'is-demo')}
                style={{ '--p': pct.toFixed(2) }}
              >
                <div className="br-label">
                  <IT i={i} k="title" className="br-name" />
                  <IT i={i} k="meta" className="br-meta" />
                </div>
                {/* 막대와 숫자. 가로 막대에서는 묶음 없이(contents) 줄의 칸에, 세로 막대에서는 바닥 줄 위의 한 칸에 */}
                <div className="br-bar">
                  <div className="br-track">
                    <div className="br-fill" />
                  </div>
                  <IT i={i} k="value" className="br-value" />
                </div>
                <ItemTools i={i} />
              </div>
            )
          })}
        </div>
      </div>
      <T k="source" className="s-source" />
    </>
  )
}
