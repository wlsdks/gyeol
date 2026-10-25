// 부품: 모으기 (merge). 모양은 styles/blocks/merge.css, 움직임은 motion/engine.ts의 nativeAuto

import type { CSSProperties } from 'react'
import { BLOCKS } from '../../deck/blocks'
import { readField } from '../../deck/fields'
import { hintFor } from '../../deck/layouts'
import { cx } from '../../lib/cx'
import { demoOf, useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'
import { formatNumber, seriesIn } from '../numbers'
import { accentTint, greyTint } from '../tints'
import { Numeral } from './parts'

/**
 * 모으기: 여러 값을 더한 합계. 값마다 한 줄(이름, 값)에 그 값의 조각을 두는데, 조각은 합계 막대에서 그 값이 들어갈 자리에
 * 그대로 놓인다(앞 조각들이 끝난 자리부터). 위에서 내려다보면 합계 막대를 줄마다 풀어 놓은 계단이라, 맨 아래 합계 줄(선 아래)의
 * 막대가 그 조각들을 이어 붙인 것으로 읽힌다. 발표할 때는 조각이 하나씩 제 자리로 내려가 끼워지고, 끼워질 때마다 합계가 그만큼
 * 오른다. 합계 칸을 비우면 값을 더한 값
 */
export function Merge() {
  const { slide, meta, mode, folds } = useSlide()
  const items = slide.items.slice(0, BLOCKS.merge.items!.max)
  const demo = demoOf(mode, items)
  const texts = items.map((it, i) => (demo ? hintFor(slide.layout, slide.hints, 'value', 'value', i) : it.value).trim())
  const unit = readField(slide, meta, 'unit').trim()
  // 값을 한 기준으로 더한다('1.2억'과 '8,000만'). 단위가 다른 값이 섞였으면 조각과 합계는 틀린 숫자라 보이지 않는다
  const series = seriesIn(texts, unit)
  const values = series.values.map((v) => Math.max(0, v ?? 0))
  const sum = values.reduce((a, b) => a + b, 0)
  const ok = series.ok && sum > 0
  const shares = values.map((v) => (ok ? v / sum : 0))
  const sumText = ok ? `${formatNumber(Math.round(sum * 100) / 100)}${series.suffix}` : ''
  const typedTotal = readField(slide, meta, 'total').trim()
  const totalField = !!typedTotal || (mode !== 'final' && !folds?.has('total'))
  const unitField = !!unit || (mode !== 'final' && !folds?.has('unit'))
  const hl = slide.options.highlight
  const pick = hl !== undefined && hl >= 0 && hl < items.length ? hl : -1
  let grey = 0
  const colors = items.map((_, i) => (pick < 0 ? accentTint(i) : i === pick ? 'var(--accent)' : greyTint(grey++)))
  // 조각의 자리: 앞의 조각들이 차지한 몫(--o)과 그 앞의 틈 수(--k). 막대와 같은 식이라 줄의 조각이 막대의 조각 바로 위에 선다
  const gaps = Math.max(0, shares.filter((p) => p > 0).length - 1)
  let before = 0
  let k = 0
  const spots = shares.map((p) => {
    const at = { o: before, k }
    before += p
    if (p > 0) k++
    return at
  })
  const piece = (i: number) => ({ '--c': colors[i], '--p': shares[i].toFixed(5), '--o': spots[i].o.toFixed(5), '--k': spots[i].k }) as CSSProperties
  return (
    <div className={cx('bk-mg', demo && 'is-demo', !ok && 'is-blank')} data-n={items.length} style={{ '--mg-n': gaps } as CSSProperties}>
      <div className="bk-mg-grid">
        {items.map((it, i) => (
          <div key={it.id} className={cx('it bk-mg-part', i === pick && 'is-hl')} style={piece(i)}>
            <IT i={i} k="title" className="bk-mg-name" />
            <p className="bk-mg-num">
              <IT i={i} k="value" as="span" className="bk-mg-v" numeral oneLine />
              {unit && (!!it.value || mode !== 'final') && <span className="bk-mg-vu">{unit}</span>}
            </p>
            <span className="bk-mg-track" aria-hidden="true">
              {shares[i] > 0 && <span className="bk-mg-pc" />}
            </span>
            <ItemTools i={i} />
          </div>
        ))}
        {/* 합계 줄: 위의 줄들과 선으로 나눈다(셈의 합계 선) */}
        <div className="bk-mg-sum">
          <div className="bk-mg-head">
            <T k="label" as="p" className="bk-mg-label" />
            {unitField && (
              <span className="bk-mg-unit">
                단위: <T k="unit" as="span" oneLine />
              </span>
            )}
          </div>
          {totalField ? (
            <T k="total" as="p" className="bk-mg-total" numeral />
          ) : (
            <p className="bk-mg-total">{sumText ? <Numeral text={sumText} /> : '–'}</p>
          )}
          <span className="bk-mg-bar" aria-hidden="true">
            {items.map((it, i) => (shares[i] > 0 ? <span key={it.id} className="bk-mg-seg" style={piece(i)} /> : null))}
          </span>
        </div>
      </div>
    </div>
  )
}
