// 부품: 전과 후 (delta). 모양은 styles/blocks/delta.css

import { readField } from '../../deck/fields'
import { hintFor } from '../../deck/layouts'
import { cx } from '../../lib/cx'
import { ArrowMark } from '../arrow'
import { useSlide } from '../context'
import { numberUnits, T } from '../fields'
import { changeOf, formatNumber } from '../numbers'
import { useDemo } from './parts'

/**
 * 전과 후의 차이. 둘 다 %면 %p로, 아니면 전 값에 대한 %. 단위까지 읽어서 '6분 → 40초'는 ▼ 89%,
 * 견줄 수 없는 단위('3건 → 40%')면 보이지 않는다 (numbers.ts의 changeOf)
 */
function deltaOf(before: string, after: string): { text: string; dir: -1 | 0 | 1 } | null {
  const c = changeOf(before, after)
  if (!c) return null
  const round = (n: number) => (Math.abs(n) < 10 ? Math.round(n * 10) / 10 : Math.round(n))
  const shown = Math.abs(round(c.value))
  // 반올림해 0이면 바뀐 쪽을 가리키지 않는다 (▲ 0%가 되지 않게)
  const dir = shown === 0 ? 0 : c.value > 0 ? 1 : -1
  return { text: `${formatNumber(shown)}${c.pp ? '%p' : '%'}`, dir }
}

/**
 * 전과 후: 두 숫자는 같은 크기로(둘 중 긴 쪽이 들어가는 크기), 전은 옅게, 후는 강조색으로. 크기가 다르면 같은 줄의 두 숫자가
 * 서로 다른 것을 재는 것처럼 보인다. 바뀐 만큼은 결과(후) 바로 아래에 붙인다
 */
export function Delta() {
  const { slide, meta } = useSlide()
  const { demo, read } = useDemo(['before', 'after'])
  const delta = deltaOf(read('before'), read('after'))
  // 비어 있는 쪽은 안내 글의 폭으로 (편집할 때 안내 글이 그 자리에 보인다)
  const shown = (k: string) => readField(slide, meta, k).trim() || hintFor(slide.layout, slide.hints, k)
  const units = Math.max(numberUnits(shown('before')), numberUnits(shown('after')))
  return (
    <div className={cx('bk-dl', demo && 'is-demo')}>
      <T k="label" className="bk-dl-l" />
      <div className="bk-dl-row" style={{ '--dl-units': units.toFixed(2) }}>
        <div className="bk-dl-side bk-dl-from">
          <span className="bk-dl-k">전</span>
          <div className="bk-dl-vbox">
            <T k="before" className="bk-dl-v" oneLine numeral units={units} />
          </div>
        </div>
        <span className="bk-dl-arrow" aria-hidden="true">
          <ArrowMark />
        </span>
        <div className="bk-dl-side bk-dl-to">
          <span className="bk-dl-k">후</span>
          <div className="bk-dl-vbox">
            <T k="after" className="bk-dl-v" oneLine numeral units={units} />
          </div>
          {delta && (
            <span className={cx('bk-dl-chip', delta.dir < 0 ? 'is-down' : delta.dir > 0 ? 'is-up' : 'is-flat')}>
              {delta.dir < 0 ? '▼' : delta.dir > 0 ? '▲' : '–'} {delta.text}
            </span>
          )}
        </div>
      </div>
      <T k="note" className="bk-dl-n" />
    </div>
  )
}
