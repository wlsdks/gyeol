import { autoPlace, composeAreaH } from '../deck/blocks'
import { sampleBlock } from '../deck/blockSamples'
import { makeSlide } from '../deck/generate'
import type { Block, BlockLook, BlockType, Slide } from '../deck/types'

/*
 * 개발용: 부품 장의 대표 조합 (#/gallery?set=review). 조합 시험(combos.ts)은 seed로 고른 수백 장이라 한 장씩 비교하기 어려워서,
 * 고칠 때마다 같은 장을 전과 후로 견주어 볼 장면을 정해 둔다. 첫 장은 예시 발표의 '사업 기회'를 부품 장으로 바꾸고
 * 핵심 한 줄과 인용을 더한 장이다(장 제목과 핵심 한 줄, 인용이 모두 굵은 검정으로 비슷한 크기라 셋 다 제목처럼 읽혔고,
 * 짧은 글 칸이 높은 칸에 떠서 부제 아래가 200px 넘게 비었다). 편집기의 '넣기'처럼 autoPlace로 차례대로 넣는다.
 * 내용은 모두 지어낸 것이다
 */

type Put = { type: BlockType; fields?: Record<string, string>; look?: BlockLook; n?: number; variant?: string }

function block(p: Put, id: string): Block {
  const s = sampleBlock(p.type)
  const items = p.n && s.items.length ? Array.from({ length: p.n }, (_, i) => ({ ...s.items[i % s.items.length], id: `${id}-it${i}` })) : s.items
  return { ...s, id, items, fields: { ...s.fields, ...p.fields }, ...(p.look ? { look: p.look } : {}), ...(p.variant ? { variant: p.variant } : {}) }
}

function scene(id: string, fields: Record<string, string>, puts: Put[], size?: string): Slide {
  const base: Slide = { ...makeSlide('compose'), id: `review-${id}`, fields }
  const areaH = composeAreaH(base, { theme: { size } }, true)
  let blocks: Block[] = []
  puts.forEach((p, i) => {
    blocks = autoPlace(blocks, block(p, `${id}-b${i}`), areaH) ?? blocks
  })
  return { ...base, blocks }
}

export function reviewSlides(size?: string): Slide[] {
  return [
    // 예시 발표의 '사업 기회' + 핵심 한 줄 + 인용 (말한 사람 없이)
    scene(
      'user',
      {
        title: '한빛제조가 12월에 평택 공장 품질 검사 시스템을 바꿔요',
        lead: '지금 시스템의 유지보수가 내년 3월에 끝나서 품질팀장이 연내에 업체를 정하려고 해요. 최종 결정은 공장장이 해요.',
      },
      [
        { type: 'message', fields: { text: '검사 시간을 절반으로 줄일 수 있어요', sub: '' } },
        { type: 'quote', fields: { quote: '사람이 하던 외관 검사를 카메라로 바꾸면 야간 조도 돌릴 수 있어요. 불량이 가장 많은 3개 라인부터 해 보죠.', by: '' } },
      ],
      size,
    ),
    // 글만: 핵심 한 줄 아래 제목과 글 둘
    scene('text', { title: '배포 전 점검을 자동으로 바꿔요' }, [{ type: 'message' }, { type: 'text' }, { type: 'text', fields: { heading: '실패한 것만 다시 봐요', body: '자동 시험이 걸러 낸 항목만 사람이 확인해서 점검 시간이 하루에서 두 시간으로 줄어요.' } }], size),
    // 글과 숫자
    scene('number', { title: '전기료가 해마다 3.6억 원 줄어요', lead: '공장 두 곳의 냉각 설비를 바꾼 뒤 6개월 기준' }, [{ type: 'number' }, { type: 'number', fields: { value: '14%', label: '줄어든 사용량', note: '' } }, { type: 'text' }], size),
    // 글과 차트
    scene('chart', { title: '문의는 줄고 한 번에 끝내는 비율은 올랐어요' }, [{ type: 'message' }, { type: 'trend' }], size),
    // 인용과 목록
    scene('quote', { title: '시범 부서의 반응' }, [{ type: 'quote' }, { type: 'bullets' }], size),
    // 셋이 나란히
    scene('three', { title: '세 가지를 먼저 바꿔요' }, [{ type: 'text' }, { type: 'text' }, { type: 'text' }], size),
    // 제목 없는 결론 한 장
    scene('bare', {}, [{ type: 'message' }, { type: 'quote' }], size),
    // 빽빽한 장
    scene('dense', { title: '3분기 운영 지표', lead: '목표 대비 달성과 다음 분기 과제' }, [{ type: 'number' }, { type: 'delta' }, { type: 'goal' }, { type: 'trend' }, { type: 'bullets' }, { type: 'callout' }], size),
    // 강조 상자와 근거
    scene('callout', { title: '교육 담당 2명을 지원해 주세요' }, [{ type: 'callout', look: 'bold' }, { type: 'bullets', n: 4 }], size),
    // 소제목과 목록 둘
    scene('heading', { title: '잘된 것과 남은 것' }, [{ type: 'heading' }, { type: 'bullets', n: 2 }, { type: 'heading' }, { type: 'checks', n: 2 }], size),
  ]
}
