// 레이아웃: 목차 (agenda). 모양은 styles/agenda.css

import { IT, ItemTools, T } from '../fields'
import { useItems } from './parts'

export function Agenda() {
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
