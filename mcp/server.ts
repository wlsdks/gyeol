// html-maker MCP 서버. Claude Code, Codex가 발표의 '모양'만 보고 바꾸자고 제안할 수 있게 한다.
//
// 내용이 새지 않게 세 겹으로 막는다.
// 1. 볼 수 있는 곳: 'AI 공유' 폴더뿐. 스스로를 Node 권한 모델(--permission) 안에서 다시 띄워서
//    그 폴더 밖의 파일(.deck 작업 파일 등)은 Node 수준에서 읽기 자체가 막힌다. 다른 프로그램 실행도 막힌다.
//    권한 모델은 심볼릭 링크를 따라가 버리므로, 링크와 하드 링크는 아예 읽지 않고 실제 위치도 확인한다.
// 2. 읽는 것: 모양 파일도 checkShape로 다시 확인하고, 어긋나면 통째로 버린다.
// 3. 내보내는 것: 응답 안의 모든 글자가 카탈로그, 정해진 말, 해시 id 중 하나인지 마지막으로 확인한다.
//    하나라도 아니면 응답 대신 정해진 오류만 보낸다. 오류 메시지에도 받은 값이나 경로를 넣지 않는다.
//
// 바꾸는 것은 제안(requests)으로만 남기고, 사람이 앱에서 보고 적용하거나 거절한다.

import { spawn } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { MAX_OPS, NOTE_MAX, OP_NAMES, parseRequest, REQUEST_FORMAT, REQUEST_ID, requestId, type ChangeRequest } from '../src/ai/ops'
import { catalog, checkShape, onlyKnownStrings, SHAPE_FORMAT, type ShapeDeck } from '../src/ai/share'
import { BLOCK_EFFECT_IDS, BLOCK_LINK_IDS, BLOCK_LOOK_IDS, BLOCK_TYPES } from '../src/deck/blocks'
import { LAYOUT_ORDER } from '../src/deck/layouts'
import { FONTS, FOOTERS, MOTIONS, TEXT_SIZES, THEME_ORDER, TONES, TRANSITIONS } from '../src/deck/themes'

const SHARE_DIR_NAME = 'AI 공유'
const VERSION = '0.1.0'
const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
const MAX_PENDING_PER_DECK = 5
const DECK_ID = /^d[0-9a-f]{8}$/

// ---------- 정해진 말: 응답에 나가도 되는 글자 ----------

const MESSAGES = {
  noDeck: '공유된 발표가 아니에요. list_decks로 확인하세요.',
  badShape: '모양 파일을 읽을 수 없어요. 앱에서 발표를 다시 열면 새로 만들어져요.',
  badRequest: '제안의 꼴이 맞지 않아요. 도구 설명의 규칙을 확인하세요.',
  tooMany: '이 발표에 아직 보지 않은 제안이 많아요. 사람이 앱에서 확인한 뒤에 다시 보내세요.',
  unknownRequest: '모르는 제안 id예요.',
  blocked: '응답에 내보낼 수 없는 값이 있어서 막았어요.',
  unknownTool: '모르는 도구예요.',
  pending: '앱에서 사람이 확인하면 적용돼요. get_result로 결과를 볼 수 있어요.',
  internal: '처리하지 못했어요.',
} as const

const PROTOCOL_WORDS = [
  // 모양 파일
  SHAPE_FORMAT, 'format', 'version', 'deck', 'type', 'audience', 'duration', 'method', 'theme', 'accent', 'motion', 'font', 'size', 'footer', 'transition', 'tone', 'updatedAt', 'slides',
  'id', 'layout', 'role', 'section', 'hidden', 'hiddenItems', 'fields', 'items', 'options', 'highlight', 'flip', 'contain', 'variant', 'variants', 'base',
  'empty', 'filled', 'long',
  // 부품 장
  'blocks', 'span', 'look', 'effect', 'rowGrow', 'link', 'rowLinks',
  // 목록과 결과
  'decks', 'slideCount', 'visibleSlides', 'request', 'status', 'results', 'ok', 'code', 'message', 'pending', 'applied', 'rejected', 'invalid', 'unknown',
  'no_slide', 'has_content', 'out_of_range', 'not_for_layout', 'last_slide', 'unknown_role', 'no_change', 'not_reviewed', 'no_block', 'no_room', 'look_clash',
  ...OP_NAMES,
  ...Object.values(MESSAGES),
]

// ---------- 'AI 공유' 폴더 ----------

interface Dirs {
  decks: string
  requests: string
  results: string
}

/**
 * 폴더 안의 진짜 파일만 읽는다. 심볼릭 링크, 하드 링크(다른 이름이 또 있는 파일), 실제 위치가
 * 폴더 밖인 파일은 읽지 않는다. 권한 모델이 링크를 따라가는 것을 여기서 막는다.
 */
function readJson(file: string): unknown {
  try {
    const st = lstatSync(file)
    if (!st.isFile() || st.nlink > 1 || st.size > 2 * 1024 * 1024) return undefined
    if (!realpathSync.native(file).startsWith(realpathSync.native(dirname(file)) + sep)) return undefined
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

/** 공유 폴더의 하위 폴더가 링크면 다른 곳을 읽고 쓰게 되므로 시작하지 않는다 */
function checkDirs(dirs: Dirs): boolean {
  try {
    return Object.values(dirs).every((d) => lstatSync(d).isDirectory())
  } catch {
    return false
  }
}

function readShape(dirs: Dirs, deck: string): ShapeDeck | null {
  if (!DECK_ID.test(deck)) return null
  const shape = readJson(join(dirs.decks, `${deck}.json`))
  return checkShape(shape) && shape.deck === deck ? shape : null
}

function listShapes(dirs: Dirs): ShapeDeck[] {
  if (!existsSync(dirs.decks)) return []
  return readdirSync(dirs.decks)
    .filter((n) => /^d[0-9a-f]{8}\.json$/.test(n))
    .map((n) => readShape(dirs, n.slice(0, -5)))
    .filter((s): s is ShapeDeck => !!s)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

function pendingFor(dirs: Dirs, deck: string): ChangeRequest[] {
  if (!existsSync(dirs.requests)) return []
  return readdirSync(dirs.requests)
    .filter((n) => n.endsWith('.json'))
    .map((n) => parseRequest(readJson(join(dirs.requests, n))))
    .filter((r): r is ChangeRequest => !!r && r.deck === deck)
}

// ---------- 도구 ----------

class ToolError extends Error {}

const refSchema = { type: 'string', description: '장 id(s로 시작하는 9글자) 또는 같은 제안에서 add_slide의 as로 붙인 이름(n1, n2...)' }
const blockRefSchema = { type: 'string', description: '부품 id(get_shape의 blocks[][].id, b로 시작하는 9글자) 또는 같은 제안에서 add_block의 as로 붙인 이름(p1, p2...)' }

const TOOLS = [
  {
    name: 'list_decks',
    description:
      '사용자가 앱에서 AI 공유를 켠 발표 목록. 제목은 없고 해시 id(d로 시작)로 구분한다. 보고 종류, 장 수, 보고 받는 분, 시간이 나온다. ' +
      '최근에 고친 순서라서, 여러 개면 맨 앞이 지금 고치고 있는 발표일 가능성이 크다. 목록이 비었으면 앱의 편집 화면 위쪽 AI 버튼에서 공유를 켜 달라고 안내한다.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_catalog',
    description:
      '쓸 수 있는 레이아웃(칸과 항목 수 범위 포함), 보고 종류별 장 역할(role)과 순서, 보고 받는 분, 시간, 방식, 테마, 부품 장에 쓰이는 부품(blocks). ' +
      '제안을 만들기 전에 한 번 읽는다. add_slide의 role에 여기 나온 역할 이름을 쓰면 그 장의 안내와 이름표까지 같이 들어간다.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_shape',
    description:
      '발표 하나의 모양: 장 순서, 장마다 레이아웃과 역할, 숨김 여부, 칸마다 비었는지(empty)/채웠는지(filled)/길어서 넘칠 수 있는지(long), 항목 수, 옵션, 테마. ' +
      '부품 장(layout compose)은 부품을 줄과 칸에 놓아 꾸민 장으로, blocks에 줄마다 부품의 id(b로 시작), 종류, 너비(span, 12 기준), 모양, 바탕, 움직임, 칸 상태가 나온다. ' +
      '사람이 적은 글은 이 서버에 없다. 글의 내용을 추측하거나 사용자에게 붙여 달라고 하지 말고 모양만으로 판단한다.',
    inputSchema: {
      type: 'object',
      properties: { deck: { type: 'string', description: 'list_decks의 deck (d로 시작하는 9글자)' } },
      required: ['deck'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'propose_changes',
    description: [
      '발표의 모양을 바꾸자는 제안을 보낸다. 바로 바뀌지 않고, 사용자가 앱에서 미리 보고 적용하거나 거절한다. 적용 전 상태는 버전으로 남는다.',
      '사람이 적은 글은 쓸 수도 지울 수도 없다. 쓸 수 있는 글은 note(사용자에게 보이는 제안 설명), set_guide(장 안내), set_hint(칸의 회색 안내 문구)뿐이고 모두 안내다. 내용처럼 보이는 문장(숫자, 회사명, 결론)을 안내 문구에 넣지 않는다.',
      'ops는 차례로 적용되고, 되지 않는 것은 건너뛴다.',
      '- add_slide {after: 장 id 또는 null(맨 앞), role?: 카탈로그의 역할 이름, layout?: 레이아웃 id, as?: "n1"} role이나 layout 중 하나는 있어야 한다.',
      '- remove_slide {slide} 빈 장만 지운다. 내용이 있으면 has_content로 실패하니 set_hidden을 쓴다.',
      '- move_slide {slide, after: 장 id 또는 null(맨 앞)}',
      '- set_layout {slide, layout, variant?} 내용은 그대로 두고 모양만 바꾼다. variant는 카탈로그 layouts[].variants의 id. 넘치는 항목은 숨겨질 뿐 지워지지 않는다. ' +
        'layout을 compose로 하면 같은 내용의 부품 장이 되고(표지, 단락 장은 안 됨), 부품 장은 그 레이아웃의 부품 하나뿐일 때만 다른 레이아웃으로 되돌릴 수 있다.',
      '- set_hidden {slide, hidden} 발표에서 빼거나 다시 넣는다.',
      '- set_item_count {slide, count} 항목 수. 줄일 때는 끝의 빈 항목만 지운다.',
      '- set_options {slide, highlight?: 강조할 항목 번호(0부터, -1은 없음; 카탈로그 layouts[].highlight가 있는 레이아웃만), flip?, contain?: 이미지와 설명, motion?: 이 장만 다른 움직임(카탈로그 motions, null은 발표 전체 설정대로), tone?: 이 장의 바탕(카탈로그 tones; 표지, 섹션, 결정 요청은 안 됨)}',
      '- set_theme {theme?: 테마 id, accent?: "#rrggbb"(카탈로그 accents의 강조색에서 고르기) 또는 null(테마 기본색), motion?: 발표할 때 움직임(카탈로그 motions), font?: 제목 글꼴(카탈로그 fonts, null은 테마 글꼴), size?: 글자 크기(textSizes), footer?: 아래 표시(footers), transition?: 장 넘기기(transitions)}',
      '바탕(tone)은 흐름을 끊고 눈길을 모을 장 한두 곳에만 쓴다. 모든 장을 바꾸면 오히려 아무것도 눈에 띄지 않는다.',
      '- set_guide {slide, text} 이 장을 어떻게 채우면 좋은지 (200자 이내)',
      '- set_hint {slide, block?, field, item?, text} 칸의 안내 문구 (80자 이내, 한 줄). item을 빼면 장의 칸, 장에 없는 칸이면 모든 항목의 그 칸. block이 있으면 부품 장의 그 부품 칸(카탈로그 blocks[].fields, items.fields).',
      '부품 장(compose): 줄은 위에서 아래로, 한 줄에 부품이 왼쪽에서 오른쪽으로 놓인다. 줄 수, 한 줄과 한 장의 부품 수, 고를 수 있는 너비는 카탈로그 blockRules. 부품마다 가장 좁은 너비는 blocks[].minSpan(12면 그 부품은 한 줄을 혼자 쓴다). 장에 자리가 모자라면 no_room으로 건너뛴다. ' +
        '면(look)은 부품마다 고를 수 있는 것(blocks[].looks)에서, 한 장에 한 가지만: 옅은 면(card)끼리, 또는 진한 면(bold) 하나와 바탕 없는(plain) 부품들. ' +
        '옅은 면은 같은 줄의 부품이 함께 바뀌고, 혼자 한 줄을 다 쓰는 부품은 면 없이 그려진다. 어긋나면 look_clash로 건너뛴다.',
      '- add_block {slide, type, variant?, look?, effect?, as?: "p1", 자리} 빈 부품을 넣는다. 자리: row(그 차례에 새 줄, 0이 맨 위) 또는 beside(그 부품의 줄에)와 side(before|after, 기본 after). 자리를 빼면 알아서 놓는다.',
      '- remove_block {slide, block} 빈 부품만 뺀다. 내용이 있으면 has_content.',
      '- move_block {slide, block, 자리} 부품을 옮긴다. 글은 부품과 함께 간다. row는 옮기는 부품을 뺀 뒤의 줄 차례로 센다.',
      '- set_block {slide, block, variant?: 카탈로그 blocks[].variants, look?: blockLooks, effect?: blockEffects, count?: 항목 수(줄일 때는 끝의 빈 항목만), highlight?: 강조할 항목(blocks[].highlight가 있는 부품만, -1은 없음)}',
      '- set_spans {slide, block, spans} 그 부품이 있는 줄의 칸 너비. blockRules.spans에서 그 줄의 부품 수에 맞는 것을 고른다.',
      '- set_row_grow {slide, grow} 부품 장의 줄 높이 비중(1~100의 정수, 줄 수만큼 위에서부터). 빈 배열이면 똑같이 나눈다. 지금 비중은 모양의 rowGrow(없으면 똑같이). 비중대로면 잘리는 줄은 잘리지 않을 높이로 묶인다.',
      '- set_link {slide, block, side, link} 이음표(카탈로그 blockLinks)를 부품 사이에 끼운다. side가 right면 그 부품과 같은 줄의 오른쪽 부품 사이, below면 그 부품의 줄과 아래 줄 사이. link가 null이면 뺀다. 지금 이음표는 모양의 blocks[][].link와 rowLinks. ' +
        '두 부품이 이어지거나(화살표), 함께이거나(더하기), 모여 결과가 되거나(결과), 견줄 때(견주기)만 쓴다. 줄 사이 이음표는 높이가 더 들어서 모자라면 no_room.',
    ].join('\n'),
    inputSchema: {
      type: 'object',
      properties: {
        deck: { type: 'string' },
        note: { type: 'string', maxLength: NOTE_MAX, description: '무엇을 왜 바꾸는지 사용자에게 보여 줄 짧은 설명' },
        ops: {
          type: 'array',
          minItems: 1,
          maxItems: MAX_OPS,
          items: {
            type: 'object',
            properties: {
              op: { type: 'string', enum: OP_NAMES },
              slide: refSchema,
              after: { anyOf: [refSchema, { type: 'null' }] },
              layout: { type: 'string', enum: LAYOUT_ORDER },
              role: { type: 'string', maxLength: 24 },
              as: { type: 'string', pattern: '^[np][0-9]{1,2}$' },
              hidden: { type: 'boolean' },
              count: { type: 'integer', minimum: 0, maximum: 20 },
              highlight: { type: 'integer', minimum: -1, maximum: 19 },
              flip: { type: 'boolean' },
              contain: { type: 'boolean' },
              variant: { type: 'string', maxLength: 24 },
              theme: { type: 'string', enum: THEME_ORDER },
              accent: { anyOf: [{ type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }, { type: 'null' }] },
              motion: { anyOf: [{ type: 'string', enum: MOTIONS.map((m) => m.id) }, { type: 'null' }] },
              tone: { type: 'string', enum: TONES.map((m) => m.id) },
              font: { anyOf: [{ type: 'string', enum: FONTS.map((m) => m.id) }, { type: 'null' }] },
              size: { type: 'string', enum: TEXT_SIZES.map((m) => m.id) },
              footer: { type: 'string', enum: FOOTERS.map((m) => m.id) },
              transition: { type: 'string', enum: TRANSITIONS.map((m) => m.id) },
              field: { type: 'string' },
              item: { type: 'integer', minimum: 0 },
              text: { type: 'string' },
              block: blockRefSchema,
              type: { type: 'string', enum: BLOCK_TYPES },
              look: { type: 'string', enum: BLOCK_LOOK_IDS },
              effect: { type: 'string', enum: BLOCK_EFFECT_IDS },
              row: { type: 'integer', minimum: 0, maximum: 3 },
              beside: blockRefSchema,
              side: { type: 'string', enum: ['before', 'after', 'right', 'below'] },
              link: { anyOf: [{ type: 'string', enum: BLOCK_LINK_IDS }, { type: 'null' }] },
              spans: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'integer', minimum: 1, maximum: 12 } },
            },
            required: ['op'],
            additionalProperties: false,
          },
        },
      },
      required: ['deck', 'ops'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'get_result',
    description: '보낸 제안을 사용자가 어떻게 했는지: pending(아직 안 봄), applied(적용), rejected(거절), invalid(꼴이 맞지 않음). 적용했으면 op마다 결과 코드가 나온다.',
    inputSchema: {
      type: 'object',
      properties: { request: { type: 'string', description: 'propose_changes가 돌려준 request (r로 시작)' } },
      required: ['request'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
]

function callTool(dirs: Dirs, name: string, args: Record<string, unknown>): unknown {
  switch (name) {
    case 'list_decks':
      return {
        decks: listShapes(dirs).map((s) => ({
          deck: s.deck,
          type: s.type,
          audience: s.audience,
          duration: s.duration,
          method: s.method,
          slideCount: s.slides.length,
          visibleSlides: s.slides.filter((x) => !x.hidden).length,
          updatedAt: s.updatedAt,
        })),
      }
    case 'get_catalog':
      return catalog()
    case 'get_shape': {
      const shape = typeof args.deck === 'string' ? readShape(dirs, args.deck) : null
      if (!shape) throw new ToolError(MESSAGES.noDeck)
      return shape
    }
    case 'propose_changes': {
      const deck = typeof args.deck === 'string' ? args.deck : ''
      if (!readShape(dirs, deck)) throw new ToolError(MESSAGES.noDeck)
      if (pendingFor(dirs, deck).length >= MAX_PENDING_PER_DECK) throw new ToolError(MESSAGES.tooMany)
      const id = requestId()
      const request = parseRequest({ format: REQUEST_FORMAT, version: 1, id, deck, createdAt: Date.now(), note: args.note ?? '', ops: args.ops })
      if (!request) throw new ToolError(MESSAGES.badRequest)
      const file = join(dirs.requests, `${id}.json`)
      const tmp = join(dirs.requests, `.${id}.tmp`)
      writeFileSync(tmp, JSON.stringify(request, null, 2))
      renameSync(tmp, file)
      return { request: id, status: 'pending', message: MESSAGES.pending }
    }
    case 'get_result': {
      const id = typeof args.request === 'string' && REQUEST_ID.test(args.request) ? args.request : null
      if (!id) throw new ToolError(MESSAGES.unknownRequest)
      const result = readJson(join(dirs.results, `${id}.json`)) as { status?: unknown; results?: unknown } | undefined
      if (result && typeof result === 'object') {
        const status = ['applied', 'rejected', 'invalid'].includes(result.status as string) ? result.status : 'invalid'
        const results = Array.isArray(result.results)
          ? result.results.map((r: { ok?: unknown; code?: unknown }) => ({ ok: r?.ok === true, code: typeof r?.code === 'string' ? r.code : 'unknown' }))
          : []
        return { request: id, status, results }
      }
      if (existsSync(join(dirs.requests, `${id}.json`))) return { request: id, status: 'pending', results: [] }
      throw new ToolError(MESSAGES.unknownRequest)
    }
    default:
      throw new ToolError(MESSAGES.unknownTool)
  }
}

// ---------- JSON-RPC (MCP stdio) ----------

type Message = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown }

const INSTRUCTIONS =
  'html-maker는 사내 보고 발표를 만드는 앱이다. 이 서버로는 발표의 모양(장 구성, 레이아웃, 테마, 안내 문구)만 보고 바꾸자고 제안할 수 있다. ' +
  '사람이 적은 글은 보안 때문에 이 서버에 없고, 사용자에게 붙여 달라고 하지도 않는다. ' +
  '순서: list_decks → get_catalog → get_shape → propose_changes → (사용자가 앱에서 적용) → get_result.'

function toolText(value: unknown, isError = false) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }], isError }
}

export function handleMessage(dirs: Dirs, msg: Message): object | null {
  const id = typeof msg.id === 'string' || typeof msg.id === 'number' ? msg.id : null
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id, result })
  const fail = (code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } })
  if (msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return id === null ? null : fail(-32600, 'Invalid Request')
  const params = (msg.params && typeof msg.params === 'object' ? msg.params : {}) as Record<string, unknown>

  // 알림(id 없음)에는 답하지 않는다
  if (id === null) return null

  switch (msg.method) {
    case 'initialize': {
      const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : ''
      return reply({
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'html-maker', version: VERSION },
        instructions: INSTRUCTIONS,
      })
    }
    case 'ping':
      return reply({})
    case 'tools/list':
      return reply({ tools: TOOLS })
    case 'tools/call': {
      const name = typeof params.name === 'string' ? params.name : ''
      const args = (params.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Record<string, unknown>
      let value: unknown
      try {
        value = callTool(dirs, name, args)
      } catch (e) {
        // 정해진 말만 돌려준다. 예외 메시지에는 경로나 받은 값이 들어 있을 수 있다.
        return reply(toolText({ message: e instanceof ToolError ? e.message : MESSAGES.internal }, true))
      }
      if (!onlyKnownStrings(value, PROTOCOL_WORDS)) return reply(toolText({ message: MESSAGES.blocked }, true))
      return reply(toolText(value))
    }
    default:
      return fail(-32601, 'Method not found')
  }
}

function serve(shareRoot: string) {
  const dirs: Dirs = { decks: join(shareRoot, 'decks'), requests: join(shareRoot, 'requests'), results: join(shareRoot, 'results') }
  if (!checkDirs(dirs)) {
    process.stderr.write('html-maker: AI 공유 폴더를 쓸 수 없어요.\n')
    process.exit(1)
  }
  const write = (out: unknown) => process.stdout.write(JSON.stringify(out) + '\n')
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })
  rl.on('line', (line) => {
    if (!line.trim()) return
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      return write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
    }
    if (Array.isArray(parsed)) {
      const out = parsed.map((m) => handleMessage(dirs, m as Message)).filter(Boolean)
      if (out.length) write(out)
      return
    }
    const out = handleMessage(dirs, parsed as Message)
    if (out) write(out)
  })
  rl.on('close', () => process.exit(0))
}

/** 권한 모델 밖에서 시작했으면, 'AI 공유' 폴더와 이 서버 코드만 읽을 수 있게 스스로를 다시 띄운다. */
function launch() {
  const here = dirname(fileURLToPath(import.meta.url))
  const share = process.env.HTML_MAKER_SHARE || join(here, '..', SHARE_DIR_NAME)
  const sandboxed = (process as { permission?: unknown }).permission !== undefined

  if (sandboxed) return serve(share)

  for (const d of ['decks', 'requests', 'results']) mkdirSync(join(share, d), { recursive: true })
  const child = spawn(
    process.execPath,
    [
      '--permission',
      `--allow-fs-read=${share}`,
      `--allow-fs-write=${share}`,
      `--allow-fs-read=${here}`,
      fileURLToPath(import.meta.url),
    ],
    { stdio: 'inherit', env: { ...process.env, HTML_MAKER_SHARE: share } },
  )
  for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => child.kill(sig))
  child.on('exit', (code) => process.exit(code ?? 0))
}

function isMain(): boolean {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isMain()) launch()
