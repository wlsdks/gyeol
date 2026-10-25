// 레이아웃: 위치 비교 (position). 모양은 styles/position.css

import { useEffect, useLayoutEffect, useRef } from 'react'
import { BLOCK_COL_GAP } from '../../deck/blocks'
import { highlightOf, hintFor } from '../../deck/layouts'
import { cx } from '../../lib/cx'
import { demoOf, useSlide } from '../context'
import { IT, ItemTools, T } from '../fields'
import { placeLabels } from '../fitBlocks'
import { Head, numberOrNull, useItems } from './parts'

/** 위치 비교의 판 크기 어림 (px): 한 장을 다 쓸 때. 부품 안이면 칸 너비에서 판 둘레의 여백을 뺀다 */
const PM_PLOT = { w: 1568, h: 520 }

/**
 * 위치 비교의 이름표가 차지하는 자리를 판의 몫(%)으로 어림한다. 글자 하나는 이름(32px)이 30px, 강조할 점의 이름(40px)이 38px,
 * 설명(24px)이 22px쯤이고 이름표는 380px에서 줄이 바뀐다. 높이는 이름만이면 한 줄, 설명이 있으면 두 줄.
 * 부품 안에서는 칸이 좁으면 글자도 줄어든다 (blocks.css의 --bk-w 단계)
 */
function labelSize(name: string, body: string, hl: boolean, edit: boolean, span?: number): { w: number; h: number } {
  const cell = span ? span * ((1680 - 11 * BLOCK_COL_GAP) / 12) + (span - 1) * BLOCK_COL_GAP : 0
  const k = !cell ? 1 : cell <= 420 ? 0.66 : cell <= 560 ? 0.74 : cell <= 820 ? 0.84 : cell <= 1100 ? 0.92 : 1
  const plotW = cell ? Math.max(200, cell - 112) : PM_PLOT.w
  const n = [...name.trim()].length * (hl ? 38 : 30)
  const b = [...body.trim()].length * 22
  // 편집할 때는 빈 설명 칸과 점수 줄이 더 보인다
  const px = edit ? Math.max(n, b, 300) : Math.max(n, b)
  const lines = edit ? 120 : (body.trim() ? 73 : 38) + (hl ? 10 : 0)
  return { w: (Math.min(380, px) * k + 8) / plotW * 100, h: (lines * k) / PM_PLOT.h * 100 }
}

type PmSide = { left: boolean; v?: 'up' | 'down' }

/**
 * 위치 비교의 이름표를 어디에 붙일지: 기본은 점 오른쪽 가운데, 오른쪽 끝에 가까우면 왼쪽.
 * 앞의 점들의 이름표와 겹치면 반대쪽, 위로, 아래로, 반대쪽 위나 아래 차례로 겹치지 않는 자리를 찾는다.
 * 슬라이드를 그리기 전에 정해야 해서(내보낸 파일도 같은 모습) 글 길이를 재지 않고 자리로만 어림한다
 */
function labelSides(pts: ({ x: number; y: number; w: number; h: number } | null)[]): PmSide[] {
  const out: PmSide[] = pts.map((p) => ({ left: !!p && p.x > 72 }))
  const box = (i: number, o: PmSide) => {
    const { x, y, w, h: lh } = pts[i]!
    // 이름표는 점에서 조금 떨어져 붙는다 (slides.css의 .pm-label left 30px)
    const h = o.left ? [x - 1.5 - w, x - 1.5] : [x + 1.5, x + 1.5 + w]
    const v = o.v === 'up' ? [y + 1, y + 1 + lh] : o.v === 'down' ? [y - 1 - lh, y - 1] : [y - lh / 2, y + lh / 2]
    return { h, v }
  }
  const meet = (a: number[], b: number[]) => a[0] < b[1] && b[0] < a[1]
  const placed = pts.flatMap((p, i) => (p ? [i] : []))
  // 이름표끼리, 그리고 이름표와 다른 점(점은 어디에 이름표가 붙든 그 자리에 있다)
  const hitsLabel = (i: number, o: PmSide, j: number, oj = out[j]) => {
    const a = box(i, o)
    const b = box(j, oj)
    return meet(a.h, b.h) && meet(a.v, b.v)
  }
  const hitsDot = (i: number, o: PmSide) => {
    const a = box(i, o)
    return placed.some((j) => j !== i && meet(a.h, [pts[j]!.x - 1.2, pts[j]!.x + 1.2]) && meet(a.v, [pts[j]!.y - 3, pts[j]!.y + 3]))
  }
  // 판 밖으로 많이 나가는 자리는 고르지 않는다 (판 둘레의 여백만큼은 괜찮다)
  const inside = (i: number, o: PmSide) => {
    const { h, v } = box(i, o)
    return h[0] >= -2 && h[1] <= 102 && v[0] >= -8 && v[1] <= 108
  }
  const free = (i: number, o: PmSide, others: number[]) => inside(i, o) && !hitsDot(i, o) && !others.some((j) => hitsLabel(i, o, j))
  for (const i of placed) {
    const before = placed.filter((j) => j < i)
    const base = out[i]
    const tries: PmSide[] = [base, { left: !base.left }, { ...base, v: 'up' }, { ...base, v: 'down' }, { left: !base.left, v: 'up' }, { left: !base.left, v: 'down' }]
    const pick = tries.find((o) => free(i, o, before))
    if (pick) {
      out[i] = pick
      continue
    }
    // 거의 같은 자리의 두 점: 앞의 점까지 함께 비켜 하나는 위로, 하나는 아래로
    const j = before.find((k) => hitsLabel(i, base, k))
    if (j === undefined || out[j].v) continue
    const rest = before.filter((k) => k !== j)
    for (const [vj, vi] of [['up', 'down'], ['down', 'up']] as const) {
      const oj: PmSide = { ...out[j], v: vj }
      const oi: PmSide = { ...base, v: vi }
      if (free(j, oj, rest) && free(i, oi, rest) && !hitsLabel(i, oi, j, oj)) {
        out[j] = oj
        out[i] = oi
        break
      }
    }
  }
  return out
}

/**
 * 위치 비교(포지셔닝 맵): 두 기준의 점수로 점을 찍는다. 점수가 모두 0~10이면 0~10 눈금, 아니면 가장 큰 값까지.
 * 강조할 점(보통 우리)만 강조색으로 크게, 나머지는 회색. 이름표는 점 오른쪽에, 오른쪽 끝에 가까운 점은 왼쪽에.
 * 점수는 편집할 때만 이름 아래에 보인다. 발표 화면에는 자리로만
 */
export function Position() {
  const { slide, mode, span } = useSlide()
  const items = useItems()
  const final = mode === 'final'
  const highlight = highlightOf(slide)
  const demo = demoOf(mode, items, ['value', 'meta'])
  const read = (k: 'value' | 'meta', i: number) => numberOrNull(demo ? hintFor(slide.layout, slide.hints, k, k, i) : items[i][k])
  const xs = items.map((_, i) => read('value', i))
  const ys = items.map((_, i) => read('meta', i))
  const known = [...xs, ...ys].filter((v): v is number => v !== null)
  const lo = Math.min(0, ...known)
  const top = Math.max(1, ...known)
  const hi = top <= 10 && lo >= 0 ? 10 : top + (top - lo) * 0.08
  const pct = (v: number) => ((v - lo) / (hi - lo || 1)) * 100
  const at = (v: number) => pct(v).toFixed(2)
  const text = (k: 'title' | 'body', i: number) => (demo ? hintFor(slide.layout, slide.hints, k, k, i) : items[i][k])
  // 어림한 자리를 그려진 크기로 다시 고른다. 글꼴이 늦게 오면 한 번 더 (부품 장 안이면 fitBlocks도 한다)
  const plot = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    if (plot.current) placeLabels(plot.current)
  })
  useEffect(() => {
    let on = true
    document.fonts?.ready.then(() => on && plot.current && placeLabels(plot.current))
    return () => {
      on = false
    }
  }, [])
  const sides = labelSides(
    items.map((_, i) => (xs[i] !== null && ys[i] !== null ? { x: pct(xs[i]!), y: pct(ys[i]!), ...labelSize(text('title', i), text('body', i), i === highlight, !final, span) } : null)),
  )
  return (
    <>
      <Head />
      <div className={cx('s-body pm', demo && 'is-demo')} data-n={items.length}>
        <T k="yAxis" className="pm-y" />
        <div className="pm-plot" ref={plot}>
          <span className="pm-mid is-x" aria-hidden="true" />
          <span className="pm-mid is-y" aria-hidden="true" />
          {items.map((it, i) => {
            const [x, y] = [xs[i], ys[i]]
            const placed = x !== null && y !== null
            if (!placed && final) return null
            // 점수를 아직 적지 않은 점(편집할 때만)은 판 위쪽에 차례로 늘어세운다
            const style = { '--x': placed ? at(x) : String(4 + i * 17), '--y': placed ? at(y) : '100' }
            const side = cx(sides[i].left && 'is-left', sides[i].v && `is-${sides[i].v}`)
            return (
              <div
                key={it.id}
                className={cx('it pm-pt', i === highlight && 'is-hl', !placed && 'is-blank', side)}
                data-pm-side={side}
                style={style}
              >
                <span className="pm-dot" />
                <div className="pm-label">
                  <IT i={i} k="title" className="pm-name" />
                  <IT i={i} k="body" className="pm-body" />
                  {!final && (
                    <span className="pm-nums">
                      가로 <IT i={i} k="value" as="span" className="pm-num" oneLine /> 세로 <IT i={i} k="meta" as="span" className="pm-num" oneLine />
                    </span>
                  )}
                </div>
                <ItemTools i={i} sort={false} />
              </div>
            )
          })}
        </div>
        <T k="xAxis" className="pm-x" />
      </div>
    </>
  )
}
