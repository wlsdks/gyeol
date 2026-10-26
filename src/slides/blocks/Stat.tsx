// 부품: 숫자 한 줄 (stat). 모양은 styles/blocks/stat.css, 움직임은 motion/engine.ts의 nativeAuto

import { T } from '../fields'

/**
 * 숫자 한 줄: 이름, 숫자, 변화, 덧붙임. 큰 숫자보다 작게, 좁은 칸에 여럿 쌓아 한 목록으로 읽힌다.
 * 어느 칸에서나 이름 위, 숫자 아래로 왼쪽 끝에 (stat.css, 큰 숫자와 같은 짜임)
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
