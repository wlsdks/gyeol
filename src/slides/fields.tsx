import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ElementType } from 'react'
import { readField } from '../deck/fields'
import { hintFor } from '../deck/layouts'
import type { ItemKey } from '../deck/types'
import { cx } from '../lib/cx'
import { imageToDataUrl, pickImage } from '../lib/imageFile'
import { keys } from '../lib/keys'
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
}

function oneLineProps(text: string, oneLine?: boolean, units?: number, numeral?: boolean) {
  if (!oneLine) return { cls: '', style: undefined }
  return { cls: 'one-line', style: { '--units': (units ?? (numeral ? numberUnits(text) : textUnits(text))).toFixed(2) } }
}

/** 발표 화면의 글: 빼기 기호를 바로 쓰고, 큰 숫자면 단위를 작은 글자로 떼어 낸다 */
function Shown({ text, numeral }: { text: string; numeral?: boolean }) {
  const t = minusSigns(text)
  const parts = numeral ? splitNumber(t) : null
  if (!parts) return <>{t}</>
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
  if (!parts) {
    // 처음 그리는 칸(아직 빈 칸)은 innerText를 읽지 않고 바로 넣는다. innerText는 읽을 때마다 화면을 다시 재야 해서(강제 레이아웃),
    // 장을 고를 때 칸마다 읽고 쓰기를 번갈아 하면 칸 수만큼 레이아웃이 돌았다. 빈 칸의 innerText는 ''이라 결과는 같다
    if (!el.firstChild) {
      if (value) el.innerText = value
      return
    }
    if (el.innerText !== value || el.querySelector(':scope > .u')) el.innerText = value
    return
  }
  const next = numberNodes(parts)
  const same =
    el.childNodes.length === next.length &&
    next.every((n, i) => {
      const c = el.childNodes[i]
      return typeof n === 'string' ? c.nodeType === Node.TEXT_NODE && c.nodeValue === n : c instanceof HTMLElement && c.className === (n as HTMLElement).className && c.textContent === n.textContent
    })
  if (same) return
  el.replaceChildren(...next)
}

interface FieldProps extends TextProps {
  value: string
  hint: string
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

function Field({ value, hint, fieldId, onChange, as: Tag = 'div', className, fit, multiline, oneLine, units, numeral, fold, fitText }: FieldProps) {
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
      fieldId={fieldId}
      onChange={onChange}
      as={Tag}
      className={cx(className, fitClass(fitText ?? shown, fit), one.cls)}
      style={one.style}
      multiline={multiline}
      numeral={numeral}
    />
  )
}

function Editable({
  value,
  hint,
  fieldId,
  onChange,
  as: Tag = 'div',
  className,
  style,
  multiline,
  numeral,
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
        aria-label={hint}
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
          if ((e.key === 'Enter' && !multiline) || e.key === 'Escape') {
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
  const { slide, meta, actions, fieldPrefix = '', folds } = useSlide()
  return (
    <Field
      value={readField(slide, meta, k)}
      hint={hintFor(slide.layout, slide.hints, k)}
      fieldId={fieldPrefix + k}
      onChange={actions && ((v) => actions.setField(k, v))}
      fold={folds?.has(k)}
      {...props}
    />
  )
}

/** 항목 칸 */
export function IT({ i, k, ...props }: TextProps & { i: number; k: ItemKey }) {
  const { slide, mode, actions, fieldPrefix = '', folds } = useSlide()
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
 * 자리가 값으로 정해지는 항목(위치 비교의 점)은 순서가 보이지 않아 손잡이를 두지 않는다
 */
export function ItemTools({ i, sort = true }: { i: number; sort?: boolean }) {
  const { mode, actions, canRemoveItem, slide } = useSlide()
  const move = actions?.moveItem
  const grip = mode === 'edit' && sort && !!move && slide.items.length > 1
  const gripRef = useRef<HTMLButtonElement>(null)
  // 손잡이 그림은 항목이 놓인 쪽으로: 세로로 쌓인 목록은 위아래, 가로로 놓인 목록은 좌우 화살표.
  // 좁은 칸에서는 같은 목록이 가로에서 세로로 짜임을 바꾸므로, 그릴 때마다 재지 않고 항목에 올리거나 손잡이로 들어올 때 잰다
  useEffect(() => {
    const el = gripRef.current
    const item = el?.closest<HTMLElement>('.it')
    if (!el || !item) return
    const look = () => {
      const axis = itemsAcross(item) ? 'x' : 'y'
      if (el.dataset.axis !== axis) el.dataset.axis = axis
      // 가로로 놓인 낮은 항목(차트 아래의 기간 이름 같은)은 도구를 항목 아래로 내린다: 컴포넌트 안에서는 도구가 항목 안쪽
      // 오른쪽 위에 서는데, 항목이 도구보다 낮으면 도구가 글을 덮어 이름을 눌러 고칠 수 없었다(화면 px로 잰다, 도구는 22px)
      const below = axis === 'x' && item.getBoundingClientRect().height < 48
      if ((item.dataset.tools === 'below') !== below) {
        if (below) item.dataset.tools = 'below'
        else delete item.dataset.tools
      }
    }
    item.addEventListener('pointerenter', look)
    el.addEventListener('focus', look)
    return () => {
      item.removeEventListener('pointerenter', look)
      el.removeEventListener('focus', look)
    }
  }, [grip])
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
        <button type="button" className="it-remove" aria-label="이 항목 빼기" title="이 항목 빼기" onClick={() => actions.removeItem(i)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </>
  )
}
