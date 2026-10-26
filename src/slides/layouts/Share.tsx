// 레이아웃: 구성비 (share). 모양은 styles/share.css

import { readField } from '../../deck/fields'
import { highlightOf, hintFor } from '../../deck/layouts'
import { cx } from '../../lib/cx'
import { demoOf, useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'
import { formatNumber, seriesIn } from '../numbers'
import { accentTint, TINT_COUNT } from '../tints'
import { Head, useItems, useUnitOpen } from './parts'

/** 100칸을 비중대로 나눈다. 내림한 뒤 남는 칸은 소수점 아래가 큰 항목부터 하나씩 (모두 더하면 100, 비중이 0이면 0칸) */
export function unitsOf(pcts: number[]): number[] {
  const out = pcts.map((p) => Math.floor(p))
  let left = 100 - out.reduce((a, b) => a + b, 0)
  const byRest = pcts.map((p, i) => ({ i, rest: p - Math.floor(p) })).sort((a, b) => b.rest - a.rest)
  for (const { i } of byRest) {
    if (left <= 0) break
    if (pcts[i] <= 0) continue
    out[i]++
    left--
  }
  return out
}

/**
 * 구성비: 값을 더한 전체에서 각 항목의 비중. 띠는 한 줄 막대를, 도넛은 고리를, 100칸은 10×10 칸을 나눈다.
 * 모두 %로 적었으면 적은 그대로 보이고, 금액이나 건수로 적었으면 비중을 계산해 크게, 적은 값은 작게.
 */
export function Share() {
  const { slide, meta, mode } = useSlide()
  const items = useItems()
  const final = mode === 'final'
  const highlight = highlightOf(slide)
  const demo = demoOf(mode, items)
  const texts = items.map((it, i) => (demo ? hintFor(slide.layout, slide.hints, 'value', 'value', i) : it.value).trim())
  const unit = readField(slide, meta, 'unit').trim()
  const unitOpen = useUnitOpen(unit)
  // 값을 한 기준으로 더한다 ('1.2억'과 '8,000만'). 단위가 서로 다른 값이 섞였으면 비중과 합계는 틀린 숫자라 보이지 않는다
  const series = seriesIn(texts, unit)
  const values = series.values.map((v) => Math.max(0, v ?? 0))
  const sum = values.reduce((a, b) => a + b, 0)
  const pcts = values.map((v) => (sum > 0 ? (v / sum) * 100 : 0))
  const typedPct = texts.every((t) => !t || t.includes('%'))
  const pctText = (p: number) => (!series.ok ? '–' : p > 0 && p < 1 ? '1% 미만' : `${formatNumber(p < 10 ? Math.round(p * 10) / 10 : Math.round(p))}%`)
  let grey = 0
  const colors = items.map((_, i) => {
    // 강조할 조각이 없으면 강조색의 농담, 있으면 그 조각만 강조색이고 나머지는 강조색의 옅은 농담(셋째 단계부터, 큰 조각부터 진하게).
    // 회색 농담은 첫 단계가 중간 회색이라 강조색 옆에서 같은 무게의 회색 덩어리로 읽혔다(VISUAL-RULES 3)
    if (highlight < 0) return accentTint(i)
    if (i === highlight) return 'var(--accent)'
    return accentTint(Math.min(2 + grey++, TINT_COUNT - 1))
  })
  let start = 0
  const segs = pcts.map((p) => {
    const s = { start, len: p }
    start += p
    return s
  })
  const donut = slide.variant === 'donut'
  const units = slide.variant === 'units'
  // 100칸: 왼쪽 위에서부터 줄마다 항목 차례대로 칠한다. 칸 하나가 1%
  const cells = units ? unitsOf(pcts).flatMap((n, i) => Array.from({ length: n }, () => i)) : []
  // '131억 원'처럼 숫자와 단위는 붙여 쓴다. 단위 칸이 비었으면 값에 붙여 쓴 자리와 단위('58억'이면 억)
  const totalText = sum > 0 && !typedPct && series.ok ? `${formatNumber(sum)}${series.suffix}` : ''
  return (
    <>
      <Head />
      <div className={cx('s-body sh', demo && 'is-demo')} data-n={items.length} style={{ '--n': items.length }}>
        {/* 띠는 합계를 위에, 도넛은 고리 가운데에, 100칸은 이름표 목록 위에. 단위 칸은 편집할 때만: 띠는 오른쪽 위에, 도넛은 고리 가운데 합계 아래에
            (도넛의 오른쪽 위는 이름표 목록이 차지해서 덮는다) */}
        {!donut && (totalText || (!final && unitOpen)) && (
          <div className="sh-top">
            <span className="sh-sum">{totalText && `합계 ${totalText}`}</span>
            {!final && unitOpen && (
              <span className="sh-unit">
                단위: <T k="unit" as="span" oneLine />
              </span>
            )}
          </div>
        )}
        {donut ? (
          <div className="sh-ring">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle className="sh-ring-track" cx="50" cy="50" r="40" />
              {segs.map((s, i) =>
                s.len > 0 ? (
                  <circle
                    key={items[i].id}
                    className="sh-arc"
                    cx="50"
                    cy="50"
                    r="40"
                    pathLength="100"
                    // 조각 사이를 조금 띄운다. 한 조각뿐이면 고리를 닫는다
                    strokeDasharray={`${Math.max(0.01, s.len - (s.len < 100 ? 0.7 : 0))} 100`}
                    strokeDashoffset={-s.start}
                    style={{ stroke: colors[i] }}
                  />
                ) : null,
              )}
            </svg>
            {(totalText || (!final && unitOpen)) && (
              <div className="sh-total">
                {totalText && <span className="sh-total-k">합계</span>}
                {totalText && <span className="sh-total-v">{totalText}</span>}
                {!final && unitOpen && (
                  <span className="sh-unit">
                    단위: <T k="unit" as="span" oneLine />
                  </span>
                )}
              </div>
            )}
          </div>
        ) : units ? (
          <div className="sh-units" aria-hidden="true">
            {Array.from({ length: 100 }, (_, k) => (
              <span key={k} className="sh-u" style={k < cells.length ? { '--c': colors[cells[k]] } : undefined} />
            ))}
          </div>
        ) : (
          <div className="sh-band" aria-hidden="true">
            {segs.map((s, i) =>
              s.len > 0 ? <span key={items[i].id} className="sh-seg" style={{ flexGrow: s.len, background: colors[i] }} /> : null,
            )}
          </div>
        )}
        <div className="sh-legend">
          {items.map((it, i) => (
            <div key={it.id} className={cx('it sh-item', i === highlight && 'is-hl')} style={{ '--c': colors[i] }}>
              <span className="sh-pct">
                {typedPct ? <IT i={i} k="value" as="span" oneLine /> : final && !texts[i] ? '–' : pctText(pcts[i])}
              </span>
              <div className="sh-text">
                <IT i={i} k="title" className="sh-name" />
                {!typedPct && (!final || texts[i]) && (
                  <span className="sh-value">
                    <IT i={i} k="value" as="span" oneLine />
                    {unit && <span>{unit}</span>}
                  </span>
                )}
                <IT i={i} k="meta" className="sh-meta" />
              </div>
              <ItemTools i={i} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
