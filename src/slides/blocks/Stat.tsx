// 부품: 숫자 한 줄 (stat). 모양은 styles/blocks/stat.css, 움직임은 motion/engine.ts의 nativeAuto

import { T } from '../fields'

/**
 * 숫자 한 줄: 이름, 숫자(강조색), 변화, 덧붙임. 큰 숫자보다 작게, 좁은 칸에 여럿 쌓아 한 목록으로 읽히게 아래에 옅은 선을 긋는다.
 * 좁으면 이름 위, 숫자 아래. 넓으면 이름은 왼쪽, 숫자는 오른쪽 끝에 같은 글자선으로 (stat.css)
 */
export function Stat() {
  return (
    <div className="bk-sl">
      <div className="bk-sl-box">
        <T k="label" className="bk-sl-l" />
        <div className="bk-sl-fig">
          <T k="value" className="bk-sl-v" oneLine numeral />
          <T k="change" className="bk-sl-c" />
        </div>
        <T k="note" className="bk-sl-n" multiline />
      </div>
    </div>
  )
}
