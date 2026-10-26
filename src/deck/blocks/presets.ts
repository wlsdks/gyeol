// 연출: 컴포넌트 장의 나오는 차례와 때를 한 번에 정하는 묶음 (움직임 편집의 '연출').
// 새 값을 저장하지 않는다. 부품마다의 '언제'(when)와 장의 나오는 차례(options.order)를 한꺼번에 바꾸는 것이라
// 예전 버전, 내보낸 HTML, AI 제안이 그대로 읽는다. 움직임(effect)과 빠르기는 사람이 고른 것을 두고 건드리지 않는다

import type { Block, BlockType, BlockWhen, Slide } from '../types'
import { byReading } from './board'
import { playOrder, whenOf } from './cells'

export type MotionPreset = 'steps' | 'together' | 'clicks' | 'answer' | 'reveal'

/** 결론을 말하는 컴포넌트: 결론 먼저, 결론은 마지막에가 이것을 앞이나 뒤로 옮긴다 */
const CONCLUSION: readonly BlockType[] = ['message', 'callout']

export const MOTION_PRESETS: { id: MotionPreset; name: string; description: string; needs?: 'conclusion' }[] = [
  { id: 'steps', name: '차례로', description: '놓인 차례(위에서 아래, 왼쪽에서 오른쪽)대로 하나씩 이어서 나와요' },
  { id: 'together', name: '한꺼번에', description: '제목이 나온 뒤 모든 컴포넌트가 함께 나와요' },
  { id: 'clicks', name: '누를 때마다', description: '누를 때마다 하나씩 나와요. 하나씩 짚어 가며 말할 때 써요' },
  { id: 'answer', name: '결론 먼저', description: '결론(핵심 한 줄, 강조 상자)이 먼저 나오고 근거가 이어서 나와요', needs: 'conclusion' },
  { id: 'reveal', name: '결론은 마지막에', description: '근거가 먼저 나오고, 결론은 누르면 나와요', needs: 'conclusion' },
]

const isConclusion = (b: Block) => CONCLUSION.includes(b.type)

/** 이 장에서 쓸 수 있는 연출인지 (결론이 없는 장에서는 결론을 옮기는 연출이 아무것도 바꾸지 않는다) */
export function presetFits(slide: Pick<Slide, 'blocks'>, id: MotionPreset): boolean {
  const blocks = slide.blocks ?? []
  const spec = MOTION_PRESETS.find((p) => p.id === id)
  if (!spec || !blocks.length) return false
  if (spec.needs !== 'conclusion') return true
  // 모두 결론이거나 결론이 없으면 앞뒤로 옮길 것이 없다
  const n = blocks.filter(isConclusion).length
  return n > 0 && n < blocks.length
}

/** 연출을 고른 장: 부품마다의 '언제'와 장의 나오는 차례를 바꾼다. 쓸 수 없는 연출이면 그대로 */
export function withPreset(slide: Slide, id: MotionPreset): Slide {
  if (!presetFits(slide, id)) return slide
  const reading = byReading(slide.blocks ?? [])
  const first = reading.filter(isConclusion)
  const rest = reading.filter((b) => !isConclusion(b))
  const order = id === 'answer' ? [...first, ...rest] : id === 'reveal' ? [...rest, ...first] : reading
  const when = (b: Block, i: number): BlockWhen =>
    id === 'together' ? (i === 0 ? 'after' : 'with') : id === 'clicks' ? 'click' : id === 'reveal' && isConclusion(b) ? (i === rest.length ? 'click' : 'with') : 'after'
  const at = new Map(order.map((b, i) => [b.id, when(b, i)]))
  const blocks = (slide.blocks ?? []).map((b) => {
    const w = at.get(b.id) ?? 'after'
    if (whenOf(b) === w) return b
    const next = { ...b }
    // 이어서가 기본이라 적지 않는다 (예전 파일과 같은 꼴)
    if (w === 'after') delete next.when
    else next.when = w
    return next
  })
  // 놓인 차례와 같으면 차례를 적지 않는다: 부품을 옮기면 차례도 따라가게
  const same = order.every((b, i) => b.id === reading[i].id)
  const options = { ...slide.options }
  if (same) delete options.order
  else options.order = order.map((b) => b.id)
  return { ...slide, blocks, options }
}

/**
 * 지금 장이 어느 연출과 같은지 (사람이 하나하나 바꿨으면 null).
 * 둘과 같을 수 있다: 결론이 이미 맨 앞이면 차례로와 결론 먼저가, 컴포넌트가 하나면 차례로와 한꺼번에가 같다.
 * prefer(방금 고른 연출)가 그 가운데 하나면 그것을. 예전에는 결론 먼저를 눌러도 차례로가 눌려 보였고,
 * 다른 장에 옮길 때도 차례로를 옮겨 그 장의 결론이 앞으로 오지 않았다
 */
export function currentPreset(slide: Slide, prefer?: MotionPreset | null): MotionPreset | null {
  const key = (s: Slide) => playOrder(s).map((b) => `${b.id}:${whenOf(b)}`).join('/')
  const now = key(slide)
  const same = (id: MotionPreset) => presetFits(slide, id) && key(withPreset(slide, id)) === now
  if (prefer && same(prefer)) return prefer
  return MOTION_PRESETS.find((p) => same(p.id))?.id ?? null
}
