import { request } from 'node:http'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAppServer, HOST } from './serve.mjs'

let server
let port
const root = mkdtempSync(join(tmpdir(), 'html-maker-serve-'))

function get(path, host = `${HOST}:${port}`, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request({ host: HOST, port, path, method, headers: { Host: host } }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

beforeAll(async () => {
  mkdirSync(join(root, 'assets'))
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>t</title>')
  writeFileSync(join(root, 'assets', 'app.js'), 'console.log(1)')
  writeFileSync(join(tmpdir(), 'html-maker-secret.txt'), 'secret')
  server = createAppServer(root)
  await new Promise((resolve) => server.listen(0, HOST, resolve))
  port = server.address().port
})

afterAll(() => new Promise((resolve) => server.close(resolve)))

describe('로컬 서버', () => {
  it('127.0.0.1에만 묶인다', () => {
    expect(server.address().address).toBe('127.0.0.1')
  })

  it('화면 파일을 CSP와 함께 내준다', async () => {
    const res = await get('/')
    expect(res.status).toBe(200)
    expect(res.body).toContain('<title>t</title>')
    expect(res.headers['content-security-policy']).toContain("connect-src 'self'")
    expect(res.headers['content-security-policy']).toContain("default-src 'self'")
    expect((await get('/assets/app.js')).headers['content-type']).toContain('javascript')
  })

  it('다른 이름으로 들어온 요청은 막는다', async () => {
    expect((await get('/', `evil.example:${port}`)).status).toBe(403)
    expect((await get('/', `192.168.0.10:${port}`)).status).toBe(403)
  })

  it('localhost는 127.0.0.1 주소로 보낸다', async () => {
    const res = await get('/assets/app.js?v=1', `localhost:${port}`)
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`http://127.0.0.1:${port}/assets/app.js?v=1`)
  })

  it('화면 폴더 밖의 파일은 내주지 않는다', async () => {
    for (const path of ['/../html-maker-secret.txt', '/%2e%2e/html-maker-secret.txt', '/..%2fhtml-maker-secret.txt', '/..%5chtml-maker-secret.txt']) {
      const res = await get(path)
      expect(res.status).not.toBe(200)
      expect(res.body).not.toContain('secret')
    }
    expect((await get('/%E0%A4%A')).status).toBe(400)
  })

  it('읽기 말고는 받지 않는다', async () => {
    expect((await get('/', undefined, 'POST')).status).toBe(405)
  })
})
