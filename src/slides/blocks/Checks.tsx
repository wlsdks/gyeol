// 부품: 준비 상황 (checks). 모양은 styles/blocks/checks.css

import { BLOCKS } from '../../deck/blocks'
import { cx } from '../../lib/cx'
import { useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'
import { statusOf, type Status } from '../numbers'

function StatusMark({ status }: { status: Status | null }) {
  return (
    <span className="bk-ck-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32">
        {status === 'done' ? (
          <>
            <circle className="bk-ck-fill" cx="16" cy="16" r="15" />
            <path className="bk-ck-glyph" d="M9.5 16.5l4.2 4.2 8.8-9.2" />
          </>
        ) : status === 'late' ? (
          <>
            <circle className="bk-ck-fill" cx="16" cy="16" r="15" />
            <path className="bk-ck-glyph" d="M16 8.5v9M16 22.6v.4" />
          </>
        ) : status === 'doing' ? (
          <>
            <circle className="bk-ck-ring" cx="16" cy="16" r="13.5" />
            <path className="bk-ck-fill" d="M16 6.5a9.5 9.5 0 0 1 0 19z" />
          </>
        ) : (
          <circle className="bk-ck-ring" cx="16" cy="16" r="13.5" />
        )}
      </svg>
    </span>
  )
}

/** 준비 상황: 할 일마다 상태 표시. 상태 글(완료, 진행 중, 지연, 예정)을 읽어 표시를 고르고, 글은 그대로 보인다 */
export function Checks() {
  const { slide } = useSlide()
  const items = slide.items.slice(0, BLOCKS.checks.items!.max)
  const states = items.map((it) => statusOf(it.body, null))
  const done = states.filter((s) => s === 'done').length
  return (
    <div className="bk-ck">
      <div className="bk-ck-top">
        <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
        {states.some((s) => s !== null) && (
          <p className="bk-ck-sum">
            {items.length}개 중 <b>{done}개</b> 완료
          </p>
        )}
      </div>
      <ul className="bk-ck-list" data-n={items.length}>
        {items.map((it, i) => (
          <li key={it.id} className={cx('it bk-ck-row', states[i] && `is-${states[i]}`)}>
            <StatusMark status={states[i]} />
            <div className="bk-ck-text">
              <IT i={i} k="title" className="bk-ck-t" />
              <IT i={i} k="meta" className="bk-ck-m" />
            </div>
            <IT i={i} k="body" className="bk-ck-s" />
            <ItemTools i={i} />
          </li>
        ))}
      </ul>
    </div>
  )
}
