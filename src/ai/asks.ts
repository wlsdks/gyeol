// 'AI에게 부탁'에서 고르는 부탁들. 앱과 로컬 서버 사이에는 이 목록의 id와 해시 id만 오간다.
//
// 사람이 적은 글은 부탁에 넣지 않는다. AI에게 보내는 문장도 앱이 아니라 로컬 서버가 이 파일의
// 정해진 말로 만든다. 그래서 앱에 버그가 있어도 부탁을 타고 발표 내용이 나갈 길이 없다.

export type AskScope = 'slide' | 'deck'

/** 로컬 서버가 띄운 Claude Code가 어디까지 했는지. 도구 이름으로만 짐작한다 */
export type AskStep = 'starting' | 'looking' | 'proposing'
export type AskState = 'running' | 'done' | 'no_change' | 'failed' | 'cancelled'
export type AskError = 'busy' | 'no_agent' | 'not_shared' | 'bad_ask' | 'timeout' | 'login' | 'failed'

export interface AskRun {
  id: string
  state: AskState
  step: AskStep
  /** done일 때 AI가 보낸 제안 id */
  request?: string
  /** no_change일 때 AI가 말한 까닭. AI → 앱 쪽 글이라 발표 내용이 나가는 길이 아니다 */
  reason?: string
  error?: AskError
}

export const REASON_MAX = 280

export interface Ask {
  id: string
  scope: AskScope
  /** 화면에 보이는 이름. 하는 일을 그대로 */
  name: string
  description: string
  /** AI에게 보내는 부탁. 고칠 수 있는 것(ops)으로 할 수 있는 일만 적는다 */
  prompt: string
}

export const ASKS = [
  {
    id: 'slide_layout',
    scope: 'slide',
    name: '더 어울리는 모양으로',
    description: '이 장의 역할과 칸 수에 맞는 레이아웃과 모양을 골라요',
    prompt:
      '이 장의 역할, 칸이 비었는지, 항목 수를 보고 더 잘 맞는 레이아웃이나 같은 레이아웃의 다른 모양(variant)이 있으면 바꿔 주세요. 지금 채운 칸이 새 레이아웃에도 있는지 확인하고, 없어지는 칸이 많으면 바꾸지 마세요.',
  },
  {
    id: 'slide_focus',
    scope: 'slide',
    name: '핵심이 눈에 띄게',
    description: '강조할 항목, 바탕, 움직임을 골라요',
    prompt:
      '듣는 사람이 이 장에서 가장 먼저 봐야 할 것이 눈에 띄도록 강조할 항목(highlight), 장의 바탕(tone), 발표할 때 움직임(motion)을 골라 주세요. 발표 전체에서 반대 색이나 강조색 바탕이 너무 많아지지 않게 하세요.',
  },
  {
    id: 'slide_guide',
    scope: 'slide',
    name: '칸 안내 다듬기',
    description: '칸마다 무엇을 쓰면 되는지 안내를 이 보고에 맞게 고쳐요',
    prompt:
      '이 발표의 종류와 듣는 사람에 맞게 이 장의 안내(set_guide)와 빈 칸의 안내 문구(set_hint)를 구체적으로 다듬어 주세요. 안내 문구에는 무엇을 쓰면 되는지만 적고, 회사 이름, 사람 이름, 실제처럼 보이는 숫자는 지어내지 마세요.',
  },
  {
    id: 'slide_around',
    scope: 'slide',
    name: '앞뒤에 필요한 장',
    description: '이 장 앞뒤로 빠진 장이 있으면 넣어요',
    prompt:
      '이 장 앞뒤로 보고 흐름에 꼭 필요한데 빠진 장이 있으면 넣어 주세요(add_slide). 많아야 두 장이고, 이미 비슷한 역할의 장이 있으면 넣지 마세요.',
  },
  {
    id: 'deck_flow',
    scope: 'deck',
    name: '보고 흐름 점검',
    description: '결론부터 말하도록 장 순서를 다듬고 빠진 장을 넣어요',
    prompt:
      '듣는 사람이 결론부터 듣도록 장 순서를 다듬고, 빠진 장은 넣고, 쓰지 않는 빈 장은 빼 주세요. 지울 때는 빈 장만 지울 수 있어요.',
  },
  {
    id: 'deck_time',
    scope: 'deck',
    name: '시간에 맞추기',
    description: '발표 시간에 맞게 장 수를 맞춰요',
    prompt:
      '발표 시간(duration)과 발표 방식(method)에 맞게 보이는 장 수를 맞춰 주세요. 줄일 때는 지우지 말고 발표에서 빼기(set_hidden)를 쓰고, 결론과 결정 요청 장은 남겨 두세요.',
  },
  {
    id: 'deck_look',
    scope: 'deck',
    name: '테마와 움직임',
    description: '듣는 사람에 맞게 테마, 글꼴, 움직임을 골라요',
    prompt:
      '듣는 사람(audience)과 발표 방식(method)에 맞게 테마, 글꼴, 장 넘기기, 발표할 때 움직임을 골라 주세요. 장마다 바탕을 바꿀 필요가 있으면 섹션을 여는 장 위주로만 바꾸세요.',
  },
] as const satisfies readonly Ask[]

export type AskId = (typeof ASKS)[number]['id']

export const ASK_IDS: readonly AskId[] = ASKS.map((a) => a.id)

const DECK_ID = /^d[0-9a-f]{8}$/
const SLIDE_ID = /^s[0-9a-f]{8}$/

export function askOf(id: unknown): (typeof ASKS)[number] | undefined {
  return ASKS.find((a) => a.id === id)
}

/** 부탁과 대상이 맞는지. 장 부탁에는 장 id가, 발표 전체 부탁에는 null이 와야 한다 */
export function validAsk(ask: unknown, deck: unknown, slide: unknown): ask is AskId {
  const a = askOf(ask)
  if (!a || typeof deck !== 'string' || !DECK_ID.test(deck)) return false
  return a.scope === 'slide' ? typeof slide === 'string' && SLIDE_ID.test(slide) : slide === null
}

/** 이 PC에서 Claude Code를 바로 띄울 수 없을 때, Claude Code나 Codex에 붙여 넣을 부탁 */
export function askSentence(ask: AskId, deck: string, slide: string | null): string {
  return `html-maker에 공유한 ${slide ? `발표 ${deck}의 장 ${slide}` : `발표 ${deck}`}: ${askOf(ask)!.prompt} 바꿀 것은 propose_changes로 제안해 줘.`
}

/** AI에게 보내는 문장. 정해진 말과 해시 id만으로 만든다 */
export function askPrompt(ask: AskId, deck: string, slide: string | null): string {
  const a = askOf(ask)!
  const target = slide ? `발표 ${deck}의 장 ${slide}` : `발표 ${deck}`
  return [
    `html-maker 앱에서 사람이 ${target}에 대해 부탁했어요.`,
    '',
    `부탁: ${a.prompt}`,
    '',
    '지킬 것',
    '- html-maker 도구만 쓸 수 있어요. get_catalog로 레이아웃과 고를 수 있는 값을, get_shape로 이 발표의 모양을 먼저 보세요.',
    '- 사람이 적은 글은 보이지 않고 바꿀 수도 없어요. 장 순서, 레이아웃과 모양, 강조, 바탕, 움직임, 테마, 안내 문구만 바꿀 수 있어요.',
    '- 바꿀 것을 모아 propose_changes를 한 번만 부르세요. note에는 왜 이렇게 바꾸는지 듣는 사람 입장에서 한두 문장으로 쓰세요.',
    '- 지금 모양이 이미 잘 맞으면 제안을 보내지 말고, 왜 그런지 두 문장 안으로만 답하고 끝내세요. 되묻지 마세요.',
    '- 제안을 보낸 뒤에는 결과를 기다리지 말고 바로 끝내세요. 사람이 앱에서 보고 정해요.',
  ].join('\n')
}
