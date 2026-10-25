// 비밀 심기 시험에 쓰는 발표. 모양(share.test.ts)과 MCP 서버(mcp/server.test.ts)의 시험이 같이 쓴다.
// 시험 파일에서 가져오면 그 파일의 시험까지 한 번 더 돌아서 따로 둔다

import { createSampleDeck } from '../deck/sample'
import type { Block, BlockRow, Deck } from '../deck/types'

export const SECRET = '기밀7731'

/** 사람이 글을 적을 수 있는 모든 곳, 그리고 가져온 파일이라면 아무 글이나 들어 있을 수 있는 곳에 비밀을 심는다 */
export function secretDeck(): Deck {
  const deck = createSampleDeck()
  const s = (k: string) => `${SECRET}-${k}`
  return {
    ...deck,
    id: s('deck-id'),
    title: s('title'),
    // 발표 종류, 듣는 사람, 방식도 고르는 값이지만 가져온 파일(또는 새 버전이 더한 값)이면 아무 글이나 있을 수 있다
    meta: {
      ...deck.meta,
      type: s('type'),
      audience: s('audience'),
      method: s('method'),
      org: s('org'),
      presenter: s('presenter'),
      date: s('date'),
      contact: s('contact'),
      logo: `data:image/png;base64,${SECRET}`,
    } as unknown as Deck['meta'],
    // 가져온 파일이면 고르는 값 자리에도 아무 글이나 들어 있을 수 있다
    theme: { id: deck.theme.id, accent: s('accent'), font: s('font'), size: s('size'), footer: s('footer'), transition: s('transition') } as unknown as Deck['theme'],
    slides: (deck.slides.map((slide, i) => ({
      ...slide,
      id: s(`slide-${i}`),
      purpose: s('purpose'),
      section: s('section'),
      guide: s('guide'),
      notes: s('notes'),
      hints: { title: s('hint') },
      options: { ...slide.options, motion: s('motion'), tone: s('tone'), transition: s('transition'), order: [s('order')] } as unknown as Deck['slides'][number]['options'],
      fields: Object.fromEntries([...Object.keys(slide.fields), 'title', 'lead', 'body'].map((k) => [k, s(`field-${k}`)])),
      items: slide.items.map((it, j) => ({ ...it, id: s(`item-${j}`), title: s('t'), body: s('b'), value: s('v'), meta: s('m'), image: s('img') })),
    })) as Deck['slides']).concat(composeSecret(s)),
  }
}

/** 부품 장: 부품의 칸, 항목, 안내, id, 그리고 고르는 값 자리(바탕, 움직임, 나오는 때와 차례, 모양, 너비)에도 비밀을 심는다 */
function composeSecret(s: (k: string) => string): Deck['slides'] {
  const it = (j: number) => ({ id: s(`bi-${j}`), title: s('bt'), body: s('bb'), value: s('bv'), meta: s('bm'), image: s('bimg') })
  const block = (type: string, j: number) =>
    ({ id: s(`block-${j}`), type, fields: { text: s('bf'), body: s('bf'), label: s('bf'), [s('key')]: s('bf') }, items: [it(0), it(1)], hints: { body: s('bh') }, look: s('look'), effect: s('fx'), when: s('when'), speed: s('speed'), from: s('from'), variant: s('va'), highlight: 1 }) as unknown as Block
  return [
    {
      id: s('compose'),
      layout: 'compose',
      purpose: s('purpose'),
      section: s('section'),
      guide: s('guide'),
      notes: s('notes'),
      hints: { title: s('hint') },
      // 나오는 차례: 없는 id(비밀)는 빠지고, 있는 부품의 원래 id는 해시 id로만 나가야 한다
      options: { transition: s('transition'), order: [s('order'), s('block-3'), s('block-1')] } as unknown as Deck['slides'][number]['options'],
      fields: { title: s('ct'), lead: s('cl') },
      items: [],
      // 이음표 자리에도: 첫 줄은 맞는 이음표, 둘째 줄과 마지막 부품은 비밀
      rows: [
        { id: s('row-1'), spans: [s('span')] as unknown as number[], blocks: [{ ...block('message', 1), link: 'arrow' }, { ...block('bullets', 2), link: s('link') } as unknown as Block], link: 'plus' },
        { id: s('row-2'), blocks: [{ ...block('kpi', 3), link: s('link') } as unknown as Block, block(s('type'), 4)], link: s('rowlink') } as unknown as BlockRow,
      ],
    },
  ]
}
