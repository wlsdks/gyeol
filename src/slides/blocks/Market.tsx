// 부품: 시장 규모 (market). 모양은 styles/blocks/market.css

import { BLOCKS } from '../../deck/blocks'
import { useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'

/**
 * 시장 규모: 전체 시장, 공략할 시장, 목표를 바닥에 맞춰 겹친 원으로. 원의 크기는 규모에 비례하지 않는다
 * (전체 시장은 목표의 백 배가 넘기 일쑤라 비례하면 목표가 점이 된다). 규모는 옆 목록의 큰 숫자로 읽는다
 */
export function Market() {
  const { slide } = useSlide()
  const items = slide.items.slice(0, BLOCKS.market.items!.max)
  return (
    <div className="bk-mk" data-n={items.length}>
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <div className="bk-mk-body">
        <div className="bk-mk-box" aria-hidden="true">
          <div className="bk-mk-fig">
            {items.map((it, i) => (
              <span key={it.id} className="bk-mk-c" style={{ '--i': i }} />
            ))}
          </div>
        </div>
        <ol className="bk-mk-list">
          {items.map((it, i) => (
            <li key={it.id} className="it bk-mk-row" style={{ '--i': i }}>
              <span className="bk-mk-sw" aria-hidden="true" />
              <div className="bk-mk-text">
                <IT i={i} k="title" className="bk-mk-t" />
                <IT i={i} k="value" className="bk-mk-v" />
                <IT i={i} k="body" className="bk-mk-b" multiline />
              </div>
              <ItemTools i={i} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// 항목마다 칸 하나(.bk-cc-col)가 그래프 줄과 이름 줄을 subgrid로 나눠 쓴다. 막대 길이는 --p(0~100)로만 넘기고,
// 막대 위 숫자 자리는 CSS가 칸 높이에서 뺀다. 편집할 때 숫자는 막대 위 그 자리에서 고친다
