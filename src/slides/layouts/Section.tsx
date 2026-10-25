// 레이아웃: 섹션 구분 (section). 모양은 styles/section.css

import { cx } from '../../lib/cx'
import { useSlide } from '../context'
import { T } from '../fields'

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

export function Section() {
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
