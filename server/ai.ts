// 'AI 공유' 폴더를 다루는 로컬 서버 쪽 창구. 브라우저 앱과 MCP 서버는 이 폴더로만 이야기한다.
//
//   AI 공유/
//   ├─ 읽어 주세요.txt
//   ├─ decks/<덱 해시>.json     앱 → AI   발표의 모양 (글 없음)
//   ├─ requests/<요청 id>.json  AI → 앱   바꾸자는 제안 (사람이 보고 적용하거나 거절)
//   └─ results/<요청 id>.json   앱 → AI   제안을 어떻게 했는지
//
// 'AI에게 부탁'(asks)은 이 PC의 Claude Code를 띄워 부탁을 전한다. 띄우는 방법과 막는 것은 agent.ts에.
//
// 이 창구도 모양 파일을 받을 때 checkShape로 다시 확인한다. 글이 섞인 파일은 쓰지 않는다.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { validAsk, type AskError } from '../src/ai/asks'
import { isOpCode, parseRequest, REQUEST_ID, type ChangeRequest, type OpCode } from '../src/ai/ops'
import { checkShape } from '../src/ai/share'
import { ASK_RUN_ID, createAgent, type AgentCommand } from './agent'

export const SHARE_DIR_NAME = 'AI 공유'
export const AI_PREFIX = '/__html-maker/ai/'
export const RESULT_FORMAT = 'html-maker/result'
const MAX_BODY = 512 * 1024
const KEEP_RESULTS_MS = 7 * 24 * 60 * 60 * 1000
const DECK_ID = /^d[0-9a-f]{8}$/

const README = `이 폴더는 결이 AI(Claude Code, Codex)와 주고받는 곳이에요.

- decks: 공유를 켠 발표의 '모양'만 있어요. 장 순서, 레이아웃, 칸이 비었는지, 테마.
  제목, 적은 글, 이미지, 발표자 노트, 소속과 이름은 들어 있지 않아요. 파일을 열어 직접 확인해 보세요.
- requests: AI가 보낸 바꾸자는 제안이에요. 앱에서 보고 적용하거나 거절해요.
- results: 제안을 적용했는지 거절했는지 AI에게 알려 주는 기록이에요.

지워도 괜찮아요. 공유를 켠 발표를 다시 열면 새로 만들어져요.
`

export interface ShareDirs {
  root: string
  decks: string
  requests: string
  results: string
}

export function shareDirs(root: string): ShareDirs {
  return { root, decks: join(root, 'decks'), requests: join(root, 'requests'), results: join(root, 'results') }
}

export function ensureShareDir(root: string): ShareDirs {
  const dirs = shareDirs(root)
  for (const d of [dirs.decks, dirs.requests, dirs.results]) mkdirSync(d, { recursive: true })
  const readme = join(root, '읽어 주세요.txt')
  // 윈도우 메모장이 한글을 바로 알아보게 BOM과 CRLF로 쓴다
  if (!existsSync(readme)) writeFileSync(readme, '\uFEFF' + README.replace(/\n/g, '\r\n'))
  return dirs
}

/** 반쯤 쓴 파일을 읽지 않게, 임시 이름으로 쓴 뒤 바꾼다 */
export function writeJsonAtomic(file: string, value: unknown) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, JSON.stringify(value, null, 2))
  renameSync(tmp, file)
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

export function pruneResults(dirs: ShareDirs, now = Date.now()) {
  if (!existsSync(dirs.results)) return
  for (const name of readdirSync(dirs.results)) {
    const file = join(dirs.results, name)
    try {
      if (now - statSync(file).mtimeMs > KEEP_RESULTS_MS) rmSync(file, { force: true })
    } catch {
      // 다른 쪽이 먼저 지웠으면 그만
    }
  }
}

/** 기다리는 제안. 꼴이 맞지 않는 파일은 지우고 거절 기록을 남긴다. */
export function pendingRequests(dirs: ShareDirs): ChangeRequest[] {
  if (!existsSync(dirs.requests)) return []
  const out: ChangeRequest[] = []
  for (const name of readdirSync(dirs.requests)) {
    if (!name.endsWith('.json')) continue
    const file = join(dirs.requests, name)
    const id = name.slice(0, -5)
    const request = parseRequest(readJson(file))
    if (request && request.id === id) {
      out.push(request)
      continue
    }
    rmSync(file, { force: true })
    if (REQUEST_ID.test(id)) writeResult(dirs, id, 'invalid', [])
  }
  return out.sort((a, b) => a.createdAt - b.createdAt)
}

export type ResultStatus = 'applied' | 'rejected' | 'invalid'

export function writeResult(dirs: ShareDirs, id: string, status: ResultStatus, results: { ok: boolean; code: OpCode }[]) {
  writeJsonAtomic(join(dirs.results, `${id}.json`), { format: RESULT_FORMAT, version: 1, request: id, status, decidedAt: Date.now(), results })
}

function parseResultBody(v: unknown): { status: ResultStatus; results: { ok: boolean; code: OpCode }[] } | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  if (!Object.keys(o).every((k) => k === 'status' || k === 'results')) return null
  if (o.status !== 'applied' && o.status !== 'rejected') return null
  if (!Array.isArray(o.results) || o.results.length > 40) return null
  const ok = o.results.every(
    (r) =>
      r && typeof r === 'object' && Object.keys(r).length === 2 && typeof (r as { ok: unknown }).ok === 'boolean' && isOpCode((r as { code: unknown }).code),
  )
  return ok ? { status: o.status, results: o.results as { ok: boolean; code: OpCode }[] } : null
}

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) {
        resolve(null)
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', () => resolve(null))
  })
}

export interface AiSetup {
  /** MCP 서버 파일의 경로. Claude Code, Codex 설정에 넣는다. */
  mcpPath: string
  /** MCP 서버를 띄울 node. 윈도우 배포본에는 node.exe가 들어 있어서 PATH의 node가 아닐 수 있다. */
  nodePath?: string
  /** 'AI에게 부탁'으로 띄울 프로그램을 찾는 방법. 시험에서만 바꾼다 */
  findAgent?: () => AgentCommand | null
  agentTimeoutMs?: number
}

const ASK_ERROR_STATUS: Record<AskError, number> = { bad_ask: 400, not_shared: 404, busy: 409, no_agent: 503, timeout: 500, login: 500, failed: 500 }

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

function empty(res: ServerResponse, status: number) {
  res.writeHead(status, { 'Cache-Control': 'no-store' })
  res.end()
}

/**
 * /__html-maker/ai/ 요청을 처리한다. 처리했으면 true.
 *
 * 다른 웹사이트가 이 창구를 쓰지 못하게: 앱만 붙이는 머리글(X-HTML-Maker)이 있어야 하고,
 * Origin이 있으면 이 서버 주소와 같아야 한다. 머리글을 붙인 다른 사이트의 요청은 브라우저가
 * 먼저 허락을 묻는데(OPTIONS), 이 서버는 허락하지 않는다.
 */
export function createAiHandler(shareRoot: string, setup: AiSetup) {
  const dirs = ensureShareDir(shareRoot)
  pruneResults(dirs)
  const agent = createAgent({
    shareRoot,
    mcpPath: setup.mcpPath,
    nodePath: setup.nodePath ?? process.execPath,
    find: setup.findAgent,
    timeoutMs: setup.agentTimeoutMs,
    hasTarget(deck, slide) {
      const shape = readJson(join(dirs.decks, `${deck}.json`))
      return checkShape(shape) && shape.deck === deck && (slide === null || shape.slides.some((s) => s.id === slide))
    },
    requestIds: (deck) => pendingRequests(dirs).filter((r) => r.deck === deck).map((r) => r.id),
  })
  process.once('exit', () => agent.stopAll())

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (!url.pathname.startsWith(AI_PREFIX)) return false
    const origin = req.headers.origin
    if (req.headers['x-html-maker'] !== '1' || (origin !== undefined && origin !== `http://${req.headers.host}`)) {
      empty(res, 403)
      return true
    }
    const path = url.pathname.slice(AI_PREFIX.length).split('/')
    const method = req.method ?? 'GET'

    if (method === 'GET' && path.join('/') === 'status') {
      const shared = existsSync(dirs.decks) ? readdirSync(dirs.decks).filter((n) => /^d[0-9a-f]{8}\.json$/.test(n)).map((n) => n.slice(0, -5)) : []
      json(res, 200, { ok: true, shared, mcpPath: setup.mcpPath, nodePath: setup.nodePath ?? process.execPath, agent: agent.available() })
      return true
    }

    if (method === 'POST' && path.join('/') === 'asks') {
      const body = await readBody(req)
      let v: unknown
      try {
        v = body === null ? undefined : JSON.parse(body)
      } catch {
        v = undefined
      }
      const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
      const keysOk = !!o && Object.keys(o).every((k) => k === 'ask' || k === 'deck' || k === 'slide')
      if (!o || !keysOk || !validAsk(o.ask, o.deck, o.slide ?? null)) {
        json(res, 400, { error: 'bad_ask' })
        return true
      }
      const run = agent.start(o.ask as Parameters<typeof agent.start>[0], o.deck as string, (o.slide as string | undefined) ?? null)
      if (typeof run === 'string') json(res, ASK_ERROR_STATUS[run], { error: run })
      else json(res, 202, run)
      return true
    }

    if (path[0] === 'asks' && path.length === 2 && ASK_RUN_ID.test(path[1])) {
      if (method === 'GET') {
        const run = agent.get(path[1])
        if (run) json(res, 200, run)
        else empty(res, 404)
        return true
      }
      if (method === 'DELETE') {
        empty(res, agent.cancel(path[1]) ? 204 : 404)
        return true
      }
    }

    if (path[0] === 'decks' && path.length === 2 && DECK_ID.test(path[1])) {
      const file = join(dirs.decks, `${path[1]}.json`)
      if (method === 'PUT') {
        const body = await readBody(req)
        let shape: unknown
        try {
          shape = body === null ? undefined : JSON.parse(body)
        } catch {
          shape = undefined
        }
        if (!checkShape(shape) || shape.deck !== path[1]) {
          empty(res, 400)
          return true
        }
        writeJsonAtomic(file, shape)
        empty(res, 204)
        return true
      }
      if (method === 'DELETE') {
        rmSync(file, { force: true })
        // 공유를 끄면 그 발표에 온 제안도 거절로 정리한다
        for (const r of pendingRequests(dirs)) {
          if (r.deck !== path[1]) continue
          rmSync(join(dirs.requests, `${r.id}.json`), { force: true })
          writeResult(dirs, r.id, 'rejected', r.ops.map(() => ({ ok: false, code: 'not_reviewed' as const })))
        }
        empty(res, 204)
        return true
      }
    }

    if (method === 'GET' && path.join('/') === 'requests') {
      json(res, 200, { requests: pendingRequests(dirs) })
      return true
    }

    if (method === 'POST' && path[0] === 'requests' && path.length === 3 && REQUEST_ID.test(path[1]) && path[2] === 'result') {
      const file = join(dirs.requests, `${path[1]}.json`)
      const body = await readBody(req)
      let parsed: ReturnType<typeof parseResultBody> = null
      try {
        parsed = body === null ? null : parseResultBody(JSON.parse(body))
      } catch {
        parsed = null
      }
      if (!parsed || !existsSync(file)) {
        empty(res, parsed ? 404 : 400)
        return true
      }
      writeResult(dirs, path[1], parsed.status, parsed.results)
      rmSync(file, { force: true })
      empty(res, 204)
      return true
    }

    empty(res, 404)
    return true
  }
}
