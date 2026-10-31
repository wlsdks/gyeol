import { autoPlace, composeAreaH } from '../deck/blocks'
import { sampleBlock } from '../deck/blockSamples'
import { makeSlide } from '../deck/generate'
import type { Block, BlockLook, BlockType, Slide } from '../deck/types'

/*
 * 개발용: 부품 장의 대표 조합 (#/gallery?set=review). 조합 시험(combos.ts)은 seed로 고른 수백 장이라 한 장씩 비교하기 어려워서,
 * 고칠 때마다 같은 장을 전과 후로 견주어 볼 장면을 정해 둔다. 첫 장은 예시 발표의 '지금의 문제'를 부품 장으로 바꾸고
 * 핵심 한 줄과 인용을 더한 장이다(장 제목과 핵심 한 줄, 인용이 모두 굵은 검정으로 비슷한 크기라 셋 다 제목처럼 읽혔고,
 * 짧은 글 칸이 높은 칸에 떠서 부제 아래가 200px 넘게 비었다). 편집기의 '넣기'처럼 autoPlace로 차례대로 넣는다.
 * 내용은 모두 지어낸 것이다
 */

type Put = { type: BlockType; fields?: Record<string, string>; look?: BlockLook; n?: number; variant?: string }
type Look = Parameters<typeof composeAreaH>[1]

function block(p: Put, id: string): Block {
  const s = sampleBlock(p.type)
  const items = p.n && s.items.length ? Array.from({ length: p.n }, (_, i) => ({ ...s.items[i % s.items.length], id: `${id}-it${i}` })) : s.items
  return { ...s, id, items, fields: { ...s.fields, ...p.fields }, ...(p.look ? { look: p.look } : {}), ...(p.variant ? { variant: p.variant } : {}) }
}

function scene(id: string, fields: Record<string, string>, puts: Put[], look?: Look): Slide {
  const base: Slide = { ...makeSlide('compose'), id: `review-${id}`, fields }
  const areaH = composeAreaH(base, look, true)
  let blocks: Block[] = []
  puts.forEach((p, i) => {
    const placed = autoPlace(blocks, block(p, `${id}-b${i}`), areaH)
    if (!placed) throw new Error(`대표 조합 ${id}에 ${p.type}을 넣을 수 없습니다`)
    blocks = placed
  })
  return { ...base, blocks }
}

/** look: 갤러리의 테마(글꼴)와 글자 크기. 판을 그 본문 높이로 짠다 */
export function reviewSlides(look?: Look): Slide[] {
  return [
    // 예시 발표의 '지금의 문제' + 핵심 한 줄 + 인용 (말한 사람 없이)
    scene(
      'user',
      {
        title: '회의가 많아서 정작 일할 시간이 모자라요',
        lead: '본부 80명 중 열에 일곱이 회의 때문에 야근한 적이 있다고 답했어요. 가장 오래 걸리는 건 돌아가며 진행 상황을 말하는 주간 회의예요.',
      },
      [
        { type: 'message', fields: { text: '회의 시간을 3분의 1로 줄일 수 있어요', sub: '' } },
        { type: 'quote', fields: { quote: '진행 상황은 보드로 미리 보고 모여서는 정할 것만 정하면 한 시간은 아껴요. 손을 든 두 팀부터 해 보죠.', by: '' } },
      ],
      look,
    ),
    // 글만: 핵심 한 줄 아래 제목과 글 둘
    scene('text', { title: '배포 전 점검을 자동으로 바꿔요' }, [{ type: 'message' }, { type: 'text' }, { type: 'text', fields: { heading: '실패한 것만 다시 봐요', body: '자동 시험이 걸러 낸 항목만 사람이 확인해서 점검 시간이 하루에서 두 시간으로 줄어요.' } }], look),
    // 글과 숫자
    scene('number', { title: '전기료가 해마다 3.6억 원 줄어요', lead: '공장 두 곳의 냉각 설비를 바꾼 뒤 6개월 기준' }, [{ type: 'number' }, { type: 'number', fields: { value: '14%', label: '줄어든 사용량', note: '' } }, { type: 'text' }], look),
    // 글과 차트
    scene('chart', { title: '문의는 줄고 한 번에 끝내는 비율은 올랐어요' }, [{ type: 'message' }, { type: 'trend' }], look),
    // 인용과 목록
    scene('quote', { title: '시범 부서의 반응' }, [{ type: 'quote' }, { type: 'bullets' }], look),
    // 셋이 나란히
    scene('three', { title: '세 가지를 먼저 바꿔요' }, [{ type: 'text' }, { type: 'text' }, { type: 'text' }], look),
    // 제목 없는 결론 한 장
    scene('bare', {}, [{ type: 'message' }, { type: 'quote' }], look),
    // 빽빽한 장
    scene('dense', { title: '3분기 운영 지표', lead: '목표 대비 달성과 다음 분기 과제' }, [{ type: 'number' }, { type: 'delta' }, { type: 'goal' }, { type: 'bullets' }, { type: 'callout' }], look),
    // 강조 상자와 근거
    scene('callout', { title: '교육 담당 2명을 지원해 주세요' }, [{ type: 'callout', look: 'bold' }, { type: 'bullets', n: 4 }], look),
    // 소제목과 목록 둘
    scene('heading', { title: '잘된 것과 남은 것' }, [{ type: 'heading' }, { type: 'bullets', n: 2 }, { type: 'heading' }, { type: 'checks', n: 2 }], look),
    // 긴 목록과 차트 다음에 넣은 핵심 한 줄 (맨 위에도 목록 왼쪽에도 자리가 없어 맨 아래에 깔리던 장)
    scene('lead-late', { title: '시범 부서의 반응' }, [{ type: 'bullets', n: 6 }, { type: 'trend' }, { type: 'message' }], look),
    // 일정 설명 바로 아래 개요 제목이 붙어 보이던 장
    scene('timeline-facts', { title: '시범 운영을 세 단계로 진행해요' }, [{ type: 'timeline', n: 3 }, { type: 'facts', n: 2 }], look),
    // 가로 원인 차트 아래 숫자와 설명이 붙어 보이던 장
    scene('pareto-number', { title: '불량 원인을 우선순위대로 개선해요' }, [{ type: 'pareto', variant: 'rows', n: 4, fields: { heading: '9월 불량 원인 (830건)' } }, { type: 'number', fields: { label: '연간 예상 절감액' } }], look),
  ]
}
