// 로컬 서버의 창구(AI 공유, 새 버전)가 같이 쓰는 문지기. 다른 웹사이트가 이 PC의 창구를 부르지 못하게 한다.
// 가져오는 것은 약속(protocol)뿐이다. 새 버전 창구가 AI 창구의 처리기까지 딸려 읽지 않게.

import type { IncomingMessage } from 'node:http'
import { AI_HEADER } from '../src/ai/protocol'

/**
 * 앱이 보낸 요청인지: 앱만 붙이는 머리글이 있고, Origin이 있으면 이 서버 주소와 같다.
 * 머리글을 붙인 다른 사이트의 요청은 브라우저가 먼저 허락을 묻는데(OPTIONS), 이 서버는 허락하지 않는다.
 */
export function fromApp(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  return req.headers[AI_HEADER.toLowerCase()] === '1' && (origin === undefined || origin === `http://${req.headers.host}`)
}
