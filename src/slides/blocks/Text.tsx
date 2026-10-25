// 부품: 제목과 글 (text). 모양은 styles/blocks/text.css

import { T } from '../fields'

export function Text() {
  return (
    <div className="bk-tx">
      <T k="label" className="bk-label" />
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <T k="body" className="bk-body" multiline />
    </div>
  )
}
