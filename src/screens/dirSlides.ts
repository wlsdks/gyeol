import { autoPlace, composeAreaH } from '../deck/blocks'
import { sampleBlock } from '../deck/blockSamples'
import { makeSlide } from '../deck/generate'
import type { Block, BlockLook, BlockType, Slide } from '../deck/types'

/*
 * 개발용: 컴포넌트 디자인 방향 시안(#/gallery?set=dirs&dir=a|b)을 견줄 장. 대표 조합(reviewSlides.ts)에 없는
 * 지표 줄, 단계 표시, 단계 흐름, 두 안 비교와, 빽빽한 장과 듬성한 장을 더한다. 내용은 모두 지어낸 것이다
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

export function dirSlides(size?: string): Slide[] {
  return [
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
