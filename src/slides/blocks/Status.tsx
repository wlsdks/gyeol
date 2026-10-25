// 부품: 상태 (status). 모양은 styles/blocks/status.css, 움직임은 motion/engine.ts의 nativeAuto

import { cx } from '../../lib/cx'
import { useSlide } from '../context'
import { T } from '../fields'
import { STATUS_NAMES, type Status as State } from '../numbers'

const STATES: readonly State[] = ['doing', 'done', 'todo', 'late']

/**
 * 상태 표시: 색이 아니라 꼴로 가른다(흑백 인쇄, 강조색을 바꿔도 읽히게). 완료는 꽉 찬 글자색 원, 진행 중은 반이 찬 강조색 원
 * (강조색은 지금 움직이는 일에만), 예정은 빈 옅은 고리, 지연은 글자색 고리에 시계 바늘. 빨강 같은 따로 정한 색은 쓰지 않는다
 */
function StateMark({ state }: { state: State }) {
  return (
    <svg className="bk-ss-mark" viewBox="0 0 32 32" aria-hidden="true">
      {state === 'done' ? (
        <circle className="bk-ss-fill" cx="16" cy="16" r="13.25" />
      ) : (
        <>
          <circle className="bk-ss-ring" cx="16" cy="16" r="12" />
          {state === 'doing' && <path className="bk-ss-fill" d="M16 4a12 12 0 0 1 0 24z" />}
          {state === 'late' && <path className="bk-ss-hand" d="M16 9.5V16h5.5" />}
        </>
      )}
    </svg>
  )
}

/** 상태: 상태 표시와 이름(완료, 진행 중, 예정, 지연) 아래 할 일과 언제·누가. 상태는 모양(variant)으로 고른다 */
export function Status() {
  const { slide } = useSlide()
  const state = STATES.find((s) => s === slide.variant) ?? STATES[0]
  return (
    <div className={cx('bk-ss', `is-${state}`)}>
      <p className="bk-ss-st">
        <StateMark state={state} />
        <span className="bk-ss-name">{STATUS_NAMES[state]}</span>
      </p>
      <T k="what" className="bk-ss-w" multiline />
      <T k="meta" className="bk-ss-m" />
    </div>
  )
}
