// 부품: 맡은 사람 (people). 모양은 styles/blocks/people.css

import { BLOCKS } from '../../deck/blocks'
import { useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'

/**
 * 맡은 사람: 이름, 역할, 맡은 일. 사진은 받지 않는다(사람 사진을 발표 파일에 담지 않게).
 * 이름 첫 글자를 넣은 회색 동그라미는 두지 않는다: 사진이 빠진 자리처럼 보였고, 글보다 동그라미가 먼저 눈에 들어와
 * 누가 무엇을 맡는지보다 '빈 얼굴 셋'이 읽혔다. 사람마다 위에 선을 긋고 이름을 크게 써서 사람 단위로 나눈다
 */
export function People() {
  const { slide } = useSlide()
  const items = slide.items.slice(0, BLOCKS.people.items!.max)
  return (
    <div className="bk-pp">
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <ul className="bk-pp-list" data-n={items.length}>
        {items.map((it, i) => (
          <li key={it.id} className="it bk-pp-card">
            <div className="bk-pp-text">
              <IT i={i} k="title" className="bk-pp-name" />
              <IT i={i} k="meta" className="bk-pp-role" />
              <IT i={i} k="body" className="bk-pp-b" multiline />
            </div>
            <ItemTools i={i} />
          </li>
        ))}
      </ul>
    </div>
  )
}
