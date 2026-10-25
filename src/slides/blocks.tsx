import { useContext, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import { areaStyle, BLOCK_LINKS, BLOCKS, blockFieldPrefix, foldableFields, blockItems, blockMinH, blockSlide, cellBoxes, cellStyle, effectOf, knownRows, linkAt, rowMins, sameLinkTarget, shownLook, shownRows, spansOf, variantOfBlock, withLink, type CellBox, type LinkTarget } from '../deck/blocks'
import { followIndex, moveIn, readField } from '../deck/fields'
import { hintFor } from '../deck/layouts'
import type { Block, BlockLink, BlockRow, BlockType, NativeBlockType } from '../deck/types'
import { cx } from '../lib/cx'
import { imageSize } from '../lib/image'
import { BlockEditContext, type BlockEdit } from './blockEdit'
import { SlideContext, useSlide, type SlideActions } from './context'
import { fitBlocks } from './fitBlocks'
import { IT, ImageSlot, ItemTools, minusSigns, numberUnits, splitNumber, T, textUnits } from './fields'
import { LAYOUT_VIEWS } from './layouts'
import { amountPair, changeOf, colsOf, formatNumber, gradeOf, gradesOf, periodRest, readAmount, readNumber, seriesIn, spanIn, statusOf, type Grade, type Status } from './numbers'

// 부품 장(compose). 칸의 자리는 deck/blocks.ts가 계산하고, 여기서는 그 자리에 부품을 그린다.
// 부품 안의 칸은 슬라이드의 칸 그리기(T, IT, 그림 칸)를 그대로 쓴다. 부품을 장처럼 보이게 한
// 가짜 장(blockSlide)을 SlideContext로 한 번 더 감싸서, 레이아웃 부품은 그 레이아웃의 그리기를 그대로 쓴다.
// 칸 둘 이상의 숫자로 계산하는 곳(비율, 합, 차이)은 단위까지 읽어 같은 기준으로 맞춘다 (numbers.ts의 seriesIn, amountPair)

/** 편집할 때 비어 있으면 안내 문구의 예시 숫자로 흐리게 그린다. 발표할 때는 적은 값만 */
function useDemo(keys: string[]) {
  const { slide, meta, mode } = useSlide()
  const demo = mode !== 'final' && keys.every((k) => !readField(slide, meta, k).trim())
  const read = (k: string) => (demo ? hintFor(slide.layout, slide.hints, k) : readField(slide, meta, k))
  return { demo, read }
}

// ---------- 부품 장만의 부품 ----------

function Message() {
  return (
    <div className="bk-msg">
      <T k="text" as="p" className="bk-msg-t" fit={[30, 52]} multiline />
      <T k="sub" className="bk-msg-s" multiline />
    </div>
  )
}

function Text() {
  return (
    <div className="bk-tx">
      <T k="label" className="bk-label" />
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <T k="body" className="bk-body" multiline />
    </div>
  )
}

function Bullets() {
  const { slide } = useSlide()
  const items = slide.items.slice(0, BLOCKS.bullets.items!.max)
  return (
    <div className="bk-bl">
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <ul className="bk-list" data-n={items.length}>
        {items.map((it, i) => (
          <li key={it.id} className="it bk-li">
            <span className="bk-dot" aria-hidden="true" />
            <div className="bk-li-text">
              <IT i={i} k="title" className="bk-li-t" multiline />
              <IT i={i} k="body" className="bk-li-b" multiline />
            </div>
            <ItemTools i={i} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function Quote() {
  return (
    <figure className="bk-q">
      <span className="bk-q-mark" aria-hidden="true">
        “
      </span>
      <T k="quote" as="blockquote" className="bk-q-t" fit={[40, 70]} multiline />
      <T k="by" as="figcaption" className="bk-q-by" />
    </figure>
  )
}

function Callout() {
  return (
    <div className="bk-call">
      <T k="label" className="bk-call-l" />
      <T k="text" className="bk-call-t" fit={[30, 56]} multiline />
    </div>
  )
}

function BigNumber() {
  return (
    <div className="bk-num">
      <T k="label" className="bk-num-l" />
      <T k="value" className="bk-num-v" oneLine numeral />
      <T k="note" className="bk-num-n" multiline />
    </div>
  )
}

/**
 * 전과 후의 차이. 둘 다 %면 %p로, 아니면 전 값에 대한 %. 단위까지 읽어서 '6분 → 40초'는 ▼ 89%,
 * 견줄 수 없는 단위('3건 → 40%')면 보이지 않는다 (numbers.ts의 changeOf)
 */
function deltaOf(before: string, after: string): { text: string; dir: -1 | 0 | 1 } | null {
  const c = changeOf(before, after)
  if (!c) return null
  const round = (n: number) => (Math.abs(n) < 10 ? Math.round(n * 10) / 10 : Math.round(n))
  const shown = Math.abs(round(c.value))
  // 반올림해 0이면 바뀐 쪽을 가리키지 않는다 (▲ 0%가 되지 않게)
  const dir = shown === 0 ? 0 : c.value > 0 ? 1 : -1
  return { text: `${formatNumber(shown)}${c.pp ? '%p' : '%'}`, dir }
}

/**
 * 전과 후: 두 숫자는 같은 크기로(둘 중 긴 쪽이 들어가는 크기), 전은 옅게, 후는 강조색으로. 크기가 다르면 같은 줄의 두 숫자가
 * 서로 다른 것을 재는 것처럼 보인다. 바뀐 만큼은 결과(후) 바로 아래에 붙인다
 */
function Delta() {
  const { slide, meta } = useSlide()
  const { demo, read } = useDemo(['before', 'after'])
  const delta = deltaOf(read('before'), read('after'))
  // 비어 있는 쪽은 안내 글의 폭으로 (편집할 때 안내 글이 그 자리에 보인다)
  const shown = (k: string) => readField(slide, meta, k).trim() || hintFor(slide.layout, slide.hints, k)
  const units = Math.max(numberUnits(shown('before')), numberUnits(shown('after')))
  return (
    <div className={cx('bk-dl', demo && 'is-demo')}>
      <T k="label" className="bk-dl-l" />
      <div className="bk-dl-row" style={{ '--dl-units': units.toFixed(2) } as CSSProperties}>
        <div className="bk-dl-side bk-dl-from">
          <span className="bk-dl-k">전</span>
          <div className="bk-dl-vbox">
            <T k="before" className="bk-dl-v" oneLine numeral units={units} />
          </div>
        </div>
        <span className="bk-dl-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 12h15M13 6l6 6-6 6" />
          </svg>
        </span>
        <div className="bk-dl-side bk-dl-to">
          <span className="bk-dl-k">후</span>
          <div className="bk-dl-vbox">
            <T k="after" className="bk-dl-v" oneLine numeral units={units} />
          </div>
          {delta && (
            <span className={cx('bk-dl-chip', delta.dir < 0 ? 'is-down' : delta.dir > 0 ? 'is-up' : 'is-flat')}>
              {delta.dir < 0 ? '▼' : delta.dir > 0 ? '▲' : '–'} {delta.text}
            </span>
          )}
        </div>
      </div>
      <T k="note" className="bk-dl-n" />
    </div>
  )
}

function Goal() {
  const { mode } = useSlide()
  const { demo, read } = useDemo(['value', 'target'])
  // 단위 칸('억 원')으로 숫자만 적은 값을 읽고, 따로 적은 자리('7,200만 / 1억')나 단위('50분 / 2시간')는 같은 기준으로 바꿔 나눈다
  const pair = amountPair(read('value'), read('target'), read('unit'))
  const pct = pair && pair.b.base > 0 ? (pair.a.base / pair.b.base) * 100 : null
  return (
    <div className={cx('bk-gl', demo && 'is-demo', pct !== null && pct >= 100 && 'is-met')} style={{ '--p': Math.min(100, Math.max(0, pct ?? 0)).toFixed(1) } as CSSProperties}>
      <div className="bk-gl-top">
        <T k="label" className="bk-gl-l" />
        {/* 큰 숫자처럼 단위(%)는 두 단계 작게: 같은 장의 전과 후, 큰 숫자와 꼴이 같다 */}
        <span className="bk-gl-pct">
          {pct === null ? (
            '–'
          ) : (
            <>
              {formatNumber(Math.round(pct))}
              <span className="u">%</span>
            </>
          )}
        </span>
      </div>
      <div className="bk-gl-bar" aria-hidden="true">
        <span className="bk-gl-fill" />
      </div>
      <p className="bk-gl-of">
        <span className="bk-gl-num">
          <T k="value" as="span" className="bk-gl-v" />
          {/* 단위는 한 번만 적고 실적과 목표에 같이 붙인다 */}
          {mode !== 'edit' && read('unit').trim() && <span className="bk-gl-vu">{read('unit')}</span>}
        </span>
        <span className="bk-gl-sep">/ 목표</span>
        <span className="bk-gl-num">
          <T k="target" as="span" className="bk-gl-t" />
          {(mode !== 'final' || read('unit').trim()) && <T k="unit" as="span" className="bk-gl-u" />}
        </span>
      </p>
      <T k="note" className="bk-gl-n" multiline />
    </div>
  )
}

/** 비율 원: 가운데에 비율, 둘레가 그만큼 찬다 */
/** 반원 게이지의 호: 왼쪽 끝(0%)에서 오른쪽 끝(100%)까지. 가운데(50, 52)를 축으로 돈다 */
const GAUGE_ARC = 'M 8 52 A 42 42 0 0 1 92 52'

function Ring() {
  const { slide } = useSlide()
  const { demo, read } = useDemo(['value'])
  const v = readNumber(read('value'))
  const p = v === null ? 0 : Math.min(100, Math.max(0, v))
  if (slide.variant === 'gauge')
    return (
      <div className={cx('bk-rg is-gauge', demo && 'is-demo')} style={{ '--p': p.toFixed(1) } as CSSProperties}>
        <T k="label" className="bk-rg-l" />
        <div className="bk-rg-box">
          <div className="bk-rg-sq">
            <svg viewBox="0 0 100 58" aria-hidden="true">
              <path className="bk-rg-track" d={GAUGE_ARC} pathLength="100" />
              {v !== null && p > 0 && <path className="bk-rg-arc" d={GAUGE_ARC} pathLength="100" />}
              {/* 호의 끝을 따라가는 손잡이: 왼쪽 끝에 두고 가운데를 축으로 비율만큼 돌린다 */}
              {v !== null && (
                <g className="bk-rg-knob">
                  <circle cx="8" cy="52" r="5.2" />
                </g>
              )}
            </svg>
            <div className="bk-rg-c">
              <T k="value" className="bk-rg-v" oneLine numeral />
            </div>
          </div>
        </div>
        <T k="note" className="bk-rg-n" multiline />
      </div>
    )
  return (
    <div className={cx('bk-rg', demo && 'is-demo')} style={{ '--p': p.toFixed(1) } as CSSProperties}>
      <T k="label" className="bk-rg-l" />
      <div className="bk-rg-box">
        <div className="bk-rg-sq">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="bk-rg-track" cx="50" cy="50" r="44" />
            {v !== null && p > 0 && <circle className="bk-rg-arc" cx="50" cy="50" r="44" pathLength="100" />}
          </svg>
          <div className="bk-rg-c">
            <T k="value" className="bk-rg-v" oneLine numeral />
          </div>
        </div>
      </div>
      <T k="note" className="bk-rg-n" multiline />
    </div>
  )
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="7" r="4.6" />
      <path d="M3.2 22c0-5 3.9-8.6 8.8-8.6s8.8 3.6 8.8 8.6z" />
    </svg>
  )
}

/** 몇 중 몇: 전체가 20개까지면 점 하나가 하나, 더 많으면 점 100개로 백분율 */
function Ratio() {
  const { mode } = useSlide()
  const { demo, read } = useDemo(['value', 'total'])
  const unit = read('unit').trim()
  // 몇과 전체를 전체에 적은 단위로 맞춘다('180분 중 3시간'). 자리는 그대로 둬서 '1만 명'의 점은 1개가 아니라 백분율
  const pair = amountPair(read('value'), read('total'), unit)
  const per = pair ? pair.b.scale / pair.b.place : 1
  const value = pair && pair.a.base / per
  const total = pair && pair.b.base / per
  const ok = value !== null && total !== null && total > 0
  const exact = ok && total <= 20 && Number.isInteger(total)
  const n = !ok ? 0 : exact ? total : 100
  const on = !ok ? 0 : exact ? Math.round(Math.min(Math.max(value, 0), total)) : Math.round(Math.min(1, Math.max(0, value / total)) * 100)
  const cols = n <= 10 ? n : n <= 20 ? Math.ceil(n / 2) : 20
  // 높이가 남는 칸에서는 줄을 늘려 점을 키운다 (10개면 다섯씩 두 줄, 100개면 열씩 열 줄)
  const tall = n <= 10 ? Math.ceil(n / 2) : n <= 20 ? Math.ceil(n / 4) : 10
  // 한 줄로 늘어놓는 배치(cols)가 줄을 늘린 배치(tall)보다 점이 커지는 칸의 가로세로 비율. 둘 다 칸에 맞춰 점 크기를 정하니
  // (가로 cols개와 사이 0.3) ÷ (세로 줄 수와 사이 0.3)에서 갈린다. 칸의 컨테이너 쿼리가 고르게 0.5 단계로 (blocks.css)
  const flat = Math.min(5.5, Math.max(1, Math.round(((cols * 1.3 - 0.3) / (Math.ceil(n / tall) * 1.3 - 0.3)) * 2) / 2))
  // 사람을 센 것이면 점 대신 사람 모양
  const person = /^(명|분|사람|인)$/.test(unit)
  return (
    <div
      className={cx('bk-rt', demo && 'is-demo')}
      // 점 칸의 높이(blocks.css의 .bk-rt-box)도 줄 수로 정해서 위에 둔다
      style={{ '--cols': cols, '--rows': Math.ceil(n / cols), '--cols-t': tall, '--rows-t': Math.ceil(n / tall) } as CSSProperties}
    >
      <div className="bk-rt-text">
        <T k="label" className="bk-rt-l" />
        <p className="bk-rt-of">
          <span className="bk-rt-num">
            <T k="total" as="span" className="bk-rt-t" />
            {/* 단위는 한 번만 적고 전체와 몇에 같이 붙인다 */}
            {mode === 'edit' ? <T k="unit" as="span" className="bk-rt-u" /> : unit && <span className="bk-rt-u">{unit}</span>}
          </span>
          <span className="bk-rt-sep">중</span>
        </p>
        <p className="bk-rt-big">
          <T k="value" as="span" className="bk-rt-v" />
          {mode !== 'edit' && unit && <span className="bk-rt-vu">{unit}</span>}
        </p>
        <T k="note" className="bk-rt-n" multiline />
      </div>
      {n > 0 && (
        <div className="bk-rt-box" aria-hidden="true">
          <div className={cx('bk-rt-dots', !exact && 'is-pct')} data-kind={person ? 'person' : 'dot'} data-flat={flat}>
            {Array.from({ length: n }, (_, i) => (
              <span key={i} className={cx('bk-rt-d', i < on && 'is-on')}>
                {person && <PersonIcon />}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 흐름 칸의 숫자들. 쉼표나 띄어쓰기로 나눈다. '1,200'처럼 천 단위 쉼표가 든 숫자는 하나로 본다
 * (그래서 천 단위 숫자를 이어 적을 때는 쉼표 뒤를 띄어 쓴다: 1,200, 1,500). 단위를 섞어 적었으면('9,500만, 1.2억') 같은 자리로 맞춘다
 */
export function seriesOf(text: string): number[] {
  return seriesIn(tokensOf(text)).values.filter((v): v is number => v !== null)
}

/** 숫자와 흐름: 지금 숫자를 크게, 그동안의 흐름은 작은 선으로. 선 끝이 지금 숫자다 */
function Spark() {
  const { mode } = useSlide()
  const { demo, read } = useDemo(['value', 'series'])
  const pts = seriesOf(read('series')).slice(-24)
  const lo = Math.min(...pts)
  const hi = Math.max(...pts)
  // 위아래 끝의 점이 잘리지 않게 띄우는 것은 그림 상자가 한다 (blocks.css의 .bk-sp-svg): 여기서는 위아래를 다 쓴다
  const at = pts.map((v, i) => ({ x: (i / Math.max(1, pts.length - 1)) * 100, y: hi === lo ? 50 : 100 - ((v - lo) / (hi - lo)) * 100 }))
  const line = at.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  const last = at[at.length - 1]
  return (
    <div className={cx('bk-sp', demo && 'is-demo')}>
      <div className="bk-sp-text">
        <T k="label" className="bk-sp-l" />
        <T k="value" className="bk-sp-v" oneLine numeral />
        <T k="note" className="bk-sp-n" />
      </div>
      <div className="bk-sp-chart">
        {pts.length >= 2 && (
          <>
            <svg className="bk-sp-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d={line} />
            </svg>
            <span className="bk-sp-dot" style={{ '--x': last.x, '--y': last.y } as CSSProperties} aria-hidden="true" />
          </>
        )}
        {/* 흐름 숫자는 편집할 때 그림 자리에서 고친다(올리거나 누르면 숫자가 보인다). 발표 화면에는 선만.
            그림 아래에 줄을 따로 두면 편집 화면에서만 부품이 높아져 글자가 작아진다 */}
        {mode === 'edit' && <T k="series" className="bk-sp-s on-chart" />}
      </div>
    </div>
  )
}

/** 개요: 항목과 내용을 짝지은 줄 */
function Facts() {
  const { slide } = useSlide()
  const items = slide.items.slice(0, BLOCKS.facts.items!.max)
  return (
    <div className="bk-fc">
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <dl className="bk-fc-list" data-n={items.length}>
        {items.map((it, i) => (
          <div key={it.id} className="it bk-fc-row">
            <IT i={i} k="title" as="dt" className="bk-fc-k" />
            <IT i={i} k="body" as="dd" className="bk-fc-v" multiline />
            <ItemTools i={i} />
          </div>
        ))}
      </dl>
    </div>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  )
}

/** 걱정과 대책: 걱정되는 점 옆에 막는 방법. 대책이 '답'이라 강조색은 대책 쪽에만 */
function Risks() {
  const { slide } = useSlide()
  const items = slide.items.slice(0, BLOCKS.risks.items!.max)
  return (
    <div className="bk-rk">
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <div className="bk-rk-head" aria-hidden="true">
        <span className="bk-rk-hk">걱정되는 점</span>
        <span className="bk-rk-hk is-fix">대책</span>
      </div>
      <ul className="bk-rk-list" data-n={items.length}>
        {items.map((it, i) => (
          <li key={it.id} className="it bk-rk-row">
            <IT i={i} k="title" className="bk-rk-t" multiline />
            <span className="bk-rk-arrow" aria-hidden="true">
              <ArrowIcon />
            </span>
            <IT i={i} k="body" className="bk-rk-b" multiline />
            <ItemTools i={i} />
          </li>
        ))}
      </ul>
    </div>
  )
}

const SWOT = ['S', 'W', 'O', 'T']

/** 강점과 약점(SWOT): 위는 안(강점, 약점), 아래는 밖(기회, 위협). 칸 이름 글자(S, W, O, T)는 옅게 */
function Swot() {
  const { slide } = useSlide()
  const items = slide.items.slice(0, BLOCKS.swot.items!.max)
  return (
    <div className="bk-sw">
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <ul className="bk-sw-grid">
        {items.map((it, i) => (
          <li key={it.id} className="it bk-sw-q">
            <div className="bk-sw-top">
              <span className="bk-sw-k" aria-hidden="true">
                {SWOT[i]}
              </span>
              <IT i={i} k="title" className="bk-sw-t" />
            </div>
            <IT i={i} k="body" className="bk-sw-b" multiline />
            <ItemTools i={i} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 예상 질문: 질문과 짧은 답 */
function Faq() {
  const { slide } = useSlide()
  const items = slide.items.slice(0, BLOCKS.faq.items!.max)
  return (
    <div className="bk-qa">
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <dl className="bk-qa-list" data-n={items.length}>
        {items.map((it, i) => (
          <div key={it.id} className="it bk-qa-item">
            <dt className="bk-qa-q">
              <span className="bk-qa-k" aria-hidden="true">
                Q
              </span>
              <IT i={i} k="title" className="bk-qa-qt" multiline />
            </dt>
            <dd className="bk-qa-a">
              <IT i={i} k="body" className="bk-qa-at" multiline />
            </dd>
            <ItemTools i={i} />
          </div>
        ))}
      </dl>
    </div>
  )
}

function StatusMark({ status }: { status: Status | null }) {
  return (
    <span className="bk-ck-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32">
        {status === 'done' ? (
          <>
            <circle className="bk-ck-fill" cx="16" cy="16" r="15" />
            <path className="bk-ck-glyph" d="M9.5 16.5l4.2 4.2 8.8-9.2" />
          </>
        ) : status === 'late' ? (
          <>
            <circle className="bk-ck-fill" cx="16" cy="16" r="15" />
            <path className="bk-ck-glyph" d="M16 8.5v9M16 22.6v.4" />
          </>
        ) : status === 'doing' ? (
          <>
            <circle className="bk-ck-ring" cx="16" cy="16" r="13.5" />
            <path className="bk-ck-fill" d="M16 6.5a9.5 9.5 0 0 1 0 19z" />
          </>
        ) : (
          <circle className="bk-ck-ring" cx="16" cy="16" r="13.5" />
        )}
      </svg>
    </span>
  )
}

/** 준비 상황: 할 일마다 상태 표시. 상태 글(완료, 진행 중, 지연, 예정)을 읽어 표시를 고르고, 글은 그대로 보인다 */
function Checks() {
  const { slide } = useSlide()
  const items = slide.items.slice(0, BLOCKS.checks.items!.max)
  const states = items.map((it) => statusOf(it.body, null))
  const done = states.filter((s) => s === 'done').length
  return (
    <div className="bk-ck">
      <div className="bk-ck-top">
        <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
        {states.some((s) => s !== null) && (
          <p className="bk-ck-sum">
            {items.length}개 중 <b>{done}개</b> 완료
          </p>
        )}
      </div>
      <ul className="bk-ck-list" data-n={items.length}>
        {items.map((it, i) => (
          <li key={it.id} className={cx('it bk-ck-row', states[i] && `is-${states[i]}`)}>
            <StatusMark status={states[i]} />
            <div className="bk-ck-text">
              <IT i={i} k="title" className="bk-ck-t" />
              <IT i={i} k="meta" className="bk-ck-m" />
            </div>
            <IT i={i} k="body" className="bk-ck-s" />
            <ItemTools i={i} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * 추진 일정: 기간 칸을 위에 늘어놓고 할 일마다 그 기간에 막대를 긋는다.
 * 지금 칸을 적으면 지난 일은 흐리게, 하는 일은 강조색, 앞으로 할 일은 옅은 강조색으로 나눠 칠한다
 */
function Gantt() {
  const { slide, mode } = useSlide()
  const { demo, read } = useDemo(['cols'])
  const cols = colsOf(read('cols'))
  const now = spanIn(read('now'), cols)?.[0] ?? -1
  const items = slide.items.slice(0, BLOCKS.gantt.items!.max)
  // 기간이 비어 있으면 편집할 때만 안내 기간으로 흐린 막대를 보인다
  const periodOf = (i: number) => items[i].body.trim() || (mode === 'final' ? '' : hintFor(slide.layout, slide.hints, 'body', 'body', i))
  return (
    <div className={cx('bk-gt', demo && 'is-demo')} style={{ '--n': Math.max(1, cols.length), '--now': now } as CSSProperties}>
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <div className="bk-gt-grid">
        {now >= 0 && <span className="bk-gt-now" aria-hidden="true" />}
        {/* 편집할 때는 비어 있는 왼쪽 위에 지금 칸을 적고, 기간 칸 이름은 그 자리 위에서 고친다(올리거나 누르면 글이 보인다).
            편집 때만 줄이 늘면 발표 화면과 높이가 달라 글자가 작아진다 */}
        <div className="bk-gt-head">
          {mode === 'edit' ? (
            <div className="bk-gt-nowset">
              <span className="bk-gt-sk">지금</span>
              <T k="now" as="span" className="bk-gt-sv" />
            </div>
          ) : (
            <span />
          )}
          <div className="bk-gt-colwrap">
            <div className="bk-gt-cols">
              {cols.map((c, i) => (
                <span key={i} className={cx('bk-gt-c', i === now && 'is-now')}>
                  {c}
                </span>
              ))}
            </div>
            {mode === 'edit' && <T k="cols" className="bk-gt-sv bk-gt-colsed on-chart" oneLine />}
          </div>
        </div>
        <ul className="bk-gt-list" data-n={items.length}>
          {items.map((it, i) => {
            const period = periodOf(i)
            const span = spanIn(period, cols)
            const state = !span || now < 0 ? null : span[1] < now ? 'done' : span[0] > now ? 'later' : 'now'
            // 막대가 기간을 보여 주므로, 기간 글은 칸 이름 말고 더 적은 것이 있을 때만 ('12월 2주~2월 1주', '내년 상반기')
            const more = !span || periodRest(period, cols) !== ''
            return (
              <li key={it.id} className={cx('it bk-gt-row', state && `is-${state}`, !it.body.trim() && 'is-hint')}>
                <div className="bk-gt-label">
                  <IT i={i} k="title" className="bk-gt-t" />
                  <IT i={i} k="meta" className="bk-gt-m" />
                  {more && (mode === 'edit' ? <span className="bk-gt-p">{period}</span> : <IT i={i} k="body" className="bk-gt-p" />)}
                </div>
                {/* 편집할 때 기간은 막대 자리에서 고친다 (위의 기간 칸 이름과 같이) */}
                <div className="bk-gt-track">
                  {span && <span className="bk-gt-bar" style={{ '--s': span[0], '--e': span[1] + 1 } as CSSProperties} />}
                  {mode === 'edit' && <IT i={i} k="body" className="bk-gt-p on-chart" oneLine />}
                </div>
                <ItemTools i={i} />
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

/** 맡은 사람: 이름 첫 글자를 동그라미에. 사진은 받지 않는다(사람 사진을 발표 파일에 담지 않게) */
function People() {
  const { slide, mode } = useSlide()
  const items = slide.items.slice(0, BLOCKS.people.items!.max)
  return (
    <div className="bk-pp">
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <ul className="bk-pp-list" data-n={items.length}>
        {items.map((it, i) => {
          const initial = [...it.title.trim()][0]
          return (
            <li key={it.id} className="it bk-pp-card">
              <span className={cx('bk-pp-av', !initial && 'is-blank')} aria-hidden="true">
                {initial ?? (mode === 'final' ? null : <PersonIcon />)}
              </span>
              <div className="bk-pp-text">
                <IT i={i} k="title" className="bk-pp-name" />
                <IT i={i} k="meta" className="bk-pp-role" />
                <IT i={i} k="body" className="bk-pp-b" multiline />
              </div>
              <ItemTools i={i} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** 평가표의 표시: 꽉 찬 원(좋음), 반 찬 원(보통), 빈 원(나쁨). 보고서에서 흔히 쓰는 하비 볼 */
function GradeMark({ grade, className = 'bk-ev-mk' }: { grade: Grade; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      {grade === 'good' ? (
        <circle className="bk-ev-fill" cx="16" cy="16" r="14" />
      ) : (
        <>
          <circle className="bk-ev-ring" cx="16" cy="16" r="12.75" />
          {grade === 'mid' && <path className="bk-ev-fill" d="M16 3.25a12.75 12.75 0 0 1 0 25.5z" />}
        </>
      )}
    </svg>
  )
}

const GRADE_NAMES: [Grade, string][] = [
  ['good', '좋음'],
  ['mid', '보통'],
  ['bad', '나쁨'],
]

/**
 * 평가표: 기준마다 여러 안을 좋음, 보통, 나쁨으로. 안 이름을 위에 늘어놓고 기준마다 평가 글을 안 차례로 읽는다.
 * 추천하는 안을 적으면 그 안의 세로 띠와 표시만 강조색 (추진 일정의 지금 칸처럼)
 */
function Rating() {
  const { slide, mode } = useSlide()
  const { demo, read } = useDemo(['opts', 'pick'])
  const opts = colsOf(read('opts')).slice(0, 5)
  const pick = spanIn(read('pick'), opts)?.[0] ?? -1
  const items = slide.items.slice(0, BLOCKS.rating.items!.max)
  // 평가가 비어 있으면 편집할 때만 안내 평가로 흐린 표시를 보인다
  const marksOf = (i: number) => gradesOf(items[i].body.trim() || (mode === 'final' ? '' : hintFor(slide.layout, slide.hints, 'body', 'body', i)))
  const graded = items.some((_, i) => marksOf(i).some((g) => gradeOf(g)))
  return (
    <div className={cx('bk-ev', demo && 'is-demo')} style={{ '--n': Math.max(1, opts.length), '--pick': pick } as CSSProperties}>
      <div className="bk-ev-top">
        <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
        {graded && (
          <p className="bk-ev-lg">
            {GRADE_NAMES.map(([g, name]) => (
              <span key={g} className="bk-ev-lk">
                <GradeMark grade={g} className="bk-ev-lm" />
                {name}
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="bk-ev-grid">
        {pick >= 0 && <span className="bk-ev-band" aria-hidden="true" />}
        <div className="bk-ev-head">
          {mode === 'edit' ? (
            <div className="bk-ev-pickset">
              <span className="bk-ev-sk">추천</span>
              <T k="pick" as="span" className="bk-ev-sv" />
            </div>
          ) : (
            <span />
          )}
          <div className="bk-ev-colwrap">
            <div className="bk-ev-cols">
              {opts.map((o, j) => (
                <span key={j} className={cx('bk-ev-c', j === pick && 'is-pick')}>
                  {j === pick && <span className="bk-ev-pk">추천</span>}
                  <span className="bk-ev-cn">{o}</span>
                </span>
              ))}
            </div>
            {mode === 'edit' && <T k="opts" className="bk-ev-sv bk-ev-optsed on-chart" oneLine />}
          </div>
        </div>
        <ul className="bk-ev-list" data-n={items.length}>
          {items.map((it, i) => {
            const marks = marksOf(i)
            return (
              <li key={it.id} className={cx('it bk-ev-row', !it.body.trim() && 'is-hint')}>
                <div className="bk-ev-label">
                  <IT i={i} k="title" className="bk-ev-t" />
                  <IT i={i} k="meta" className="bk-ev-m" />
                </div>
                {/* 편집할 때 평가 글은 표시 자리에서 고친다 (위의 안 이름과 같이) */}
                <div className="bk-ev-track">
                  {opts.map((_, j) => {
                    const g = marks[j] ? gradeOf(marks[j]) : null
                    return (
                      <span key={j} className={cx('bk-ev-cell', j === pick && 'is-pick')}>
                        {g ? <GradeMark grade={g} /> : marks[j] ? <span className="bk-ev-x">{marks[j]}</span> : null}
                      </span>
                    )
                  })}
                  {mode === 'edit' && <IT i={i} k="body" className="bk-ev-p on-chart" oneLine />}
                </div>
                <ItemTools i={i} />
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

/**
 * 시장 규모: 전체 시장, 공략할 시장, 목표를 바닥에 맞춰 겹친 원으로. 원의 크기는 규모에 비례하지 않는다
 * (전체 시장은 목표의 백 배가 넘기 일쑤라 비례하면 목표가 점이 된다). 규모는 옆 목록의 큰 숫자로 읽는다
 */
function Market() {
  const { slide } = useSlide()
  const items = slide.items.slice(0, BLOCKS.market.items!.max)
  return (
    <div className="bk-mk" data-n={items.length}>
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <div className="bk-mk-body">
        <div className="bk-mk-box" aria-hidden="true">
          <div className="bk-mk-fig">
            {items.map((it, i) => (
              <span key={it.id} className="bk-mk-c" style={{ '--i': i } as CSSProperties} />
            ))}
          </div>
        </div>
        <ol className="bk-mk-list">
          {items.map((it, i) => (
            <li key={it.id} className="it bk-mk-row" style={{ '--i': i } as CSSProperties}>
              <span className="bk-mk-sw" aria-hidden="true" />
              <div className="bk-mk-text">
                <IT i={i} k="title" className="bk-mk-t" />
                <IT i={i} k="value" className="bk-mk-v" />
                <IT i={i} k="body" className="bk-mk-b" multiline />
              </div>
              <ItemTools i={i} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// ---------- 세로 막대 차트 (원인 순위, 기간별 달성, 쌓은 막대) ----------
// 항목마다 칸 하나(.bk-cc-col)가 그래프 줄과 이름 줄을 subgrid로 나눠 쓴다. 막대 길이는 --p(0~100)로만 넘기고,
// 막대 위 숫자 자리는 CSS가 칸 높이에서 뺀다. 편집할 때 숫자는 막대 위 그 자리에서 고친다

/** 몫을 보이는 꼴: 10% 밑은 소수 한 자리, 1% 밑은 '1% 미만' */
function pctText(p: number): string {
  if (p > 0 && p < 1) return '1% 미만'
  return `${formatNumber(p < 10 ? Math.round(p * 10) / 10 : Math.round(p))}%`
}

/** 칸 위의 한 줄: 요점(계산한 말), 표시 설명, 단위. 단위 칸은 편집할 때만 비어 있어도 보인다 */
function ChartKey({ sum, keys, unitKey = 'unit' }: { sum?: ReactNode; keys?: ReactNode; unitKey?: string }) {
  const { slide, meta, mode, folds } = useSlide()
  const unit = readField(slide, meta, unitKey).trim()
  // 비어서 접힌 칸이면 '단위:'만 남지 않게 줄째 뺀다 ('칸 더하기'로 열면 보인다)
  const showUnit = !!unit || (mode !== 'final' && !folds?.has(unitKey))
  if (!sum && !keys && !showUnit) return null
  return (
    <div className="bk-cc-key">
      {sum && <p className="bk-cc-sum">{sum}</p>}
      {keys}
      {showUnit && (
        <span className="bk-cc-u">
          {unitKey === 'unit' ? '단위: ' : ''}
          <T k={unitKey} as="span" oneLine />
        </span>
      )}
    </div>
  )
}

/**
 * 원인 순위(파레토): 막대는 전체에서 그 원인이 차지하는 몫, 선은 앞에서부터 더한 몫. 둘이 같은 눈금(전체 = 100)이라
 * 눈금 하나로 읽는다(눈금 둘을 겹치지 않는다). 더한 몫이 80%에 닿기까지의 원인이 먼저 잡을 원인이라 강조색, 나머지는 회색.
 * 원인은 적은 차례 그대로 둔다. 장 위에서 순서를 바꾼 대로 보여야 해서 저절로 줄 세우지 않는다(안내에 '많은 것부터')
 */
function Pareto() {
  const { slide, meta, mode } = useSlide()
  const items = slide.items.slice(0, BLOCKS.pareto.items!.max)
  const final = mode === 'final'
  const demo = !final && items.every((it) => !it.value.trim())
  const series = seriesIn(
    items.map((it, i) => (demo ? hintFor(slide.layout, slide.hints, 'value', 'value', i) : it.value)),
    readField(slide, meta, 'unit'),
  )
  const values = series.values.map((v) => Math.max(0, v ?? 0))
  const total = values.reduce((a, b) => a + b, 0)
  const share = values.map((v) => (total > 0 ? (v / total) * 100 : 0))
  const cum: number[] = []
  share.forEach((p, i) => cum.push((cum[i - 1] ?? 0) + p))
  // 단위가 서로 다른 값('3건', '40%')을 더한 몫은 틀린 숫자라 먼저 잡을 원인과 몫을 말하지 않는다
  const vital = total > 0 && series.ok ? cum.filter((_, i) => (cum[i - 1] ?? 0) < 80).length : 0
  const n = items.length
  // 점은 막대 칸의 오른쪽 끝: 그 칸까지 더한 몫. 가운데에 찍으면 첫 점이 첫 막대의 숫자 위에 앉는다
  const x = (i: number) => ((i + 1) / n) * 100
  const line = cum.map((c, i) => `${x(i).toFixed(2)},${(100 - c).toFixed(2)}`).join(' ')
  // 몇 개가 거의 다인지가 요점. 모두가 80% 안이면 몰린 곳이 없어서 말하지 않는다
  const sum =
    vital > 0 && vital < n ? (
      <>
        {vital === 1 ? '가장 많은 하나가' : `상위 ${vital}개가`} 전체의 <b>{pctText(cum[vital - 1])}</b>
      </>
    ) : undefined
  return (
    <div className={cx('bk-cc bk-pa', demo && 'is-demo')} style={{ '--n': n } as CSSProperties}>
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <ChartKey
        sum={sum}
        keys={
          <span className="bk-cc-lk is-line">
            <i aria-hidden="true" />
            누적 비율
          </span>
        }
      />
      <div className="bk-cc-plot">
        {total > 0 && (
          <div className="bk-pa-canvas" aria-hidden="true">
            <svg className="bk-pa-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline points={line} />
            </svg>
            {cum.map((c, i) => (
              <span key={items[i].id} className={cx('bk-pa-pt', i === vital - 1 && vital < n && 'is-cut')} style={{ '--x': x(i).toFixed(2), '--y': c.toFixed(2) } as CSSProperties}>
                {i === vital - 1 && vital < n && <span className="bk-pa-cut">{pctText(c)}</span>}
              </span>
            ))}
          </div>
        )}
        {items.map((it, i) => (
          // 칸 자리를 적어 둔다: 선 그림이 첫 줄 전체를 차지해서, 적지 않으면 막대 칸이 그 옆 새 칸으로 밀려난다
          <div key={it.id} className={cx('it bk-cc-col', i < vital && 'is-hl')} style={{ '--p': share[i].toFixed(2), gridColumn: i + 1 } as CSSProperties}>
            <div className="bk-cc-bar">
              <span className="bk-cc-v">
                <IT i={i} k="value" as="span" className="bk-cc-num" oneLine />
              </span>
              <span className="bk-cc-fill" />
            </div>
            <div className="bk-cc-label">
              <IT i={i} k="title" className="bk-cc-name" />
            </div>
            <ItemTools i={i} />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * 기간별 달성: 기간마다 실적 막대와 목표 표시(가로 줄). 목표를 넘은 기간만 강조색이고 못 미친 기간은 회색이라
 * 어느 달이 모자랐는지가 먼저 보인다. 막대 위에 실적과 목표 숫자를, 이름 아래에 달성률을 붙인다
 */
function Attain() {
  const { slide, meta, mode } = useSlide()
  const items = slide.items.slice(0, BLOCKS.attain.items!.max)
  const final = mode === 'final'
  const demo = !final && items.every((it) => !it.value.trim() && !it.meta.trim())
  const text = (k: 'value' | 'meta', i: number) => (demo ? hintFor(slide.layout, slide.hints, k, k, i) : items[i][k])
  // 실적과 목표를 한 기준으로 읽는다. 단위가 서로 다른 값이 섞였으면 달성과 달성률은 말하지 않고 막대만 그린다
  const series = seriesIn([...items.map((_, i) => text('value', i)), ...items.map((_, i) => text('meta', i))], readField(slide, meta, 'unit'))
  const actual = series.values.slice(0, items.length)
  const goal = series.values.slice(items.length)
  const top = Math.max(0, ...actual.map((v) => v ?? 0), ...goal.map((v) => v ?? 0))
  const y = (v: number | null) => (v === null || top <= 0 ? 0 : (Math.max(0, v) / top) * 100)
  const met = items.map((_, i) => (actual[i] === null || goal[i] === null || !series.ok ? null : actual[i]! >= goal[i]!))
  const judged = met.filter((m) => m !== null).length
  const hit = met.filter((m) => m === true).length
  return (
    <div
      className={cx('bk-cc bk-tg', demo && 'is-demo', items.length <= 6 && items.every((it) => [...it.title.trim()].length <= 4) && 'is-short')}
      style={{ '--n': items.length } as CSSProperties}
    >
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <ChartKey
        sum={
          judged > 1 ? (
            <>
              {judged}번 중 <b>{hit}번</b> 달성
            </>
          ) : undefined
        }
        keys={
          <>
            <span className="bk-cc-lk is-bar">
              <i aria-hidden="true" />
              실적
            </span>
            <span className="bk-cc-lk is-goal">
              <i aria-hidden="true" />
              목표
            </span>
          </>
        }
      />
      <div className="bk-cc-plot">
        {items.map((it, i) => {
          const rate = actual[i] !== null && goal[i] && series.ok ? Math.round((actual[i]! / goal[i]!) * 100) : null
          return (
            <div
              key={it.id}
              className={cx('it bk-cc-col', met[i] === true && 'is-hl', met[i] === false && 'is-miss')}
              style={{ '--p': y(actual[i]).toFixed(2), '--g': y(goal[i]).toFixed(2), '--m': Math.max(y(actual[i]), y(goal[i])).toFixed(2) } as CSSProperties}
            >
              <div className="bk-cc-bar bk-tg-bar">
                <span className="bk-cc-fill" />
                {(goal[i] !== null || !final) && <span className="bk-tg-goal" aria-hidden="true" />}
                {/* 목표 숫자는 편집할 때만 막대 위에서 적는다. 발표할 때는 목표 줄과 달성률로 읽혀서, 기간마다 숫자 둘을 늘어놓지 않는다 */}
                <span className="bk-tg-v">
                  <IT i={i} k="value" as="span" className="bk-cc-num" oneLine />
                  {mode === 'edit' && (
                    <span className="bk-tg-g">
                      목표 <IT i={i} k="meta" as="span" className="bk-tg-gv" oneLine />
                    </span>
                  )}
                </span>
              </div>
              <div className="bk-cc-label">
                <IT i={i} k="title" className="bk-cc-name" />
                {rate !== null && <span className="bk-tg-rate">{formatNumber(rate)}%</span>}
              </div>
              <ItemTools i={i} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** 쌓은 막대의 나눈 것 이름. 이름 안에 띄어 쓰기가 있을 수 있어서('제품 A') 쉼표, 가운뎃점, 빗금으로만 나눈다 */
export function partsOf(text: string): string[] {
  return text
    .split(/\s*[,·/|]\s*/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, STACK_TINTS.length)
}

/** 쌓은 막대의 칸 색: 맨 아래(첫째)가 강조색, 위로 갈수록 옅게. 칸 사이는 바탕색 틈으로 나눈다 */
const STACK_TINTS = [100, 62, 38, 22, 12]

/**
 * 쌓은 막대: 기간마다 합계 막대 하나를 나눈 것마다 칸으로 쌓는다. 값 그대로는 합계의 크기를, 100%로는 구성의 변화를 본다.
 * 칸 안의 숫자는 칸이 충분히 클 때만(작은 칸에 넣으면 칸 밖으로 넘친다)
 */
function Stack() {
  const { slide, meta, mode } = useSlide()
  const items = slide.items.slice(0, BLOCKS.stack.items!.max)
  const final = mode === 'final'
  const demo = !final && items.every((it) => !it.value.trim())
  const partsText = readField(slide, meta, 'parts').trim() || (final ? '' : hintFor(slide.layout, slide.hints, 'parts'))
  const parts = partsOf(partsText)
  const pct = slide.variant === 'pct'
  const width = parts.length || STACK_TINTS.length
  // 막대끼리도 키를 견주므로 모든 막대의 값을 한 기준으로 읽는다 ('1.2억, 8,000만'이면 1.2와 0.8)
  const cells = items.map((it, i) =>
    tokensOf(demo ? hintFor(slide.layout, slide.hints, 'value', 'value', i) : it.value)
      .filter((t) => readAmount(t) !== null)
      .slice(0, width),
  )
  const series = seriesIn(cells.flat(), readField(slide, meta, 'unit'))
  let at = 0
  const rows = cells.map((r) => r.map(() => Math.max(0, series.values[at++] ?? 0)))
  const totals = rows.map((r) => r.reduce((a, b) => a + b, 0))
  const top = Math.max(0, ...totals)
  const tint = (j: number) => `color-mix(in srgb, var(--accent) ${STACK_TINTS[j]}%, var(--bg))`
  return (
    <div className={cx('bk-cc bk-st', demo && 'is-demo')} style={{ '--n': items.length } as CSSProperties}>
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <ChartKey
        keys={
          <span className="bk-st-keywrap">
            <span className="bk-st-keys">
              {parts.map((p, j) => (
                <span key={j} className="bk-cc-lk" style={{ '--c': tint(j) } as CSSProperties}>
                  <i aria-hidden="true" />
                  {p}
                </span>
              ))}
            </span>
            {/* 나눈 것 이름은 표시 줄 위에서 고친다 (올리거나 누르면 글이 보인다). 편집 때만 줄이 늘면 발표 화면과 높이가 달라진다 */}
            {mode === 'edit' && <T k="parts" className="bk-st-partsed on-chart" oneLine />}
          </span>
        }
      />
      <div className="bk-cc-plot">
        {items.map((it, i) => {
          const sum = totals[i]
          const p = pct ? (sum > 0 ? 100 : 0) : top > 0 ? (sum / top) * 100 : 0
          return (
            <div key={it.id} className="it bk-cc-col" style={{ '--p': p.toFixed(2) } as CSSProperties}>
              <div className="bk-cc-bar bk-st-bar">
                <span className="bk-cc-v">
                  {/* 단위는 그래프 위에 한 번만 (막대마다 되풀이하지 않는다). 단위가 서로 다른 값을 더한 합은 보이지 않는다 */}
                  {sum > 0 && series.ok && <span className="bk-cc-num">{formatNumber(sum)}</span>}
                </span>
                <span className="bk-cc-fill bk-st-stack">
                  {rows[i].map((v, j) => {
                    const of = sum > 0 ? (v / sum) * 100 : 0
                    // 칸 안 숫자는 그 칸이 막대 높이에서 차지하는 몫이 충분할 때만. 칸이 숫자보다 낮으면 CSS가 숨긴다
                    const room = (of * p) / 100 >= 6 && series.ok
                    return v > 0 ? (
                      <span key={j} className={cx('bk-st-seg', j === 0 && 'is-base')} style={{ flexGrow: v, background: tint(j) } as CSSProperties}>
                        {room && <span className="bk-st-n">{pct ? pctText(of) : formatNumber(v)}</span>}
                      </span>
                    ) : null
                  })}
                </span>
                {mode === 'edit' && <IT i={i} k="value" className="bk-st-in on-chart" oneLine />}
              </div>
              <div className="bk-cc-label">
                <IT i={i} k="title" className="bk-cc-name" />
              </div>
              <ItemTools i={i} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 항목별 증감: 0을 세로 선으로 두고 늘어난 것은 오른쪽, 줄어든 것은 왼쪽으로 뻗는다. 0의 자리는 양쪽 가장 큰 값의 비율로 옮겨
 * (모두 늘었으면 왼쪽 끝) 빈 반쪽이 생기지 않게 한다. 늘어난 것이 좋은지(매출) 나쁜지(비용)는 장마다 달라서 강조할 쪽을 고른다
 */
function Diverge() {
  const { slide, mode } = useSlide()
  const items = slide.items.slice(0, BLOCKS.diverge.items!.max)
  const final = mode === 'final'
  const demo = !final && items.every((it) => !it.value.trim())
  // 막대 길이끼리 견주므로 한 기준으로 ('+1.2억', '−4,000만')
  const values = seriesIn(items.map((it, i) => (demo ? hintFor(slide.layout, slide.hints, 'value', 'value', i) : it.value))).values
  const known = values.filter((v): v is number => v !== null)
  const pos = Math.max(0, ...known)
  const neg = Math.max(0, ...known.map((v) => -v))
  const range = pos + neg || 1
  const z = (neg / range) * 100
  const down = slide.variant === 'down'
  return (
    <div className={cx('bk-dv', demo && 'is-demo', neg > 0 && 'has-neg', pos > 0 && 'has-pos')} style={{ '--z': z.toFixed(2) } as CSSProperties}>
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <ChartKey unitKey="basis" />
      <ul className="bk-dv-list" data-n={items.length}>
        {items.map((it, i) => {
          const v = values[i]
          const side = v === null || v === 0 ? null : v > 0 ? 'pos' : 'neg'
          const hl = side !== null && (side === 'neg') === down
          return (
            <li
              key={it.id}
              className={cx('it bk-dv-row', side && `is-${side}`, hl && 'is-hl', v === null && 'is-blank')}
              style={{ '--p': v === null ? 0 : ((Math.abs(v) / range) * 100).toFixed(2) } as CSSProperties}
            >
              <IT i={i} k="title" className="bk-dv-name" />
              <div className="bk-dv-track">
                <div className="bk-dv-scale">
                  <span className="bk-dv-axis" aria-hidden="true" />
                  {side && <span className="bk-dv-bar" aria-hidden="true" />}
                  <span className="bk-dv-v">
                    <IT i={i} k="value" as="span" className="bk-dv-num" oneLine />
                  </span>
                </div>
              </div>
              <ItemTools i={i} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * 칸마다의 값 글. 흐름 칸(seriesOf)처럼 나누되, 숫자가 없는 칸('-', '없음')도 제자리를 지켜 그 칸을 비운다.
 * 숫자 뒤에 띄어 쓴 단위('42 억')는 앞 숫자에 붙인다
 */
function tokensOf(text: string): string[] {
  const out: string[] = []
  for (const tok of text.split(/[\s/·|]+|,\s+/)) {
    if (!tok) continue
    const parts = /^[-−–△▼+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(tok) ? [tok] : tok.split(',').filter(Boolean)
    for (const p of parts) {
      if (/\d/.test(p) || /^([-−–—.x×?]+|없음)$/.test(p) || !out.length) out.push(p)
      else out[out.length - 1] += ` ${p}`
    }
  }
  return out
}

/** 숫자 글: 빼기 기호로 바꾸고, 붙여 쓴 단위('58억')는 두 단계 작은 글자로 뗀다 (fields.tsx의 Shown과 같은 꼴) */
function Numeral({ text }: { text: string }) {
  const t = minusSigns(text)
  const p = splitNumber(t)
  if (!p) return <>{t}</>
  return (
    <>
      {p.num}
      <span className="u">{p.unit}</span>
    </>
  )
}

/** 색 표의 칸 수: 열두 달까지 */
const HEAT_COLS = 12

/**
 * 색 표(히트맵): 줄(지점)과 칸(월)으로 놓인 값을 강조색의 진하기 하나로 칠한다. 가장 낮은 값이 가장 옅고 가장 높은 값이 강조색 그대로.
 * 칸 안 숫자의 색은 칸의 진하기(--t)로 CSS가 고른다(blocks.css). 표 전체에서 견주면 가장 높은 칸과 낮은 칸에 고리를 두르고
 * 위에 어디인지 적는다. 줄마다 견주면(지표마다 단위가 다를 때) 줄마다 제 눈금이라 고리를 두르지 않는다.
 * 색만으로는 값을 읽지 못해서 칸마다 숫자를 그대로 둔다. 그래서 진하기를 읽는 눈금 띠는 두지 않는다
 */
function Heat() {
  const { slide, meta, mode } = useSlide()
  const items = slide.items.slice(0, BLOCKS.heat.items!.max)
  const final = mode === 'final'
  const demo = !final && items.every((it) => !it.value.trim())
  const colsText = readField(slide, meta, 'cols').trim()
  const names = colsOf(colsText || (final ? '' : hintFor(slide.layout, slide.hints, 'cols')))
  const rows = items.map((it, i) => tokensOf(demo ? hintFor(slide.layout, slide.hints, 'value', 'value', i) : it.value).slice(0, HEAT_COLS))
  const c = Math.max(1, Math.min(HEAT_COLS, Math.max(names.length, ...rows.map((r) => r.length))))
  const byRow = slide.variant === 'rows'
  // 표 전체에서 견주면 표 전체를, 줄마다 견주면(지표마다 단위가 다를 때) 줄마다 한 기준으로 읽는다
  const unit = readField(slide, meta, 'unit')
  const cellTexts = rows.map((r) => Array.from({ length: c }, (_, j) => r[j] ?? ''))
  const table = seriesIn(cellTexts.flat(), unit)
  const nums = byRow ? cellTexts.map((r) => seriesIn(r, unit).values) : cellTexts.map((_, i) => table.values.slice(i * c, (i + 1) * c))
  const rangeOf = (vs: (number | null)[]) => {
    const k = vs.filter((v): v is number => v !== null)
    return k.length ? { lo: Math.min(...k), hi: Math.max(...k) } : null
  }
  const all = rangeOf(nums.flat())
  // 진하기 0~1. 줄의 값이 모두 같으면 가운데 진하기
  const shade = nums.map((r) => {
    const g = byRow ? rangeOf(r) : all
    return r.map((v) => (v === null || !g ? null : g.hi === g.lo ? 0.5 : (v - g.lo) / (g.hi - g.lo)))
  })
  // 가장 높은 칸과 낮은 칸: 같은 값이 여럿이면 먼저 나온 칸. 값이 다 같으면 짚지 않는다
  const find = (v: number): [number, number] | null => {
    for (let i = 0; i < nums.length; i++) for (let j = 0; j < c; j++) if (nums[i][j] === v) return [i, j]
    return null
  }
  // 단위가 서로 다른 칸이 섞인 표에서 가장 높은 곳과 낮은 곳은 틀린 말이라 짚지 않는다
  const marks = !byRow && table.ok && !!all && all.hi > all.lo
  const top = marks ? find(all.hi) : null
  const low = marks ? find(all.lo) : null
  const is = (p: [number, number] | null, i: number, j: number) => !!p && p[0] === i && p[1] === j
  const rowName = (i: number) => items[i].title.trim() || (final ? '' : hintFor(slide.layout, slide.hints, 'title', 'title', i))
  const where = (p: [number, number] | null) => (p ? [rowName(p[0]), names[p[1]] ?? ''].filter(Boolean).join(' ') : '')
  const topAt = where(top)
  const lowAt = where(low)
  return (
    <div className={cx('bk-cc bk-hm', demo && 'is-demo')} style={{ '--c': c } as CSSProperties}>
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <ChartKey
        sum={
          topAt && lowAt ? (
            <>
              가장 높은 곳 <b>{topAt}</b>
              <span className="bk-hm-low">가장 낮은 곳 {lowAt}</span>
            </>
          ) : undefined
        }
      />
      <div className="bk-hm-grid">
        {names.length > 0 && (
          <div className={cx('bk-hm-head', !colsText && 'is-hint')}>
            <span />
            {Array.from({ length: c }, (_, j) => (
              <span key={j} className="bk-hm-cn">
                {names[j] && (
                  <span className="bk-hm-ct one-line" style={{ '--units': textUnits(names[j]).toFixed(2) } as CSSProperties}>
                    {names[j]}
                  </span>
                )}
              </span>
            ))}
            {/* 칸 이름은 이름 줄 위에서 고친다 (올리거나 누르면 글이 보인다). 편집 때만 줄이 늘면 발표 화면과 높이가 달라진다 */}
            {mode === 'edit' && <T k="cols" className="bk-hm-colsed on-chart" oneLine />}
          </div>
        )}
        <ul className="bk-hm-list" data-n={items.length}>
          {items.map((it, i) => (
            <li key={it.id} className="it bk-hm-row">
              <IT i={i} k="title" className="bk-hm-name" />
              {shade[i].map((v, j) => {
                const text = rows[i][j] ?? ''
                const mark = is(top, i, j) ? 'is-max' : is(low, i, j) ? 'is-min' : null
                return (
                  <span key={j} className={cx('bk-hm-cell', v === null && 'is-empty', mark)} style={v === null ? undefined : ({ '--t': v.toFixed(3) } as CSSProperties)}>
                    {v !== null && (
                      <span className="bk-hm-v one-line" style={{ '--units': numberUnits(text).toFixed(2) } as CSSProperties}>
                        <Numeral text={text} />
                      </span>
                    )}
                    {mark && <span className="bk-hm-ring" aria-hidden="true" />}
                  </span>
                )
              })}
              {/* 줄의 값은 칸들 위에서 고친다 */}
              {mode === 'edit' && <IT i={i} k="value" className="bk-hm-in on-chart" oneLine />}
              <ItemTools i={i} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** 숫자 글의 소수 자리 수 */
const decimalsOf = (t: string) => /\.(\d+)/.exec(t)?.[1].length ?? 0

/** 지표 흐름표의 바뀐 만큼: 지금 값(뒤 값)의 자리와 단위로 센 차이. 단위가 %면 %p. 견줄 수 없는 단위끼리면 null */
function stepOf(from: string, to: string, unit: string): { text: string; dir: number } | null {
  const p = amountPair(from, to, unit)
  if (!p) return null
  // 소수 자리는 적은 값을 따른다. 두 값의 자리가 다르면('9,500만 → 1.2억'은 0.25억) 둘째 자리까지
  const k = 10 ** (p.a.scale === p.b.scale ? Math.min(2, Math.max(decimalsOf(from), decimalsOf(to))) : 2)
  const d = Math.round(((p.b.base - p.a.base) / p.b.scale) * k) / k
  // 단위 칸이 비었으면 지금 값에 붙여 쓴 자리와 단위('58억')를 그대로
  return { text: `${formatNumber(Math.abs(d))}${p.kind === '%' ? '%p' : unit || p.b.suffix}`, dir: Math.sign(d) }
}

/**
 * 지표 흐름표: 지표마다 그동안의 흐름을 작은 선으로 긋고, 지금 값(흐름의 마지막)과 바뀐 만큼을 나란히 둔다. 선은 지표마다 제 눈금이라
 * 크기와 단위가 다른 지표(억 원, %)를 한 표에 둔다. 강조색은 지금(선 끝의 점과 지금 값)에만. 오른 것이 좋은지(매출) 나쁜지(불량률)는
 * 지표마다 달라서 바뀐 만큼은 색 없이 ▲▼로. 칸은 줄마다 같은 자리에 오게 표 하나의 격자를 나눠 쓴다(subgrid, blocks.css)
 */
function Sparks() {
  const { slide, mode, folds } = useSlide()
  const items = slide.items.slice(0, BLOCKS.sparks.items!.max)
  const final = mode === 'final'
  const demo = !final && items.every((it) => !it.value.trim())
  const first = slide.variant === 'first'
  // 단위 칸은 편집할 때 지금 값 옆에서 적는다. 모두 비어 접혀 있으면(칸 더하기로 연다) 적은 단위나 예시 단위를 그대로 보인다
  const unitField = mode === 'edit' && !folds?.has('items.meta')
  return (
    <div className={cx('bk-sx', demo && 'is-demo')}>
      <T k="heading" as="h3" className="bk-h" fit={[18, 32]} multiline />
      <div className="bk-sx-table">
        <div className="bk-sx-head">
          <span />
          <T k="period" as="span" className="bk-sx-hk bk-sx-period" />
          <span className="bk-sx-hk is-now">지금</span>
          <span className="bk-sx-hk is-chg">{first ? '처음보다' : '바로 앞보다'}</span>
        </div>
        {/* 넓은 칸에서 두 단으로 흘릴 때 오른쪽 단의 머리 (blocks.css). 기간은 왼쪽 머리에서만 고친다 */}
        <div className="bk-sx-head is-more" aria-hidden="true">
          <span />
          <span className="bk-sx-hk bk-sx-period">{slide.fields.period?.trim()}</span>
          <span className="bk-sx-hk is-now">지금</span>
          <span className="bk-sx-hk is-chg">{first ? '처음보다' : '바로 앞보다'}</span>
        </div>
        <ul className="bk-sx-list" data-n={items.length}>
          {items.map((it, i) => {
            const toks = tokensOf(demo ? hintFor(slide.layout, slide.hints, 'value', 'value', i) : it.value).slice(-24)
            const unit = it.meta.trim() || (demo ? hintFor(slide.layout, slide.hints, 'meta', 'meta', i) : '')
            // 줄 안에서 자리를 섞어 적었으면('9,500만, 1.2억') 한 기준으로 맞춰 선을 긋는다
            const vs = seriesIn(toks, unit).values
            const pts = toks.flatMap((t, j) => {
              const v = vs[j]
              return v === null ? [] : [{ j, v, t }]
            })
            const lo = Math.min(...pts.map((p) => p.v))
            const hi = Math.max(...pts.map((p) => p.v))
            // 위아래 끝의 점이 칸 밖으로 나가지 않게 조금 띄운다. 비어 있는 자리('-')는 그 자리를 건너뛰어 잇는다
            const at = pts.map((p) => ({ x: (p.j / Math.max(1, toks.length - 1)) * 100, y: hi === lo ? 50 : 88 - ((p.v - lo) / (hi - lo)) * 76 }))
            const line = at.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
            const last = pts[pts.length - 1]
            const base = first ? pts[0] : pts[pts.length - 2]
            const step = last && base && base !== last ? stepOf(base.t, last.t, unit) : null
            const end = at[at.length - 1]
            return (
              <li key={it.id} className="it bk-sx-row">
                <IT i={i} k="title" className="bk-sx-name" />
                <div className="bk-sx-plot">
                  {pts.length > 1 && (
                    <svg className="bk-sx-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      <path d={line} />
                    </svg>
                  )}
                  {end && <span className="bk-sx-dot" style={{ '--x': end.x.toFixed(2), '--y': end.y.toFixed(2) } as CSSProperties} aria-hidden="true" />}
                  {/* 흐름 숫자는 선 자리에서 고친다 (올리거나 누르면 숫자가 보인다) */}
                  {mode === 'edit' && <IT i={i} k="value" className="bk-sx-in on-chart" oneLine />}
                </div>
                <span className="bk-sx-now">
                  {last && (
                    <span className="bk-sx-v">
                      <Numeral text={last.t} />
                    </span>
                  )}
                  {/* 단위는 숫자보다 두 단계 작게 */}
                  {unitField ? <IT i={i} k="meta" as="span" className="bk-sx-u" /> : unit && last && <span className="bk-sx-u">{unit}</span>}
                </span>
                <span className="bk-sx-chg">{step && (step.dir === 0 ? '그대로' : `${step.dir > 0 ? '▲' : '▼'} ${step.text}`)}</span>
                <ItemTools i={i} />
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

/**
 * 이미지. 꽉 채우기는 칸을 다 덮고(넘치는 쪽을 자른다), 전체 보이기는 이미지 비율 그대로 칸 안에서 가장 크게 그린다.
 * 비율은 파일 머리에서 읽어 둬서(imageSize) 내보낸 HTML도 자바스크립트 없이 같은 크기로 그린다
 */
function Picture() {
  const { slide } = useSlide()
  const contain = slide.variant === 'contain'
  const size = contain ? imageSize(slide.fields.image ?? '') : null
  return (
    <figure className={cx('bk-img', size && 'is-fit')} style={size ? ({ '--ar': size.w / size.h } as CSSProperties) : undefined}>
      <ImageSlot k="image" className="bk-img-i" contain={contain} />
      <T k="caption" as="figcaption" className="bk-img-c" />
    </figure>
  )
}

const NATIVE_VIEWS: Record<NativeBlockType, () => ReactNode> = {
  message: Message,
  text: Text,
  bullets: Bullets,
  quote: Quote,
  callout: Callout,
  number: BigNumber,
  delta: Delta,
  goal: Goal,
  ring: Ring,
  ratio: Ratio,
  spark: Spark,
  facts: Facts,
  risks: Risks,
  swot: Swot,
  faq: Faq,
  checks: Checks,
  gantt: Gantt,
  people: People,
  image: Picture,
  rating: Rating,
  market: Market,
  pareto: Pareto,
  attain: Attain,
  diverge: Diverge,
  stack: Stack,
  heat: Heat,
  sparks: Sparks,
}

// ---------- 부품 하나 ----------

const FOLDS = new Map<BlockType, ReadonlySet<string>>()

/** 부품에서 비어 있으면 접어 두는 칸 (deck/blocks.ts의 foldableFields) */
function foldsOf(type: BlockType): ReadonlySet<string> {
  let m = FOLDS.get(type)
  if (!m) FOLDS.set(type, (m = new Set(foldableFields(type).map((f) => f.key))))
  return m
}

function BlockBody({ block, span }: { block: Block; span: number }) {
  const ctx = useSlide()
  const opened = useContext(BlockEditContext)?.opened
  // 편집기에서 '칸 더하기'로 연 칸은 비어 있어도 그린다
  const folds = useMemo(() => {
    const all = foldsOf(block.type)
    return opened?.size ? new Set([...all].filter((k) => !opened.has(`${block.id} ${k}`))) : all
  }, [block.type, block.id, opened])
  const spec = BLOCKS[block.type]
  const outer = ctx.actions
  const inner = useMemo(() => blockSlide(ctx.slide, block), [ctx.slide, block])
  const actions = useMemo<SlideActions | undefined>(() => {
    const update = outer?.updateBlock
    if (!outer || !update) return undefined
    return {
      // 발표 전체의 값($org 같은)은 부품이 아니라 발표에 적는다. 이미지를 넣으면 그 줄의 칸 너비도 이미지에 맞춘다
      setField: (k, v) =>
        k.startsWith('$')
          ? outer.setField(k, v)
          : block.type === 'image' && k === 'image' && v && outer.placeImage
            ? outer.placeImage(block.id, v)
            : update(block.id, (b) => ({ ...b, fields: { ...b.fields, [k]: v } }), `${block.id}.${k}`),
      setItem: (i, k, v) => update(block.id, (b) => ({ ...b, items: b.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) }), `${block.id}.${i}.${k}`),
      removeItem: (i) => update(block.id, (b) => ({ ...b, items: b.items.filter((_, j) => j !== i) })),
      moveItem: (from, to, key) =>
        update(
          block.id,
          (b) => {
            const highlight = followIndex(b.highlight, from, to)
            return { ...b, items: moveIn(b.items, from, to), ...(highlight !== undefined ? { highlight } : {}) }
          },
          key,
        ),
    }
  }, [outer, block.id, block.type])
  const View = spec.layout ? LAYOUT_VIEWS[spec.layout] : NATIVE_VIEWS[block.type as NativeBlockType]
  return (
    <SlideContext.Provider
      value={{
        ...ctx,
        slide: inner,
        actions,
        canRemoveItem: !!spec.items && blockItems(block).length > spec.items.min,
        fieldPrefix: blockFieldPrefix(block.id),
        folds,
        span,
      }}
    >
      <div className="bk-in">
        <View />
      </div>
    </SlideContext.Provider>
  )
}

/** 칸 둘레의 이음표: 그 쪽으로 칸이 비켜 이음표가 설 자리를 낸다 (blocks.css의 .lk-r, .lk-l, .lk-b, .lk-t) */
function linkSides(rows: BlockRow[], box: CellBox): string[] {
  const out: string[] = []
  if (linkAt(rows, { dir: 'h', row: box.row, col: box.col })) out.push('lk-r')
  if (box.col > 0 && linkAt(rows, { dir: 'h', row: box.row, col: box.col - 1 })) out.push('lk-l')
  if (linkAt(rows, { dir: 'v', row: box.row })) out.push('lk-b')
  if (box.row > 0 && linkAt(rows, { dir: 'v', row: box.row - 1 })) out.push('lk-t')
  // 칸 사이에 이음표가 선 줄: 이음표가 줄 가운데에 서니 그 줄의 부품도 가운데에 (위에 붙이면 이음표만 아래에 떠 보인다)
  if (rows[box.row]?.blocks.some((_, c) => linkAt(rows, { dir: 'h', row: box.row, col: c }))) out.push('lk-row')
  return out
}

/** 이음표의 모양. 줄 사이의 화살표는 아래를 본다 */
export function LinkGlyph({ link }: { link: BlockLink }) {
  if (link === 'versus') return <span className="bk-link-vs">vs</span>
  return (
    <svg viewBox="0 0 48 48">
      {link === 'arrow' ? (
        <path d="M9 24h28M27 13l11 11-11 11" />
      ) : link === 'plus' ? (
        <path d="M24 11v26M11 24h26" />
      ) : (
        <path d="M11 18.5h26M11 29.5h26" />
      )}
    </svg>
  )
}

/**
 * 칸 사이와 줄 사이의 이음표. 칸 사이는 왼쪽 칸의 자리에, 줄 사이는 위 줄의 자리에 붙여 그 바깥 간격 가운데에 세운다.
 * 떠 있는(absolute) 격자 자식은 끝 줄을 auto로 두면 격자 끝까지 늘어나서 끝을 span 1로 정한다
 */
function Links({ rows, boxes, live }: { rows: BlockRow[]; boxes: CellBox[]; live: BlockEdit | null }) {
  // after: 발표할 때 이 부품 다음에 나타난다 (칸 사이는 왼쪽 부품, 줄 사이는 위 줄의 마지막 부품)
  const marks: { key: string; t: LinkTarget; link: BlockLink; area: React.CSSProperties; after: string; side?: string }[] = []
  for (const b of boxes) {
    const t: LinkTarget = { dir: 'h', row: b.row, col: b.col }
    const link = linkAt(rows, t)
    // 줄 사이에도 이음표가 있으면 칸이 위아래로 비켜 있어서, 칸 사이의 이음표도 칸의 가운데로 옮긴다
    const below = !!linkAt(rows, { dir: 'v', row: b.row })
    const above = b.row > 0 && !!linkAt(rows, { dir: 'v', row: b.row - 1 })
    const side = below && !above ? 'lk-up' : above && !below ? 'lk-down' : undefined
    if (link) marks.push({ key: `h${b.rowId}-${b.col}`, t, link, area: { gridRow: `${b.row + 1} / span 1`, gridColumn: `${b.start + 1} / span ${b.span}` }, after: b.block.id, side })
  }
  rows.forEach((r, i) => {
    const t: LinkTarget = { dir: 'v', row: i }
    const link = linkAt(rows, t)
    if (link) marks.push({ key: `v${r.id}`, t, link, area: { gridRow: `${i + 1} / span 1`, gridColumn: '1 / -1' }, after: r.blocks[r.blocks.length - 1].id })
  })
  return (
    <>
      {marks.map((m) => {
        const name = BLOCK_LINKS.find((l) => l.id === m.link)!.name
        const preview = !!live?.linkPreview && sameLinkTarget(live.linkPreview.target, m.t)
        return (
          <span
            key={m.key}
            className={cx('bk-link', `lk-${m.t.dir}`, m.side, `is-${m.link}`, preview && 'is-preview', !!live && sameLinkTarget(live.selectedLink, m.t) && 'is-selected')}
            style={m.area}
            data-link={m.t.dir === 'h' ? `h${m.t.row}-${m.t.col}` : `v${m.t.row}`}
            data-after={m.after}
            {...(live && !preview
              ? { role: 'button', 'aria-label': `이음표: ${name}`, title: `${name} (눌러서 바꾸거나 빼기)`, onPointerDown: (e: React.PointerEvent<HTMLElement>) => live.onLinkPointerDown(e, m.t) }
              : { 'aria-hidden': true })}
          >
            <span className="bk-link-g">
              <LinkGlyph link={m.link} />
            </span>
          </span>
        )
      })}
    </>
  )
}

function BlockCell({ box, live, rows }: { box: CellBox; live: BlockEdit | null; rows: BlockRow[] }) {
  const b = box.block
  const spec = BLOCKS[b.type]
  const look = shownLook(b, box.cols)
  const slot = live?.dragId === b.id
  const selected = !!live && live.selected === b.id && !live.dragId
  return (
    <div
      className={cx(
        'bk',
        ...linkSides(rows, box),
        `bk-${b.type}`,
        `bk-look-${look}`,
        `fx-${effectOf(b)}`,
        spec.layout && 'bk-layout',
        `va-${variantOfBlock(b)}`,
        box.cols > 1 && 'is-shared',
        selected && 'is-selected',
        slot && 'is-slot',
      )}
      style={cellStyle(box)}
      data-block={b.id}
      data-type={b.type}
      data-row={box.row}
      onPointerDown={live && !slot ? (e) => live.onCellPointerDown(e, b) : undefined}
    >
      {slot ? <div className="bk-slot" aria-hidden="true" /> : <BlockBody block={b} span={box.span} />}
      {/* 끌어서 옮기는 손잡이: 칸 왼쪽 위에 붙는 이름표. 글 칸이 부품을 거의 덮어도 잡을 데가 있게 */}
      {live && !slot && (
        <span className="bk-handle" title="끌어서 옮기기" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M9 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm6 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-6 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm6 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-6 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm6 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
          </svg>
          {spec.name}
        </span>
      )}
    </div>
  )
}

/** 줄 안의 칸 사이마다 너비를 바꾸는 손잡이. 놓으면 정해진 비율 가운데 가장 가까운 것에 붙는다 */
function Gutters({ rows, boxes, live }: { rows: BlockRow[]; boxes: CellBox[]; live: BlockEdit }) {
  return (
    <>
      {boxes
        .filter((b) => b.col > 0)
        .map((b) => (
          <div
            key={`${b.rowId}-${b.col}`}
            // 이음표가 선 사이는 손잡이 선이 이음표를 가로지르지 않게 가운데를 비운다
            className={cx('bk-gutter', linkAt(rows, { dir: 'h', row: b.row, col: b.col - 1 }) && 'has-link')}
            style={{ gridRow: String(b.row + 1), gridColumn: `${b.start + 1} / span 1` }}
            role="separator"
            aria-label="컴포넌트 너비 바꾸기"
            title="끌어서 컴포넌트 너비 바꾸기"
            onPointerDown={(e) => live.onGutterPointerDown(e, b.rowId, b.col - 1)}
          >
            <span className="bk-gutter-grip" />
          </div>
        ))}
    </>
  )
}

/** 줄 사이마다 높이를 나누는 손잡이. 끌면 위아래 줄이 높이를 나눠 갖고(24분의 1에 붙는다), 두 번 누르면 똑같이 */
function RowGaps({ rows, live }: { rows: BlockRow[]; live: BlockEdit }) {
  return (
    <>
      {Array.from({ length: rows.length - 1 }, (_, i) => (
        <div
          key={i}
          className={cx('bk-rowgap', linkAt(rows, { dir: 'v', row: i }) && 'has-link')}
          style={{ gridRow: String(i + 2), gridColumn: '1 / -1' }}
          role="separator"
          aria-orientation="horizontal"
          aria-label="줄 높이 바꾸기"
          title="끌어서 줄 높이 바꾸기 (두 번 누르면 똑같이)"
          onPointerDown={(e) => live.onRowGapPointerDown(e, i)}
          onDoubleClick={() => live.onRowGapReset()}
        >
          <span className="bk-rowgap-grip" />
        </div>
      ))}
    </>
  )
}

type Box = { x: number; y: number; w: number; h: number }

/** 칸들이 지금 화면에 보이는 자리 (움직이는 중이면 움직이는 중의 자리). 캔버스 px, 본문 상자 기준 */
function visualBoxes(area: HTMLElement): Map<string, Box> {
  const a = area.getBoundingClientRect()
  const k = area.offsetWidth ? a.width / area.offsetWidth : 1
  const out = new Map<string, Box>()
  for (const el of area.querySelectorAll<HTMLElement>(':scope > .bk')) {
    const r = el.getBoundingClientRect()
    out.set(el.dataset.block!, { x: (r.left - a.left) / k, y: (r.top - a.top) / k, w: r.width / k, h: r.height / k })
  }
  return out
}

/** 편집할 때 칸이 자리를 옮기면 원래 자리에서 새 자리로 미끄러지게 (FLIP). 새로 생긴 칸은 제자리에서 맞춰 들어온다 */
const FLIP_EASING =
  'linear(0, 0.0576, 0.1409, 0.2066, 0.3123, 0.4188, 0.5204, 0.6135, 0.6697, 0.7445, 0.8079, 0.8604, 0.9029, 0.9261, 0.9543, 0.9755, 0.991, 1.0019, 1.007, 1.0122, 1.0151, 1.0162, 1.0161, 1.0156, 1.0143, 1.0127, 1.011, 1.0093, 1.0082, 1.0066, 1.0052, 1.004, 1.003, 1.0025, 1.0017, 1.0011, 1.0007, 1.0004, 1.0002, 1, 1)'

function useFlip(area: React.RefObject<HTMLDivElement | null>, on: boolean, key: string) {
  const before = useRef<Map<string, Box> | null>(null)
  // 그리기 전에(아직 옛 모습일 때) 지금 보이는 자리를 재 둔다
  if (on && area.current) before.current = visualBoxes(area.current)
  useLayoutEffect(() => {
    const el = area.current
    const first = before.current
    before.current = null
    if (!on || !el || !first || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    for (const cell of el.querySelectorAll<HTMLElement>(':scope > .bk')) {
      const id = cell.dataset.block!
      const f = first.get(id)
      cell.getAnimations().forEach((a) => a.cancel())
      const last = { x: cell.offsetLeft, y: cell.offsetTop, w: cell.offsetWidth, h: cell.offsetHeight }
      if (!f) {
        cell.animate([{ opacity: 0, scale: '0.94' }, { opacity: 1, scale: '1' }], { duration: 420, easing: FLIP_EASING })
        continue
      }
      const dx = f.x - last.x
      const dy = f.y - last.y
      const dw = f.w - last.w
      const dh = f.h - last.h
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(dw) < 1 && Math.abs(dh) < 1) continue
      // 자리는 미끄러지고, 크기는 늘이지 않는다(가로세로를 다르게 늘이면 글자가 찌그러져 보인다).
      // 커지는 칸은 옛 크기만큼 보이던 데서 새 크기로 펼쳐지고, 작아지는 칸은 새 크기로 바로 바뀐 채 미끄러진다
      const round = getComputedStyle(cell).borderTopLeftRadius || '0px'
      const clip = (w: number, h: number) => `inset(0 ${Math.max(0, last.w - w)}px ${Math.max(0, last.h - h)}px 0 round ${round})`
      const grow = dw < -1 || dh < -1
      cell.animate(
        [
          { translate: `${dx}px ${dy}px`, ...(grow ? { clipPath: clip(f.w, f.h) } : {}) },
          { translate: '0 0', ...(grow ? { clipPath: clip(last.w, last.h) } : {}) },
        ],
        { duration: 470, easing: FLIP_EASING },
      )
    }
  }, [key, on, area])
}

export function BlockArea() {
  const { slide, mode } = useSlide()
  const edit = useContext(BlockEditContext)
  const live = mode === 'edit' && edit ? edit : null
  // 발표할 때는 비워 둔 부품을 빼고 그린다 (남은 부품이 줄을 채운다)
  const known = knownRows(slide.rows ?? [])
  const saved = live?.rows ?? (mode === 'final' ? shownRows(known) : known)
  // 이음표를 끄는 동안에는 놓일 자리에 흐리게 미리 세운다 (양쪽 칸이 비켜 나는 것까지)
  const rows = live?.linkPreview ? withLink(saved, live.linkPreview.target, live.linkPreview.link) : saved
  const boxes = cellBoxes(rows)
  const ref = useRef<HTMLDivElement | null>(null)
  // 자리가 바뀔 때만: 줄마다 부품 id와 칸 너비
  const key = rows
    .map((r) => {
      const spans = spansOf(r)
      return `${r.blocks.map((b, i) => `${b.id}:${blockMinH(b, spans[i])}:${b.link ?? ''}`).join(',')}|${spans.join(',')}|${r.link ?? ''}`
    })
    .join('/')
  // 넘치는 부품 맞추기는 자리 옮기는 움직임(useFlip)이 끝자리를 재기 전에
  useLayoutEffect(() => {
    if (ref.current) fitBlocks(ref.current)
  })
  useEffect(() => {
    let on = true
    const fit = () => on && ref.current && fitBlocks(ref.current)
    document.fonts?.ready.then(fit)
    // 그릴 때 안 보이던 장이 보이게 되거나, 제목이 두 줄이 되어 본문 상자가 낮아지면 다시 맞춘다.
    // 맞추기는 칸 안만 바꾸고 본문 상자의 크기는 바꾸지 않아서 되풀이되지 않는다
    const ro = typeof ResizeObserver === 'undefined' || !ref.current ? null : new ResizeObserver(fit)
    if (ref.current) ro?.observe(ref.current)
    return () => {
      on = false
      ro?.disconnect()
    }
  }, [])
  useFlip(ref, !!live, key)
  const setRef = (el: HTMLDivElement | null) => {
    ref.current = el
    live?.areaRef(el)
  }
  return (
    <div
      ref={setRef}
      className={cx('bk-area', live && 'is-live', live?.dragId && 'is-dragging', !rows.length && 'is-empty')}
      style={rows.length ? areaStyle(rows) : undefined}
      data-rows={rows.length}
      data-mins={rows.length ? rowMins(rows) : undefined}
    >
      {!rows.length && mode !== 'final' && (live ? live.empty() : <p className="bk-empty-t">컴포넌트를 골라 넣어 꾸미는 장이에요</p>)}
      {boxes.map((box) => (
        <BlockCell key={box.block.id} box={box} live={live} rows={rows} />
      ))}
      <Links rows={rows} boxes={boxes} live={live} />
      {live && !live.dragId && <Gutters rows={rows} boxes={boxes} live={live} />}
      {live && !live.dragId && rows.length > 1 && <RowGaps rows={rows} live={live} />}
      {live?.incoming && <div className="bk-incoming" aria-hidden="true" />}
    </div>
  )
}

/** 부품 장. 머리(제목, 부제)는 비우면 발표할 때 자리를 차지하지 않는다 */
export function Compose() {
  return (
    <>
      <header className="s-head">
        <T k="title" as="h2" className="s-title" fit={[24, 40]} multiline />
        <T k="lead" as="p" className="s-lead" multiline />
      </header>
      <BlockArea />
      <T k="source" className="s-source" />
    </>
  )
}
