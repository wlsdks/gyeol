// 부품: 강점과 약점 (swot). 모양은 styles/blocks/swot.css

import { BLOCKS } from '../../deck/blocks'
import { cx } from '../../lib/cx'
import { useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'

const SWOT = ['S', 'W', 'O', 'T']

/** 강점과 약점(SWOT): 위는 안(강점, 약점), 아래는 밖(기회, 위협). 칸 이름 글자(S, W, O, T)는 옅게 */
export function Swot() {
  const { slide, mode } = useSlide()
  const items = slide.items.slice(0, BLOCKS.swot.items!.max)
  // 발표할 때 글이 하나도 없는 칸은 칸 이름 글자도 그리지 않는다: 빈 칸은 그리지 않아서(fields.tsx) S, W, T만 덩그러니 남았다.
  // 빈 칸 하나는 자리를 남겨 네 칸의 자리(위는 안, 아래는 밖)를 지키고, 한 줄(위 둘이나 아래 둘)이 다 비면 그 줄을 빼서
  // 소제목 아래나 칸 아래가 한 줄만큼 비지 않게 한다. 글자는 원래 자리의 글자 그대로다
  const blank = items.map((it) => mode === 'final' && !it.title.trim() && !it.body.trim())
  return (
    <div className="bk-sw">
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <ul className="bk-sw-grid">
        {items.map((it, i) =>
          blank[i] && blank[i ^ 1] ? null : (
            <li key={it.id} className={cx('it bk-sw-q', blank[i] && 'is-blank')}>
              <div className="bk-sw-top">
                <span className="bk-sw-k" aria-hidden="true">
                  {SWOT[i]}
                </span>
                <IT i={i} k="title" className="bk-sw-t" />
              </div>
              <IT i={i} k="body" className="bk-sw-b" multiline />
              <ItemTools i={i} />
            </li>
          ),
        )}
      </ul>
    </div>
  )
}
