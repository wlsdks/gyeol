// 부품: 연결도 (network). 모양은 styles/blocks/network.css, 움직임은 motion/engine.ts의 nativeAuto

import type { CSSProperties } from 'react'
import { BLOCKS } from '../../deck/blocks'
import { isBlankItem } from '../../deck/fields'
import { cx } from '../../lib/cx'
import { useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'

/**
 * 연결된 것의 자리: 앞의 반(홀수면 하나 더)은 왼쪽, 나머지는 오른쪽. 한쪽 단은 2줄씩 차지하는 칸이고, 오른쪽이 하나 적으면
 * 한 줄 내려 두 단의 가운데가 엇갈린다(가운데 상자 높이의 가운데에 한쪽 단의 가운데 칸이 선다).
 * m은 칸 가운데에서 가운데 상자 가운데까지의 거리를 '칸 높이 + 사이'의 몇 배로 (선의 세로 길이, network.css)
 */
export function networkSpots(n: number): { side: 'l' | 'r'; row: number; m: number; dir: 'up' | 'mid' | 'down' }[] {
  const left = Math.ceil(n / 2)
  const right = n - left
  return Array.from({ length: n }, (_, i) => {
    const side = i < left ? 'l' : 'r'
    const k = side === 'l' ? i : i - left
    const row = side === 'l' || right === left ? 2 * k + 1 : 2 * k + 2
    const off = row - left
    return { side, row, m: Math.abs(off) / 2, dir: off < 0 ? 'up' : off > 0 ? 'down' : 'mid' }
  })
}

/**
 * 연결도: 가운데 하나(짙은 면)에 여러 시스템이나 팀이 이어진 모습. 넓은 칸에서는 양옆에 나눠 두고 꺾인 선(둥근 모서리)으로
 * 가운데 상자에 모은다. 좁은 칸에서는 가운데를 위에, 연결된 것을 아래 목록으로 두고 왼쪽 줄기에서 가지를 뻗는다(network.css).
 * 발표할 때는 가운데가 먼저 나오고 선이 하나씩 뻗어 나가며 닿는 상자가 나타난 뒤, 데이터 조각이 가운데로 모여든다
 */
export function Network() {
  const { slide, mode } = useSlide()
  // 발표할 때 칸을 하나도 채우지 않은 것(가장 적은 수를 채우려 남긴 빈 칸, presentable)은 자리째 뺀다: 감추기만 하면 양옆 단의
  // 자리는 그대로라 남은 상자가 위로 꺾인 선 끝에 매달리고, 빈 쪽으로 가운데의 선이 뻗었다. 항목의 칸은 원래 자리(i)로 가리킨다
  const shown = slide.items
    .slice(0, BLOCKS.network.items!.max)
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => mode !== 'final' || !isBlankItem(it))
  const spots = networkSpots(shown.length)
  return (
    <div className="bk-nw" data-n={shown.length}>
      <div className="bk-nw-map" style={{ '--nw-t': 2 * Math.ceil(shown.length / 2) } as CSSProperties}>
        <div className="bk-nw-hub">
          <T k="center" as="p" className="bk-nw-c" />
        </div>
        {shown.map(({ it, i }, k) => {
          const p = spots[k]
          return (
            <div key={it.id} className={cx('it bk-nw-node', `is-${p.side}`, `is-${p.dir}`)} style={{ '--nw-p': `${p.row} / span 2`, '--nw-m': p.m } as CSSProperties}>
              {/* 이 상자에서 가운데까지의 선. 좁은 칸에서는 왼쪽 줄기의 가지, 줄기는 다음 상자까지 이어진다(bk-nw-run) */}
              <span className="bk-nw-wire" aria-hidden="true" />
              {k < shown.length - 1 && <span className="bk-nw-run" aria-hidden="true" />}
              <IT i={i} k="title" className="bk-nw-t" />
              <IT i={i} k="meta" className="bk-nw-m" />
              <ItemTools i={i} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
