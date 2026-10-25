// 부품: 기간별 달성 (attain)

import { BLOCKS } from '../../deck/blocks'
import { readField } from '../../deck/fields'
import { hintFor } from '../../deck/layouts'
import { cx } from '../../lib/cx'
import { demoOf, useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'
import { formatNumber, seriesIn } from '../numbers'
import { ChartKey } from './parts'

/**
 * 기간별 달성: 기간마다 실적 막대와 목표 표시(가로 줄). 목표를 넘은 기간만 강조색이고 못 미친 기간은 회색이라
 * 어느 달이 모자랐는지가 먼저 보인다. 막대 위에 실적과 목표 숫자를, 이름 아래에 달성률을 붙인다
 */
export function Attain() {
  const { slide, meta, mode } = useSlide()
  const items = slide.items.slice(0, BLOCKS.attain.items!.max)
  const final = mode === 'final'
  const demo = demoOf(mode, items, ['value', 'meta'])
  const text = (k: 'value' | 'meta', i: number) => (demo ? hintFor(slide.layout, slide.hints, k, k, i) : items[i][k])
  // 실적과 목표를 한 기준으로 읽는다. 단위가 서로 다른 값이 섞였으면 달성과 달성률은 말하지 않고 막대만 그린다
  const series = seriesIn([...items.map((_, i) => text('value', i)), ...items.map((_, i) => text('meta', i))], readField(slide, meta, 'unit'))
  const actual = series.values.slice(0, items.length)
  const goal = series.values.slice(items.length)
  const top = Math.max(0, ...actual.map((v) => v ?? 0), ...goal.map((v) => v ?? 0))
  const y = (v: number | null) => (v === null || top <= 0 ? 0 : (Math.max(0, v) / top) * 100)
  const met = items.map((_, i) => (actual[i] === null || goal[i] === null || !series.ok ? null : actual[i]! >= goal[i]!))
  const judged = met.filter((m) => m !== null).length
  const hit = met.filter((m) => m === true).length
  return (
    <div
      className={cx('bk-cc bk-tg', demo && 'is-demo', items.length <= 6 && items.every((it) => [...it.title.trim()].length <= 4) && 'is-short')}
      style={{ '--n': items.length }}
    >
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <ChartKey
        sum={
          judged > 1 ? (
            <>
              {judged}번 중 <b>{hit}번</b> 달성
            </>
          ) : undefined
        }
        keys={
          <>
            <span className="bk-cc-lk is-bar">
              <i aria-hidden="true" />
              실적
            </span>
            <span className="bk-cc-lk is-goal">
              <i aria-hidden="true" />
              목표
            </span>
          </>
        }
      />
      <div className="bk-cc-plot">
        {items.map((it, i) => {
          const rate = actual[i] !== null && goal[i] && series.ok ? Math.round((actual[i]! / goal[i]!) * 100) : null
          return (
            <div
              key={it.id}
              className={cx('it bk-cc-col', met[i] === true && 'is-hl', met[i] === false && 'is-miss')}
              style={{ '--p': y(actual[i]).toFixed(2), '--g': y(goal[i]).toFixed(2), '--m': Math.max(y(actual[i]), y(goal[i])).toFixed(2) }}
            >
              <div className="bk-cc-bar bk-tg-bar">
                <span className="bk-cc-fill" />
                {(goal[i] !== null || !final) && <span className="bk-tg-goal" aria-hidden="true" />}
                {/* 목표 숫자는 편집할 때만 막대 위에서 적는다. 발표할 때는 목표 줄과 달성률로 읽혀서, 기간마다 숫자 둘을 늘어놓지 않는다 */}
                <span className="bk-tg-v">
                  <IT i={i} k="value" as="span" className="bk-cc-num" oneLine />
                  {mode === 'edit' && (
                    <span className="bk-tg-g">
                      목표 <IT i={i} k="meta" as="span" className="bk-tg-gv" oneLine />
                    </span>
                  )}
                </span>
              </div>
              <div className="bk-cc-label">
                <IT i={i} k="title" className="bk-cc-name" />
                {rate !== null && <span className="bk-tg-rate">{formatNumber(rate)}%</span>}
              </div>
              <ItemTools i={i} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
