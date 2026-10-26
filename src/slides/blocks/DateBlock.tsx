// 부품: 날짜 (date). 모양은 styles/blocks/date.css, 움직임은 motion/engine.ts의 nativeAuto

import { readField } from '../../deck/fields'
import { cx } from '../../lib/cx'
import { useSlide } from '../context'
import { T } from '../fields'
import { dateParts } from '../numbers'

/**
 * 날짜: 일의 숫자를 왼쪽에 크게(글자색), 그 오른쪽에 달과 요일, 그날 하는 일, 덧붙임을 차례로. 달력 한 장을 글자로만 짠 꼴이라
 * 달력 그림은 쓰지 않는다. 날짜로 읽히지 않는 글(11월 둘째 주)은 나누지 않고 그대로 굵게. 편집할 때는 달 줄 위에 적은 글을 겹쳐 고친다
 */
export function DateBlock() {
  const { slide, meta, mode } = useSlide()
  const parts = dateParts(readField(slide, meta, 'date'))
  return (
    <div className={cx('bk-dt', !parts && 'is-text')}>
      {parts ? (
        <>
          <p className="bk-dt-day">{parts.day}</p>
          <p className="bk-dt-mo">
            {parts.head}
            {parts.weekday && <span className="bk-dt-wd">{parts.weekday}</span>}
          </p>
          {mode === 'edit' && <T k="date" className="bk-dt-txt on-chart" oneLine />}
        </>
      ) : (
        <T k="date" className="bk-dt-txt" />
      )}
      <T k="what" className="bk-dt-w" multiline />
      <T k="note" className="bk-dt-n" />
    </div>
  )
}
