// 레이아웃: 사례 (case). 모양은 styles/case.css

import { IT, ImageSlot, ItemTools, T } from '../fields'
import { useItems, useSharedUnits } from './parts'

export function Case() {
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
