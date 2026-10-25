// 여러 부품이 같이 쓰는 조각: 빈 칸의 예시 값, 사람 모양, 차트 범례, 값 나누기, 숫자 글자

import type { ReactNode } from 'react'
import { readField } from '../../deck/fields'
import { hintFor } from '../../deck/layouts'
import { useSlide } from '../context'
import { minusSigns, splitNumber, T } from '../fields'
import { formatNumber } from '../numbers'

/** 편집할 때 비어 있으면 안내 문구의 예시 숫자로 흐리게 그린다. 발표할 때는 적은 값만 */
export function useDemo(keys: string[]) {
  const { slide, meta, mode } = useSlide()
  const demo = mode !== 'final' && keys.every((k) => !readField(slide, meta, k).trim())
  const read = (k: string) => (demo ? hintFor(slide.layout, slide.hints, k) : readField(slide, meta, k))
  return { demo, read }
}

export function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="7" r="4.6" />
      <path d="M3.2 22c0-5 3.9-8.6 8.8-8.6s8.8 3.6 8.8 8.6z" />
    </svg>
  )
}

/** 몫을 보이는 꼴: 10% 밑은 소수 한 자리, 1% 밑은 '1% 미만' */
/**
 * 여는 따옴표(“)를 그림으로. 글꼴의 따옴표는 고딕에서는 가는 빗금 둘로 작게 보이고, 명조(본문 한글 글꼴)에서는 한 글자 폭의
 * 오른쪽 반에 그려져 글 왼쪽 선보다 안으로 들어가 떠 보였다. 그림이면 글꼴과 상관없이 같은 모양이 글의 왼쪽 선에 맞는다
 */
export function QuoteMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 39 26" aria-hidden="true">
      <path d="M15.5 1C6.5 2.8 1 9.4 1 18a7 7 0 1 0 7-7c.6-3.7 3.2-6.4 7.9-7.9Z" />
      <path d="M37.5 1C28.5 2.8 23 9.4 23 18a7 7 0 1 0 7-7c.6-3.7 3.2-6.4 7.9-7.9Z" />
    </svg>
  )
}

export function pctText(p: number): string {
  if (p > 0 && p < 1) return '1% 미만'
  return `${formatNumber(p < 10 ? Math.round(p * 10) / 10 : Math.round(p))}%`
}

/** 칸 위의 한 줄: 요점(계산한 말), 표시 설명, 단위. 단위 칸은 편집할 때만 비어 있어도 보인다 */
export function ChartKey({ sum, keys, unitKey = 'unit' }: { sum?: ReactNode; keys?: ReactNode; unitKey?: string }) {
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
 * 칸마다의 값 글. 흐름 칸(seriesOf)처럼 나누되, 숫자가 없는 칸('-', '없음')도 제자리를 지켜 그 칸을 비운다.
 * 숫자 뒤에 띄어 쓴 단위('42 억')는 앞 숫자에 붙인다
 */
export function tokensOf(text: string): string[] {
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
export function Numeral({ text }: { text: string }) {
  const t = minusSigns(text)
  const p = splitNumber(t)
  if (!p) return <>{t}</>
  return (
    <>
      {p.pre && <span className="u u-pre">{p.pre}</span>}
      {p.num}
      {p.unit && <span className="u">{p.unit}</span>}
    </>
  )
}
