import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { BLOCK_GAP } from '../deck/blocks'
import { asksDecision } from '../deck/blueprints'
import { readField, visibleItems } from '../deck/fields'
import { highlightOf, hintFor, logoColumns, variantOf } from '../deck/layouts'
import type { ItemKey, LayoutId, Slide } from '../deck/types'
import { cx } from '../lib/cx'
import { useSlide } from './context'
import { amountPair, formatNumber, isNumericCell, lowerIsBetter, readNumber, seriesIn, statusOf, STATUS_NAMES, type Status } from './numbers'
import { Compose } from './blocks'
import { IT, ImageSlot, ItemTools, MetaRow, minusSigns, numberUnits, T } from './fields'
import { placeLabels } from './fitBlocks'

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

/**
 * 나란히 놓인 숫자들이 한 크기로 보이게, 가장 긴 값의 폭을 함께 쓴다(가장 작게 줄어야 하는 숫자에 모두 맞춘다).
 * 숫자마다 제 칸에 맞춰 줄이면 '40%', '3.6시간', '1,200시간'이 세 크기로 보여 깨져 보인다.
 * 편집할 때는 빈 칸의 안내 숫자까지 넣어 잰다(채우는 동안 크기가 들쭉날쭉하지 않게). skip은 같이 재지 않는 항목(하나 크게의 첫 숫자)
 */
function useSharedUnits(key: 'value', skip?: (i: number) => boolean) {
  const { slide, mode } = useSlide()
  const items = visibleItems(slide)
  const texts = items
    .map((it, i) => (skip?.(i) ? '' : it[key].trim() || (mode === 'final' ? '' : hintFor(slide.layout, slide.hints, key, key, i))))
    .filter(Boolean)
  return texts.length ? Math.max(...texts.map(numberUnits)) : undefined
}

function Cover() {
  const { slide, meta, mode } = useSlide()
  // 결정 요청 칸은 결정을 받는 발표에서만 편집할 때 안내와 함께 보인다. 공유, 교육, 소개 같은 발표는 묻지 않으니
  // 칸을 두지 않는다(예전에 적어 둔 결정 요청은 그대로 보인다)
  const showAsk = !!slide.fields.ask?.trim() || (mode !== 'final' && asksDecision(meta.type))
  return (
    <>
      <div className="cv-main">
        <ImageSlot k="$logo" className="cv-logo" contain optional />
        <div className="cv-text">
          <T k="title" as="h1" className="cv-title" fit={[16, 28]} multiline />
          <T k="lead" as="p" className="cv-lead" multiline />
        </div>
      </div>
      <div className={cx('cv-side', !showAsk && 'no-ask')}>
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
          <div className="sc-num" data-d={(sectionIndex + 1) % 10} aria-hidden="true">
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
  const { slide } = useSlide()
  const items = useItems()
  // 하나 크게: 첫 숫자는 혼자 크고, 나머지끼리 한 크기
  const focus = variantOf(slide) === 'focus' && items.length > 1
  const units = useSharedUnits('value', focus ? (i) => i === 0 : undefined)
  return (
    <>
      <Head />
      <div className="s-body kp" data-n={items.length} style={{ '--n': items.length } as CSSProperties}>
        {items.map((it, i) => (
          <div key={it.id} className="it kp-item">
            <IT i={i} k="title" className="kp-label" />
            <IT i={i} k="value" className="kp-value" oneLine numeral units={focus && i === 0 ? undefined : units} />
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
      {/* 컴포넌트 사이의 화살표 이음표(blocks.tsx의 LinkGlyph)와 같은 모양 */}
      <svg viewBox="0 0 48 48">
        <path d="M9 24h28M27 13l11 11-11 11" />
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
        {/* 두 면 사이의 화살표 하나 (표 모양은 줄마다의 화살표를 쓴다) */}
        <Arrow />
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
      {/* 대상(고객사, 부서)은 결과 판의 로고 아래에: 제목 위에 두면 이 장만 제목이 한 줄 내려가 장을 넘길 때 제목이 뛰었고,
          로고가 없으면 결과 판 위쪽이 통째로 비었다 */}
      <div className="cs-main">
        <T k="title" as="h2" className="cs-title" fit={[22, 36]} multiline />
        <T k="body" className="cs-body" multiline />
        <T k="quote" as="blockquote" className="cs-quote" multiline />
      </div>
      <aside className="cs-side">
        <ImageSlot k="image" className="cs-logo" contain optional />
        <T k="client" className="cs-client" />
        <div className="cs-results">
          {items.map((it, i) => (
            <div key={it.id} className="it cs-res">
              <IT i={i} k="value" className="cs-value" oneLine numeral units={units} />
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
            <IT i={i} k="value" className="pr-price" oneLine numeral units={units} />
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
  const cols = logoColumns(items.length)
  const rows = Math.ceil(items.length / cols)
  // 덜 찬 마지막 줄은 가운데로: 칸을 반 칸으로 나눠 두고(로고 하나가 반 칸 둘), 마지막 줄의 첫 로고를 빈 만큼 뒤에서 시작한다
  const last = items.length - (rows - 1) * cols
  return (
    <>
      <Head lead />
      <div className="s-body lg" data-n={items.length} data-rows={rows} style={{ '--lg-half': cols * 2 } as CSSProperties}>
        {items.map((it, i) => (
          <div key={it.id} className="it lg-cell" style={last < cols && i === (rows - 1) * cols ? { gridColumnStart: cols - last + 1 } : undefined}>
            <ImageSlot i={i} className="lg-img" contain />
            <IT i={i} k="title" className="lg-name" />
            <ItemTools i={i} />
          </div>
        ))}
      </div>
    </>
  )
}



/** 숫자를 넣기 전, 편집할 때 흐리게 보여 줄 예시 길이. 어떤 모양의 장인지 알아보게만 한다. */
const DEMO_BARS = [64, 78, 100, 86, 72, 92]

/** 예시 숫자가 막대마다 있으면 그 비율로, 없으면 정해 둔 길이로. 안내 글의 숫자와 막대 길이가 맞아야 덜 어색하다. */
function demoBars(slide: Slide, n: number): number[] {
  const hinted = Array.from({ length: n }, (_, i) => readNumber(hintFor(slide.layout, slide.hints, 'value', 'value', i)) ?? 0)
  const top = Math.max(0, ...hinted)
  if (top > 0 && hinted.every((v) => v > 0)) return hinted.map((v) => (v / top) * 100)
  return Array.from({ length: n }, (_, i) => DEMO_BARS[i % DEMO_BARS.length])
}

/** '단위:' 줄을 그릴지: 적었으면 늘, 비었으면 편집할 때만. 부품에서 비어 접힌 단위 칸이면 '단위:'만 남지 않게 뺀다 ('칸 더하기'로 열면 보인다) */
function useUnitOpen(unit: string): boolean {
  const { mode, folds } = useSlide()
  return !!unit || (mode !== 'final' && !folds?.has('unit'))
}

function Bars() {
  const { slide, meta, mode } = useSlide()
  const items = useItems()
  const unit = readField(slide, meta, 'unit').trim()
  const unitOpen = useUnitOpen(unit)
  // 세로 막대에서 보충 설명이 있는 막대만 바닥 줄이 올라가지 않게, 없는 막대에도 그만큼 자리를 둔다
  const anyMeta = items.some((it) => it.meta.trim())
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
function Versus() {
  const { slide, meta, mode } = useSlide()
  const items = useItems()
  const final = mode === 'final'
  const highlight = highlightOf(slide)
  const lines = slide.variant === 'lines'
  const dots = slide.variant === 'dots'
  // 편집할 때 숫자가 하나도 없으면 안내 문구의 예시 숫자로 흐리게 그린다
  const demo = !final && items.every((it) => !it.value.trim() && !it.meta.trim())
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
  const lo = known.length ? Math.min(...known) : 0
  const hi = known.length ? Math.max(...known) : 1
  const span = hi - lo || Math.abs(hi) || 1
  const floor = lo >= 0 ? (lo - span * 1.2 > 0 ? lo - span * 0.5 : 0) : lo - span * 0.12
  const ceil = hi + span * 0.06
  const y = (v: number) => ((v - floor) / (ceil - floor || 1)) * 100
  const x = (i: number) => ((i + 0.5) / items.length) * 100
  const path = (vs: (number | null)[]) =>
    vs
      .map((v, i) => (v === null ? null : `${x(i).toFixed(2)},${(100 - y(v)).toFixed(2)}`))
      .filter(Boolean)
      .join(' ')
  const at = (v: number, i: number) => ({ '--x': x(i).toFixed(2), '--y': y(v).toFixed(2) }) as CSSProperties
  return (
    <>
      <Head lead />
      <div className={cx('s-body vs', demo && 'is-demo', highlight >= 0 && 'has-hl')} data-n={items.length} style={{ '--n': items.length } as CSSProperties}>
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
              } as CSSProperties
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
                    <IT i={i} k="meta" as="span" className="vs-num is-a" oneLine />
                    <IT i={i} k="value" as="span" className="vs-num is-b" oneLine />
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
              {floor < 0 && <span className="vs-zero" style={{ '--y': y(0).toFixed(2) } as CSSProperties} />}
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
                        <IT i={i} k="meta" as="span" className="vs-num" oneLine />
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
                        <IT i={i} k="value" as="span" className="vs-num" oneLine />
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
                  <div className="vs-bar is-a" style={{ '--p': bar(a[i]).toFixed(2) } as CSSProperties}>
                    <span className="vs-val">
                      <IT i={i} k="meta" as="span" className="vs-num" oneLine />
                    </span>
                    <span className="vs-fill" />
                  </div>
                  <div className="vs-bar is-b" style={{ '--p': bar(b[i]).toFixed(2) } as CSSProperties}>
                    <span className="vs-val">
                      <IT i={i} k="value" as="span" className="vs-num" oneLine />
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
          // 목표와 실적은 단위까지 읽어 같은 기준으로 ('7분 이하'와 '6분 30초', '1.2억 원'과 '9,500만 원').
          // 견줄 수 없는 단위끼리면 달성률과 달성 여부를 말하지 않는다
          const p = amountPair(meta, value)
          const target = p?.a.base ?? 0
          const actual = p?.b.base ?? 0
          const known = target > 0 && value.trim() !== ''
          // 낮을수록 좋은 지표('7분 이하'): 목표보다 작아야 달성, 달성률은 목표 ÷ 실적
          const lower = lowerIsBetter(meta)
          const met = lower ? actual <= target : actual >= target
          const rate = lower ? (actual > 0 ? target / actual : 0) : actual / target
          // 목표와 실적 중 큰 쪽이 막대 끝. 목표를 넘으면 목표 줄이 막대 안으로 들어간다.
          const scale = Math.max(target, actual) || 1
          const bar = { '--a': known ? ((actual / scale) * 100).toFixed(2) : '0', '--t': known ? ((target / scale) * 100).toFixed(2) : '0' } as CSSProperties
          return (
            <div key={it.id} className={cx('it sk-row', highlight === i && 'is-hl', known && (met ? 'is-met' : 'is-miss'), demo && 'is-demo')}>
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
              <span className="sk-rate sk-num">{known && rate > 0 ? `${Math.round(rate * 100)}%` : '–'}</span>
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
  // 처음 값과 증감을 한 기준으로 더한다 ('1.2억'에 '+3,000만'은 1.5억). 단위가 서로 다른 값이 섞였으면 끝 값을 말하지 않는다
  const series = seriesIn(
    [demo ? hintFor(slide.layout, slide.hints, 'startValue') : startText, ...items.map((it, i) => (demo ? hintFor(slide.layout, slide.hints, 'value', 'value', i) : it.value))],
    unit,
  )
  const start = series.values[0] ?? 0
  const deltas = series.values.slice(1).map((v) => v ?? 0)
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
  const known = demo || (!!startText.trim() && series.values[0] !== null && series.ok)
  // 끝 값의 단위: 단위 칸이 비었으면 처음 값에 붙여 쓴 자리와 단위('117억'이면 억)
  const endUnit = unit || (demo ? hintFor(slide.layout, slide.hints, 'unit') : series.suffix)
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
              <span className="wf-num">{known ? minusSigns(formatNumber(end)) : '–'}</span>
              {known && endUnit && <span className="wf-unit">{endUnit}</span>}
            </span>
          </div>
          <Label k="endTitle" fallback="결과" className="wf-title" />
        </div>
      </div>
      <T k="source" className="s-source" />
    </>
  )
}

/**
 * 숫자 칸 하나를 읽는다(진행률, 점수처럼 칸 하나로 그리는 값). 비었거나 숫자가 없으면 null. '△3', '-2%'처럼 줄어든 값은 음수로.
 * 칸 여럿을 견주거나 더하는 곳은 단위까지 읽는 seriesIn, amountPair를 쓴다
 */
const numberOrNull = readNumber

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
  // 목표를 비워 두면 선을 긋지 않는다. 예시로 그릴 때만 예시 목표값에 흐리게
  const unit = readField(slide, meta, 'unit').trim()
  const unitOpen = useUnitOpen(unit)
  const targetField = readField(slide, meta, 'target')
  const targetText = readNumber(targetField) === null && demo ? hintFor(slide.layout, slide.hints, 'target') : targetField
  // 시기마다의 값과 목표를 한 기준으로 ('1.2억'과 '9,500만'의 높이가 맞게)
  const series = seriesIn([...items.map((it, i) => (demo ? hintFor(slide.layout, slide.hints, 'value', 'value', i) : it.value)), targetText], unit)
  const values = series.values.slice(0, items.length)
  const target = series.values[items.length]
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
  // 골짜기의 숫자는 점 아래에. 바닥에 붙은 골짜기는 아래 시기 이름과 부딪혀서 위에 둔다
  const dip = (i: number) => {
    const [a, v, b] = [values[i - 1], values[i], values[i + 1]]
    return i !== highlight && v !== null && a != null && b != null && v < a && v < b && y(v) > 30
  }
  const at = (p: { x: number; y: number }) => ({ '--x': p.x.toFixed(2), '--y': p.y.toFixed(2) }) as CSSProperties
  return (
    <>
      <Head lead />
      <div className={cx('s-body tn', demo && 'is-demo')} style={{ '--n': items.length } as CSSProperties}>
        {/* 단위와 목표는 그래프 위 따로 둔 줄에. 선 끝에 이름표를 달면 최근 시기의 점(대개 강조한 점)과 부딪힌다 */}
        {(unitOpen || target !== null) && (
          <div className="tn-meta">
            <span className="tn-unit">
              {unitOpen && (
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
  // '131억 원'처럼 숫자와 단위는 붙여 쓴다. 단위 칸이 비었으면 값에 붙여 쓴 자리와 단위('58억'이면 억)
  const totalText = sum > 0 && !typedPct && series.ok ? `${formatNumber(sum)}${series.suffix}` : ''
  return (
    <>
      <Head />
      <div className={cx('s-body sh', demo && 'is-demo')} data-n={items.length} style={{ '--n': items.length } as CSSProperties}>
        {/* 띠는 합계를 위에, 도넛은 고리 가운데에. 단위 칸은 편집할 때만: 띠는 오른쪽 위에, 도넛은 고리 가운데 합계 아래에
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
              {/* 장 한 장을 다 쓸 때는 담당과 시간을 아래 끝 줄로 내린다(slides.css). 비어 있는 단계도 그 줄의 선을 두려고 감싼다 */}
              <div className="pc-foot">
                <IT i={i} k="meta" className="pc-meta" />
              </div>
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
      <div className={cx('s-body fn', demo && 'is-demo')} data-n={items.length}>
        {items.map((it, i) => {
          // 빈 단계로 들어가거나 나오는 사이는 잇지 않는다. 앞 단계보다 늘어난 단계는 전환율이 아니라(1,333%) 적지 않는다
          const linked = i > 0 && values[i - 1] > 0 && values[i] > 0
          const rate = linked && series.ok && values[i] <= values[i - 1] ? (values[i] / values[i - 1]) * 100 : null
          // 단계의 농담: 첫 단계가 가장 옅고 갈수록 진하게 (강조할 단계는 강조색 그대로)
          const tint = items.length > 1 ? 24 + (46 * i) / (items.length - 1) : 46
          const style = { '--w': widths[i].toFixed(2), '--pw': (i > 0 ? widths[i - 1] : widths[i]).toFixed(2), '--t': tint.toFixed(0) } as CSSProperties
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
                <div className="fn-val">
                  <IT i={i} k="value" as="span" className="fn-num" oneLine />
                  {/* 단위는 편집할 때 첫 단계의 숫자 옆에서 고친다. 아래에 '단위' 줄을 따로 두면 편집 화면에서만 장이 높아진다 */}
                  {mode === 'edit' && i === 0 ? (
                    <T k="unit" as="span" className="fn-unit" oneLine />
                  ) : (
                    unit && (!final || it.value.trim()) && <span className="fn-unit">{unit}</span>
                  )}
                </div>
              </div>
              <ItemTools i={i} />
            </div>
          )
        })}
        {first > 0 && last > 0 && items.length > 2 && series.ok && (
          <p className="fn-total">
            <span>
              처음부터 끝까지 <b>{rateText((last / first) * 100)}</b>
            </span>
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

/** 위치 비교의 판 크기 어림 (px): 한 장을 다 쓸 때. 부품 안이면 칸 너비에서 판 둘레의 여백을 뺀다 */
const PM_PLOT = { w: 1568, h: 520 }

/**
 * 위치 비교의 이름표가 차지하는 자리를 판의 몫(%)으로 어림한다. 글자 하나는 이름(32px)이 30px, 강조할 점의 이름(40px)이 38px,
 * 설명(24px)이 22px쯤이고 이름표는 380px에서 줄이 바뀐다. 높이는 이름만이면 한 줄, 설명이 있으면 두 줄.
 * 부품 안에서는 칸이 좁으면 글자도 줄어든다 (blocks.css의 --bk-w 단계)
 */
function labelSize(name: string, body: string, hl: boolean, edit: boolean, span?: number): { w: number; h: number } {
  const cell = span ? span * ((1680 - 11 * BLOCK_GAP) / 12) + (span - 1) * BLOCK_GAP : 0
  const k = !cell ? 1 : cell <= 420 ? 0.66 : cell <= 560 ? 0.74 : cell <= 820 ? 0.84 : cell <= 1100 ? 0.92 : 1
  const plotW = cell ? Math.max(200, cell - 112) : PM_PLOT.w
  const n = [...name.trim()].length * (hl ? 38 : 30)
  const b = [...body.trim()].length * 22
  // 편집할 때는 빈 설명 칸과 점수 줄이 더 보인다
  const px = edit ? Math.max(n, b, 300) : Math.max(n, b)
  const lines = edit ? 120 : (body.trim() ? 73 : 38) + (hl ? 10 : 0)
  return { w: (Math.min(380, px) * k + 8) / plotW * 100, h: (lines * k) / PM_PLOT.h * 100 }
}

type PmSide = { left: boolean; v?: 'up' | 'down' }

/**
 * 위치 비교의 이름표를 어디에 붙일지: 기본은 점 오른쪽 가운데, 오른쪽 끝에 가까우면 왼쪽.
 * 앞의 점들의 이름표와 겹치면 반대쪽, 위로, 아래로, 반대쪽 위나 아래 차례로 겹치지 않는 자리를 찾는다.
 * 슬라이드를 그리기 전에 정해야 해서(내보낸 파일도 같은 모습) 글 길이를 재지 않고 자리로만 어림한다
 */
function labelSides(pts: ({ x: number; y: number; w: number; h: number } | null)[]): PmSide[] {
  const out: PmSide[] = pts.map((p) => ({ left: !!p && p.x > 72 }))
  const box = (i: number, o: PmSide) => {
    const { x, y, w, h: lh } = pts[i]!
    // 이름표는 점에서 조금 떨어져 붙는다 (slides.css의 .pm-label left 30px)
    const h = o.left ? [x - 1.5 - w, x - 1.5] : [x + 1.5, x + 1.5 + w]
    const v = o.v === 'up' ? [y + 1, y + 1 + lh] : o.v === 'down' ? [y - 1 - lh, y - 1] : [y - lh / 2, y + lh / 2]
    return { h, v }
  }
  const meet = (a: number[], b: number[]) => a[0] < b[1] && b[0] < a[1]
  const placed = pts.flatMap((p, i) => (p ? [i] : []))
  // 이름표끼리, 그리고 이름표와 다른 점(점은 어디에 이름표가 붙든 그 자리에 있다)
  const hitsLabel = (i: number, o: PmSide, j: number, oj = out[j]) => {
    const a = box(i, o)
    const b = box(j, oj)
    return meet(a.h, b.h) && meet(a.v, b.v)
  }
  const hitsDot = (i: number, o: PmSide) => {
    const a = box(i, o)
    return placed.some((j) => j !== i && meet(a.h, [pts[j]!.x - 1.2, pts[j]!.x + 1.2]) && meet(a.v, [pts[j]!.y - 3, pts[j]!.y + 3]))
  }
  // 판 밖으로 많이 나가는 자리는 고르지 않는다 (판 둘레의 여백만큼은 괜찮다)
  const inside = (i: number, o: PmSide) => {
    const { h, v } = box(i, o)
    return h[0] >= -2 && h[1] <= 102 && v[0] >= -8 && v[1] <= 108
  }
  const free = (i: number, o: PmSide, others: number[]) => inside(i, o) && !hitsDot(i, o) && !others.some((j) => hitsLabel(i, o, j))
  for (const i of placed) {
    const before = placed.filter((j) => j < i)
    const base = out[i]
    const tries: PmSide[] = [base, { left: !base.left }, { ...base, v: 'up' }, { ...base, v: 'down' }, { left: !base.left, v: 'up' }, { left: !base.left, v: 'down' }]
    const pick = tries.find((o) => free(i, o, before))
    if (pick) {
      out[i] = pick
      continue
    }
    // 거의 같은 자리의 두 점: 앞의 점까지 함께 비켜 하나는 위로, 하나는 아래로
    const j = before.find((k) => hitsLabel(i, base, k))
    if (j === undefined || out[j].v) continue
    const rest = before.filter((k) => k !== j)
    for (const [vj, vi] of [['up', 'down'], ['down', 'up']] as const) {
      const oj: PmSide = { ...out[j], v: vj }
      const oi: PmSide = { ...base, v: vi }
      if (free(j, oj, rest) && free(i, oi, rest) && !hitsLabel(i, oi, j, oj)) {
        out[j] = oj
        out[i] = oi
        break
      }
    }
  }
  return out
}

/**
 * 위치 비교(포지셔닝 맵): 두 기준의 점수로 점을 찍는다. 점수가 모두 0~10이면 0~10 눈금, 아니면 가장 큰 값까지.
 * 강조할 점(보통 우리)만 강조색으로 크게, 나머지는 회색. 이름표는 점 오른쪽에, 오른쪽 끝에 가까운 점은 왼쪽에.
 * 점수는 편집할 때만 이름 아래에 보인다. 발표 화면에는 자리로만
 */
function Position() {
  const { slide, mode, span } = useSlide()
  const items = useItems()
  const final = mode === 'final'
  const highlight = highlightOf(slide)
  const demo = !final && items.every((it) => !it.value.trim() && !it.meta.trim())
  const read = (k: 'value' | 'meta', i: number) => numberOrNull(demo ? hintFor(slide.layout, slide.hints, k, k, i) : items[i][k])
  const xs = items.map((_, i) => read('value', i))
  const ys = items.map((_, i) => read('meta', i))
  const known = [...xs, ...ys].filter((v): v is number => v !== null)
  const lo = Math.min(0, ...known)
  const top = Math.max(1, ...known)
  const hi = top <= 10 && lo >= 0 ? 10 : top + (top - lo) * 0.08
  const pct = (v: number) => ((v - lo) / (hi - lo || 1)) * 100
  const at = (v: number) => pct(v).toFixed(2)
  const text = (k: 'title' | 'body', i: number) => (demo ? hintFor(slide.layout, slide.hints, k, k, i) : items[i][k])
  // 어림한 자리를 그려진 크기로 다시 고른다. 글꼴이 늦게 오면 한 번 더 (부품 장 안이면 fitBlocks도 한다)
  const plot = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    if (plot.current) placeLabels(plot.current)
  })
  useEffect(() => {
    let on = true
    document.fonts?.ready.then(() => on && plot.current && placeLabels(plot.current))
    return () => {
      on = false
    }
  }, [])
  const sides = labelSides(
    items.map((_, i) => (xs[i] !== null && ys[i] !== null ? { x: pct(xs[i]!), y: pct(ys[i]!), ...labelSize(text('title', i), text('body', i), i === highlight, !final, span) } : null)),
  )
  return (
    <>
      <Head />
      <div className={cx('s-body pm', demo && 'is-demo')} data-n={items.length}>
        <T k="yAxis" className="pm-y" />
        <div className="pm-plot" ref={plot}>
          <span className="pm-mid is-x" aria-hidden="true" />
          <span className="pm-mid is-y" aria-hidden="true" />
          {items.map((it, i) => {
            const [x, y] = [xs[i], ys[i]]
            const placed = x !== null && y !== null
            if (!placed && final) return null
            // 점수를 아직 적지 않은 점(편집할 때만)은 판 위쪽에 차례로 늘어세운다
            const style = { '--x': placed ? at(x) : String(4 + i * 17), '--y': placed ? at(y) : '100' } as CSSProperties
            const side = cx(sides[i].left && 'is-left', sides[i].v && `is-${sides[i].v}`)
            return (
              <div
                key={it.id}
                className={cx('it pm-pt', i === highlight && 'is-hl', !placed && 'is-blank', side)}
                data-pm-side={side}
                style={style}
              >
                <span className="pm-dot" />
                <div className="pm-label">
                  <IT i={i} k="title" className="pm-name" />
                  <IT i={i} k="body" className="pm-body" />
                  {!final && (
                    <span className="pm-nums">
                      가로 <IT i={i} k="value" as="span" className="pm-num" oneLine /> 세로 <IT i={i} k="meta" as="span" className="pm-num" oneLine />
                    </span>
                  )}
                </div>
                <ItemTools i={i} sort={false} />
              </div>
            )
          })}
        </div>
        <T k="xAxis" className="pm-x" />
      </div>
      <T k="source" className="s-source" />
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
  position: Position,
  timeline: Timeline,
  case: Case,
  pricing: Pricing,
  imageText: ImageText,
  logos: Logos,
  bars: Bars,
  versus: Versus,
  closing: Closing,
  compose: Compose,
}

export { BOLD_LAYOUTS } from '../deck/layouts'
