// 글자 칸과 그림에 CSS 변수(--n, --p 같은)를 style로 넘긴다. React의 CSSProperties는 변수 이름을 모르므로
// 여기서 '--'로 시작하는 이름을 열어 둔다. 장마다 'as CSSProperties'로 덮으면 보통 속성의 오타까지 숨었다
import 'react'

declare module 'react' {
  interface CSSProperties {
    [name: `--${string}`]: string | number | undefined
  }
}
