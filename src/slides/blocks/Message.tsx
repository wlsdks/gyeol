// 부품: 핵심 한 줄 (message). 모양은 styles/blocks/message.css

import { T } from '../fields'

export function Message() {
  return (
    <div className="bk-msg">
      <T k="text" as="p" className="bk-msg-t" fit={[30, 52]} multiline />
      <T k="sub" className="bk-msg-s" multiline />
    </div>
  )
}
