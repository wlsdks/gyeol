import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { request, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSampleDeck } from '../src/deck/sample'
import { REQUEST_FORMAT } from '../src/ai/ops'
import { toShape } from '../src/ai/share'
import { HOST, createAppServer } from './serve'

let server: Server
let port: number
const base = mkdtempSync(join(tmpdir(), 'html-maker-serve-'))
const root = join(base, 'dist')
const share = join(base, 'AI 공유')

interface Res {
  status: number
  headers: Record<string, string | string[] | undefined>
  body: string
}

function call(path: string, { host, method = 'GET', headers = {}, body }: { host?: string; method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const req = request({ host: HOST, port, path, method, headers: { Host: host ?? `${HOST}:${port}`, ...headers } }, (res) => {
      let text = ''
      res.on('data', (c) => (text += c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: text }))
    })
    req.on('error', reject)
    req.end(body)
  })
}

const AI = { 'X-HTML-Maker': '1' }

beforeAll(async () => {
  mkdirSync(join(root, 'assets'), { recursive: true })
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>t</title>')
  writeFileSync(join(root, 'assets', 'app.js'), 'console.log(1)')
  writeFileSync(join(base, 'html-maker-secret.txt'), 'secret')
  server = createAppServer({ root, share })
  await new Promise<void>((resolve) => server.listen(0, HOST, resolve))
  port = (server.address() as AddressInfo).port
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

describe('로컬 서버', () => {
  it('127.0.0.1에만 묶인다', () => {
    expect((server.address() as AddressInfo).address).toBe('127.0.0.1')
  })

  it('화면 파일을 CSP와 함께 내준다', async () => {
    const res = await call('/')
    expect(res.status).toBe(200)
    expect(res.body).toContain('<title>t</title>')
    expect(res.headers['content-security-policy']).toContain("connect-src 'self'")
    expect(res.headers['content-security-policy']).toContain("default-src 'self'")
    expect((await call('/assets/app.js')).headers['content-type']).toContain('javascript')
  })

  it('다른 이름으로 들어온 요청은 막는다', async () => {
    expect((await call('/', { host: `evil.example:${port}` })).status).toBe(403)
    expect((await call('/', { host: `192.168.0.10:${port}` })).status).toBe(403)
  })

  it('localhost는 127.0.0.1 주소로 보낸다', async () => {
    const res = await call('/assets/app.js?v=1', { host: `localhost:${port}` })
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`http://127.0.0.1:${port}/assets/app.js?v=1`)
  })

  it('화면 폴더 밖의 파일은 내주지 않는다', async () => {
    for (const path of ['/../html-maker-secret.txt', '/%2e%2e/html-maker-secret.txt', '/..%2fhtml-maker-secret.txt', '/..%5chtml-maker-secret.txt']) {
      const res = await call(path)
      expect(res.status).not.toBe(200)
      expect(res.body).not.toContain('secret')
    }
    expect((await call('/%E0%A4%A')).status).toBe(400)
  })

  it('화면 파일에는 읽기 말고는 받지 않는다', async () => {
    expect((await call('/', { method: 'POST' })).status).toBe(405)
  })
})

describe('AI 공유 창구', () => {
  const deck = createSampleDeck()
  const shape = toShape(deck)

  it('앱 머리글이 없거나 다른 사이트에서 오면 막는다', async () => {
    expect((await call('/__html-maker/ai/status')).status).toBe(403)
    expect((await call('/__html-maker/ai/status', { headers: { ...AI, Origin: 'https://evil.example' } })).status).toBe(403)
    expect((await call('/__html-maker/ai/status', { headers: { ...AI, Origin: `http://${HOST}:${port}` } })).status).toBe(200)
  })

  it('모양 파일만 받고, 글이 섞이면 쓰지 않는다', async () => {
    const put = (body: unknown) => call(`/__html-maker/ai/decks/${shape.deck}`, { method: 'PUT', headers: AI, body: JSON.stringify(body) })
    expect((await put(shape)).status).toBe(204)
    const saved = readFileSync(join(share, 'decks', `${shape.deck}.json`), 'utf8')
    expect(JSON.parse(saved)).toEqual(shape)

    const leaky = structuredClone(shape) as unknown as { slides: Record<string, unknown>[]; title?: string }
    leaky.title = deck.title
    expect((await put(leaky)).status).toBe(400)
    const leaky2 = structuredClone(shape) as unknown as { slides: Record<string, unknown>[] }
    leaky2.slides[1].role = '한빛제조 품질 관리 사업'
    expect((await put(leaky2)).status).toBe(400)
    expect(readFileSync(join(share, 'decks', `${shape.deck}.json`), 'utf8')).toBe(saved)
  })

  it('제안을 넘겨주고, 결과를 남기면 제안은 지운다', async () => {
    const id = 'r0123456789ab'
    const req = { format: REQUEST_FORMAT, version: 1, id, deck: shape.deck, createdAt: 1, note: '목차를 뺐어요', ops: [{ op: 'set_hidden', slide: shape.slides[2].id, hidden: true }] }
    writeFileSync(join(share, 'requests', `${id}.json`), JSON.stringify(req))
    writeFileSync(join(share, 'requests', 'r111111111111.json'), JSON.stringify({ ...req, id: 'r111111111111', ops: [{ op: 'set_field', slide: shape.slides[2].id, text: 'x' }] }))

    const list = JSON.parse((await call('/__html-maker/ai/requests', { headers: AI })).body)
    expect(list.requests.map((r: { id: string }) => r.id)).toEqual([id])
    // 꼴이 맞지 않는 제안은 지우고 invalid로 남긴다
    expect(JSON.parse(readFileSync(join(share, 'results', 'r111111111111.json'), 'utf8')).status).toBe('invalid')

    const res = await call(`/__html-maker/ai/requests/${id}/result`, {
      method: 'POST',
      headers: AI,
      body: JSON.stringify({ status: 'applied', results: [{ ok: true, code: 'applied' }] }),
    })
    expect(res.status).toBe(204)
    expect(readdirSync(join(share, 'requests'))).toEqual([])
    expect(JSON.parse(readFileSync(join(share, 'results', `${id}.json`), 'utf8')).status).toBe('applied')
  })

  it('공유를 끄면 모양 파일을 지운다', async () => {
    expect((await call(`/__html-maker/ai/decks/${shape.deck}`, { method: 'DELETE', headers: AI })).status).toBe(204)
    expect(readdirSync(join(share, 'decks'))).toEqual([])
  })
})
