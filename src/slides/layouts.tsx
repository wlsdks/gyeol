import type { ReactNode } from 'react'
import { visibleItems } from '../deck/fields'
import type { LayoutId } from '../deck/types'
import { cx } from '../lib/cx'
import { useSlide } from './context'
import { IT, ImageSlot, ItemTools, MetaRow, T } from './fields'

function Head({ lead = false }: { lead?: boolean }) {
  return (
    <header className="s-head">
      <T k="title" as="h2" className="s-title" fit={[26, 44]} multiline />
      {lead && <T k="lead" as="p" className="s-lead" multiline />}
    </header>
  )
}

function useItems() {
  const { slide } = useSlide()
  return visibleItems(slide)
}

function Cover() {
  return (
    <>
      <div className="cv-main">
        <ImageSlot k="$logo" className="cv-logo" contain optional />
        <div className="cv-text">
          <T k="title" as="h1" className="cv-title" fit={[18, 30]} multiline />
          <T k="lead" as="p" className="cv-lead" />
          <dl className="cv-meta">
            <MetaRow label="발표" k="$presenter" />
            <MetaRow label="날짜" k="$date" />
          </dl>
        </div>
      </div>
      <div className="cv-side">
        <CoverCustomer />
      </div>
    </>
  )
}

function CoverCustomer() {
  const { meta, mode } = useSlide()
  if (mode === 'final' && !meta.customer.trim()) return null
  return (
    <div className="cv-customer">
      <span className="cv-customer-label">고객사</span>
      <T k="$customer" as="p" className="cv-customer-name" fit={[8, 14]} />
    </div>
  )
}

function Section() {
  const { sectionNumber } = useSlide()
  return (
    <>
      <div className="sc-num">{sectionNumber ?? ''}</div>
      <div className="sc-text">
        <T k="title" as="h2" className="sc-title" fit={[14, 24]} />
        <T k="lead" as="p" className="sc-lead" multiline />
      </div>
    </>
  )
}

function Agenda() {
  const items = useItems()
  return (
    <div className="ag">
      <T k="title" as="h2" className="s-title ag-title" fit={[10, 18]} multiline />
      <ol className="ag-list">
        {items.map((it, i) => (
          <li key={it.id} className="it ag-item">
            <span className="ag-n">{i + 1}</span>
            <IT i={i} k="title" className="ag-t" fit={[16, 26]} />
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
      <T k="title" as="h2" className="st-title" fit={[28, 50]} multiline />
      <T k="lead" as="p" className="st-lead" multiline />
    </div>
  )
}

function Kpi() {
  const items = useItems()
  return (
    <>
      <Head />
      <div className="s-body kp" data-n={items.length}>
        {items.map((it, i) => (
          <div key={it.id} className="it kp-item">
            <IT i={i} k="value" className="kp-value" oneLine />
            <IT i={i} k="title" className="kp-label" />
            <IT i={i} k="body" className="kp-body" multiline />
            <ItemTools i={i} />
          </div>
        ))}
      </div>
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

function Chevron() {
  return (
    <svg className="cp-arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

function Compare() {
  const items = useItems()
  return (
    <>
      <Head />
      <div className="s-body cp">
        <div className="cp-row cp-headrow">
          <T k="leftTitle" className="cp-h cp-hl" />
          <span />
          <T k="rightTitle" className="cp-h cp-hr" />
        </div>
        {items.map((it, i) => (
          <div key={it.id} className="it cp-row">
            <IT i={i} k="title" className="cp-l" multiline />
            <Chevron />
            <IT i={i} k="body" className="cp-r" multiline />
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
  return (
    <div className="s-body cs">
      <div className="cs-main">
        <T k="client" className="cs-client" />
        <T k="title" as="h2" className="cs-title" fit={[24, 40]} multiline />
        <T k="body" className="cs-body" multiline />
        <T k="quote" as="blockquote" className="cs-quote" multiline />
      </div>
      <aside className="cs-side">
        <ImageSlot k="image" className="cs-logo" contain optional />
        <div className="cs-results">
          {items.map((it, i) => (
            <div key={it.id} className="it cs-res">
              <IT i={i} k="value" className="cs-value" oneLine />
              <IT i={i} k="title" className="cs-label" />
              <ItemTools i={i} />
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}

function Pricing() {
  const { slide } = useSlide()
  const items = useItems()
  const highlight = slide.options.highlight ?? -1
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
            <IT i={i} k="value" className="pr-price" oneLine />
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
        <T k="title" as="h2" className="s-title ix-title" fit={[18, 32]} multiline />
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
      <div className="s-body lg" data-n={items.length}>
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

function parseNumber(text: string): number {
  const n = parseFloat(text.replace(/,/g, '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function Bars() {
  const items = useItems()
  const values = items.map((it) => parseNumber(it.value))
  const max = Math.max(0, ...values)
  return (
    <>
      <Head lead />
      <div className="s-body br" data-n={items.length}>
        {items.map((it, i) => {
          const pct = max > 0 && values[i] > 0 ? Math.max(2, (values[i] / max) * 100) : 0
          return (
            <div key={it.id} className="it br-row">
              <div className="br-label">
                <IT i={i} k="title" className="br-name" />
                <IT i={i} k="meta" className="br-meta" />
              </div>
              <div className="br-track">
                <div className="br-fill" style={{ width: `${pct}%` }} />
              </div>
              <IT i={i} k="value" className="br-value" />
              <ItemTools i={i} />
            </div>
          )
        })}
      </div>
    </>
  )
}

function Closing() {
  const items = useItems()
  return (
    <>
      <div className="cl-main">
        <T k="title" as="h2" className="cl-title" fit={[10, 20]} multiline />
        {items.length > 0 && (
          <ol className="cl-steps" data-n={items.length}>
            {items.map((it, i) => (
              <li key={it.id} className="it cl-step">
                <span className="cl-n">{i + 1}</span>
                <IT i={i} k="title" className="cl-step-t" />
                <IT i={i} k="body" className="cl-step-b" multiline />
                <ItemTools i={i} />
              </li>
            ))}
          </ol>
        )}
      </div>
      <dl className="cl-contact">
        <MetaRow label="발표" k="$presenter" />
        <MetaRow label="연락처" k="$contact" />
      </dl>
    </>
  )
}

export const LAYOUT_VIEWS: Record<LayoutId, () => ReactNode> = {
  cover: Cover,
  section: Section,
  agenda: Agenda,
  statement: Statement,
  kpi: Kpi,
  points: Points,
  compare: Compare,
  timeline: Timeline,
  case: Case,
  pricing: Pricing,
  imageText: ImageText,
  logos: Logos,
  bars: Bars,
  closing: Closing,
}

/** 색 면을 쓰는 장. 하단 쪽 번호를 넣지 않는다. */
export const BOLD_LAYOUTS: LayoutId[] = ['cover', 'section', 'closing']
