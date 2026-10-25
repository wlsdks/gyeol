// 레이아웃: 표 (table). 모양은 styles/table.css

import { readField } from '../../deck/fields'
import { highlightOf } from '../../deck/layouts'
import type { ItemKey } from '../../deck/types'
import { cx } from '../../lib/cx'
import { useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'
import { isNumericCell } from '../numbers'
import { Head, useItems } from './parts'

/** 표의 칸: 머리말 칸 이름과 그 칸에 들어가는 항목 값, 기본 너비 */
const TABLE_COLS: { head: string; key: ItemKey; fr: number }[] = [
  { head: 'h1', key: 'title', fr: 1.3 },
  { head: 'h2', key: 'meta', fr: 1 },
  { head: 'h3', key: 'value', fr: 0.9 },
  { head: 'h4', key: 'body', fr: 1.8 },
]

export function Table() {
  const { slide, meta, mode } = useSlide()
  const items = useItems()
  const highlight = highlightOf(slide)
  // 발표할 때는 머리말도 칸도 비어 있는 칸을 뺀다. 편집할 때는 채울 수 있게 모두 보인다.
  const cols = TABLE_COLS.filter(
    (c, i) => i === 0 || mode !== 'final' || readField(slide, meta, c.head).trim() || items.some((it) => it[c.key].trim()),
  )
  const numeric = (key: ItemKey) => {
    const filled = items.map((it) => it[key].trim()).filter(Boolean)
    return filled.length > 0 && filled.every(isNumericCell)
  }
  const style = { '--cols': cols.map((c) => `minmax(0, ${c.fr}fr)`).join(' ') }
  return (
    <>
      <Head />
      <div className="s-body tb" data-n={items.length} style={style}>
        <div className="tb-row tb-headrow">
          {cols.map((c) => (
            <T key={c.head} k={c.head} as="span" className={cx('tb-h', numeric(c.key) && 'is-num')} />
          ))}
        </div>
        {items.map((it, i) => (
          // 마지막 줄이 합계면 위에 굵은 줄을 긋고 숫자를 굵게 (보고서 표의 관례)
          <div key={it.id} className={cx('it tb-row', highlight === i && 'is-hl', i === items.length - 1 && i > 0 && isTotalRow(it.title) && 'is-total')}>
            {cols.map((c) => (
              <IT
                key={c.key}
                i={i}
                k={c.key}
                className={cx('tb-cell', c.key === 'title' && 'tb-first', numeric(c.key) && 'is-num')}
                multiline={c.key === 'body'}
              />
            ))}
            <ItemTools i={i} />
          </div>
        ))}
      </div>
    </>
  )
}

/** 표의 합계 줄인지: 첫째 칸이 '합계', '총계', '소계', '계', '전체' 같은 말 (띄어쓰기, 괄호, 쌍점은 빼고 본다) */
function isTotalRow(title: string): boolean {
  return /^(합계|총계|총합|소계|계|합|전체)$/.test(title.replace(/[\s()[\]·:]/g, ''))
}
