import { autoPlace, composeAreaH } from '../deck/blocks'
import { sampleBlock } from '../deck/blockSamples'
import { makeSlide } from '../deck/generate'
import type { Block, BlockLook, BlockType, Slide } from '../deck/types'

/*
 * 개발용: 컴포넌트의 모양을 고칠 때 전과 후를 견줄 장(#/gallery?set=dirs). 대표 조합(reviewSlides.ts)에 없는
 * 지표 줄, 단계 표시, 단계 흐름, 두 안 비교, 이음표(옆과 아래, 화살표·더하기·결과·견주기)와, 빽빽한 장과 듬성한 장을 더한다.
 * 지면의 말투(괘선)를 고를 때 시안 둘(괘선, 조용한 면)을 이 장들로 견줬다. 내용은 모두 지어낸 것이다
 */

type Put = { type: BlockType; fields?: Record<string, string>; look?: BlockLook; n?: number; variant?: string }

function block(p: Put, id: string): Block {
  const s = sampleBlock(p.type)
  const items = p.n && s.items.length ? Array.from({ length: p.n }, (_, i) => ({ ...s.items[i % s.items.length], id: `${id}-it${i}` })) : s.items
  return { ...s, id, items, fields: { ...s.fields, ...p.fields }, ...(p.look ? { look: p.look } : {}), ...(p.variant ? { variant: p.variant } : {}) }
}

function scene(id: string, fields: Record<string, string>, puts: Put[], size?: string): Slide {
  const base: Slide = { ...makeSlide('compose'), id: `dir-${id}`, fields }
  const areaH = composeAreaH(base, { theme: { size } }, true)
  let blocks: Block[] = []
  puts.forEach((p, i) => {
    blocks = autoPlace(blocks, block(p, `${id}-b${i}`), areaH) ?? blocks
  })
  return { ...base, blocks }
}

/** 판의 자리를 손으로 정하고 이음표를 건 장 (이음표의 모양을 견줄 때) */
function linked(id: string, fields: Record<string, string>, puts: (Put & { at: Block['at']; link?: Block['link']; linkBelow?: Block['linkBelow'] })[]): Slide {
  const base: Slide = { ...makeSlide('compose'), id: `dir-${id}`, fields }
  return {
    ...base,
    blocks: puts.map((p, i) => ({ ...block(p, `${id}-b${i}`), at: p.at, ...(p.link ? { link: p.link } : {}), ...(p.linkBelow ? { linkBelow: p.linkBelow } : {}) })),
  }
}

export function dirSlides(size?: string): Slide[] {
  return [
    // 이음표: 옆으로 화살표, 더하기, 결과
    linked('links-h', { title: '세 가지가 모여 절감액이 돼요' }, [
      { type: 'number', fields: { value: '1.2억 원', label: '인건비', note: '' }, at: { x: 0, y: 0, w: 3, h: 6 }, link: 'arrow' },
      { type: 'number', fields: { value: '0.8억 원', label: '운영비', note: '' }, at: { x: 3, y: 0, w: 3, h: 6 }, link: 'plus' },
      { type: 'number', fields: { value: '0.4억 원', label: '자재비', note: '' }, at: { x: 6, y: 0, w: 3, h: 6 }, link: 'equals' },
      { type: 'number', fields: { value: '2.4억 원', label: '연간 절감', note: '' }, at: { x: 9, y: 0, w: 3, h: 6 } },
      { type: 'text', at: { x: 0, y: 6, w: 6, h: 6 }, link: 'versus' },
      { type: 'text', fields: { heading: '실패한 것만 다시 봐요' }, at: { x: 6, y: 6, w: 6, h: 6 } },
    ]),
    // 이음표: 아래로 화살표, 두 안 비교
    linked('links-v', { title: '요청이 들어오면 이렇게 처리해요' }, [
      { type: 'text', at: { x: 0, y: 0, w: 6, h: 4 }, linkBelow: 'arrow' },
      { type: 'delta', at: { x: 6, y: 0, w: 6, h: 8 } },
      { type: 'callout', look: 'plain', at: { x: 0, y: 4, w: 6, h: 4 } },
      { type: 'compare', at: { x: 0, y: 8, w: 12, h: 4 } },
    ]),
    // 빽빽한 장: 숫자 둘, 전과 후, 점 목록 여섯, 강조 상자
    scene(
      'dense',
      { title: '3분기 운영 지표', lead: '목표 대비 달성과 다음 분기 과제' },
      [{ type: 'number' }, { type: 'number', fields: { value: '14%', label: '줄어든 사용량', note: '' } }, { type: 'delta' }, { type: 'bullets', n: 6 }, { type: 'callout' }],
      size,
    ),
    // 듬성한 장: 핵심 한 줄 하나와 숫자 하나
    scene('sparse', { title: '전기료가 해마다 3.6억 원 줄어요' }, [{ type: 'number' }, { type: 'message', fields: { text: '설비 교체비는 2년 안에 돌아와요', sub: '' } }], size),
    // 지표 줄과 핵심 한 줄
    scene('kpi', { title: '시범 운영 석 달의 결과' }, [{ type: 'kpi' }, { type: 'message' }], size),
    // 단계 표시, 단계 흐름
    scene('steps', { title: '도입은 네 단계로 나눠 해요' }, [{ type: 'steps' }, { type: 'callout' }, { type: 'process' }], size),
    // 두 안 비교
    scene('compare', { title: '두 안을 견줘 보면' }, [{ type: 'compare' }], size),
    // 인용과 강조 상자(옅은 면)
    scene('voice', { title: '현장에서 들은 말' }, [{ type: 'quote' }, { type: 'callout', look: 'card' }, { type: 'bullets', n: 3 }], size),
  ]
}
