// 레이아웃: 단계 흐름 (process). 모양은 styles/process.css

import { highlightOf } from '../../deck/layouts'
import { cx } from '../../lib/cx'
import { useSlide } from '../context'
import { IT, ItemTools } from '../fields'
import { Head, useItems } from './parts'

/** 단계 흐름: 맞물린 꺾쇠 띠(화살표) 또는 화살표로 이은 칸. 단계는 순서라 번호를 붙인다. */
export function Process() {
  const { slide } = useSlide()
  const items = useItems()
  const highlight = highlightOf(slide)
  return (
    <>
      <Head lead />
      <ol className="s-body pc" data-n={items.length} style={{ '--n': items.length }}>
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
