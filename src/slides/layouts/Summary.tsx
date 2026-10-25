// 레이아웃: 한 장 요약 (summary). 모양은 styles/summary.css

import { IT, ItemTools, T } from '../fields'
import { useItems } from './parts'

/** 한 장 요약: 결론 아래에 이름표와 요점을 줄마다. 이름표는 작게, 요점은 크게. */
export function Summary() {
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
