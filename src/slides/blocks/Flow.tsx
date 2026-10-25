// 부품: 흐름 (flow). 모양은 styles/blocks/flow.css, 움직임은 motion/engine.ts의 nativeAuto

import { Fragment } from 'react'
import { BLOCKS } from '../../deck/blocks'
import { readField } from '../../deck/fields'
import { cx } from '../../lib/cx'
import { useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'

/** 강조할 단계: 고른 것이 있으면 그것(-1은 강조 없음), 없으면 마지막(흐름이 닿는 곳) */
export function flowHighlight(chosen: number | undefined, n: number): number {
  if (chosen === undefined) return n - 1
  return Number.isInteger(chosen) && chosen >= -1 && chosen < n ? chosen : n - 1
}

/**
 * 흐름: 단계(시스템)를 상자로 나란히 두고, 사이를 방향이 보이는 선으로 잇는다. 발표할 때는 선이 그어지며 작은 데이터 조각이
 * 선을 따라 건너가고, 닿는 단계가 받아서 나타난다. 오가는 양은 단계마다 상자 아래 끝에 숫자로(나란한 단계끼리 한 줄에 선다).
 * 좁은 칸에서는 상자를 세로로 쌓고 선도 아래로 긋는다(flow.css): 나란히 두면 단계 이름이 두세 글자마다 꺾인다
 */
export function Flow() {
  const { slide, meta, mode, folds } = useSlide()
  const items = slide.items.slice(0, BLOCKS.flow.items!.max)
  const hl = flowHighlight(slide.options.highlight, items.length)
  // 오가는 것은 비어 있으면 줄째 뺀다 (편집할 때 '칸 더하기'로 열면 보인다)
  const key = !!readField(slide, meta, 'what').trim() || (mode !== 'final' && !folds?.has('what'))
  return (
    <div className="bk-fw" data-n={items.length}>
      {key && (
        <p className="bk-fw-key">
          <span className="bk-fw-kg" aria-hidden="true" />
          <T k="what" as="span" className="bk-fw-what" />
        </p>
      )}
      <div className="bk-fw-list">
        {items.map((it, i) => (
          <Fragment key={it.id}>
            {/* 단계 사이의 선. 앞 단계에서 다음 단계로 (화살표 끝) */}
            {i > 0 && <span className="bk-fw-link" aria-hidden="true" />}
            <div className={cx('it bk-fw-node', i === hl && 'is-hl')}>
              <div className="bk-fw-text">
                <IT i={i} k="title" className="bk-fw-t" />
                <IT i={i} k="meta" className="bk-fw-m" />
              </div>
              <IT i={i} k="value" className="bk-fw-v" numeral />
              <ItemTools i={i} />
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}
