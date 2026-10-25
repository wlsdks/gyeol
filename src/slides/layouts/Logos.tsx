// 레이아웃: 로고 모음 (logos). 모양은 styles/logos.css

import { logoColumns } from '../../deck/layouts'
import { IT, ImageSlot, ItemTools } from '../fields'
import { Head, useItems } from './parts'

export function Logos() {
  const items = useItems()
  const cols = logoColumns(items.length)
  const rows = Math.ceil(items.length / cols)
  // 덜 찬 마지막 줄은 가운데로: 칸을 반 칸으로 나눠 두고(로고 하나가 반 칸 둘), 마지막 줄의 첫 로고를 빈 만큼 뒤에서 시작한다
  const last = items.length - (rows - 1) * cols
  return (
    <>
      <Head lead />
      <div className="s-body lg" data-n={items.length} data-rows={rows} style={{ '--lg-half': cols * 2, '--n': items.length }}>
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
