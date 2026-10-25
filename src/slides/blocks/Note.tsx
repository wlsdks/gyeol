// 부품: 주석 (note). 모양은 styles/blocks/note.css, 움직임은 motion/engine.ts의 nativeAuto

import { T } from '../fields'

/**
 * 주석: 표나 그림 아래, 또는 쌓은 단의 맨 아래에 두는 작은 글. 이름(출처, 기준, 주의)을 굵게 앞에 걸고 글은 그 옆에서 줄을 바꿔도
 * 같은 왼쪽 끝으로 내려간다. 선이나 색 막대 없이 글자 크기와 글자색만으로 본문보다 한 걸음 물러나 있다 (note.css)
 */
export function Note() {
  return (
    <div className="bk-nt">
      <T k="kind" className="bk-nt-k" />
      <T k="text" className="bk-nt-t" multiline />
    </div>
  )
}
