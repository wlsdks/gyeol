// 레이아웃: 두 값 비교 (versus). 모양은 styles/versus.css

import { readField } from '../../deck/fields'
import { highlightOf, hintFor } from '../../deck/layouts'
import { cx } from '../../lib/cx'
import { demoOf, useSlide } from '../context'
import { IT, ItemTools, T, textUnits } from '../fields'
import { formatNumber, lineAxis, seriesIn } from '../numbers'
import { Head, Label, useItems, useUnitOpen } from './parts'

/** 앞 값에서 뒤 값으로 몇 % 바뀌었는지. 앞 값이 0 이하이면 비율을 말할 수 없어서 null */
function changeText(from: number | null, to: number | null): string | null {
  if (from === null || to === null || from <= 0) return null
  const pct = ((to - from) / from) * 100
  const shown = Math.abs(pct) < 10 ? Math.round(Math.abs(pct) * 10) / 10 : Math.round(Math.abs(pct))
  if (shown === 0) return '0%'
  return `${pct > 0 ? '▲' : '▼'} ${formatNumber(shown)}%`
}

/**
 * 두 값 비교: 항목마다 앞 값(작년, 계획)과 뒤 값(올해, 실적). 묶은 막대는 바닥(0)부터 세우고,
 * 두 선은 흐름을 보는 모양이라 추이처럼 바닥을 올려 그린다. 항목 이름 아래에는 앞 값에서 몇 % 바뀌었는지 계산해 붙인다.
 * 늘어난 것이 좋은지(매출) 나쁜지(비용)는 장마다 달라서 좋고 나쁨의 색은 쓰지 않는다.
 */
export function Versus() {
  const { slide, meta, mode } = useSlide()
  const items = useItems()
  const final = mode === 'final'
  const highlight = highlightOf(slide)
  const lines = slide.variant === 'lines'
  const dots = slide.variant === 'dots'
  // 편집할 때 숫자가 하나도 없으면 안내 문구의 예시 숫자로 흐리게 그린다
  const demo = demoOf(mode, items, ['value', 'meta'])
  const text = (k: 'meta' | 'value', i: number) => (demo ? hintFor(slide.layout, slide.hints, k, k, i) : items[i][k])
  const unit = readField(slide, meta, 'unit').trim()
  const unitOpen = useUnitOpen(unit)
  // 앞 값과 뒤 값을 한 기준으로 읽는다. 단위가 서로 다른 값이 섞였으면 바뀐 비율은 말하지 않는다
  const series = seriesIn([...items.map((_, i) => text('meta', i)), ...items.map((_, i) => text('value', i))], unit)
  const a = series.values.slice(0, items.length)
  const b = series.values.slice(items.length)
  const change = (i: number) => (series.ok ? changeText(a[i], b[i]) : null)
  const known = [...a, ...b].filter((v): v is number => v !== null)
  // 막대: 0부터 가장 큰 값까지. 0보다 작은 값은 바닥에 붙인다
  const top = Math.max(0, ...known)
  const bar = (v: number | null) => (v === null || top <= 0 ? 0 : Math.max(v > 0 ? 1.5 : 0, (Math.max(0, v) / top) * 100))
  // 선: 추이와 같은 바닥과 천장
  const { floor, ceil, y, x } = lineAxis(known, items.length)
  const path = (vs: (number | null)[]) =>
    vs
      .map((v, i) => (v === null ? null : `${x(i).toFixed(2)},${(100 - y(v)).toFixed(2)}`))
      .filter(Boolean)
      .join(' ')
  const at = (v: number, i: number) => ({ '--x': x(i).toFixed(2), '--y': y(v).toFixed(2) })
  // 좁은 막대에서 숫자는 막대 너비에 맞게 줄어드는데(.one-line), 숫자마다 제 길이로 줄이면 '96'은 크고 '104'는 작아
  // 막대마다 크기가 달랐다. 앞 값끼리, 뒤 값끼리는 가장 긴 숫자에 맞춘 한 크기로
  const shown = (k: 'meta' | 'value', i: number) => items[i][k].trim() || (final ? '' : hintFor(slide.layout, slide.hints, k, k, i))
  const widest = (k: 'meta' | 'value') => Math.max(1, ...items.map((_, i) => textUnits(shown(k, i))))
  const [ua, ub] = [widest('meta'), widest('value')]
  return (
    <>
      <Head lead />
      <div className={cx('s-body vs', demo && 'is-demo', highlight >= 0 && 'has-hl')} data-n={items.length} style={{ '--n': items.length }}>
        {/* 무엇과 무엇의 비교인지는 그래프 위에 한 번. 선과 막대의 색, 모양이 같은 표시로 */}
        <div className="vs-top">
          <span className="vs-key is-a">
            <i aria-hidden="true" />
            <Label k="metaTitle" fallback="작년" className="vs-key-t" />
          </span>
          <span className="vs-key is-b">
            <i aria-hidden="true" />
            <Label k="valueTitle" fallback="올해" className="vs-key-t" />
          </span>
          {unitOpen && (
            <span className="vs-unit">
              단위: <T k="unit" as="span" oneLine />
            </span>
          )}
        </div>
        {dots ? (
          // 점 두 개: 항목마다 한 줄. 앞 값 점에서 뒤 값 점까지 이어 얼마나, 어느 쪽으로 움직였는지 본다.
          // 줄마다 따로 그려서 값이 가까워도 이름표끼리 겹치지 않는다. 자리는 두 선과 같은 바닥과 천장
          <div className="vs-rows">
            {items.map((it, i) => {
              const [va, vb] = [a[i], b[i]]
              const pa = va === null ? null : y(va)
              const pb = vb === null ? null : y(vb)
              const style = {
                ...(pa !== null ? { '--a': pa.toFixed(2) } : {}),
                ...(pb !== null ? { '--b': pb.toFixed(2) } : {}),
                ...(pa !== null && pb !== null ? { '--lo': Math.min(pa, pb).toFixed(2), '--hi': Math.max(pa, pb).toFixed(2) } : {}),
              }
              return (
                <div key={it.id} className={cx('it vs-row', i === highlight && 'is-hl', pa !== null && pb !== null && pb < pa && 'is-down')} style={style}>
                  <div className="vs-label">
                    <IT i={i} k="title" className="vs-name" />
                  </div>
                  <div className="vs-track" aria-hidden="true">
                    {pa !== null && pb !== null && <span className="vs-span" />}
                    {pa !== null && <span className="vs-d is-a" />}
                    {pb !== null && <span className="vs-d is-b" />}
                  </div>
                  {/* 읽는 차례대로 앞 값, 뒤 값, 바뀐 비율. 비율은 계산한 표시라 칸이 아니다 */}
                  <div className="vs-nums">
                    <IT i={i} k="meta" as="span" className="vs-num is-a" oneLine units={ua} />
                    <IT i={i} k="value" as="span" className="vs-num is-b" oneLine units={ub} />
                    <span className="vs-change">{change(i) ?? ''}</span>
                  </div>
                  <ItemTools i={i} />
                </div>
              )
            })}
          </div>
        ) : (
        <div className="vs-plot">
          {lines && (
            <div className="vs-canvas">
              {floor < 0 && <span className="vs-zero" style={{ '--y': y(0).toFixed(2) }} />}
              <svg className="vs-svg is-a" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline className="vs-line" points={path(a)} />
              </svg>
              <svg className="vs-svg is-b" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline className="vs-line" points={path(b)} />
              </svg>
              {items.flatMap((it, i) => {
                const [va, vb] = [a[i], b[i]]
                // 앞 값의 숫자는 뒤 값과 겹치지 않게 늘 뒤 값의 반대쪽(뒤 값이 크면 아래)에
                const below = va !== null && vb !== null && va <= vb
                // 발표할 때 숫자가 없는 점은 찍지 않는다. 편집할 때는 바닥에 칸을 둬서 채울 수 있게
                const base = Math.max(floor, Math.min(0, ceil))
                return [
                  (va !== null || !final) && (
                    <div key={`${it.id}-a`} className={cx('vs-pt is-a', below && 'is-below', va === null && 'is-blank')} style={at(va ?? base, i)}>
                      <span className="vs-dot" />
                      <span className="vs-val">
                        <IT i={i} k="meta" as="span" className="vs-num" oneLine units={ua} />
                      </span>
                    </div>
                  ),
                  (vb !== null || !final) && (
                    <div
                      key={`${it.id}-b`}
                      className={cx('vs-pt is-b', i === highlight && 'is-hl', !below && va !== null && vb !== null && 'is-below', vb === null && 'is-blank')}
                      style={at(vb ?? base, i)}
                    >
                      <span className="vs-dot" />
                      <span className="vs-val">
                        <IT i={i} k="value" as="span" className="vs-num" oneLine units={ub} />
                      </span>
                    </div>
                  ),
                ]
              })}
            </div>
          )}
          {items.map((it, i) => (
            <div key={it.id} className={cx('it vs-col', i === highlight && 'is-hl')}>
              {!lines && (
                <div className="vs-bars">
                  <div className="vs-bar is-a" style={{ '--p': bar(a[i]).toFixed(2) }}>
                    <span className="vs-val">
                      <IT i={i} k="meta" as="span" className="vs-num" oneLine units={ua} />
                    </span>
                    <span className="vs-fill" />
                  </div>
                  <div className="vs-bar is-b" style={{ '--p': bar(b[i]).toFixed(2) }}>
                    <span className="vs-val">
                      <IT i={i} k="value" as="span" className="vs-num" oneLine units={ub} />
                    </span>
                    <span className="vs-fill" />
                  </div>
                </div>
              )}
              <div className="vs-label">
                <IT i={i} k="title" className="vs-name" />
                {change(i) && <span className="vs-change">{change(i)}</span>}
              </div>
              <ItemTools i={i} />
            </div>
          ))}
        </div>
        )}
      </div>
      <T k="source" className="s-source" />
    </>
  )
}
