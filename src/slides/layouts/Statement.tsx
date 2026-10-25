// 레이아웃: 한 문장 메시지 (statement). 모양은 styles/statement.css

import { T } from '../fields'

export function Statement() {
  return (
    <div className="s-body st">
      <T k="title" as="h2" className="st-title" fit={[26, 46]} multiline />
      <T k="lead" as="p" className="st-lead" multiline />
    </div>
  )
}
