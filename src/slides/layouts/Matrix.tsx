// 레이아웃: 2×2 우선순위 (matrix). 모양은 styles/matrix.css

import { highlightOf } from '../../deck/layouts'
import { cx } from '../../lib/cx'
import { useSlide } from '../context'
import { IT, T } from '../fields'
import { Head, useItems } from './parts'

/** 2×2: 세로 기준(위로 갈수록)과 가로 기준(오른쪽으로 갈수록)으로 나눈 네 칸. 항목 순서는 왼쪽 위부터 글 읽는 순서. */
export function Matrix() {
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
