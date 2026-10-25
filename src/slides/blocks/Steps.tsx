// 부품: 단계 표시 (steps). 모양은 styles/blocks/steps.css, 움직임은 motion/engine.ts의 nativeAuto

import type { CSSProperties } from 'react'
import { BLOCKS } from '../../deck/blocks'
import { hintFor } from '../../deck/layouts'
import { cx } from '../../lib/cx'
import { useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'

/** 지금 단계: 고른 것이 있으면 그것(-1은 고르지 않음), 없으면 둘째 단계(첫 단계를 마치고 다음으로 넘어간 때가 가장 흔하다) */
export function stepsHighlight(chosen: number | undefined, n: number): number {
  if (chosen === undefined) return Math.min(1, n - 1)
  return Number.isInteger(chosen) && chosen >= -1 && chosen < n ? chosen : Math.min(1, n - 1)
}

/**
 * 단계 표시: 단계마다 점 하나를 한 줄 위에 두고, 지난 단계는 글자색으로 채운 점, 지금 단계는 강조색의 큰 점, 남은 단계는 빈 고리.
 * 답은 지금 단계라 그 번호(몇 / 몇)를 크게 둔다. 칸이 넓으면 단계 이름을 점 아래에 다 두고, 좁으면 지금 단계 이름만 번호 옆에 둔다
 * (steps.css). 좁은 칸에서 숨긴 이름은 편집할 때 점 줄 위에 겹쳐 고친다: 편집할 때만 줄이 늘면 발표 화면과 높이가 달라진다
 */
export function Steps() {
  const { slide, mode } = useSlide()
  const items = slide.items.slice(0, BLOCKS.steps.items!.max)
  const n = items.length
  const hl = stepsHighlight(slide.options.highlight, n)
  const now = hl >= 0 ? items[hl] : null
  const typed = now?.title.trim() ?? ''
  const nowName = typed || (now && mode !== 'final' ? hintFor(slide.layout, slide.hints, 'title', 'title', hl) : '')
  return (
    <div className={cx('bk-stp', hl < 0 && 'is-free')} data-n={n} style={{ '--n': n, '--hl': Math.max(hl, 0) } as CSSProperties}>
      <div className="bk-stp-head">
        <T k="label" className="bk-stp-l" />
        {now && (
          <p className="bk-stp-now">
            <span className="bk-stp-c">
              <b className="bk-stp-k">{hl + 1}</b>
              <span className="bk-stp-of">/ {n}</span>
            </span>
            {nowName && <span className={cx('bk-stp-cur', !typed && 'is-hint')}>{nowName}</span>}
          </p>
        )}
      </div>
      <ol className="bk-stp-list">
        {items.map((it, i) => (
          <li
            key={it.id}
            className={cx('it bk-stp-it', hl >= 0 && i < hl && 'is-done', i === hl && 'is-now')}
            style={{ '--i': i } as CSSProperties}
          >
            <span className="bk-stp-dot" aria-hidden="true" />
            <IT i={i} k="title" className="bk-stp-t" oneLine />
            <ItemTools i={i} />
          </li>
        ))}
      </ol>
    </div>
  )
}
