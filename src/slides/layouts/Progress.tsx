// 레이아웃: 진행 현황 (progress). 모양은 styles/progress.css

import { hintFor } from '../../deck/layouts'
import { cx } from '../../lib/cx'
import { demoOf, useSlide } from '../context'
import { IT, ItemTools } from '../fields'
import { statusOf, STATUS_NAMES, type Status } from '../numbers'
import { Head, numberOrNull, useItems } from './parts'

const STATUS_ORDER: Status[] = ['done', 'doing', 'late', 'todo']

/**
 * 진행 현황: 과제마다 진행률 막대와 상태. 위에는 상태별 과제 수를 모아 '지연'이 먼저 눈에 들어오게.
 * 상태 칸을 비우면 발표할 때 진행률로 짐작한 상태(100%는 완료, 0%는 예정)를 보여 준다.
 */
export function Progress() {
  const { slide, mode } = useSlide()
  const items = useItems()
  const final = mode === 'final'
  const demo = demoOf(mode, items, ['value', 'body'])
  const rows = items.map((it, i) => {
    const valueText = demo ? hintFor(slide.layout, slide.hints, 'value', 'value', i) : it.value
    const stateText = demo ? hintFor(slide.layout, slide.hints, 'body', 'body', i) : it.body
    const n = numberOrNull(valueText)
    const pct = n === null ? null : Math.max(0, Math.min(100, n))
    // 편집할 때 상태 칸이 비어 있으면 색을 짐작하지 않는다. 안내 글과 색이 어긋나 보이지 않게
    const status = !final && !demo && !it.body.trim() ? null : statusOf(stateText, pct)
    return { pct, status }
  })
  const counts = STATUS_ORDER.map((s) => ({ s, n: rows.filter((r) => r.status === s).length })).filter((c) => c.n > 0)
  return (
    <>
      <Head />
      <div className={cx('s-body ps', demo && 'is-demo')} data-n={items.length}>
        {/* 머리줄 오른쪽에 상태별 과제 수. 상태가 한 가지뿐이면 셀 필요가 없어 '상태'라고만 */}
        <div className="ps-row ps-headrow">
          <span className="ps-h">과제</span>
          {counts.length > 1 ? (
            <p className="ps-sum">
              {counts.map((c) => (
                <span key={c.s} className={`ps-count is-${c.s}`}>
                  {STATUS_NAMES[c.s]}
                  <b>{c.n}</b>
                </span>
              ))}
            </p>
          ) : (
            <span className="ps-h ps-h-state">상태</span>
          )}
        </div>
        {items.map((it, i) => {
          const r = rows[i]
          const derived = final && !it.body.trim()
          return (
            <div key={it.id} className={cx('it ps-row', r.status && `is-${r.status}`)} style={{ '--p': (r.pct ?? 0).toFixed(1) }}>
              <div className="ps-name">
                <IT i={i} k="title" className="ps-title" />
                <IT i={i} k="meta" className="ps-meta" />
              </div>
              <div className="ps-track">
                <span className="ps-fill" />
              </div>
              <IT i={i} k="value" className="ps-pct" oneLine />
              <div className="ps-state">
                {derived ? (
                  r.status && <span className="ps-chip">{STATUS_NAMES[r.status]}</span>
                ) : (
                  <IT i={i} k="body" as="span" className="ps-chip" oneLine />
                )}
              </div>
              <ItemTools i={i} />
            </div>
          )
        })}
      </div>
    </>
  )
}
