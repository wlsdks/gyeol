// 레이아웃: 깔때기 (funnel). 모양은 styles/funnel.css

import { readField } from '../../deck/fields'
import { highlightOf, hintFor } from '../../deck/layouts'
import { cx } from '../../lib/cx'
import { demoOf, useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'
import { formatNumber, seriesIn } from '../numbers'
import { Head, useItems } from './parts'

/** 비율을 읽기 좋게: 10% 미만은 소수 한 자리, 1% 미만은 두 자리까지 (0%로 뭉개지지 않게) */
function rateText(p: number): string {
  const r = p < 1 ? Math.round(p * 100) / 100 : p < 10 ? Math.round(p * 10) / 10 : Math.round(p)
  return `${formatNumber(r)}%`
}

/**
 * 깔때기: 단계마다 가운데 맞춘 막대가 줄어들고, 막대 사이는 옅은 사다리꼴로 잇는다.
 * 막대 너비는 첫 단계(가장 큰 값) 기준. 단계 사이 전환율과 처음부터 끝까지의 전환율은 계산한다.
 */
export function Funnel() {
  const { slide, meta, mode } = useSlide()
  const items = useItems()
  const final = mode === 'final'
  const highlight = highlightOf(slide)
  const demo = demoOf(mode, items)
  const unit = readField(slide, meta, 'unit').trim()
  // 단계마다의 값을 한 기준으로 ('1.2만 명', '8,000명'). 단위가 서로 다른 값이 섞였으면 전환율은 틀린 숫자라 보이지 않는다
  const series = seriesIn(
    items.map((it, i) => (demo ? hintFor(slide.layout, slide.hints, 'value', 'value', i) : it.value)),
    unit,
  )
  const values = series.values.map((v) => Math.max(0, v ?? 0))
  const top = Math.max(0, ...values)
  const widths = values.map((v) => (top > 0 ? Math.max(3, (v / top) * 100) : 0))
  const first = values[0]
  const last = values[values.length - 1]
  return (
    <>
      <Head />
      <div className={cx('s-body fn', demo && 'is-demo')} data-n={items.length} style={{ '--n': items.length }}>
        {items.map((it, i) => {
          // 빈 단계로 들어가거나 나오는 사이는 잇지 않는다. 앞 단계보다 늘어난 단계는 전환율이 아니라(1,333%) 적지 않는다
          const linked = i > 0 && values[i - 1] > 0 && values[i] > 0
          const rate = linked && series.ok && values[i] <= values[i - 1] ? (values[i] / values[i - 1]) * 100 : null
          return (
            <div
              key={it.id}
              className={cx('it fn-row', i === highlight && 'is-hl', !values[i] && 'is-blank')}
              // --pw: 앞 단계의 길이. 이 단계에서 빠진 만큼(앞 길이에서 이 길이까지)을 막대 뒤에 옅게 깐다
              style={{ '--w': widths[i].toFixed(2), '--pw': (linked ? widths[i - 1] : widths[i]).toFixed(2) }}
            >
              <div className="fn-val">
                <IT i={i} k="value" as="span" className="fn-num" oneLine numeral />
                {/* 단위는 편집할 때 첫 단계의 숫자 옆에서 고친다. 아래에 '단위' 줄을 따로 두면 편집 화면에서만 장이 높아진다 */}
                {mode === 'edit' && i === 0 ? (
                  <T k="unit" as="span" className="fn-unit" oneLine />
                ) : (
                  unit && (!final || it.value.trim()) && <span className="fn-unit">{unit}</span>
                )}
              </div>
              {/* 앞 단계에서 넘어온 비율: 이 막대의 시작 위에 */}
              {rate !== null && <span className="fn-rate">{rateText(rate)}</span>}
              <div className="fn-zone">
                <span className="fn-bar" />
              </div>
              <div className="fn-label">
                <IT i={i} k="title" className="fn-name" />
                <IT i={i} k="meta" className="fn-meta" />
              </div>
              <ItemTools i={i} />
            </div>
          )
        })}
        {first > 0 && last > 0 && items.length > 2 && series.ok && (
          <p className="fn-total">
            <span>처음부터 끝까지</span>
            <b>{rateText((last / first) * 100)}</b>
          </p>
        )}
      </div>
    </>
  )
}
