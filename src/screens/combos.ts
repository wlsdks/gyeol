import { BLOCK_LOOK_IDS, BLOCK_TYPES, BLOCKS, composeAreaH, insertAt, placeIssue, validTargets, whyNot } from '../deck/blocks'
import { sampleBlock } from '../deck/blockSamples'
import { makeSlide } from '../deck/generate'
import type { Block, BlockRow, Slide } from '../deck/types'
import { clashes } from './measureBlocks'

/*
 * 개발용: 부품 조합 시험. 규칙(deck/blocks.ts)이 '넣을 수 있다'고 한 조합을 여러 개 만들어 실제로 그려 보고,
 * 잘리거나 겹치는 칸이 없는지 본다. #/gallery?set=combos&seed=1&n=60 → 콘솔에서 checkCombos()
 * 부품, 모양, 바탕, 항목 수, 놓을 자리를 seed로 정한 차례대로 고른다 (같은 seed면 늘 같은 조합).
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

/** 예시 내용으로 채운 부품 하나: 모양, 바탕, 항목 수를 고른다 */
function randomBlock(rand: () => number, id: string): Block {
  const type = BLOCK_TYPES[Math.floor(rand() * BLOCK_TYPES.length)]
  const spec = BLOCKS[type]
  const sample = sampleBlock(type)
  const variants = spec.variants ?? []
  const variant = variants.length ? variants[Math.floor(rand() * variants.length)].id : undefined
  const look = BLOCK_LOOK_IDS[Math.floor(rand() * BLOCK_LOOK_IDS.length)]
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

/** 규칙이 받아들인 조합 n개. 제목이 있는 장과 없는 장을 섞는다 */
/** edit면 편집 화면의 본문 높이(비운 제목과 부제의 안내까지)로 놓는다: 편집 화면에서 잘리거나 겹치는지 볼 때 */
export function comboSlides(seed: number, n: number, look?: Parameters<typeof composeAreaH>[1], edit?: boolean): Combo[] {
  const rand = random(seed)
  return Array.from({ length: n }, (_, k) => {
    const title = rand() < 0.7 ? `조합 ${seed}-${k + 1}` : ''
    const base: Slide = { ...makeSlide('compose'), id: `combo-${seed}-${k}`, fields: { title } }
    const areaH = composeAreaH(base, look, edit)
    let rows: BlockRow[] = []
    const refused: Combo['refused'] = []
    const want = 1 + Math.floor(rand() * 6)
    for (let tries = 0; tries < 14 && rows.reduce((a, r) => a + r.blocks.length, 0) < want; tries++) {
      const b = randomBlock(rand, `c${k}-b${tries}`)
      const valid = validTargets(rows, b, areaH)
      if (!valid.length) {
        const why = placeIssue(rows, b, areaH)
        refused.push({ block: b, why: why ? JSON.stringify(why) : '?' })
        continue
      }
      const t = valid[Math.floor(rand() * valid.length)]
      // validTargets와 whyNot이 같은 것을 말하는지
      if (whyNot(rows, t, b, areaH)) throw new Error('validTargets와 whyNot이 서로 다르게 판단했어요')
      rows = insertAt(rows, t, b, `r${k}-${tries}`)!
    }
    return { slide: { ...base, rows }, refused }
  })
}

/**
 * 그려진 조합 장마다: 줄을 같은 비율로 낮춰야 했거나(--bk-sq), 글자를 한 단계(0.92)보다 더 줄였거나,
 * 그러고도 넘치거나 겹치는 칸. 없으면 빈 목록
 */
export async function checkCombos(): Promise<{ slides: number; cells: number; problems: string[] }> {
  await document.fonts.ready
  await new Promise((r) => setTimeout(r, 300))
  const problems: string[] = []
  let cells = 0
  const areas = [...document.querySelectorAll<HTMLElement>('.bk-area')]
  areas.forEach((area, i) => {
    if (area.style.getPropertyValue('--bk-sq')) problems.push(`${i + 1}번 장: 줄을 낮춰야 들어가요 (${area.style.getPropertyValue('--bk-sq')})`)
    // 줄 높이의 합이 본문 상자보다 높으면 아래 줄이 출처와 하단 표시 자리로 내려간다
    const style = getComputedStyle(area)
    const tracks = style.gridTemplateRows.split(' ').map(parseFloat)
    const used = tracks.reduce((a, h) => a + h, 0) + (parseFloat(style.rowGap) || 0) * Math.max(0, tracks.length - 1)
    if (used > area.clientHeight + 1) problems.push(`${i + 1}번 장: 줄이 본문 상자보다 ${Math.round(used - area.clientHeight)} 높아요`)
    // 글자 크기 '크게'(1.08배)는 두 단계(0.84)까지 줄여도 보통 크기를 한 단계 줄인 것(0.92)과 같다
    const least = area.closest('.slide')?.classList.contains('sz-large') ? 0.84 : 0.92
    for (const cell of area.querySelectorAll<HTMLElement>(':scope > .bk')) {
      cells++
      const fit = Number(cell.style.getPropertyValue('--bk-fit') || 1)
      const what = `${i + 1}번 장 ${cell.dataset.type} ${[...cell.classList].filter((c) => c.startsWith('va-') || c.startsWith('bk-look-')).join(' ')} 항목 ${cell.querySelectorAll('.it').length} 너비 ${Math.round(cell.offsetWidth)}×${Math.round(cell.offsetHeight)}`
      if (fit < least) problems.push(`${what}: 글자를 ${fit}까지 줄였어요`)
      const left = clashes(cell)
      if (left.length) problems.push(`${what}: ${left.slice(0, 3).join(', ')}`)
    }
  })
  return { slides: areas.length, cells, problems }
}
