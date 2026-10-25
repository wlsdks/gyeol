import {
  autoPlace,
  BLOCK_LINK_IDS,
  BLOCK_TYPES,
  BLOCKS,
  BOARD_ROWS,
  boardAreaH,
  boardFit,
  composeAreaH,
  insertAt,
  linkIssue,
  linkTargets,
  lookChangeIssue,
  lookOf,
  needRows,
  placeIssue,
  settle,
  validTargets,
  whyNot,
  withLink,
  withLook,
} from '../deck/blocks'
import { sampleBlock } from '../deck/blockSamples'
import { makeSlide } from '../deck/generate'
import type { Block, BlockType, Slide } from '../deck/types'
import { innerProblems } from './comboChecks'
import { clashes } from './measureBlocks'

/*
 * 개발용: 부품 조합 시험. 실제 발표에서 함께 쓸 만한 장면(숫자와 그 추이, 결론과 근거, 일정과 위험 같은)마다
 * 부품을 골라 규칙(deck/blocks)이 '넣을 수 있다'고 한 자리에 놓아 보고, 잘리거나 겹치는 칸이 없는지 본다.
 * #/gallery?set=combos&seed=1&n=60 → 콘솔에서 checkCombos()
 * 장면, 부품, 모양, 바탕, 항목 수, 놓을 자리를 seed로 정한 차례대로 고른다 (같은 seed면 늘 같은 조합).
 * 예전에는 부품을 아무렇게나 골라 진행 막대와 시장 원을 견주는 것 같은, 아무도 만들지 않을 장이 섞였다
 */

/** 같은 seed면 같은 차례를 내는 작은 난수 (mulberry32) */
function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 장면: 자리마다 고를 수 있는 부품들. 앞 자리부터 놓는다 */
const SCENES: BlockType[][][] = [
  // 숫자 하나와 그 추이, 까닭
  [['number', 'delta', 'kpi'], ['trend', 'bars', 'spark'], ['bullets', 'points', 'text']],
  // 결론 한마디와 근거
  [['message', 'callout'], ['bullets', 'facts', 'points']],
  // 숫자 셋을 나란히, 아래에 차트
  [['stat', 'number', 'ring'], ['stat', 'number', 'ring'], ['stat', 'number', 'goal'], ['trend', 'bars', 'stack', 'attain']],
  // 전과 후와 다음 단계, 결정 요청
  [['delta'], ['checks', 'bullets', 'steps'], ['callout']],
  // 일정과 위험
  [['gantt', 'timeline', 'process'], ['risks', 'status', 'facts']],
  // 비교 표와 결정 요청
  [['compare', 'table', 'rating', 'pricing'], ['callout', 'message']],
  // 깔때기와 핵심 숫자
  [['funnel', 'pareto', 'bridge'], ['number', 'stat'], ['text', 'note']],
  // 화면 캡처와 설명
  [['image'], ['bullets', 'points', 'text']],
  // 시장과 몫
  [['market', 'share', 'versus'], ['text', 'bullets'], ['number']],
  // 진행 상황
  [['progress', 'meter', 'goal', 'range'], ['checks', 'status'], ['date', 'note']],
  // 흐름과 결과
  [['flow', 'network', 'merge', 'split'], ['number', 'message']],
  // 사람과 일정
  [['people'], ['agenda', 'timeline'], ['date']],
  // 분석과 해석
  [['heat', 'diverge', 'matrix', 'position'], ['summary', 'text', 'quote']],
  // 지표 묶음과 예상 질문
  [['scorecard', 'kpi', 'sparks'], ['faq', 'bullets']],
  // 소제목과 묶음 둘
  [['heading'], ['bullets', 'points'], ['heading'], ['bullets', 'checks']],
  // 강점과 약점, 결론
  [['swot'], ['message', 'callout']],
  // 함께하는 곳과 숫자
  [['logos'], ['stat', 'number'], ['stat', 'number']],
  // 칸 조립과 설명
  [['tiles', 'ratio'], ['text', 'bullets']],
]

/** 어느 장면에도 없는 부품은 설명 글과 짝지은 장면으로 (새 부품을 더해도 시험에서 빠지지 않게) */
const ALL_SCENES: BlockType[][][] = [
  ...SCENES,
  ...BLOCK_TYPES.filter((t) => !SCENES.some((s) => s.some((slot) => slot.includes(t)))).map((t) => [[t], ['text', 'bullets', 'message']] as BlockType[][]),
]

const pick = <T,>(rand: () => number, list: readonly T[]): T => list[Math.floor(rand() * list.length)]

/** 예시 내용으로 채운 부품 하나: 모양, 바탕, 항목 수를 고른다 */
function sceneBlock(rand: () => number, type: BlockType, id: string): Block {
  const spec = BLOCKS[type]
  const sample = sampleBlock(type)
  const variants = spec.variants ?? []
  const variant = variants.length ? pick(rand, variants).id : undefined
  // 실제로 쓰는 비율에 가깝게: 대부분 바탕 없이, 가끔 옅은 면, 드물게 진한 면(장의 다른 면과 어긋나면 넣을 때 바탕 없이 바뀐다)
  const r = rand()
  const look = r < 0.55 ? 'plain' : r < 0.85 ? 'card' : 'bold'
  const it = spec.items
  const n = it ? it.min + Math.floor(rand() * (it.max - it.min + 1)) : 0
  const items = it && sample.items.length ? Array.from({ length: n }, (_, i) => ({ ...sample.items[i % sample.items.length], id: `${id}-it${i}` })) : sample.items
  return { ...sample, id, items, look, ...(variant ? { variant } : {}) }
}

export interface Combo {
  slide: Slide
  /** 넣으려다 규칙이 막은 부품과 그 까닭 (막은 것이 맞는지 보려고 남긴다) */
  refused: { block: Block; why: string }[]
}

/**
 * 규칙이 받아들인 조합 n개. 제목이 있는 장과 없는 장을 섞는다.
 * edit면 편집 화면의 본문 높이(비운 제목과 부제의 안내까지)로 놓는다: 편집 화면에서 잘리거나 겹치는지 볼 때
 */
export function comboSlides(seed: number, n: number, look?: Parameters<typeof composeAreaH>[1], edit?: boolean): Combo[] {
  const rand = random(seed)
  return Array.from({ length: n }, (_, k) => {
    const title = rand() < 0.7 ? `조합 ${seed}-${k + 1}` : ''
    const base: Slide = { ...makeSlide('compose'), id: `combo-${seed}-${k}`, fields: { title } }
    const areaH = edit ? boardAreaH(base, look) : composeAreaH(base, look)
    const scene = pick(rand, ALL_SCENES)
    let blocks: Block[] = []
    const refused: Combo['refused'] = []
    scene.forEach((slot, j) => {
      const b = sceneBlock(rand, pick(rand, slot), `c${k}-b${j}`)
      // 대개는 편집기의 '넣기'처럼 알아서, 가끔은 사람이 끌어다 놓듯 넣을 수 있는 자리 가운데 하나에
      let next: Block[] | null = null
      if (rand() < 0.65) next = autoPlace(blocks, b, areaH)
      else {
        const valid = validTargets(blocks, b, areaH)
        const t = valid.length ? pick(rand, valid) : null
        // validTargets와 whyNot이 같은 것을 말하는지
        if (t && whyNot(blocks, t, b, areaH)) throw new Error('validTargets와 whyNot이 서로 다르게 판단했어요')
        next = t && t.kind === 'spot' ? insertAt(blocks, t.spot, b, areaH) : null
      }
      if (!next) {
        const why = placeIssue(blocks, b, areaH)
        refused.push({ block: b, why: why ? JSON.stringify(why) : '?' })
        return
      }
      blocks = next
      // 편집기에서 면을 고를 때처럼 나란한 부품은 같은 면으로. 장을 넘칠 때는 편집기처럼 고를 수 없으니 그대로
      const placed = blocks.find((x) => x.id === b.id)!
      if (!lookChangeIssue(blocks, b.id, lookOf(placed), areaH)) blocks = withLook(blocks, b.id, lookOf(placed))
    })
    // 이음표: 선마다 셋에 하나꼴로, 뜻이 서는 것만(편집기와 같은 규칙), 높이가 들어갈 때만
    for (const t of linkTargets(blocks)) {
      if (rand() > 0.35) continue
      const fits = BLOCK_LINK_IDS.filter((l) => !linkIssue(blocks, t, l))
      if (!fits.length) continue
      const next = withLink(blocks, t, pick(rand, fits))
      if (needRows(next, boardFit(areaH, next)) <= BOARD_ROWS) blocks = next
    }
    // 편집기가 고칠 때마다 하듯 판을 다시 맞춘다: 면을 바꾸거나 이음표를 끼워 커진 부품이 옆에서 자리를 받는다
    blocks = settle(blocks, boardFit(areaH, blocks)) ?? blocks
    return { slide: { ...base, blocks }, refused }
  })
}

/**
 * 그려진 조합 장마다: 본문 상자를 넘거나 서로 겹치는 칸, 글자를 줄였거나(크게는 한 단계보다 더),
 * 그러고도 넘치거나 겹치는 칸, 칸에 걸치는 이음표. 없으면 빈 목록
 */
export async function checkCombos(): Promise<{ slides: number; cells: number; problems: string[] }> {
  await document.fonts.ready
  await new Promise((r) => setTimeout(r, 300))
  const problems: string[] = []
  let cells = 0
  const areas = [...document.querySelectorAll<HTMLElement>('.bk-area')]
  areas.forEach((area, i) => {
    const box = area.getBoundingClientRect()
    const list = [...area.querySelectorAll<HTMLElement>(':scope > .bk')]
    const rects = list.map((c) => c.getBoundingClientRect())
    // 판은 본문 상자 안에 들어가야 한다: 넘치면 아래 칸이 출처와 하단 표시 자리로 내려간다
    const over = Math.max(0, ...rects.map((r) => r.bottom - box.bottom))
    if (over > 1) problems.push(`${i + 1}번 장: 칸이 본문 상자보다 ${Math.round(over)} 내려가요`)
    rects.forEach((a, x) =>
      rects.slice(x + 1).forEach((b, y) => {
        if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) problems.push(`${i + 1}번 장: ${list[x].dataset.type}와 ${list[x + 1 + y].dataset.type} 칸이 겹쳐요`)
      }),
    )
    // 글자 크기 '크게'(1.2배)는 한 단계(1/1.2, fitBlocks.ts)까지 줄여도 보통 크기와 같다
    const least = area.closest('.slide')?.classList.contains('sz-large') ? 1 / 1.2 : 1
    for (const cell of list) {
      cells++
      const fit = Number(cell.style.getPropertyValue('--bk-fit') || 1)
      const what = `${i + 1}번 장 ${cell.dataset.type} ${[...cell.classList].filter((c) => c.startsWith('va-') || c.startsWith('bk-look-')).join(' ')} 항목 ${cell.querySelectorAll('.it').length} 너비 ${Math.round(cell.offsetWidth)}×${Math.round(cell.offsetHeight)}`
      if (fit < least) problems.push(`${what}: 글자를 ${fit}까지 줄였어요`)
      const left = clashes(cell)
      if (left.length) problems.push(`${what}: ${left.slice(0, 3).join(', ')}`)
      // 칸 안이 깨진 곳: 글이 줄 선에 닿거나 항목 밖으로 나가는 것, 가려진 글, 면 안의 위아래 여백 (comboChecks.ts)
      for (const p of innerProblems(cell)) problems.push(`${what}: ${p}`)
    }
    // 이음표는 칸 사이의 빈자리에 혼자 서야 한다: 어느 칸에도 걸치지 않는다
    for (const lk of area.querySelectorAll<HTMLElement>(':scope > .bk-link')) {
      const g = (lk.querySelector('svg, .bk-link-vs') ?? lk).getBoundingClientRect()
      const hit = rects.some((r) => g.left < r.right - 0.5 && g.right > r.left + 0.5 && g.top < r.bottom - 0.5 && g.bottom > r.top + 0.5)
      if (hit) problems.push(`${i + 1}번 장: 이음표(${lk.dataset.link})가 칸에 걸쳐요`)
    }
  })
  return { slides: areas.length, cells, problems }
}
