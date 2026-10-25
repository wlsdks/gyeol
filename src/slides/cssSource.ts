import { readFileSync } from 'node:fs'

/**
 * 테스트용: CSS 파일을 @import까지 풀어 한 덩어리로 (Vite가 묶는 차례와 같다). slides.css와 blocks.css는 구획마다 나눈
 * 파일(styles/)을 가져오기만 해서, 그 파일 하나만 읽으면 값이 하나도 없다
 */
export function cssSource(url: URL): string {
  return readFileSync(url, 'utf8').replace(/@import '([^']+)';/g, (_, path: string) => cssSource(new URL(path, url)))
}
