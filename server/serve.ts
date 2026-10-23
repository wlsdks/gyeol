// html-maker를 이 PC 안에서만 띄우는 작은 서버. 외부 패키지 없이 Node만으로 돈다.
//
// - 127.0.0.1에만 묶는다. 같은 네트워크의 다른 PC에서는 접속할 수 없다.
// - 포트를 고정한다. 브라우저 저장소는 주소(포트 포함)마다 따로라서, 포트가 바뀌면 저장한 발표가 안 보인다.
// - 화면 파일(dist)을 내주고, 'AI 공유' 폴더에 발표의 모양(글 없음)만 주고받는다. 발표 내용은 받지 않는다.
// - CSP로 브라우저가 이 PC 밖으로 연결하지 못하게 막는다.

import { spawn } from 'node:child_process'
import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs'
import { createServer, get, type IncomingMessage, type ServerResponse } from 'node:http'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAiHandler, SHARE_DIR_NAME } from './ai'
import { CSP } from './csp'

export { CSP }
export const HOST = '127.0.0.1'
export const PORT = Number(process.env.HTML_MAKER_PORT) || 41580
const ORIGIN = `http://${HOST}:${PORT}`
const HERE = dirname(fileURLToPath(import.meta.url))
/** 빌드하면 dist-node/ 안에 들어가므로 한 단계 위가 앱 폴더다 */
const APP_ROOT = join(HERE, '..')
const HEALTH = '/__html-maker'

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
}

function send(res: ServerResponse, status: number, body: string, headers: Record<string, string> = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', ...headers })
  res.end(body)
}

export interface ServerOptions {
  /** 화면 파일 폴더 */
  root?: string
  /** 'AI 공유' 폴더 */
  share?: string
}

export function createAppServer({ root = join(APP_ROOT, 'dist'), share = join(APP_ROOT, SHARE_DIR_NAME) }: ServerOptions = {}) {
  root = normalize(root)
  const ai = createAiHandler(share, { mcpPath: join(HERE, 'html-maker-mcp.mjs') })

  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // 다른 이름으로 들어온 요청은 받지 않는다 (DNS 리바인딩 방어).
    // localhost로 들어오면 127.0.0.1로 모은다. 주소가 다르면 브라우저 저장소도 달라서 발표가 안 보인다.
    const port = req.socket.localPort
    const origin = `http://${HOST}:${port}`
    const host = req.headers.host ?? ''
    if (host === `localhost:${port}`) return send(res, 302, '', { Location: `${origin}${req.url ?? '/'}` })
    if (host !== `${HOST}:${port}`) return send(res, 403, 'forbidden')

    let url: URL
    try {
      url = new URL(req.url ?? '/', origin)
      decodeURIComponent(url.pathname)
    } catch {
      return send(res, 400, 'bad request')
    }

    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v)
    if (await ai(req, res)) return

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed', { Allow: 'GET, HEAD' })
    if (url.pathname === HEALTH) return send(res, 200, 'html-maker')

    const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    const file = normalize(join(root, rel))
    if (!file.startsWith(root + sep)) return send(res, 403, 'forbidden')
    if (!existsSync(file) || !statSync(file).isFile()) return send(res, 404, 'not found')

    const type = TYPES[extname(file)] ?? 'application/octet-stream'
    // 화면 파일 이름에 해시가 붙어 있어 오래 캐시해도 된다. index.html만 매번 새로.
    const cache = file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable'
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': type, 'Cache-Control': cache })
    if (req.method === 'HEAD') return res.end()
    createReadStream(file).pipe(res)
  })
}

/** 이미 이 PC에서 html-maker가 떠 있는지 */
function alreadyRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = get({ host: HOST, port: PORT, path: HEALTH, headers: { Host: `${HOST}:${PORT}` }, timeout: 800 }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => resolve(body === 'html-maker'))
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => (req.destroy(), resolve(false)))
  })
}

/** 크롬이나 엣지로 연다. 둘 다 없으면 기본 브라우저로. */
function openBrowser(url: string) {
  if (process.env.HTML_MAKER_NO_OPEN) return
  const tries: [string, string[]][] =
    process.platform === 'darwin'
      ? [
          ['open', ['-a', 'Google Chrome', url]],
          ['open', ['-a', 'Microsoft Edge', url]],
          ['open', [url]],
        ]
      : process.platform === 'win32'
        ? [
            ['cmd', ['/c', 'start', '', 'chrome', url]],
            ['cmd', ['/c', 'start', '', 'msedge', url]],
          ]
        : [
            ['google-chrome', [url]],
            ['microsoft-edge', [url]],
            ['xdg-open', [url]],
          ]
  const next = (i: number) => {
    if (i >= tries.length) return
    const [cmd, args] = tries[i]
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true })
    child.on('error', () => next(i + 1))
    child.on('exit', (code) => code !== 0 && next(i + 1))
    child.unref()
  }
  next(0)
}

async function main() {
  if (!existsSync(join(APP_ROOT, 'dist', 'index.html'))) {
    console.error('화면 파일이 없어요. 먼저 "npm run build"를 실행해 주세요.')
    process.exit(1)
  }
  if (await alreadyRunning()) {
    console.log(`html-maker가 이미 켜져 있어요. 브라우저에서 엽니다: ${ORIGIN}`)
    openBrowser(ORIGIN)
    return
  }
  const server = createAppServer()
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') console.error(`${PORT}번 포트를 다른 프로그램이 쓰고 있어요. 그 프로그램을 끄고 다시 실행해 주세요.`)
    else console.error(err.message)
    process.exit(1)
  })
  server.listen(PORT, HOST, () => {
    console.log(`html-maker가 켜졌어요: ${ORIGIN}`)
    console.log('이 PC 안에서만 열리고, 발표 내용은 어디로도 보내지 않아요. 끄려면 이 창을 닫거나 Ctrl+C를 누르세요.')
    openBrowser(ORIGIN)
  })
}

function isMain(): boolean {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isMain()) main()
