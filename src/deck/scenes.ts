// 장면: 장 하나를 영화의 한 컷처럼 처음부터 끝까지 한 번에 짜 둔 움직임.
// 사람은 장면 하나를 고르기만 한다(딸깍). 무엇이 언제 움직이는지는 엔진(motion/engine.ts의 scene)이 레이아웃마다 정한다.
// 값은 장의 options.scene에 id 하나로 남고, 슬라이드의 data-scene으로 내보낸 HTML의 뷰어도 같이 읽는다.
// 여기의 목록이 고르는 값의 한 곳이다: 편집기, 발표 전체에 입히기, 예전 버전 검사(compat.ts)가 같이 쓰고,
// AI 카탈로그와 모양 파일, 제안(op)도 나중에 여기서 가져간다

import type { Block, BlockType, Deck, LayoutId, SceneId, Slide } from './types'

export interface SceneSpec {
  id: SceneId
  name: string
  description: string
  /** 이 장면이 맞는 레이아웃 */
  layouts: readonly LayoutId[]
  /** 컴포넌트 장: 이 중 하나가 있으면 맞는다 */
  blocks: readonly BlockType[]
}

/** 고를 수 있는 장면. 차례가 곧 '발표 전체에 입히기'에서 컴포넌트 장에 먼저 고르는 차례다 */
export const SCENES: readonly SceneSpec[] = [
  {
    id: 'opening',
    name: '첫 장면',
    description: '조금 다가간 데서 천천히 물러나며 자리를 잡고, 제목이 한 글자씩 내려앉아요.',
    layouts: ['cover', 'section'],
    blocks: [],
  },
  {
    id: 'answer',
    name: '결론 한 방',
    description: '결론이 한 글자씩 내려앉고 그 아래로 선이 지나가요. 근거는 그다음에 나와요.',
    layouts: ['statement', 'summary', 'case'],
    blocks: ['message', 'callout'],
  },
  {
    id: 'numbers',
    name: '숫자가 말한다',
    description: '가장 중요한 숫자만 밝게 먼저 나오고, 나머지는 뒤따라 밝아져요.',
    layouts: ['kpi', 'scorecard', 'bars', 'share', 'funnel', 'bridge', 'versus', 'pricing'],
    blocks: ['number', 'stat', 'delta', 'goal', 'ring', 'attain', 'meter', 'ratio', 'kpi', 'scorecard', 'bars', 'versus', 'share', 'funnel', 'bridge'],
  },
  {
    id: 'flow',
    name: '흐름 따라가기',
    description: '읽는 차례로 선이 이어지며 하나씩 나와요.',
    layouts: ['process', 'points', 'agenda'],
    blocks: ['steps', 'flow', 'process', 'points', 'agenda'],
  },
  {
    id: 'compare',
    name: '비교 드러내기',
    description: '왼쪽을 먼저 보이고, 장막이 걷히며 오른쪽이 드러나요.',
    layouts: ['compare'],
    blocks: ['compare'],
  },
  {
    id: 'time',
    name: '시간의 흐름',
    description: '시간 쪽으로 천천히 따라가다가 지금 단계(강조한 점)에 머물러요.',
    layouts: ['timeline', 'trend', 'progress'],
    blocks: ['timeline', 'gantt', 'trend', 'progress'],
  },
  {
    id: 'picture',
    name: '이미지 한 컷',
    description: '이미지에 천천히 다가가고, 제목이 한 글자씩 내려앉아요.',
    layouts: ['imageText'],
    blocks: ['image'],
  },
  {
    id: 'closing',
    name: '마무리',
    description: '천천히 물러나며 자리를 잡고, 부탁할 일이 차례로 이어져요.',
    layouts: ['closing'],
    blocks: [],
  },
]

export const SCENE_IDS: readonly SceneId[] = SCENES.map((s) => s.id)

export function isScene(v: unknown): v is SceneId {
  return typeof v === 'string' && (SCENE_IDS as readonly string[]).includes(v)
}

export function sceneSpec(id: SceneId): SceneSpec {
  return SCENES.find((s) => s.id === id)!
}

/** 컴포넌트 장에서 나란히 선 두 칸(앞과 뒤): 비교 드러내기가 둘 사이에 장막을 친다 */
function sideBySide(blocks: readonly Block[]): boolean {
  if (blocks.length !== 2) return false
  const [a, b] = blocks.map((x) => x.at)
  return !!a && !!b && a.y === b.y && a.h === b.h && a.x !== b.x
}

/** 이 장에 이 장면이 맞는지. 맞지 않는 장면은 고르는 곳에 보이지 않고, 골라 둔 뒤 레이아웃을 바꾸면 쉰다(값은 남는다) */
export function sceneFits(slide: Pick<Slide, 'layout' | 'blocks'>, id: SceneId): boolean {
  const spec = SCENES.find((s) => s.id === id)
  if (!spec) return false
  if (slide.layout !== 'compose') return spec.layouts.includes(slide.layout)
  const blocks = slide.blocks ?? []
  if (id === 'compare' && sideBySide(blocks)) return true
  return blocks.some((b) => spec.blocks.includes(b.type))
}

/** 이 장에 맞는 장면들 (목록 차례) */
export function scenesFor(slide: Pick<Slide, 'layout' | 'blocks'>): SceneId[] {
  return SCENE_IDS.filter((id) => sceneFits(slide, id))
}

/** 이 장에서 움직일 장면: 골랐고 지금 레이아웃에 맞을 때만 */
export function sceneOf(slide: Pick<Slide, 'layout' | 'blocks' | 'options'>): SceneId | null {
  const id = slide.options.scene
  return isScene(id) && sceneFits(slide, id) ? id : null
}

/** 발표 전체에 입힐 때 이 장에 고르는 장면. 같은 장이면 늘 같은 것(맞는 것 가운데 목록의 첫째) */
export function autoScene(slide: Pick<Slide, 'layout' | 'blocks'>): SceneId | null {
  return scenesFor(slide)[0] ?? null
}

export interface ScenePlanRow {
  slideId: string
  /** 장 번호 (1부터, 숨긴 장도 센다: 슬라이드 목록과 같게) */
  page: number
  /** 지금 골라 둔 장면 (없으면 null) */
  now: SceneId | null
  /** 입힐 장면 */
  next: SceneId
}

/**
 * 발표 전체에 장면 입히기의 계획. 맞는 장면이 있는 장마다 한 줄. 이미 장면을 골라 둔 장은 kept에 따로 둔다
 * (덮어쓰려면 사람이 따로 고른다). 숨긴 장은 건너뛴다
 */
export function planScenes(deck: Pick<Deck, 'slides'>): { add: ScenePlanRow[]; kept: ScenePlanRow[] } {
  const add: ScenePlanRow[] = []
  const kept: ScenePlanRow[] = []
  deck.slides.forEach((s, i) => {
    if (s.hidden) return
    const next = autoScene(s)
    if (!next) return
    const now = isScene(s.options.scene) ? s.options.scene : null
    const row = { slideId: s.id, page: i + 1, now, next }
    if (now === null) add.push(row)
    else if (now !== next) kept.push(row)
  })
  return { add, kept }
}

/** 계획대로 장면을 입힌 발표. overwrite면 이미 골라 둔 장(kept)도 바꾼다 */
export function withScenes<D extends Pick<Deck, 'slides'>>(deck: D, overwrite: boolean): D {
  const { add, kept } = planScenes(deck)
  const to = new Map([...add, ...(overwrite ? kept : [])].map((r) => [r.slideId, r.next]))
  if (!to.size) return deck
  return { ...deck, slides: deck.slides.map((s) => (to.has(s.id) ? { ...s, options: { ...s.options, scene: to.get(s.id) } } : s)) }
}
