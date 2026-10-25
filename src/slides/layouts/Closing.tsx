// 레이아웃: 결정 요청 (closing). 모양은 styles/closing.css

import { IT, ItemTools, MetaRow, T } from '../fields'
import { useItems } from './parts'

export function Closing() {
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
