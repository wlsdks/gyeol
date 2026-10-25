// 부품: 강조 상자 (callout). 모양은 styles/blocks/callout.css

import { T } from '../fields'

export function Callout() {
  return (
    <div className="bk-call">
      <T k="label" className="bk-call-l" />
      <T k="text" className="bk-call-t" fit={[30, 56]} multiline />
    </div>
  )
}
