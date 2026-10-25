// 부품: 소제목 (heading). 모양은 styles/blocks/heading.css, 움직임은 motion/engine.ts의 nativeAuto

import { T } from '../fields'

/**
 * 소제목: 위에 글자색 선 하나를 긋고 그 아래 짧은 제목. 옆이나 아래 컴포넌트들을 한 묶음으로 읽게 하는 이름이라
 * 면과 강조색 없이 선과 글자만. 덧붙임은 좁으면 아래, 넓으면 같은 줄 오른쪽 끝에 같은 글자선으로
 */
export function Heading() {
  return (
    <div className="bk-hd">
      <div className="bk-hd-row">
        <T k="text" as="h3" className="bk-hd-t" />
        <T k="note" as="p" className="bk-hd-n" />
      </div>
    </div>
  )
}
