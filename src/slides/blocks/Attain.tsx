// 부품: 기간별 달성 (attain)

import { BLOCKS } from '../../deck/blocks'
import { readField } from '../../deck/fields'
import { hintFor } from '../../deck/layouts'
import type { Item } from '../../deck/types'
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
  if (slide.variant === 'gap') return <AttainGap items={items} actual={actual} goal={goal} ok={series.ok} met={met} judged={judged} hit={hit} demo={demo} edit={mode === 'edit'} />
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

/** 목표보다 몇 % 더하거나 덜했는지: +5%, −12%, 딱 목표면 ±0% */
function gapText(d: number): string {
  const shown = Math.abs(d) < 10 ? Math.round(Math.abs(d) * 10) / 10 : Math.round(Math.abs(d))
  if (shown === 0) return '±0%'
  return `${d > 0 ? '+' : '−'}${formatNumber(shown)}%`
}

/**
 * 목표와의 차이: 목표(100%)를 가로 기준선으로 두고, 기간마다 목표보다 더한 만큼은 위로, 모자란 만큼은 아래로 막대를 세운다
 * (경영 보고에서 계획 대비 편차를 그리는 꼴). 실적 막대 끝의 목표 줄을 눈으로 견주지 않아도, 모자란 기간이 기준선 아래로
 * 내려가 바로 보인다. 모두 목표를 넘었으면 기준선은 바닥에, 모두 모자랐으면 천장에 붙는다(빈 반쪽을 두지 않는다).
 * 막대 끝에는 차이(+5%), 이름 아래에는 실적과 목표를 '42 / 40'으로 적는다
 */
function AttainGap({
  items,
  actual,
  goal,
  ok,
  met,
  judged,
  hit,
  demo,
  edit,
}: {
  items: Item[]
  actual: (number | null)[]
  goal: (number | null)[]
  ok: boolean
  met: (boolean | null)[]
  judged: number
  hit: number
  demo: boolean
  edit: boolean
}) {
  const gaps = items.map((_, i) => (ok && actual[i] !== null && goal[i] ? (actual[i]! / goal[i]! - 1) * 100 : null))
  const known = gaps.filter((g): g is number => g !== null)
  const hi = Math.max(0, ...known)
  const lo = Math.min(0, ...known)
  // 눈금은 10%는 잡는다: 차이 범위만큼만 잡으면 +5%, +2%뿐인 장에서 +5% 막대가 그래프 높이를 다 채워 크게 넘은 것처럼 보였다
  const span = Math.max(10, hi - lo)
  const base = (-lo / span) * 100
  return (
    <div className={cx('bk-cc bk-tg bk-ag', demo && 'is-demo')} style={{ '--n': items.length }}>
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
          <span className="bk-cc-lk is-goal">
            <i aria-hidden="true" />
            목표
          </span>
        }
      />
      <div className="bk-cc-plot bk-ag-plot" style={{ '--b': base.toFixed(2) }}>
        <div className="bk-ag-axis" aria-hidden="true" />
        {items.map((it, i) => {
          const g = gaps[i]
          return (
            <div
              key={it.id}
              className={cx('it bk-cc-col bk-ag-col', met[i] === true && 'is-hl', met[i] === false && 'is-miss', g !== null && g < 0 && 'is-down')}
              style={{ '--p': g === null ? '0' : ((Math.abs(g) / span) * 100).toFixed(2), gridColumn: i + 1 }}
            >
              <div className="bk-ag-track">
                {g !== null && <span className="bk-ag-fill" />}
                {g !== null && <span className="bk-ag-v">{gapText(g)}</span>}
              </div>
              <div className="bk-cc-label">
                <IT i={i} k="title" className="bk-cc-name" />
                <span className="bk-ag-nums">
                  <IT i={i} k="value" as="span" className="bk-ag-a" oneLine />
                  {(edit || items[i].meta.trim() || demo) && (
                    <span className="bk-ag-g">
                      {' / '}
                      <IT i={i} k="meta" as="span" className="bk-ag-gv" oneLine />
                    </span>
                  )}
                </span>
              </div>
              <ItemTools i={i} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

