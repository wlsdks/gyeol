import { execSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { linkSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SECRET, secretDeck } from '../src/ai/share.test'
import { OP_CODES } from '../src/ai/ops'
import { toShape } from '../src/ai/share'
import { createSampleDeck } from '../src/deck/sample'

// 빌드한 MCP 서버를 실제로 띄워서 Claude Code처럼 이야기해 본다.
const repo = join(import.meta.dirname, '..')
const base = mkdtempSync(join(tmpdir(), 'gyeol-mcp-'))
const share = join(base, 'AI 공유')
let child: ChildProcessWithoutNullStreams
let nextId = 1
const waiting = new Map<number, (v: { result?: { content: { text: string }[]; isError?: boolean } & Record<string, unknown>; error?: unknown }) => void>()
const raw: string[] = []

function rpc(method: string, params: Record<string, unknown> = {}) {
  const id = nextId++
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  return new Promise<Parameters<NonNullable<ReturnType<typeof waiting.get>>>[0]>((resolve) => waiting.set(id, resolve))
}

async function tool(name: string, args: Record<string, unknown> = {}) {
  const res = await rpc('tools/call', { name, arguments: args })
  return { isError: !!res.result?.isError, value: JSON.parse(res.result!.content[0].text) }
}

beforeAll(async () => {
  execSync('npx vite build -c vite.node.config.ts --logLevel error', { cwd: repo })
  for (const d of ['decks', 'requests', 'results']) mkdirSync(join(share, d), { recursive: true })

  // 공유 폴더 옆에 작업 파일(.deck)이 있다고 치자. 비밀이 들어 있다.
  writeFileSync(join(base, '비밀 보고.deck'), JSON.stringify(secretDeck()))
  // 공유된 발표 하나 (비밀을 심은 덱에서 만든 모양)
  const shape = toShape(secretDeck())
  writeFileSync(join(share, 'decks', `${shape.deck}.json`), JSON.stringify(shape))
  // 누가 공유 폴더 안에 폴더 밖 파일로 가는 링크를 만들어 둔 경우. 꼴이 맞는 모양 파일이라도 읽히면 안 된다.
  const outside = toShape(createSampleDeck())
  outside.deck = 'd00000000'
  writeFileSync(join(base, 'outside.json'), JSON.stringify(outside))
  symlinkSync(join(base, 'outside.json'), join(share, 'decks', 'd00000000.json'))
  // 하드 링크도 마찬가지. Node 권한 모델은 링크를 따라가므로 서버가 직접 거른다.
  const hard = { ...outside, deck: 'd11111111' }
  writeFileSync(join(base, 'outside-hard.json'), JSON.stringify(hard))
  linkSync(join(base, 'outside-hard.json'), join(share, 'decks', 'd11111111.json'))

  child = spawn(process.execPath, [join(repo, 'dist-node', 'gyeol-mcp.mjs')], { env: { ...process.env, GYEOL_SHARE: share } })
  createInterface({ input: child.stdout }).on('line', (line) => {
    raw.push(line)
    const msg = JSON.parse(line)
    waiting.get(msg.id)?.(msg)
  })
  await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } })
}, 60000)

afterAll(() => {
  child?.kill()
})

describe('MCP 서버', () => {
  it('도구는 모양을 다루는 다섯 개뿐이다', async () => {
    const res = await rpc('tools/list')
    const names = (res.result!.tools as { name: string }[]).map((t) => t.name)
    expect(names).toEqual(['list_decks', 'get_catalog', 'get_shape', 'propose_changes', 'get_result'])
  })

  it('공유 폴더 밖 파일로 가는 링크는 읽지 않는다', async () => {
    const { value } = await tool('list_decks')
    expect(value.decks.map((d: { deck: string }) => d.deck)).not.toContain('d00000000')
    expect(value.decks.map((d: { deck: string }) => d.deck)).not.toContain('d11111111')
    expect((await tool('get_shape', { deck: 'd00000000' })).isError).toBe(true)
    expect(value.decks).toHaveLength(1)
  })

  it('모양을 보여 주지만 비밀은 한 글자도 나가지 않는다', async () => {
    const { value: list } = await tool('list_decks')
    const { value: shape, isError } = await tool('get_shape', { deck: list.decks[0].deck })
    expect(isError).toBe(false)
    expect(shape.slides.length).toBeGreaterThan(5)
    await tool('get_catalog')
    await tool('get_shape', { deck: `../${SECRET}` })
    await tool('get_result', { request: SECRET })
    await tool('propose_changes', { deck: list.decks[0].deck, note: 'x', ops: [{ op: 'set_field', text: SECRET }] })
    expect(raw.join('\n')).not.toContain(SECRET)
    expect(raw.join('\n')).not.toContain('7731')
  })

  it('제안은 파일로만 남고, 사람이 보기 전에는 pending이다', async () => {
    const { value: list } = await tool('list_decks')
    const { value: shape } = await tool('get_shape', { deck: list.decks[0].deck })
    const { value, isError } = await tool('propose_changes', {
      deck: shape.deck,
      note: '목차를 빼고 위험과 대응을 넣었어요',
      ops: [
        { op: 'set_hidden', slide: shape.slides[2].id, hidden: true },
        { op: 'add_slide', after: shape.slides[1].id, role: '위험과 대응' },
      ],
    })
    expect(isError).toBe(false)
    expect(value.status).toBe('pending')
    const saved = JSON.parse(readFileSync(join(share, 'requests', `${value.request}.json`), 'utf8'))
    expect(saved.ops).toHaveLength(2)
    expect((await tool('get_result', { request: value.request })).value.status).toBe('pending')
  })

  it('부품 장의 부품을 해시 id로 가리켜 모양을 바꾸자고 할 수 있다', async () => {
    const { value: list } = await tool('list_decks')
    const { value: shape } = await tool('get_shape', { deck: list.decks[0].deck })
    const compose = shape.slides.find((x: { layout: string }) => x.layout === 'compose')
    const first = compose.blocks[0][0].id
    expect(first).toMatch(/^b[0-9a-f]{8}$/)
    const { value, isError } = await tool('propose_changes', {
      deck: shape.deck,
      ops: [
        { op: 'add_block', slide: compose.id, type: 'number', row: 2, as: 'p1' },
        { op: 'set_block', slide: compose.id, block: 'p1', look: 'card' },
        { op: 'move_block', slide: compose.id, block: first, beside: 'p1', side: 'after' },
        { op: 'set_spans', slide: compose.id, block: first, spans: [6, 6] },
      ],
    })
    expect(isError).toBe(false)
    expect(value.status).toBe('pending')
    // 부품의 글을 쓰려는 키는 받지 않는다
    const bad = await tool('propose_changes', { deck: shape.deck, ops: [{ op: 'set_block', slide: compose.id, block: first, text: '새 글' }] })
    expect(bad.isError).toBe(true)
  })

  it('앱이 남긴 결과 코드는 모두 AI에게 알려 준다', async () => {
    // 정해진 말에 없는 코드가 하나라도 있으면 마지막 그물에 걸려 결과 대신 오류가 나간다
    const id = 'r00000000c0de'
    const results = OP_CODES.map((code) => ({ ok: code === 'applied', code }))
    writeFileSync(join(share, 'results', `${id}.json`), JSON.stringify({ format: 'html-maker/result', version: 1, request: id, status: 'applied', decidedAt: 1, results }))
    const { value, isError } = await tool('get_result', { request: id })
    expect(isError).toBe(false)
    expect(value).toEqual({ request: id, status: 'applied', results })
  })

  it('칸의 글을 쓰려는 제안은 받지 않는다', async () => {
    const { value: list } = await tool('list_decks')
    const before = readdirSync(join(share, 'requests')).length
    const { isError } = await tool('propose_changes', { deck: list.decks[0].deck, ops: [{ op: 'set_layout', slide: 's00000000', layout: 'points', text: '새 제목' }] })
    expect(isError).toBe(true)
    expect(readdirSync(join(share, 'requests'))).toHaveLength(before)
  })
})
