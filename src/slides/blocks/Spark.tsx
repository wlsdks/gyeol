// 부품: 숫자와 흐름 (spark). 모양은 styles/blocks/spark.css

import { cx } from '../../lib/cx'
import { useSlide } from '../context'
import { T } from '../fields'
import { seriesIn } from '../numbers'
import { tokensOf, useDemo } from './parts'

/**
 * 흐름 칸의 숫자들. 쉼표나 띄어쓰기로 나눈다. '1,200'처럼 천 단위 쉼표가 든 숫자는 하나로 본다
 * (그래서 천 단위 숫자를 이어 적을 때는 쉼표 뒤를 띄어 쓴다: 1,200, 1,500). 단위를 섞어 적었으면('9,500만, 1.2억') 같은 자리로 맞춘다
 */
export function seriesOf(text: string): number[] {
  return seriesIn(tokensOf(text)).values.filter((v): v is number => v !== null)
}

/** 숫자와 흐름: 지금 숫자를 크게, 그동안의 흐름은 작은 선으로. 선 끝이 지금 숫자다 */
export function Spark() {
  const { mode } = useSlide()
  const { demo, read } = useDemo(['value', 'series'])
  const pts = seriesOf(read('series')).slice(-24)
  const lo = Math.min(...pts)
  const hi = Math.max(...pts)
  // 위아래 끝의 점이 잘리지 않게 띄우는 것은 그림 상자가 한다 (blocks.css의 .bk-sp-svg): 여기서는 위아래를 다 쓴다
  const at = pts.map((v, i) => ({ x: (i / Math.max(1, pts.length - 1)) * 100, y: hi === lo ? 50 : 100 - ((v - lo) / (hi - lo)) * 100 }))
  const line = at.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  const last = at[at.length - 1]
  return (
    <div className={cx('bk-sp', demo && 'is-demo')}>
      <div className="bk-sp-text">
        <T k="label" className="bk-sp-l" />
        <T k="value" className="bk-sp-v" oneLine numeral />
        <T k="note" className="bk-sp-n" />
      </div>
      <div className="bk-sp-chart">
        {pts.length >= 2 && (
          <>
            <svg className="bk-sp-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d={line} />
            </svg>
            <span className="bk-sp-dot" style={{ '--x': last.x, '--y': last.y }} aria-hidden="true" />
          </>
        )}
        {/* 흐름 숫자는 편집할 때 그림 자리에서 고친다(올리거나 누르면 숫자가 보인다). 발표 화면에는 선만.
            그림 아래에 줄을 따로 두면 편집 화면에서만 부품이 높아져 글자가 작아진다 */}
        {mode === 'edit' && <T k="series" className="bk-sp-s on-chart" />}
      </div>
    </div>
  )
}
