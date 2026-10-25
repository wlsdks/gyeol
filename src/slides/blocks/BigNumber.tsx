// 부품: 큰 숫자 (number). 모양은 styles/blocks/number.css

import { T } from '../fields'

export function BigNumber() {
  return (
    <div className="bk-num">
      <T k="label" className="bk-num-l" />
      <T k="value" className="bk-num-v" oneLine numeral />
      <T k="note" className="bk-num-n" multiline />
    </div>
  )
}
