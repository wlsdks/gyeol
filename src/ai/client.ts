// 브라우저 앱이 로컬 서버의 'AI 공유' 창구와 이야기하는 곳. 같은 PC의 127.0.0.1로만 간다.

import type { Deck } from '../deck/types'
import type { ChangeRequest, OpResult } from './ops'
import { shapeDeckId, toShape, type ShapeDeck } from './share'

const BASE = '/__html-maker/ai/'
/** 다른 웹사이트가 이 창구를 쓰지 못하게 서버가 확인하는 머리글 */
const HEADERS = { 'X-HTML-Maker': '1' }

export interface AiStatus {
  shared: string[]
  /** Claude Code, Codex 설정에 넣을 MCP 서버 파일 경로 */
  mcpPath: string
  /** MCP 서버를 띄울 node 프로그램 경로 */
  nodePath: string
}

/** Claude Code, Codex에 붙여 넣을 MCP 서버 실행 명령. 경로에 빈칸이 있어도 되게 따옴표로 감싼다. */
export function mcpCommand(status: AiStatus): string {
  return `"${status.nodePath || 'node'}" "${status.mcpPath}"`
}

async function call(path: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    const res = await fetch(BASE + path, { ...init, headers: { ...HEADERS, ...(init.headers ?? {}) }, cache: 'no-store' })
    return res
  } catch {
    return null
  }
}

/** html-maker 시작 파일로 켠 서버에서만 쓸 수 있다. 아니면 null */
export async function aiStatus(): Promise<AiStatus | null> {
  const res = await call('status')
  if (!res?.ok) return null
  try {
    const body = (await res.json()) as AiStatus & { ok?: boolean }
    return body.ok ? { shared: body.shared ?? [], mcpPath: body.mcpPath ?? '', nodePath: body.nodePath ?? '' } : null
  } catch {
    return null
  }
}

export async function publishShape(shape: ShapeDeck): Promise<boolean> {
  const res = await call(`decks/${shape.deck}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(shape) })
  return res?.status === 204
}

export async function unshareDeck(deck: Pick<Deck, 'id'>): Promise<void> {
  await call(`decks/${shapeDeckId(deck)}`, { method: 'DELETE' })
}

export async function fetchRequests(): Promise<ChangeRequest[]> {
  const res = await call('requests')
  if (!res?.ok) return []
  try {
    return ((await res.json()) as { requests: ChangeRequest[] }).requests ?? []
  } catch {
    return []
  }
}

export async function sendResult(id: string, status: 'applied' | 'rejected', results: OpResult[]): Promise<boolean> {
  const res = await call(`requests/${id}/result`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, results }) })
  return res?.status === 204
}

/** 지금 덱을 공유하면 AI에게 보이는 그대로 */
export const shapeOf = (deck: Deck) => toShape(deck)
