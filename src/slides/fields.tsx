import { useLayoutEffect, useRef, useState, type CSSProperties, type ElementType } from 'react'
import { readField } from '../deck/fields'
import { hintFor } from '../deck/layouts'
import type { ItemKey } from '../deck/types'
import { cx } from '../lib/cx'
import { imageToDataUrl, pickImage } from '../lib/image'
import { useSlide } from './context'

/** [a, b]: 글자 수가 a를 넘으면 한 단계, b를 넘으면 두 단계 작게. 길이 기준이라 내보낸 파일에서도 같다. */
type Fit = [number, number]

function fitClass(text: string, fit?: Fit): string {
  if (!fit) return ''
  const n = [...text].length
  return n > fit[1] ? 'fit-2' : n > fit[0] ? 'fit-1' : ''
}

/** 굵은 Pretendard 기준으로 어림한 글자 폭(em). 한 줄짜리 숫자 칸이 칸 너비를 넘지 않게 글자 크기를 정하는 데 쓴다. */
export function textUnits(text: string): number {
  let w = 0
  for (const ch of text) {
    // 고딕 굵은 글씨, 고정폭 숫자(tabular-nums)를 재어 본 폭 (em)
    if (/[\u3130-\u318f\uac00-\ud7a3\u4e00-\u9fff]/.test(ch)) w += 0.86
    else if (/[0-9]/.test(ch)) w += 0.64
    else if (/[A-Z%]/.test(ch)) w += ch === '%' ? 0.96 : 0.66
    else if (/[a-z]/.test(ch)) w += 0.54
    else if (/[.,:;'!|]/.test(ch)) w += 0.26
    else if (/\s/.test(ch)) w += 0.26
    else w += 0.6
  }
  return Math.max(1, w * 1.04)
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
}

function oneLineProps(text: string, oneLine?: boolean, units?: number) {
  if (!oneLine) return { cls: '', style: undefined }
  return { cls: 'one-line', style: { '--units': (units ?? textUnits(text)).toFixed(2) } as CSSProperties }
}

interface FieldProps extends TextProps {
  value: string
  hint: string
  fieldId: string
  onChange?: (value: string) => void
  /** 비어 있으면 편집할 때도 그리지 않는 칸 (부품 안의 채우지 않아도 되는 칸) */
  fold?: boolean
}

function clean(text: string, multiline?: boolean): string {
  const t = text.replace(/ /g, ' ')
  if (!t.trim()) return ''
  return multiline ? t : t.replace(/\s*\n\s*/g, ' ')
}

function Field({ value, hint, fieldId, onChange, as: Tag = 'div', className, fit, multiline, oneLine, units, fold }: FieldProps) {
  const { mode } = useSlide()
  if (mode === 'final') {
    const text = value.trim()
    if (!text) return null
    const one = oneLineProps(text, oneLine, units)
    return (
      <Tag className={cx(className, fitClass(text, fit), one.cls)} style={one.style}>
        {text}
      </Tag>
    )
  }
  // 접어 둔 빈칸은 발표할 때처럼 자리를 차지하지 않는다. 고른 부품의 '칸 더하기'로 연다
  if (fold && !value) return null
  const shown = value || hint
  const one = oneLineProps(shown, oneLine, units)
  if (mode === 'preview' || !onChange) {
    return (
      <Tag className={cx(className, fitClass(shown, fit), one.cls, !value && 'is-hint')} style={one.style}>
        {shown}
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
      className={cx(className, fitClass(shown, fit), one.cls)}
      style={one.style}
      multiline={multiline}
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
}: FieldProps & { style?: CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null)

  // 입력 중에는 DOM을 건드리지 않는다. 되돌리기 같은 바깥 변경만 반영한다.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    if (el.innerText !== value) el.innerText = value
  }, [value])

  return (
    <Tag className={cx(className, 'ed', !value && 'is-empty')} style={style}>
      {/* 칸에 두르는 면과 점선. 넓이는 이웃한 칸과의 틈에 맞춘다 (halos.ts) */}
      <span className="ed-halo" aria-hidden="true" />
      <span className="ed-hint" aria-hidden="true">
        {hint}
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
          if (e.currentTarget.innerText !== v) e.currentTarget.innerText = v
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' && !multiline) || e.key === 'Escape') {
            e.preventDefault()
            e.currentTarget.blur()
          }
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
  const { slide, actions, fieldPrefix = '', folds } = useSlide()
  return (
    <Field
      value={slide.items[i]?.[k] ?? ''}
      hint={hintFor(slide.layout, slide.hints, k, k, i)}
      fieldId={`${fieldPrefix}${i}.${k}`}
      onChange={actions && ((v) => actions.setItem(i, k, v))}
      fold={folds?.has(`items.${k}`)}
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
          <span className="img-drop-t">{hint}</span>
          <span className="img-drop-s">끌어다 놓거나 눌러서 올려요</span>
        </button>
      )}
    </div>
  )
}

export function ItemTools({ i }: { i: number }) {
  const { mode, actions, canRemoveItem } = useSlide()
  if (mode !== 'edit' || !actions || !canRemoveItem) return null
  return (
    <button type="button" className="it-remove" aria-label="이 항목 빼기" title="이 항목 빼기" onClick={() => actions.removeItem(i)}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  )
}
