import type { CSSProperties, ReactNode } from 'react'
import { readField, visibleItems } from '../deck/fields'
import { highlightOf, hintFor } from '../deck/layouts'
import type { LayoutId } from '../deck/types'
import { cx } from '../lib/cx'
import { useSlide } from './context'
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
      {sectionIndex >= 0 && (
        <div className="sc-num" aria-hidden="true">
          {sectionIndex + 1}
        </div>
      )}
      <div className="sc-text">
        <T k="title" as="h2" className="sc-title" fit={[12, 20]} multiline />
        <T k="lead" as="p" className="sc-lead" multiline />
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
  const items = useItems()
  return (
    <>
      <Head />
      <ol className="s-body tl" data-n={items.length}>
        {items.map((it, i) => (
          <li key={it.id} className="it tl-item">
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

function parseNumber(text: string): number {
  const n = parseFloat(text.replace(/,/g, '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** 숫자를 넣기 전, 편집할 때 흐리게 보여 줄 예시 길이. 어떤 모양의 장인지 알아보게만 한다. */
const DEMO_BARS = [64, 78, 100, 86, 72, 92]

function Bars() {
  const { slide, mode } = useSlide()
  const items = useItems()
  const values = items.map((it) => parseNumber(it.value))
  const max = Math.max(0, ...values)
  const demo = mode !== 'final' && max <= 0
  const highlight = highlightOf(slide)
  return (
    <>
      <Head lead />
      <div className="s-body br" data-n={items.length}>
        {items.map((it, i) => {
          const pct = demo ? DEMO_BARS[i % DEMO_BARS.length] : max > 0 && values[i] > 0 ? Math.max(2, (values[i] / max) * 100) : 0
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
            <div key={it.id} className={cx('it sk-row', highlight === i && 'is-hl', known && actual >= target && 'is-met', demo && 'is-demo')}>
              <div className="sk-name">
                <IT i={i} k="title" className="sk-title" />
                <IT i={i} k="body" className="sk-body" />
              </div>
              <div className="sk-bar" style={bar} aria-hidden="true">
                <span className="sk-fill" />
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
}

export { BOLD_LAYOUTS } from '../deck/layouts'
