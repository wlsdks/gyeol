// 부품: 항목별 증감 (diverge). 모양은 styles/blocks/diverge.css

import { BLOCKS } from '../../deck/blocks'
import { hintFor } from '../../deck/layouts'
import { cx } from '../../lib/cx'
import { demoOf, useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'
import { seriesIn } from '../numbers'
import { ChartKey } from './parts'

/**
 * 항목별 증감: 0을 세로 선으로 두고 늘어난 것은 오른쪽, 줄어든 것은 왼쪽으로 뻗는다. 0의 자리는 양쪽 가장 큰 값의 비율로 옮겨
 * (모두 늘었으면 왼쪽 끝) 빈 반쪽이 생기지 않게 한다. 늘어난 것이 좋은지(매출) 나쁜지(비용)는 장마다 달라서 강조할 쪽을 고른다
 */
export function Diverge() {
  const { slide, mode } = useSlide()
  const items = slide.items.slice(0, BLOCKS.diverge.items!.max)
  const demo = demoOf(mode, items)
  // 막대 길이끼리 견주므로 한 기준으로 ('+1.2억', '−4,000만')
  const values = seriesIn(items.map((it, i) => (demo ? hintFor(slide.layout, slide.hints, 'value', 'value', i) : it.value))).values
  const known = values.filter((v): v is number => v !== null)
  const pos = Math.max(0, ...known)
  const neg = Math.max(0, ...known.map((v) => -v))
  const range = pos + neg || 1
  const z = (neg / range) * 100
  const down = slide.variant === 'down'
  return (
    <div className={cx('bk-dv', demo && 'is-demo', neg > 0 && 'has-neg', pos > 0 && 'has-pos')} style={{ '--z': z.toFixed(2) }}>
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <ChartKey unitKey="basis" />
      <ul className="bk-dv-list" data-n={items.length}>
        {items.map((it, i) => {
          const v = values[i]
          const side = v === null || v === 0 ? null : v > 0 ? 'pos' : 'neg'
          const hl = side !== null && (side === 'neg') === down
          return (
            <li
              key={it.id}
              className={cx('it bk-dv-row', side && `is-${side}`, hl && 'is-hl', v === null && 'is-blank')}
              style={{ '--p': v === null ? 0 : ((Math.abs(v) / range) * 100).toFixed(2) }}
            >
              <IT i={i} k="title" className="bk-dv-name" />
              <div className="bk-dv-track">
                <div className="bk-dv-scale">
                  <span className="bk-dv-axis" aria-hidden="true" />
                  {side && <span className="bk-dv-bar" aria-hidden="true" />}
                  <span className="bk-dv-v">
                    <IT i={i} k="value" as="span" className="bk-dv-num" oneLine />
                  </span>
                </div>
              </div>
              <ItemTools i={i} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
