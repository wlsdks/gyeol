import type { CSSProperties, ReactNode } from 'react'
import { readField, visibleItems } from '../deck/fields'
import { highlightOf, hintFor } from '../deck/layouts'
import type { ItemKey, LayoutId, Slide } from '../deck/types'
import { cx } from '../lib/cx'
import { useSlide } from './context'
import { formatNumber, isNumericCell, parseDelta, parseNumber, statusOf, STATUS_NAMES, type Status } from './numbers'
import { Compose } from './blocks'
import { IT, ImageSlot, ItemTools, MetaRow, T, textUnits } from './fields'

function Head({ lead = false }: { lead?: boolean }) {
  return (
    <header className="s-head">
      <T k="title" as="h2" className="s-title" fit={[24, 40]} multiline />
      {lead && <T k="lead" as="p" className="s-lead" multiline />}
    </header>
  )
}

/** 표 머리말처럼 비워 두면 기본 말을 쓰는 칸. 편집할 때는 그 기본 말이 안내로 보인다. */
function Label({ k, fallback, className }: { k: string; fallback: string; className?: string }) {
  const { slide, meta, mode } = useSlide()
  if (mode === 'final' && !readField(slide, meta, k).trim()) return <span className={className}>{fallback}</span>
  return <T k={k} as="span" className={className} />
}

function useItems() {
  const { slide } = useSlide()
  return visibleItems(slide)
}

/** 나란히 놓인 숫자들이 같은 크기로 보이게, 가장 긴 값의 폭을 함께 쓴다 */
function useSharedUnits(key: 'value') {
  const { slide, mode } = useSlide()
  const items = visibleItems(slide)
  const texts = items.map((it) => it[key].trim()).filter(Boolean)
  if (mode !== 'final' && texts.length < items.length) return undefined
  return texts.length ? Math.max(...texts.map(textUnits)) : undefined
}

function Cover() {
  const { slide, mode } = useSlide()
  const showAsk = mode !== 'final' || !!slide.fields.ask?.trim()
  return (
    <>
      <div className="cv-main">
        <ImageSlot k="$logo" className="cv-logo" contain optional />
        <div className="cv-text">
          <T k="title" as="h1" className="cv-title" fit={[16, 28]} multiline />
          <T k="lead" as="p" className="cv-lead" multiline />
        </div>
      </div>
      <div className="cv-side">
        {showAsk ? (
          <div className="cv-ask">
            <span className="cv-label">결정 요청</span>
            <T k="ask" as="p" className="cv-ask-text" fit={[16, 28]} multiline />
          </div>
        ) : (
          <span />
        )}
        <dl className="cv-meta">
          <MetaRow label="발표" k="$presenter" />
          <MetaRow label="소속" k="$org" />
          <MetaRow label="날짜" k="$date" />
        </dl>
      </div>
    </>
  )
}

/** 발표 전체의 단락 지도. 지금 단락만 또렷하게. */
function SectionMap({ className }: { className: string }) {
  const { sections, sectionIndex } = useSlide()
  if (sections.length < 2) return null
  return (
    <ol className={className}>
      {sections.map((name, i) => (
        <li key={i} className={cx(i === sectionIndex && 'is-on')}>
          <span className="map-n">{i + 1}</span>
          <span className="map-t">{name}</span>
        </li>
      ))}
    </ol>
  )
}

function Section() {
  const { sectionIndex } = useSlide()
  return (
    <>
      <div className="sc-body">
        <div className="sc-text">
          <T k="title" as="h2" className="sc-title" fit={[12, 20]} multiline />
          <T k="lead" as="p" className="sc-lead" multiline />
        </div>
        {sectionIndex >= 0 && (
          <div className="sc-num" aria-hidden="true">
            {sectionIndex + 1}
          </div>
        )}
      </div>
      <SectionMap className="sc-map" />
    </>
  )
}

function Agenda() {
  const items = useItems()
  return (
    <div className="ag">
      <T k="title" as="h2" className="s-title ag-title" fit={[10, 18]} multiline />
      <ol className="ag-list" data-n={items.length}>
        {items.map((it, i) => (
          <li key={it.id} className="it ag-item">
            <span className="ag-n">{i + 1}</span>
            <IT i={i} k="title" className="ag-t" fit={[14, 24]} />
            <ItemTools i={i} />
          </li>
        ))}
      </ol>
    </div>
  )
}

function Statement() {
  return (
    <div className="s-body st">
      <T k="title" as="h2" className="st-title" fit={[26, 46]} multiline />
      <T k="lead" as="p" className="st-lead" multiline />
    </div>
  )
}

function Kpi() {
  const items = useItems()
  const units = useSharedUnits('value')
  return (
    <>
      <Head />
      <div className="s-body kp" data-n={items.length}>
        {items.map((it, i) => (
          <div key={it.id} className="it kp-item">
            <IT i={i} k="title" className="kp-label" />
            <IT i={i} k="value" className="kp-value" oneLine units={units} />
            <IT i={i} k="body" className="kp-body" multiline />
            <ItemTools i={i} />
          </div>
        ))}
      </div>
      <T k="source" className="s-source" />
    </>
  )
}

function Points() {
  const items = useItems()
  return (
    <>
      <Head lead />
      <div className="s-body pt" data-n={items.length}>
        {items.map((it, i) => (
          <div key={it.id} className="it pt-item">
            <IT i={i} k="title" className="pt-title" fit={[12, 20]} />
            <IT i={i} k="body" className="pt-body" multiline />
            <ItemTools i={i} />
          </div>
        ))}
      </div>
    </>
  )
}

/** 한 장 요약: 결론 아래에 이름표와 요점을 줄마다. 이름표는 작게, 요점은 크게. */
function Summary() {
  const items = useItems()
  return (
    <>
      <header className="s-head">
        <T k="title" as="h2" className="s-title sm-title" fit={[30, 48]} multiline />
      </header>
      <div className="s-body sm" data-n={items.length}>
        {items.map((it, i) => (
          <div key={it.id} className="it sm-row">
            <IT i={i} k="title" className="sm-label" />
            <IT i={i} k="body" className="sm-body" multiline />
            <ItemTools i={i} />
          </div>
        ))}
      </div>
    </>
  )
}

function Arrow() {
  return (
    <span className="cp-arrow" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M5 12h13M13 6l6 6-6 6" />
      </svg>
    </span>
  )
}

function Compare() {
  const items = useItems()
  return (
    <>
      <Head />
      <div className="s-body cp" data-n={items.length}>
        <div className="cp-row cp-headrow">
          <T k="leftTitle" className="cp-h cp-hl" />
          <T k="rightTitle" className="cp-h cp-hr" />
        </div>
        {items.map((it, i) => (
          <div key={it.id} className="it cp-row">
            <IT i={i} k="title" className="cp-l" multiline />
            <IT i={i} k="body" className="cp-r" multiline />
            <Arrow />
            <ItemTools i={i} />
          </div>
        ))}
      </div>
    </>
  )
}

function Timeline() {
  const { slide } = useSlide()
  const items = useItems()
  const now = highlightOf(slide)
  return (
    <>
      <Head />
      <ol className={cx('s-body tl', now >= 0 && 'has-now')} data-n={items.length}>
        {items.map((it, i) => (
          <li key={it.id} className={cx('it tl-item', now >= 0 && i < now && 'is-done', i === now && 'is-now')}>
            <IT i={i} k="meta" className="tl-meta" />
            <span className="tl-dot" />
            <IT i={i} k="title" className="tl-title" fit={[10, 16]} />
            <IT i={i} k="body" className="tl-body" multiline />
            <ItemTools i={i} />
          </li>
        ))}
      </ol>
    </>
  )
}

function Case() {
  const items = useItems()
  const units = useSharedUnits('value')
  return (
    <>
      <div className="cs-main">
        <T k="client" className="cs-client" />
        <T k="title" as="h2" className="cs-title" fit={[22, 36]} multiline />
        <T k="body" className="cs-body" multiline />
        <T k="quote" as="blockquote" className="cs-quote" multiline />
      </div>
      <aside className="cs-side">
        <ImageSlot k="image" className="cs-logo" contain optional />
        <div className="cs-results">
          {items.map((it, i) => (
            <div key={it.id} className="it cs-res">
              <IT i={i} k="value" className="cs-value" oneLine units={units} />
              <IT i={i} k="title" className="cs-label" />
              <ItemTools i={i} />
            </div>
          ))}
        </div>
      </aside>
    </>
  )
}

function Pricing() {
  const { slide } = useSlide()
  const items = useItems()
  const units = useSharedUnits('value')
  const highlight = highlightOf(slide)
  return (
    <>
      <Head />
      <div className="s-body pr" data-n={items.length}>
        {items.map((it, i) => (
          <div key={it.id} className={cx('it pr-plan', highlight === i && 'is-hl')}>
            <div className="pr-top">
              <IT i={i} k="title" className="pr-name" />
              {highlight === i && <span className="pr-tag">추천</span>}
            </div>
            <IT i={i} k="value" className="pr-price" oneLine units={units} />
            <IT i={i} k="meta" className="pr-meta" />
            <IT i={i} k="body" className="pr-body" multiline />
            <ItemTools i={i} />
          </div>
        ))}
      </div>
    </>
  )
}

function ImageText() {
  const { slide } = useSlide()
  return (
    <div className={cx('ix', slide.options.flip && 'is-flip')}>
      <ImageSlot k="image" className="ix-img" contain={slide.options.contain} />
      <div className="ix-text">
        <T k="title" as="h2" className="s-title ix-title" fit={[16, 28]} multiline />
        <T k="body" className="ix-body" multiline />
      </div>
    </div>
  )
}

function Logos() {
  const items = useItems()
  return (
    <>
      <Head lead />
      <div className="s-body lg" data-n={items.length} data-rows={Math.ceil(items.length / logoColumns(items.length))}>
        {items.map((it, i) => (
          <div key={it.id} className="it lg-cell">
            <ImageSlot i={i} className="lg-img" contain />
            <IT i={i} k="title" className="lg-name" />
            <ItemTools i={i} />
          </div>
        ))}
      </div>
    </>
  )
}

function logoColumns(n: number): number {
  if (n <= 2) return 2
  if (n === 3 || n === 6) return 3
  if (n >= 9) return 6
  return 4
}


/** 숫자를 넣기 전, 편집할 때 흐리게 보여 줄 예시 길이. 어떤 모양의 장인지 알아보게만 한다. */
const DEMO_BARS = [64, 78, 100, 86, 72, 92]

/** 예시 숫자가 막대마다 있으면 그 비율로, 없으면 정해 둔 길이로. 안내 글의 숫자와 막대 길이가 맞아야 덜 어색하다. */
function demoBars(slide: Slide, n: number): number[] {
  const hinted = Array.from({ length: n }, (_, i) => parseNumber(hintFor(slide.layout, slide.hints, 'value', 'value', i)))
  const top = Math.max(0, ...hinted)
  if (top > 0 && hinted.every((v) => v > 0)) return hinted.map((v) => (v / top) * 100)
  return Array.from({ length: n }, (_, i) => DEMO_BARS[i % DEMO_BARS.length])
}

function Bars() {
  const { slide, meta, mode } = useSlide()
  const items = useItems()
  const unit = readField(slide, meta, 'unit').trim()
  // 세로 막대에서 보충 설명이 있는 막대만 바닥 줄이 올라가지 않게, 없는 막대에도 그만큼 자리를 둔다
  const anyMeta = items.some((it) => it.meta.trim())
  const values = items.map((it) => parseNumber(it.value))
  const max = Math.max(0, ...values)
  const demo = mode !== 'final' && max <= 0
  const demoP = demo ? demoBars(slide, items.length) : []
  const highlight = highlightOf(slide)
  return (
    <>
      <Head lead />
      <div className="s-body br-wrap">
        {(mode !== 'final' || unit) && (
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
                style={{ '--p': pct.toFixed(2) } as CSSProperties}
              >
                <div className="br-label">
                  <IT i={i} k="title" className="br-name" />
                  <IT i={i} k="meta" className="br-meta" />
                  {mode === 'final' && anyMeta && !it.meta.trim() && (
                    <span className="br-meta is-pad" aria-hidden="true">
                      .
                    </span>
                  )}
                </div>
                <div className="br-track">
                  <div className="br-fill" />
                </div>
                <IT i={i} k="value" className="br-value" />
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

/** 목표 대비 실적: 지표마다 목표, 실적, 달성률. 막대에 목표 자리를 세로 줄로 표시한다. */
function Scorecard() {
  const { slide, mode } = useSlide()
  const items = useItems()
  const highlight = highlightOf(slide)
  // 편집할 때 목표와 실적이 둘 다 비어 있으면 안내 문구의 예시 숫자로 막대를 흐리게 그린다.
  // 한쪽만 적었으면 예시와 섞지 않는다 (엉뚱한 달성률이 보이지 않게).
  const pair = (i: number) => {
    const it = items[i]
    if (it.meta.trim() || it.value.trim() || mode === 'final') return { demo: false, meta: it.meta, value: it.value }
    return { demo: true, meta: hintFor(slide.layout, slide.hints, 'meta', 'meta', i), value: hintFor(slide.layout, slide.hints, 'value', 'value', i) }
  }
  return (
    <>
      <Head />
      <div className="s-body sk" data-n={items.length}>
        <div className="sk-row sk-headrow">
          <span className="sk-h">지표</span>
          <span className="sk-h">목표 대비</span>
          <Label k="metaTitle" fallback="목표" className="sk-h sk-num" />
          <Label k="valueTitle" fallback="실적" className="sk-h sk-num" />
          <span className="sk-h sk-num">달성률</span>
        </div>
        {items.map((it, i) => {
          const { demo, meta, value } = pair(i)
          const target = parseNumber(meta)
          const actual = parseNumber(value)
          const known = target > 0 && value.trim() !== ''
          // 목표와 실적 중 큰 쪽이 막대 끝. 목표를 넘으면 목표 줄이 막대 안으로 들어간다.
          const scale = Math.max(target, actual) || 1
          const bar = { '--a': known ? ((actual / scale) * 100).toFixed(2) : '0', '--t': known ? ((target / scale) * 100).toFixed(2) : '0' } as CSSProperties
          return (
            <div key={it.id} className={cx('it sk-row', highlight === i && 'is-hl', known && (actual >= target ? 'is-met' : 'is-miss'), demo && 'is-demo')}>
              <div className="sk-name">
                <IT i={i} k="title" className="sk-title" />
                <IT i={i} k="body" className="sk-body" />
              </div>
              <div className="sk-bar" style={bar} aria-hidden="true">
                <span className="sk-fill" />
                {/* 목표를 넘은 만큼, 또는 목표까지 모자란 만큼을 목표 줄에 붙여 따로 칠한다 */}
                {known && actual !== target && <span className="sk-diff" />}
                {known && <span className="sk-mark" />}
              </div>
              <IT i={i} k="meta" className="sk-target sk-num" />
              <IT i={i} k="value" className="sk-value sk-num" />
              <span className="sk-rate sk-num">{known ? `${Math.round((actual / target) * 100)}%` : '–'}</span>
              <ItemTools i={i} />
            </div>
          )
        })}
      </div>
      <T k="source" className="s-source" />
    </>
  )
}

/**
 * 증감 요인(폭포): 처음 값 → 요인마다 더하고 뺀 만큼 뜬 막대 → 끝 값. 끝 값은 계산한다(따로 적으면 서로 안 맞을 수 있어서).
 * 처음과 끝이 증감보다 훨씬 크면 바닥부터 세운 막대 때문에 증감이 안 보이므로, 바닥을 올리고 잘린 표시를 한다.
 */
function Bridge() {
  const { slide, meta, mode } = useSlide()
  const items = useItems()
  const startText = readField(slide, meta, 'startValue')
  const unit = readField(slide, meta, 'unit').trim()
  // 편집할 때 숫자가 하나도 없으면 안내 문구의 예시 숫자로 흐리게 그린다
  const demo = mode !== 'final' && !startText.trim() && items.every((it) => !it.value.trim())
  const start = parseNumber(demo ? hintFor(slide.layout, slide.hints, 'startValue') : startText)
  const deltas = items.map((it, i) => parseDelta(demo ? hintFor(slide.layout, slide.hints, 'value', 'value', i) : it.value))
  const levels = deltas.reduce((acc, d) => [...acc, acc[acc.length - 1] + d], [start])
  const end = levels[levels.length - 1]
  const lo = Math.min(...levels)
  const hi = Math.max(...levels)
  const span = hi - lo || Math.abs(hi) || 1
  const cut = lo > 0 && lo - span * 1.5 > 0
  const floor = cut ? lo - span * 1.5 : Math.min(0, lo)
  const top = Math.max(hi, 0)
  const pct = (v: number) => (((v - floor) / (top - floor || 1)) * 100).toFixed(2)
  const base = cut ? floor : 0
  const col = (a: number, b: number, link?: number) =>
    ({ '--lo': pct(Math.min(a, b)), '--hi': pct(Math.max(a, b)), ...(link !== undefined ? { '--link': pct(link) } : {}) }) as CSSProperties
  const known = demo || !!startText.trim()
  return (
    <>
      <Head />
      <div className={cx('s-body wf', demo && 'is-demo', cut && 'is-cut')} style={{ '--n': items.length + 2 } as CSSProperties}>
        <div className="wf-col wf-total" style={col(base, start, start)}>
          <div className="wf-plot">
            <span className="wf-bar" />
            <span className="wf-val">
              <T k="startValue" as="span" className="wf-num" oneLine />
              {(unit || mode !== 'final') && <T k="unit" as="span" className="wf-unit" oneLine />}
            </span>
          </div>
          <Label k="startTitle" fallback="시작" className="wf-title" />
        </div>
        {items.map((it, i) => (
          <div
            key={it.id}
            className={cx('it wf-col', deltas[i] < 0 ? 'wf-down' : 'wf-up', !demo && !it.value.trim() && 'is-blank')}
            style={col(levels[i], levels[i + 1], levels[i + 1])}
          >
            <div className="wf-plot">
              <span className="wf-bar" />
              <span className="wf-val">
                <IT i={i} k="value" as="span" className="wf-num" oneLine />
              </span>
            </div>
            <div className="wf-label">
              <IT i={i} k="title" className="wf-title" />
              <IT i={i} k="meta" className="wf-meta" />
            </div>
            <ItemTools i={i} />
          </div>
        ))}
        <div className="wf-col wf-total wf-end" style={col(base, end)}>
          <div className="wf-plot">
            <span className="wf-bar" />
            <span className="wf-val">
              <span className="wf-num">{known ? formatNumber(end) : '–'}</span>
              {known && (unit || demo) && <span className="wf-unit">{unit || hintFor(slide.layout, slide.hints, 'unit')}</span>}
            </span>
          </div>
          <Label k="endTitle" fallback="결과" className="wf-title" />
        </div>
      </div>
      <T k="source" className="s-source" />
    </>
  )
}

/** 숫자 칸을 읽는다. 비었거나 숫자가 없으면 null. '△3', '-2%'처럼 줄어든 값은 음수로 */
function numberOrNull(text: string): number | null {
  return text.trim() && /\d/.test(text) ? parseDelta(text) : null
}

/**
 * 추이: 시기마다 점을 찍고 선으로 잇는다. 흐름을 보는 장이라 모두 0보다 크고 폭이 좁으면 0부터 그리지 않는다.
 * 값 이름표는 점 위에, 양옆보다 낮은 점은 선에 가리지 않게 점 아래에 둔다.
 */
function Trend() {
  const { slide, meta, mode } = useSlide()
  const items = useItems()
  const highlight = highlightOf(slide)
  const final = mode === 'final'
  // 편집할 때 숫자가 하나도 없으면 안내 문구의 예시 숫자로 흐리게 그린다
  const demo = !final && items.every((it) => !it.value.trim())
  const values = items.map((it, i) => numberOrNull(demo ? hintFor(slide.layout, slide.hints, 'value', 'value', i) : it.value))
  // 목표를 비워 두면 선을 긋지 않는다. 예시로 그릴 때만 예시 목표값에 흐리게
  const unit = readField(slide, meta, 'unit').trim()
  const target = numberOrNull(readField(slide, meta, 'target')) ?? (demo ? numberOrNull(hintFor(slide.layout, slide.hints, 'target')) : null)
  const known = values.filter((v): v is number => v !== null)
  const all = target === null ? known : [...known, target]
  const lo = all.length ? Math.min(...all) : 0
  const hi = all.length ? Math.max(...all) : 1
  const span = hi - lo || Math.abs(hi) || 1
  const floor = lo >= 0 ? (lo - span * 1.2 > 0 ? lo - span * 0.5 : 0) : lo - span * 0.12
  const ceil = hi + span * 0.06
  const y = (v: number) => ((v - floor) / (ceil - floor || 1)) * 100
  const x = (i: number) => ((i + 0.5) / items.length) * 100
  const pts = values.map((v, i) => (v === null ? null : { x: x(i), y: y(v) }))
  const drawn = pts.filter((p): p is { x: number; y: number } => p !== null)
  const line = drawn.map((p) => `${p.x.toFixed(2)},${(100 - p.y).toFixed(2)}`).join(' ')
  const area = drawn.length > 1 ? `${drawn[0].x.toFixed(2)},100 ${line} ${drawn[drawn.length - 1].x.toFixed(2)},100` : ''
  const dip = (i: number) => {
    const [a, v, b] = [values[i - 1], values[i], values[i + 1]]
    return i !== highlight && v !== null && a != null && b != null && v < a && v < b
  }
  const at = (p: { x: number; y: number }) => ({ '--x': p.x.toFixed(2), '--y': p.y.toFixed(2) }) as CSSProperties
  return (
    <>
      <Head lead />
      <div className={cx('s-body tn', demo && 'is-demo')} style={{ '--n': items.length } as CSSProperties}>
        {/* 단위와 목표는 그래프 위 따로 둔 줄에. 선 끝에 이름표를 달면 최근 시기의 점(대개 강조한 점)과 부딪힌다 */}
        {(!final || unit || target !== null) && (
          <div className="tn-meta">
            <span className="tn-unit">
              {(!final || unit) && (
                <>
                  단위: <T k="unit" as="span" oneLine />
                </>
              )}
            </span>
            {target !== null ? (
              <span className="tn-unit tn-legend">
                <i className="tn-legend-line" aria-hidden="true" />
                목표 <T k="target" as="span" oneLine />
              </span>
            ) : (
              !final && (
                <span className="tn-unit">
                  목표선: <T k="target" as="span" oneLine />
                </span>
              )
            )}
          </div>
        )}
        <div className="tn-plot">
          <div className="tn-canvas">
            {floor < 0 && <span className="tn-zero" style={{ '--y': y(0).toFixed(2) } as CSSProperties} />}
            {target !== null && (
              <div className="tn-target" style={{ '--y': y(target).toFixed(2) } as CSSProperties} />
            )}
            <svg className="tn-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {area && <polygon className="tn-area" points={area} />}
              {drawn.length > 1 && <polyline className="tn-line" points={line} />}
            </svg>
            {items.map((it, i) => {
              const p = pts[i]
              // 발표할 때 숫자가 없는 시기는 점을 찍지 않는다. 편집할 때는 바닥에 칸을 둬서 채울 수 있게
              if (!p && final) return null
              return (
                <div
                  key={it.id}
                  className={cx('tn-pt', i === highlight && 'is-hl', dip(i) && 'is-below', !p && 'is-blank')}
                  style={at(p ?? { x: x(i), y: 0 })}
                >
                  <span className="tn-dot" />
                  <span className="tn-val">
                    <IT i={i} k="value" as="span" className="tn-num" oneLine />
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="tn-x">
          {items.map((it, i) => (
            <div key={it.id} className={cx('it tn-col', i === highlight && 'is-hl')}>
              <IT i={i} k="title" className="tn-name" oneLine />
              <ItemTools i={i} />
            </div>
          ))}
        </div>
      </div>
      <T k="source" className="s-source" />
    </>
  )
}

const STATUS_ORDER: Status[] = ['done', 'doing', 'late', 'todo']

/**
 * 진행 현황: 과제마다 진행률 막대와 상태. 위에는 상태별 과제 수를 모아 '지연'이 먼저 눈에 들어오게.
 * 상태 칸을 비우면 발표할 때 진행률로 짐작한 상태(100%는 완료, 0%는 예정)를 보여 준다.
 */
function Progress() {
  const { slide, mode } = useSlide()
  const items = useItems()
  const final = mode === 'final'
  const demo = !final && items.every((it) => !it.value.trim() && !it.body.trim())
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
            <div key={it.id} className={cx('it ps-row', r.status && `is-${r.status}`)} style={{ '--p': (r.pct ?? 0).toFixed(1) } as CSSProperties}>
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
      <T k="source" className="s-source" />
    </>
  )
}

/** 강조하지 않는 조각의 회색 단계. 큰 조각부터 진하게 */
const SHARE_GREYS = [64, 46, 32, 22, 15]
/** 강조할 조각이 없을 때 강조색의 농담 */
const SHARE_TINTS = [100, 68, 46, 30, 20, 13]

/**
 * 구성비: 값을 더한 전체에서 각 항목의 비중. 띠는 한 줄 막대를 나누고, 도넛은 고리를 나눈다.
 * 모두 %로 적었으면 적은 그대로 보이고, 금액이나 건수로 적었으면 비중을 계산해 크게, 적은 값은 작게.
 */
function Share() {
  const { slide, meta, mode } = useSlide()
  const items = useItems()
  const final = mode === 'final'
  const highlight = highlightOf(slide)
  const demo = !final && items.every((it) => !it.value.trim())
  const texts = items.map((it, i) => (demo ? hintFor(slide.layout, slide.hints, 'value', 'value', i) : it.value).trim())
  const values = texts.map((t) => Math.max(0, numberOrNull(t) ?? 0))
  const sum = values.reduce((a, b) => a + b, 0)
  const pcts = values.map((v) => (sum > 0 ? (v / sum) * 100 : 0))
  const typedPct = texts.every((t) => !t || t.includes('%'))
  const unit = readField(slide, meta, 'unit').trim()
  const pctText = (p: number) => (p > 0 && p < 1 ? '1% 미만' : `${formatNumber(p < 10 ? Math.round(p * 10) / 10 : Math.round(p))}%`)
  let grey = 0
  const colors = items.map((_, i) => {
    if (highlight < 0) return `color-mix(in srgb, var(--accent) ${SHARE_TINTS[i % SHARE_TINTS.length]}%, var(--bg))`
    if (i === highlight) return 'var(--accent)'
    return `color-mix(in srgb, var(--ink-3) ${SHARE_GREYS[grey++ % SHARE_GREYS.length]}%, var(--bg))`
  })
  let start = 0
  const segs = pcts.map((p) => {
    const s = { start, len: p }
    start += p
    return s
  })
  const donut = slide.variant === 'donut'
  // '131억 원'처럼 숫자와 단위는 붙여 쓴다
  const totalText = sum > 0 && !typedPct ? `${formatNumber(sum)}${unit}` : ''
  return (
    <>
      <Head />
      <div className={cx('s-body sh', demo && 'is-demo')} data-n={items.length} style={{ '--n': items.length } as CSSProperties}>
        {/* 띠는 합계를 위에, 도넛은 고리 가운데에. 단위 칸은 편집할 때만 오른쪽에 */}
        {((!donut && totalText) || !final) && (
          <div className="sh-top">
            <span className="sh-sum">{!donut && totalText && `합계 ${totalText}`}</span>
            {!final && (
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
            {totalText && (
              <div className="sh-total">
                <span className="sh-total-k">합계</span>
                <span className="sh-total-v">{totalText}</span>
              </div>
            )}
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
            <div key={it.id} className={cx('it sh-item', i === highlight && 'is-hl')} style={{ '--c': colors[i] } as CSSProperties}>
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
      <T k="source" className="s-source" />
    </>
  )
}

/** 단계 흐름: 맞물린 꺾쇠 띠(화살표) 또는 화살표로 이은 칸. 단계는 순서라 번호를 붙인다. */
function Process() {
  const { slide } = useSlide()
  const items = useItems()
  const highlight = highlightOf(slide)
  return (
    <>
      <Head lead />
      <ol className="s-body pc" data-n={items.length} style={{ '--n': items.length } as CSSProperties}>
        {items.map((it, i) => (
          <li key={it.id} className={cx('it pc-step', i === highlight && 'is-hl')}>
            <div className="pc-head">
              <span className="pc-n">{i + 1}</span>
              <IT i={i} k="title" className="pc-title" />
            </div>
            <div className="pc-text">
              <IT i={i} k="meta" className="pc-meta" />
              <IT i={i} k="body" className="pc-body" multiline />
            </div>
            <ItemTools i={i} />
          </li>
        ))}
      </ol>
    </>
  )
}

/** 비율을 읽기 좋게: 10% 미만은 소수 한 자리, 1% 미만은 두 자리까지 (0%로 뭉개지지 않게) */
function rateText(p: number): string {
  const r = p < 1 ? Math.round(p * 100) / 100 : p < 10 ? Math.round(p * 10) / 10 : Math.round(p)
  return `${formatNumber(r)}%`
}

/**
 * 깔때기: 단계마다 가운데 맞춘 막대가 줄어들고, 막대 사이는 옅은 사다리꼴로 잇는다.
 * 막대 너비는 첫 단계(가장 큰 값) 기준. 단계 사이 전환율과 처음부터 끝까지의 전환율은 계산한다.
 */
function Funnel() {
  const { slide, meta, mode } = useSlide()
  const items = useItems()
  const final = mode === 'final'
  const highlight = highlightOf(slide)
  const demo = !final && items.every((it) => !it.value.trim())
  const values = items.map((it, i) => Math.max(0, numberOrNull(demo ? hintFor(slide.layout, slide.hints, 'value', 'value', i) : it.value) ?? 0))
  const top = Math.max(0, ...values)
  const widths = values.map((v) => (top > 0 ? Math.max(3, (v / top) * 100) : 0))
  const unit = readField(slide, meta, 'unit').trim()
  const first = values[0]
  const last = values[values.length - 1]
  return (
    <>
      <Head />
      <div className={cx('s-body fn', demo && 'is-demo')} data-n={items.length}>
        {items.map((it, i) => {
          // 빈 단계로 들어가거나 나오는 사이는 잇지 않는다
          const linked = i > 0 && values[i - 1] > 0 && values[i] > 0
          const rate = linked ? (values[i] / values[i - 1]) * 100 : null
          const style = { '--w': widths[i].toFixed(2), '--pw': (i > 0 ? widths[i - 1] : widths[i]).toFixed(2) } as CSSProperties
          return (
            <div key={it.id} className={cx('it fn-row', i === highlight && 'is-hl', !values[i] && 'is-blank')} style={style}>
              <div className="fn-label">
                <IT i={i} k="title" className="fn-name" />
                <IT i={i} k="meta" className="fn-meta" />
              </div>
              <div className="fn-zone">
                {linked && <span className="fn-link" />}
                {rate !== null && <span className="fn-rate">{rateText(rate)}</span>}
                <span className="fn-bar" />
              </div>
              <div className="fn-val">
                <IT i={i} k="value" as="span" className="fn-num" oneLine />
                {unit && (!final || it.value.trim()) && <span className="fn-unit">{unit}</span>}
              </div>
              <ItemTools i={i} />
            </div>
          )
        })}
        {(!final || (first > 0 && last > 0 && items.length > 2)) && (
          <p className="fn-total">
            {first > 0 && last > 0 && (
              <span>
                처음부터 끝까지 <b>{rateText((last / first) * 100)}</b>
              </span>
            )}
            {!final && (
              <span className="fn-unit-slot">
                단위: <T k="unit" as="span" oneLine />
              </span>
            )}
          </p>
        )}
      </div>
      <T k="source" className="s-source" />
    </>
  )
}

/** 표의 칸: 머리말 칸 이름과 그 칸에 들어가는 항목 값, 기본 너비 */
const TABLE_COLS: { head: string; key: ItemKey; fr: number }[] = [
  { head: 'h1', key: 'title', fr: 1.3 },
  { head: 'h2', key: 'meta', fr: 1 },
  { head: 'h3', key: 'value', fr: 0.9 },
  { head: 'h4', key: 'body', fr: 1.8 },
]

function Table() {
  const { slide, meta, mode } = useSlide()
  const items = useItems()
  const highlight = highlightOf(slide)
  // 발표할 때는 머리말도 칸도 비어 있는 칸을 뺀다. 편집할 때는 채울 수 있게 모두 보인다.
  const cols = TABLE_COLS.filter(
    (c, i) => i === 0 || mode !== 'final' || readField(slide, meta, c.head).trim() || items.some((it) => it[c.key].trim()),
  )
  const numeric = (key: ItemKey) => {
    const filled = items.map((it) => it[key].trim()).filter(Boolean)
    return filled.length > 0 && filled.every(isNumericCell)
  }
  const style = { '--cols': cols.map((c) => `minmax(0, ${c.fr}fr)`).join(' ') } as CSSProperties
  return (
    <>
      <Head />
      <div className="s-body tb" data-n={items.length} style={style}>
        <div className="tb-row tb-headrow">
          {cols.map((c) => (
            <T key={c.head} k={c.head} as="span" className={cx('tb-h', numeric(c.key) && 'is-num')} />
          ))}
        </div>
        {items.map((it, i) => (
          // 마지막 줄이 합계면 위에 굵은 줄을 긋고 숫자를 굵게 (보고서 표의 관례)
          <div key={it.id} className={cx('it tb-row', highlight === i && 'is-hl', i === items.length - 1 && i > 0 && isTotalRow(it.title) && 'is-total')}>
            {cols.map((c) => (
              <IT
                key={c.key}
                i={i}
                k={c.key}
                className={cx('tb-cell', c.key === 'title' && 'tb-first', numeric(c.key) && 'is-num')}
                multiline={c.key === 'body'}
              />
            ))}
            <ItemTools i={i} />
          </div>
        ))}
      </div>
      <T k="source" className="s-source" />
    </>
  )
}

/** 표의 합계 줄인지: 첫째 칸이 '합계', '총계', '소계', '계', '전체' 같은 말 (띄어쓰기, 괄호, 쌍점은 빼고 본다) */
function isTotalRow(title: string): boolean {
  return /^(합계|총계|총합|소계|계|합|전체)$/.test(title.replace(/[\s()[\]·:]/g, ''))
}

/** 2×2: 세로 기준(위로 갈수록)과 가로 기준(오른쪽으로 갈수록)으로 나눈 네 칸. 항목 순서는 왼쪽 위부터 글 읽는 순서. */
function Matrix() {
  const { slide } = useSlide()
  const items = useItems()
  const highlight = highlightOf(slide)
  return (
    <>
      <Head />
      <div className="s-body mx">
        <T k="yAxis" className="mx-y" />
        <div className="mx-grid">
          {items.map((it, i) => (
            <div key={it.id} className={cx('it mx-cell', highlight === i && 'is-hl')}>
              <IT i={i} k="title" className="mx-title" fit={[14, 22]} />
              <IT i={i} k="body" className="mx-body" multiline />
            </div>
          ))}
        </div>
        <T k="xAxis" className="mx-x" />
      </div>
    </>
  )
}

function Closing() {
  const items = useItems()
  return (
    <>
      <div className="cl-main">
        <T k="title" as="h2" className="cl-title" fit={[8, 16]} multiline />
        <dl className="cl-contact">
          <MetaRow label="발표" k="$presenter" />
          <MetaRow label="연락처" k="$contact" />
        </dl>
      </div>
      {items.length > 0 && (
        <ol className="cl-steps" data-n={items.length}>
          {items.map((it, i) => (
            <li key={it.id} className="it cl-step">
              <span className="cl-n">{i + 1}</span>
              <div className="cl-step-text">
                <IT i={i} k="title" className="cl-step-t" />
                <IT i={i} k="body" className="cl-step-b" multiline />
              </div>
              <ItemTools i={i} />
            </li>
          ))}
        </ol>
      )}
    </>
  )
}

export const LAYOUT_VIEWS: Record<LayoutId, () => ReactNode> = {
  cover: Cover,
  section: Section,
  agenda: Agenda,
  summary: Summary,
  statement: Statement,
  kpi: Kpi,
  scorecard: Scorecard,
  bridge: Bridge,
  trend: Trend,
  progress: Progress,
  share: Share,
  process: Process,
  funnel: Funnel,
  table: Table,
  points: Points,
  compare: Compare,
  matrix: Matrix,
  timeline: Timeline,
  case: Case,
  pricing: Pricing,
  imageText: ImageText,
  logos: Logos,
  bars: Bars,
  closing: Closing,
  compose: Compose,
}

export { BOLD_LAYOUTS } from '../deck/layouts'
