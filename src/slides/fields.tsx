import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ElementType } from 'react'
import { isBlankItem, readField } from '../deck/fields'
import { hintFor, labelIn, LAYOUTS } from '../deck/layouts'
import type { ItemKey } from '../deck/types'
import { cx } from '../lib/cx'
import { imageToDataUrl, pickImage } from '../lib/imageFile'
import { keys } from '../lib/keys'
import { frameRect } from './blockFrame'
import { useSlide } from './context'
import { startItemDrag } from './itemDrag'

/** [a, b]: 글자 수가 a를 넘으면 한 단계, b를 넘으면 두 단계 작게. 길이 기준이라 내보낸 파일에서도 같다. */
type Fit = [number, number]

function fitClass(text: string, fit?: Fit): string {
  if (!fit) return ''
  const n = [...text].length
  return n > fit[1] ? 'fit-2' : n > fit[0] ? 'fit-1' : ''
}

/** 굵은 Pretendard 기준으로 어림한 글자 폭(em). 고정폭 숫자로 재어서 비례폭 숫자(큰 숫자)에는 조금 넉넉하다 */
function glyphWidth(text: string): number {
  let w = 0
  for (const ch of text) {
    // 고딕 굵은 글씨, 고정폭 숫자(tabular-nums)를 재어 본 폭 (em)
    if (/[㄰-㆏가-힣一-鿿]/.test(ch)) w += 0.86
    else if (/[0-9]/.test(ch)) w += 0.64
    else if (/[A-Z%]/.test(ch)) w += ch === '%' ? 0.96 : 0.66
    else if (/[a-z]/.test(ch)) w += 0.54
    else if (/[.,:;'!|]/.test(ch)) w += 0.26
    else if (/\s/.test(ch)) w += 0.26
    else w += 0.6
  }
  return w * 1.04
}

/** 한 줄짜리 숫자 칸이 칸 너비를 넘지 않게 글자 크기를 정하는 데 쓰는 폭(em) */
export function textUnits(text: string): number {
  return Math.max(1, glyphWidth(text))
}

/*
 * 숫자의 꼴. 저장한 글은 그대로 두고 그릴 때만 바꾼다 (docs/DESIGN.md '숫자의 꼴').
 * - 큰 숫자(핵심 숫자, 사례의 성과, 안 비교의 비용)는 숫자와 단위를 나눠 단위를 글자 크기 두 단계 작게.
 *   '1,200시간'의 '시간'처럼 한글 단위는 숫자만큼 넓고 무거워서, 같은 크기면 답(숫자)보다 단위가 먼저 읽힌다.
 * - '-3%'의 붙임표(-)는 빼기 기호(−)로. 붙임표는 소문자 높이에 맞춘 짧은 선이라 숫자 옆에서 낮고 짧아 보인다.
 */

/** 단위 글자의 크기: 숫자보다 두 단계(1.2²) 작게. slides.css의 `.slide .u`와 같은 값이다 (fields.test.ts가 본다) */
export const UNIT_K = 1 / 1.44

/** 글 처음이나 띄어쓰기, 여는 괄호, 물결 뒤에서 숫자 바로 앞에 붙은 붙임표(-)와 줄표(–)를 빼기 기호(U+2212)로. '2026-10-25', 'A-1'은 그대로 */
export function minusSigns(text: string): string {
  return text.replace(/(^|[\s(~∼/])[-–](?=\d)/g, '$1−')
}

/**
 * 숫자 하나(범위 '2~3'까지)와 그 뒤의 짧은 단위. 앞에는 부호나 화폐 기호, 또는 띄어 쓴 짧은 한글 덧말('약', '하루', '월')만.
 * 이 꼴이 아니면 나누지 않고 그대로 그린다
 */
const NUMBER_PARTS = /^([가-힣]{1,3} )?([+\-−–±▲▼△▽$₩€£¥]?\s?\d[\d,]*(?:\.\d+)?(?:\s?[~∼–-]\s?[+\-−]?\d[\d,]*(?:\.\d+)?)?)(\D{0,8})$/

/**
 * '1,200시간' → 숫자 '1,200', 단위 '시간'. '하루 10분' → 앞말 '하루 ', 숫자 '10', 단위 '분'.
 * 앞말도 단위도 없거나 숫자 하나의 꼴이 아니면 null
 */
export function splitNumber(text: string): { pre?: string; num: string; unit: string } | null {
  const m = NUMBER_PARTS.exec(text)
  if (!m || (!m[1] && !m[3].trim())) return null
  return m[1] ? { pre: m[1], num: m[2], unit: m[3] } : { num: m[2], unit: m[3] }
}

/** 단위를 작게 그리는 큰 숫자의 폭(em). 나란한 숫자들이 같은 크기를 고를 때 쓴다 */
export function numberUnits(text: string): number {
  const t = text.trim()
  const parts = splitNumber(t)
  if (!parts) return textUnits(t)
  return Math.max(1, glyphWidth(parts.num) + glyphWidth((parts.pre ?? '') + parts.unit) * UNIT_K)
}

interface TextProps {
  as?: ElementType
  className?: string
  fit?: Fit
  multiline?: boolean
  /** 줄바꿈 없이 한 줄로 두고, 길면 칸 너비에 맞게 줄인다 */
  oneLine?: boolean
  /** 한 장 안의 숫자들을 같은 크기로 맞출 때 가장 긴 값의 폭 */
  units?: number
  /** 큰 숫자: 숫자 뒤의 단위('시간', '억 원', '%')를 두 단계 작게 그린다. 편집할 때도 같은 꼴로 보인다 */
  numeral?: boolean
  /**
   * 여러 줄 칸이어도 Enter는 다음 항목으로 (줄바꿈은 Shift+Enter). 점 목록의 요점처럼 항목 하나가 한 줄인 목록에. 한 줄 칸의 항목은 늘 그렇다.
   * 강점 칸(SWOT)처럼 한 항목 안에 여러 줄을 쓰는 칸은 Enter가 줄바꿈이다
   */
  enterNext?: boolean
}

function oneLineProps(text: string, oneLine?: boolean, units?: number, numeral?: boolean) {
  if (!oneLine) return { cls: '', style: undefined }
  return { cls: 'one-line', style: { '--units': (units ?? (numeral ? numberUnits(text) : textUnits(text))).toFixed(2) } }
}

/**
 * 숫자 뒤의 기호(%, ℃ 같은)와 거기 붙은 조사가 줄 끝에서 갈리지 않게 묶을 낱말: '18%보다', '3℃나'.
 * 브라우저는 줄을 낱말 단위로 꺾어도(keep-all) '%' 같은 뒤붙이 기호 다음은 꺾을 수 있는 자리로 보아서,
 * 좁은 칸이나 크게, 명조에서 '본부 평균 18% / 보다 높아요'처럼 숫자와 조사가 두 줄로 갈렸다
 */
const GLUED = /[^\s]*[%‰℃℉°][가-힣]+/g

/** 글을 그대로 둔 채 묶을 낱말만 떼어 낸 조각들. 묶을 것이 없으면 null */
export function gluedParts(text: string): (string | { nb: string })[] | null {
  const found = [...text.matchAll(GLUED)]
  if (!found.length) return null
  const out: (string | { nb: string })[] = []
  let at = 0
  for (const m of found) {
    if (m.index! > at) out.push(text.slice(at, m.index))
    out.push({ nb: m[0] })
    at = m.index! + m[0].length
  }
  if (at < text.length) out.push(text.slice(at))
  return out
}

/** 묶을 낱말은 줄을 꺾지 않는 조각(.nb)에. 글자는 하나도 바꾸지 않는다 */
function Glued({ text }: { text: string }) {
  const parts = gluedParts(text)
  if (!parts) return <>{text}</>
  return <>{parts.map((p, i) => (typeof p === 'string' ? p : <span key={i} className="nb">{p.nb}</span>))}</>
}

/** 발표 화면의 글: 빼기 기호를 바로 쓰고, 큰 숫자면 단위를 작은 글자로 떼어 낸다 */
function Shown({ text, numeral }: { text: string; numeral?: boolean }) {
  const t = minusSigns(text)
  const parts = numeral ? splitNumber(t) : null
  if (!parts) return <Glued text={t} />
  return (
    <>
      {parts.pre && <span className="u u-pre">{parts.pre}</span>}
      {parts.num}
      {parts.unit && <span className="u">{parts.unit}</span>}
    </>
  )
}

/** 큰 숫자의 앞말, 숫자, 단위를 칸에 넣을 조각으로 (앞말과 단위는 작은 글자) */
function numberNodes(parts: { pre?: string; num: string; unit: string }): (Node | string)[] {
  const span = (text: string, cls: string) => {
    const el = document.createElement('span')
    el.className = cls
    el.textContent = text
    return el
  }
  return [...(parts.pre ? [span(parts.pre, 'u u-pre')] : []), parts.num, ...(parts.unit ? [span(parts.unit, 'u')] : [])]
}

/**
 * 편집 칸에 글을 넣는다. 큰 숫자면 단위를 작은 글자(span)로 떼어 발표 화면과 같은 꼴로 보인다.
 * 글자는 하나도 바꾸지 않아서(빼기 기호도 그대로) 칸의 innerText가 적은 글과 같다
 */
function paint(el: HTMLElement, value: string, numeral?: boolean) {
  const parts = numeral ? splitNumber(value) : null
  // 숫자와 조사를 묶을 낱말이 있으면 발표 화면처럼 줄을 꺾지 않는 조각(.nb)에 (Glued)
  const glued = parts ? null : gluedParts(value)
  if (glued) {
    const next = glued.map((p) => {
      if (typeof p === 'string') return p
      const nb = document.createElement('span')
      nb.className = 'nb'
      nb.textContent = p.nb
      return nb
    })
    if (!sameNodes(el, next)) el.replaceChildren(...next)
    return
  }
  if (!parts) {
    // 처음 그리는 칸(아직 빈 칸)은 innerText를 읽지 않고 바로 넣는다. innerText는 읽을 때마다 화면을 다시 재야 해서(강제 레이아웃),
    // 장을 고를 때 칸마다 읽고 쓰기를 번갈아 하면 칸 수만큼 레이아웃이 돌았다. 빈 칸의 innerText는 ''이라 결과는 같다
    if (!el.firstChild) {
      if (value) el.innerText = value
      return
    }
    if (el.innerText !== value || el.querySelector(':scope > :is(.u, .nb)')) el.innerText = value
    return
  }
  const next = numberNodes(parts)
  if (sameNodes(el, next)) return
  el.replaceChildren(...next)
}

/** 칸의 조각이 이미 이 조각들과 같은지 (같으면 다시 넣지 않는다: 커서와 고른 글이 그대로) */
function sameNodes(el: HTMLElement, next: (Node | string)[]): boolean {
  return (
    el.childNodes.length === next.length &&
    next.every((n, i) => {
      const c = el.childNodes[i]
      return typeof n === 'string' ? c.nodeType === Node.TEXT_NODE && c.nodeValue === n : c instanceof HTMLElement && c.className === (n as HTMLElement).className && c.textContent === n.textContent
    })
  )
}

interface FieldProps extends TextProps {
  value: string
  hint: string
  /** 스크린 리더가 읽는 칸 이름 (labelFor). 없으면 빈칸일 때 안내 문구를 이름으로 */
  label?: string
  fieldId: string
  onChange?: (value: string) => void
  /** 비어 있으면 편집할 때도 그리지 않는 칸 (부품 안의 채우지 않아도 되는 칸) */
  fold?: boolean
  /** 글자 수 단계(fit)를 이 글로 고른다: 목록의 칸은 가장 긴 항목의 글 (IT) */
  fitText?: string
}

function clean(text: string, multiline?: boolean): string {
  const t = text.replace(/ /g, ' ')
  if (!t.trim()) return ''
  return multiline ? t : t.replace(/\s*\n\s*/g, ' ')
}

function Field({ value, hint, label, fieldId, onChange, as: Tag = 'div', className, fit, multiline, oneLine, units, numeral, fold, fitText, enterNext }: FieldProps) {
  const { mode } = useSlide()
  if (mode === 'final') {
    const text = value.trim()
    if (!text) return null
    const one = oneLineProps(text, oneLine, units, numeral)
    return (
      <Tag className={cx(className, fitClass(fitText ?? text, fit), one.cls)} style={one.style}>
        <Shown text={text} numeral={numeral} />
      </Tag>
    )
  }
  // 접어 둔 빈칸은 발표할 때처럼 자리를 차지하지 않는다. 고른 부품의 '칸 더하기'로 연다
  if (fold && !value) return null
  const shown = value || hint
  const one = oneLineProps(shown, oneLine, units, numeral)
  if (mode === 'preview' || !onChange) {
    return (
      <Tag className={cx(className, fitClass(fitText ?? shown, fit), one.cls, !value && 'is-hint')} style={one.style}>
        <Shown text={shown} numeral={numeral} />
      </Tag>
    )
  }
  return (
    <Editable
      value={value}
      hint={hint}
      label={label}
      fieldId={fieldId}
      onChange={onChange}
      as={Tag}
      className={cx(className, fitClass(fitText ?? shown, fit), one.cls)}
      style={one.style}
      multiline={multiline}
      numeral={numeral}
      enterNext={enterNext}
    />
  )
}

function Editable({
  value,
  hint,
  label,
  fieldId,
  onChange,
  as: Tag = 'div',
  className,
  style,
  multiline,
  numeral,
  enterNext,
}: FieldProps & { style?: CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null)

  // 입력 중에는 DOM을 건드리지 않는다. 되돌리기 같은 바깥 변경만 반영한다.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    paint(el, value, numeral)
  }, [value, numeral])

  return (
    <Tag className={cx(className, 'ed', !value && 'is-empty')} style={style}>
      {/* 칸에 두르는 면과 점선. 넓이는 이웃한 칸과의 틈에 맞춘다 (halos.ts) */}
      <span className="ed-halo" aria-hidden="true" />
      <span className="ed-hint" aria-hidden="true">
        {numeral ? <Shown text={hint} numeral /> : hint}
      </span>
      <span
        ref={ref}
        className="ed-input"
        data-field={fieldId}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        role="textbox"
        // 안내 문구는 예시라서 채운 칸의 이름으로 쓰면 틀린 말을 읽는다(한 일을 채운 칸을 '배경'으로).
        // 이름은 칸의 이름('숫자 2 이름'), 예시는 aria-placeholder로 따로 준다
        aria-label={label || (value ? undefined : hint)}
        aria-placeholder={hint}
        aria-multiline={multiline || undefined}
        spellCheck={false}
        onInput={(e) => onChange!(clean(e.currentTarget.innerText, multiline))}
        onBlur={(e) => {
          const v = clean(e.currentTarget.innerText, multiline).trim()
          if (v !== value) onChange!(v)
          // 쓰는 동안 단위 칸(span) 안팎으로 들어간 글자를 다시 나눈다
          paint(e.currentTarget, v, numeral)
        }}
        onKeyDown={(e) => {
          // 한글을 조합하는 중의 Enter와 Esc는 조합을 끝내는 키다: 브라우저가 조합을 마친 뒤 같은 키를 한 번 더 보낸다. 그때 받는다
          // (조합 중에 다른 칸으로 옮기면 마지막 글자가 옮긴 칸에 한 번 더 들어가기도 한다. 조합 중의 Esc로 칸을 떠나면 마지막 글자가
          // 한 번 더 붙었고(괜찮아요요), 이어 온 Esc가 컴포넌트 고르기까지 끝냈다)
          if ((e.key === 'Enter' || e.key === 'Escape') && (e.nativeEvent.isComposing || e.keyCode === 229)) return
          if (e.key === 'Enter' && (!multiline || (enterNext && !e.shiftKey)) && focusNextItem(e.currentTarget)) {
            e.preventDefault()
            return
          }
          if ((e.key === 'Enter' && (!multiline || (enterNext && !e.shiftKey))) || e.key === 'Escape') {
            e.preventDefault()
            e.currentTarget.blur()
          }
          if (e.key === 'Tab' && !e.nativeEvent.isComposing && focusNextField(e.currentTarget, e.shiftKey ? -1 : 1)) e.preventDefault()
        }}
        onPaste={(e) => {
          e.preventDefault()
          const text = e.clipboardData.getData('text/plain')
          document.execCommand('insertText', false, multiline ? text : text.replace(/\s*\n\s*/g, ' '))
        }}
      />
    </Tag>
  )
}

/**
 * 항목 칸의 Enter는 다음 항목의 같은 칸으로 (점 목록을 파워포인트처럼 Enter로 이어 쓰게). 예전에는 Enter가 쓰기를 끝내기만 해서
 * 이어 친 글이 들어갈 데 없이 사라졌다. 글 끝에 두어 채운 칸은 이어 쓴다. 마지막 항목이면 false(쓰기를 끝낸다).
 * 항목 칸의 id는 '앞머리 + 차례.키'다(IT, 부품 안이면 앞머리가 b.부품id.)
 */
function focusNextItem(from: HTMLElement): boolean {
  const m = /^((?:.*\.)?)(\d+)\.([^.]+)$/.exec(from.dataset.field ?? '')
  if (!m) return false
  const id = `${m[1]}${Number(m[2]) + 1}.${m[3]}`
  const next = from.closest('.slide')?.querySelector<HTMLElement>(`.ed-input[data-field="${CSS.escape(id)}"]`)
  if (!next || !next.getClientRects().length) return false
  next.focus()
  const sel = window.getSelection()
  if (sel) {
    sel.selectAllChildren(next)
    sel.collapseToEnd()
  }
  return true
}

/**
 * Tab, Shift+Tab으로 같은 장의 다음(앞) 글 칸으로. 표에서 다음 칸으로 가듯 이어 쓸 수 있게.
 * 그대로 두면 칸 사이의 항목 손잡이, 빼기 단추에 초점이 멈춰서, 이어 친 글이 엉뚱한 칸에 들어갔다(추이의 기간 이름).
 * 옮긴 칸의 글은 모두 고른다(입력 칸에 Tab으로 들어갈 때처럼 바로 고쳐 쓰게). 장의 첫 칸, 마지막 칸에서는 브라우저에 맡긴다
 */
function focusNextField(from: HTMLElement, dir: 1 | -1): boolean {
  const slide = from.closest('.slide')
  if (!slide) return false
  const all = [...slide.querySelectorAll<HTMLElement>('.ed-input')].filter((el) => el.getClientRects().length > 0)
  const next = all[all.indexOf(from) + dir]
  if (!next) return false
  next.focus()
  const sel = window.getSelection()
  if (sel) {
    const range = document.createRange()
    range.selectNodeContents(next)
    sel.removeAllRanges()
    sel.addRange(range)
  }
  return true
}

/** 슬라이드 칸 또는 덱 단위 값(`$org` 등) */
export function T({ k, ...props }: TextProps & { k: string }) {
  const { slide, meta, actions, fieldPrefix = '', folds, labels } = useSlide()
  return (
    <Field
      value={readField(slide, meta, k)}
      hint={hintFor(slide.layout, slide.hints, k)}
      label={labelIn(labels ?? LAYOUTS[slide.layout], k)}
      fieldId={fieldPrefix + k}
      onChange={actions && ((v) => actions.setField(k, v))}
      fold={folds?.has(k)}
      {...props}
    />
  )
}

/** 항목 칸 */
export function IT({ i, k, ...props }: TextProps & { i: number; k: ItemKey }) {
  const { slide, mode, actions, fieldPrefix = '', folds, labels } = useSlide()
  // 글자 수 단계는 목록에서 가장 긴 항목으로 모두 같이 고른다: 항목마다 고르면 긴 이름만 한 단계 작아져
  // 나란한 항목의 제목 크기가 줄마다 달랐다(핵심 포인트의 세 제목이 44, 44, 52px)
  const fitText = props.fit
    ? slide.items
        .map((it, j) => (mode === 'final' ? (it[k] ?? '').trim() : it[k] || hintFor(slide.layout, slide.hints, k, k, j)))
        .reduce((a, t) => ([...t].length > [...a].length ? t : a), '')
    : undefined
  return (
    <Field
      value={slide.items[i]?.[k] ?? ''}
      hint={hintFor(slide.layout, slide.hints, k, k, i)}
      label={labelIn(labels ?? LAYOUTS[slide.layout], k, k, i)}
      fieldId={`${fieldPrefix}${i}.${k}`}
      onChange={actions && ((v) => actions.setItem(i, k, v))}
      fold={folds?.has(`items.${k}`)}
      fitText={fitText}
      {...props}
    />
  )
}

/** 이름표가 붙은 덱 단위 값. 발표 때 비어 있으면 줄째로 숨긴다. */
export function MetaRow({ label, k }: { label: string; k: string }) {
  const { slide, meta, mode } = useSlide()
  if (mode === 'final' && !readField(slide, meta, k).trim()) return null
  return (
    <div className="meta-row">
      <dt>{label}</dt>
      <dd>
        <T k={k} as="span" />
      </dd>
    </div>
  )
}

interface ImageProps {
  k?: string
  i?: number
  className?: string
  contain?: boolean
  optional?: boolean
}

export function ImageSlot({ k = 'image', i, className, contain, optional }: ImageProps) {
  const { slide, meta, mode, actions } = useSlide()
  const value = i === undefined ? readField(slide, meta, k) : (slide.items[i]?.image ?? '')
  const hint = i === undefined ? hintFor(slide.layout, slide.hints, k) : hintFor(slide.layout, slide.hints, 'image', 'image', i)
  const fitCls = contain ? 'is-contain' : 'is-cover'

  if (mode !== 'edit' || !actions) {
    if (value)
      return (
        <div className={cx('img', fitCls, className)}>
          <img src={value} alt="" />
        </div>
      )
    if (mode === 'final' && optional) return null
    return <div className={cx('img img-empty', className)}>{mode === 'preview' && <span>{hint}</span>}</div>
  }

  const set = (v: string) => (i === undefined ? actions.setField(k, v) : actions.setItem(i, 'image', v))
  return <EditableImage value={value} hint={hint} set={set} className={cx(fitCls, className)} />
}

function EditableImage({ value, hint, set, className }: { value: string; hint: string; set: (v: string) => void; className?: string }) {
  const [over, setOver] = useState(false)
  const choose = async () => {
    const file = await pickImage()
    if (file) set(await imageToDataUrl(file))
  }
  return (
    <div
      className={cx('img img-ed', className, !value && 'img-empty', over && 'is-over')}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        e.preventDefault()
        setOver(false)
        const file = e.dataTransfer.files[0]
        if (file?.type.startsWith('image/')) set(await imageToDataUrl(file))
      }}
    >
      {value ? (
        <>
          <img src={value} alt="" />
          <div className="img-tools">
            <button type="button" onClick={choose}>
              바꾸기
            </button>
            <button type="button" onClick={() => set('')}>
              지우기
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="img-drop" onClick={choose}>
          <svg className="img-drop-i" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 7.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
          </svg>
          <span className="img-drop-t">{hint}</span>
          <span className="img-drop-s">눌러서 고르거나 끌어다 놓아요. {keys('mod+V')}로 붙여 넣어도 돼요</span>
        </button>
      )}
    </div>
  )
}

/** 컴포넌트 안 항목의 도구를 항목 끝에서 띄우는 너비 (화면 px, edit.css의 6px / --vs와 같다) */
const TOOL_PAD = 6

/**
 * 항목 안 글자가 그려진 네모들 (화면 px). 도구가 덮으면 그 글을 눌러 고칠 수 없다.
 * 글자 줄의 상자는 글자보다 위아래로 크다(숫자는 위아래 5분의 1이 빈다): 상자 그대로 피하면 큰 숫자 위의 빈 곳에도 도구를 두지 못해
 * 막대 위로 밀려났다. 위아래를 높이의 12%씩 줄여 한글 글자의 끝에 맞춘다
 */
function textLines(root: Element): DOMRect[] {
  const out: DOMRect[] = []
  const range = document.createRange()
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    // 숨은 편집 표시(항목 도구, 칸 왼쪽 위의 끌기 이름표)의 글은 그려진 글이 아니다
    if (!n.nodeValue?.trim() || n.parentElement?.closest('.it-grip, .it-remove, .bk-handle')) continue
    range.selectNodeContents(n)
    for (const r of range.getClientRects()) if (r.width && r.height) out.push(new DOMRect(r.left, r.top + r.height * 0.12, r.width, r.height * 0.76))
  }
  return out
}

/** 항목 안에 칠한 그림(막대, 점, 칸)의 네모들 (화면 px). 항목 자신의 옅은 면(손을 올렸을 때)과 도구는 뺀다 */
function figureRects(item: HTMLElement): DOMRect[] {
  const out: DOMRect[] = []
  for (const el of item.querySelectorAll<HTMLElement | SVGElement>('*')) {
    if (el.closest('.it-grip, .it-remove, .ed-halo') || (el instanceof SVGElement && el.ownerSVGElement)) continue
    const s = getComputedStyle(el)
    const painted = el.matches('svg, img, canvas') || (s.backgroundColor !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(s.backgroundColor)) || s.backgroundImage !== 'none'
    if (!painted) continue
    const r = el.getBoundingClientRect()
    if (r.width && r.height) out.push(r)
  }
  return out
}

/** 항목 도구 묶음(손잡이와 빼기)의 너비와 높이 (화면 px). 숨어 있어도(투명) 자리는 잡혀 있다 */
function toolsSize(item: HTMLElement): { w: number; h: number } | null {
  const tools = [...item.querySelectorAll<HTMLElement>(':scope > :is(.it-grip, .it-remove)')]
  if (!tools.length) return null
  const sizes = tools.map((t) => t.getBoundingClientRect())
  return { w: sizes.reduce((s, r) => s + r.width, 0) + (tools.length - 1) * 4, h: Math.max(...sizes.map((r) => r.height)) }
}

/** 고른 컴포넌트 위에 뜬 도구 막대의 자리 (화면 px). 그 밑에 깔린 항목 도구는 보여도 누를 수 없다 */
const barRect = () => document.querySelector('.float-tools')?.getBoundingClientRect()

/**
 * 컴포넌트 안 항목의 도구(↕, ✕)를 둘 자리 (캔버스 px): 항목 오른쪽 끝에서 도구 묶음 오른쪽 끝까지(right, 항목 밖이면 음수), 항목 위 끝에서
 * 도구 위 끝까지(top), 그리고 항목 상자가 컴포넌트 테두리 오른쪽 밖으로 나간 너비(out).
 * 항목 오른쪽 위에 그대로 두면 막대 비교의 값(96)처럼 줄 끝에 선 글을 덮어 그 글을 눌러 고칠 수 없었고, 남는 너비만큼 옮긴
 * 단(fitBlocks의 balance)의 항목은 상자가 장 오른쪽 밖까지 걸쳐 도구가 장 밖에 그려져 보이지 않았다(점 목록의 항목을 뺄 수 없었다).
 * 그래서 항목 상자 안(칸과 장 안)에서, 글과 도구 막대를 덮지 않는 곳 가운데 그린 것의 오른쪽 위 끝에 가장 가까운 곳을 찾는다.
 * 막대 같은 그림도 되도록 피한다(글처럼 막지는 않는다). 상자 안에 자리가 없으면 항목 바로 옆이나 위아래 밖의 빈 곳에
 * 붙여 둔다: 손이 항목을 떠나면 도구가 숨으므로 항목과 도구 사이를 띄우지 않는다.
 * 그런 곳이 없으면 테두리 안 오른쪽 위 (clear가 거짓)
 */
function toolsSpot(item: HTMLElement): { right: number; top: number; out: number; clear: boolean } | null {
  const cell = item.closest<HTMLElement>('.bk')
  const size = toolsSize(item)
  if (!cell || !size) return null
  const { w, h } = size
  const ir = item.getBoundingClientRect()
  const k = item.offsetWidth ? ir.width / item.offsetWidth : 1
  const frame = frameRect(cell)
  // 도구보다 조금 큰 낮은 항목은 위아래 가운데에: 6px씩 띄우면 도구가 항목 아래로 삐져나와 아랫줄 글에 걸쳤다
  const pad = Math.min(TOOL_PAD, Math.max(0, (ir.height - h) / 2))
  // 항목 상자 가운데 칸과 장 안인 곳만: 남는 너비만큼 옮긴 단의 항목은 상자가 장 밖까지 걸쳤다
  const box = cell.getBoundingClientRect()
  const page = item.closest('.slide')?.getBoundingClientRect() ?? box
  const right = Math.min(ir.right, box.right, page.right) - TOOL_PAD
  const left = Math.max(ir.left, box.left, page.left) + TOOL_PAD
  // 테두리 안 오른쪽 끝에 가까울수록 싸다. 글이 꽉 찬 한 줄 항목(좁은 점 목록)은 테두리 바로 밖, 항목 상자 안의 빈 곳에 선다
  // (테두리에 걸치지 않게, 안쪽 자리보다 조금 비싸게)
  const anchor = Math.min(right, frame.right - TOOL_PAD)
  const top = ir.top + pad
  const bottom = Math.max(top, ir.bottom - pad - h)
  const bar = barRect()
  const lines = [...textLines(item), ...(bar ? [bar] : [])]
  const figures = figureRects(item)
  const hits = (list: DOMRect[], x: number, y: number) => list.some((r) => r.left < x + 2 && r.right > x - w - 2 && r.top < y + h + 2 && r.bottom > y - 2)
  const spot = (x: number, y: number, clear = true) => ({
    right: (ir.right - x) / k,
    top: (y - ir.top) / k,
    out: Math.max(0, (ir.right - frame.right) / k),
    clear,
  })
  // 오른쪽 위에서 멀어질수록 비싸다. 아래로 내려가는 것을 옆으로 가는 것보다 비싸게 (같은 줄 끝에 있어야 그 항목의 도구로 읽힌다)
  let best = { x: anchor, y: top, cost: Infinity }
  for (let y = top; y <= bottom; y += 4)
    for (let x = right; x - w >= left; x -= 4) {
      if (x > anchor && x - w < frame.right + TOOL_PAD) continue
      const cost = (x > anchor ? x - anchor + 30 : anchor - x) + 3 * (y - top) + (hits(figures, x, y) ? 400 : 0)
      if (cost < best.cost && !hits(lines, x, y)) best = { x, y, cost }
    }
  if (Number.isFinite(best.cost)) return spot(best.x, best.y)
  // 상자 안에 자리가 없으면(좁은 단의 예상 질문처럼 첫 줄이 꽉 찬 항목) 항목 바로 오른쪽, 왼쪽, 그다음 바로 위, 아래(오른쪽 끝에 맞춰).
  // 장 안이고 장의 다른 글(이웃 컴포넌트의 글도)과 도구 막대를 덮지 않는 곳에. 장만 넘친 것을 자르고 칸은 자르지 않는다
  const ink = [...textLines(item.closest('.slide') ?? cell), ...(bar ? [bar] : [])]
  const end = Math.min(ir.right, frame.right) - TOOL_PAD
  const near = [
    [ir.right + w, top],
    [ir.left, top],
    [end, ir.top - h],
    [end, ir.bottom],
  ]
  for (const [x, y] of near)
    if (x - w >= page.left && x <= page.right && y >= page.top && y + h <= page.bottom && !hits(ink, x, y)) return spot(x, y)
  return spot(end, top, false)
}

/**
 * 가로로 놓인 낮은 항목의 도구를 항목 바로 위(above)나 아래(below)에 둘 수 있는지: 그 자리에 글과 도구 막대가 없고, 위라면 테두리 안이면.
 * 아래로 내면 고른 컴포넌트 바로 아래에 뜨는 도구 막대와 겹쳐(단계 표시의 단계 이름, 추이의 기간) 도구를 누를 수 없었다
 */
function roomBeside(item: HTMLElement, side: 'above' | 'below'): boolean {
  const cell = item.closest<HTMLElement>('.bk')
  const size = toolsSize(item)
  if (!cell || !size) return false
  const ir = item.getBoundingClientRect()
  const spot = new DOMRect(ir.left + (ir.width - size.w) / 2, side === 'above' ? ir.top - size.h : ir.bottom, size.w, size.h)
  if (side === 'above' && spot.top < frameRect(cell).top) return false
  const bar = barRect()
  return ![...textLines(cell), ...(bar ? [bar] : [])].some((r) => r.left < spot.right && r.right > spot.left && r.top < spot.bottom && r.bottom > spot.top)
}

/** 이 항목이 든 목록이 가로로 놓였는지 (앞의 두 항목이 옆으로 놓였으면) */
function itemsAcross(item: HTMLElement): boolean {
  const list = [...(item.parentElement?.children ?? [])].filter((c) => c.classList.contains('it'))
  if (list.length < 2) return false
  const a = list[0].getBoundingClientRect()
  const b = list[1].getBoundingClientRect()
  return Math.abs(b.left - a.left) > Math.abs(b.top - a.top)
}

/**
 * 항목 위에 올리면 보이는 도구: 왼쪽 위의 손잡이(끌어 순서 바꾸기), 오른쪽 위의 빼기.
 * 컴포넌트 안에서는 둘 다 항목 안쪽 오른쪽 위에 모은다 (edit.css).
 * 자리가 값으로 정해지는 항목(위치 비교의 점)은 순서가 보이지 않아 손잡이를 두지 않는다.
 * keepBlank면 발표할 때 칸이 빈 항목도 감추지 않는다: 단계 표시의 점, 막대 차트의 빈 칸(축)처럼 빈 항목의 자리도 뜻이 있는 부품
 */
export function ItemTools({ i, sort = true, keepBlank = false }: { i: number; sort?: boolean; keepBlank?: boolean }) {
  const { mode, actions, canRemoveItem, slide } = useSlide()
  const move = actions?.moveItem
  const grip = mode === 'edit' && sort && !!move && slide.items.length > 1
  const gripRef = useRef<HTMLButtonElement>(null)
  const removeRef = useRef<HTMLButtonElement>(null)
  // 손잡이 그림은 항목이 놓인 쪽으로: 세로로 쌓인 목록은 위아래, 가로로 놓인 목록은 좌우 화살표.
  // 좁은 칸에서는 같은 목록이 가로에서 세로로 짜임을 바꾸므로, 그릴 때마다 재지 않고 항목에 올리거나 도구로 들어올 때 잰다.
  // 손잡이가 없는 항목(하나만 남은 목록)도 빼기 단추의 자리는 잰다
  useEffect(() => {
    const el = gripRef.current
    const item = (el ?? removeRef.current)?.closest<HTMLElement>('.it')
    if (!item) return
    const look = (e?: Event) => {
      const axis = itemsAcross(item) ? 'x' : 'y'
      if (el && el.dataset.axis !== axis) el.dataset.axis = axis
      // 손으로 누를 때 받는 초점(focus)에서는 자리를 다시 재지 않는다: 손을 올릴 때 잰 뒤에 테두리나 도구 막대가 바뀌어 있으면
      // 누르는 순간 ✕가 옆으로 옮겨 가서, 손을 뗄 때는 ✕ 밖이라 눌리지 않았다. 키보드로 들어올 때(손이 항목 밖)만 잰다
      if (e?.type === 'focus' && item.matches(':hover')) return
      // 컴포넌트 안에서는 글을 덮지 않고 테두리 안에 서는 자리로 (toolsSpot)
      const spot = item.closest('.bk') ? toolsSpot(item) : null
      // 가로로 놓인 낮은 항목(차트 아래의 기간 이름 같은)에 그런 자리가 없으면 도구를 항목 밖 가운데로 낸다: 항목이 도구보다
      // 낮으면 안쪽 오른쪽 위의 도구가 글을 덮어 이름을 눌러 고칠 수 없었다(화면 px로 잰다, 도구는 22px).
      // 위에 자리가 있으면 위로, 없으면 아래로, 둘 다 막혔으면 안쪽 그대로 (roomBeside)
      const low = axis === 'x' && item.getBoundingClientRect().height < 48
      const side = !low || spot?.clear ? '' : roomBeside(item, 'above') ? 'above' : roomBeside(item, 'below') ? 'below' : ''
      if ((item.dataset.tools ?? '') !== side) {
        if (side) item.dataset.tools = side
        else delete item.dataset.tools
      }
      // 값이 그대로면 쓰지 않는다: 항목의 스타일을 바꾸면 장을 다시 맞춘다(blocks.tsx의 BlockArea가 본문 상자 안의 바뀜을 지켜본다)
      const at = side ? null : spot
      for (const [name, v] of [
        ['--it-tools-r', at?.right],
        ['--it-tools-t', at?.top],
        ['--it-out-r', at?.out],
      ] as const) {
        const value = v === undefined ? '' : `${Math.round(v)}px`
        if (item.style.getPropertyValue(name) === value) continue
        if (value) item.style.setProperty(name, value)
        else item.style.removeProperty(name)
      }
    }
    const tools = [el, removeRef.current].filter((t): t is HTMLButtonElement => !!t)
    item.addEventListener('pointerenter', look)
    tools.forEach((t) => t.addEventListener('focus', look))
    return () => {
      item.removeEventListener('pointerenter', look)
      tools.forEach((t) => t.removeEventListener('focus', look))
    }
  }, [grip, canRemoveItem])
  // 발표할 때는 도구 대신, 칸을 하나도 채우지 않은 항목에 표시를 둔다. 그런 항목은 가장 적은 항목 수를 채우려고 남긴 자리라
  // (deck/fields.ts의 presentable) 빈 칸이 다 빠지고 번호, 글머리, 점, 꺾쇠 같은 표시만 덩그러니 남았다.
  // 표시가 든 항목은 자리만 남기고 감춘다(styles/base.css의 .it-empty)
  if (mode === 'final') return !keepBlank && slide.items[i] && isBlankItem(slide.items[i]) ? <i className="it-empty" hidden /> : null
  if (mode !== 'edit' || !actions) return null
  if (!grip && !canRemoveItem) return null
  return (
    <>
      {grip && move && (
        <button
          ref={gripRef}
          type="button"
          className="it-grip"
          data-i={i}
          aria-label={`${i + 1}번째 항목. 끌거나 화살표 키로 순서를 바꿔요`}
          title="끌어서 순서 바꾸기"
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.preventDefault()
            e.stopPropagation()
            // 누르기를 막으면 초점이 그대로 남아서, 누른 뒤 화살표 키(손잡이의 설명대로)가 듣지 않고 쓰던 칸에 글이 들어갔다
            e.currentTarget.focus({ preventScroll: true })
            startItemDrag(e.nativeEvent, e.currentTarget, i, move)
          }}
          onKeyDown={(e) => {
            const d = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : 0
            const list = e.currentTarget.closest('.it')?.parentElement
            const n = list?.querySelectorAll(':scope > .it > .it-grip').length ?? 0
            if (!d || i + d < 0 || i + d >= n) return
            e.preventDefault()
            move(i, i + d)
            // 옮긴 항목의 손잡이에 초점을 둬서 화살표를 이어 누를 수 있게
            requestAnimationFrame(() => list?.querySelector<HTMLElement>(`:scope > .it > .it-grip[data-i="${i + d}"]`)?.focus())
          }}
        >
          {/* 컴포넌트나 판을 옮기는 손잡이(점 여섯)와 같은 그림이면 무엇을 옮기는지 헷갈려서, 순서를 바꾸는 화살표로 */}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4.5v15M8.5 8L12 4.5 15.5 8M8.5 16l3.5 3.5 3.5-3.5" />
          </svg>
        </button>
      )}
      {canRemoveItem && (
        <button
          ref={removeRef}
          type="button"
          className="it-remove"
          aria-label="이 항목 빼기"
          title="이 항목 빼기"
          onClick={(e) => {
            // 두 번 누르기의 둘째 누름은 받지 않는다: 고르지 않은 컴포넌트를 누르면 골라지면서 손 아래에 ✕가 뜨는데, 그 자리를
            // 두 번 누르면 둘째 누름이 ✕를 눌러 항목이 빠졌다. ✕를 두 번 눌러도 한 항목만 빠진다(빠진 자리로 올라온 다음 항목의 ✕가 눌리지 않게)
            if (e.detail > 1) return
            actions.removeItem(i)
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </>
  )
}
