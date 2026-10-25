// 부품: 맡은 사람 (people). 모양은 styles/blocks/people.css

import { BLOCKS } from '../../deck/blocks'
import { cx } from '../../lib/cx'
import { useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'
import { PersonIcon } from './parts'

/** 맡은 사람: 이름 첫 글자를 동그라미에. 사진은 받지 않는다(사람 사진을 발표 파일에 담지 않게) */
export function People() {
  const { slide, mode } = useSlide()
  const items = slide.items.slice(0, BLOCKS.people.items!.max)
  return (
    <div className="bk-pp">
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <ul className="bk-pp-list" data-n={items.length}>
        {items.map((it, i) => {
          const initial = [...it.title.trim()][0]
          return (
            <li key={it.id} className="it bk-pp-card">
              <span className={cx('bk-pp-av', !initial && 'is-blank')} aria-hidden="true">
                {initial ?? (mode === 'final' ? null : <PersonIcon />)}
              </span>
              <div className="bk-pp-text">
                <IT i={i} k="title" className="bk-pp-name" />
                <IT i={i} k="meta" className="bk-pp-role" />
                <IT i={i} k="body" className="bk-pp-b" multiline />
              </div>
              <ItemTools i={i} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
