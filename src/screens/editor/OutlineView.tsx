import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { allBlocks, blockFieldPrefix, blockItems, blockSlide, BLOCKS } from '../../deck/blocks'
import { emptyItem } from '../../deck/generate'
import { pageInfo, readField, visibleItems } from '../../deck/fields'
import { LAYOUTS, hintFor, type FieldSpec, type ItemFieldSpec } from '../../deck/layouts'
import type { Block, Deck, Slide } from '../../deck/types'
import { cx } from '../../lib/cx'
import { imageToDataUrl, pickImage } from '../../lib/image'
import { ScaledSlide, SlideCanvas, useStableSections } from '../../slides/SlideCanvas'
import { useDeck } from '../../store/deckStore'
import { PlusIcon, TrashIcon } from '../ui'

/** 문서 모드: 모든 장의 칸을 문서처럼 이어서 쓴다 */
export function OutlineView({ deck, onOpenSlide }: { deck: Deck; onOpenSlide: (id: string) => void }) {
  const info = pageInfo(deck.slides)
  const sections = useStableSections(info)
  const look = useMemo(() => ({ meta: deck.meta, theme: deck.theme, title: deck.title }), [deck.meta, deck.theme, deck.title])
  return (
    <div className="ol">
      <div className="ol-inner">
        <p className="ol-intro">모든 장의 내용을 여기서 차례대로 채울 수 있어요. 오른쪽 작은 슬라이드를 누르면 그 장으로 가요.</p>
        {deck.slides.map((slide) => (
          <OutlineSlide
            key={slide.id}
            look={look}
            slide={slide}
            page={info.page.get(slide.id) ?? 0}
            total={info.total}
            sections={sections}
            sectionIndex={info.sectionOf.get(slide.id) ?? -1}
            onOpen={onOpenSlide}
          />
        ))}
      </div>
    </div>
  )
}

interface OutlineSlideProps {
  look: Pick<Deck, 'meta' | 'theme' | 'title'>
  slide: Slide
  page: number
  total: number
  sections: readonly string[]
  sectionIndex: number
  onOpen: (id: string) => void
}

const OutlineSlide = memo(function OutlineSlide({ look, slide, page, total, sections, sectionIndex, onOpen }: OutlineSlideProps) {
  const setField = useDeck((s) => s.setField)
  const setItem = useDeck((s) => s.setItem)
  const addItem = useDeck((s) => s.addItem)
  const removeItem = useDeck((s) => s.removeItem)
  const spec = LAYOUTS[slide.layout]
  const items = visibleItems(slide)

  return (
    <section className={cx('ol-slide', slide.hidden && 'is-hidden')} id={`ol-${slide.id}`}>
      <div className="ol-form">
        <header className="ol-head">
          <span className="ol-n">{page || '–'}</span>
          <h2 className="ol-purpose">{slide.purpose}</h2>
          <span className="ol-layout">{spec.name}</span>
        </header>
        <p className="ol-guide">{slide.guide}</p>

        {spec.fields.map((f) => (
          <FieldInput
            key={f.key}
            spec={f}
            value={readField(slide, look.meta, f.key)}
            hint={hintFor(slide.layout, slide.hints, f.key)}
            dataField={`${slide.id}:${f.key}`}
            onChange={(v) => setField(slide.id, f.key, v)}
          />
        ))}

        {slide.layout === 'compose' && allBlocks(slide.rows ?? []).map((b) => <BlockFields key={b.id} slide={slide} block={b} />)}

        {spec.items && (
          <div className="ol-items">
            <div className="ol-items-head">
              <span>
                {spec.items.label} {items.length}개
              </span>
              {items.length < spec.items.max && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => addItem(slide.id)}>
                  <PlusIcon />
                  {spec.items.label} 추가
                </button>
              )}
            </div>
            {items.map((item, i) => (
              <div key={item.id} className="ol-item">
                <span className="ol-item-n">{i + 1}</span>
                <div className="ol-item-fields">
                  {spec.items!.fields.map((f) => (
                    <FieldInput
                      key={f.key}
                      spec={f}
                      compact
                      value={item[f.key]}
                      hint={hintFor(slide.layout, slide.hints, f.key, f.key, i)}
                      dataField={`${slide.id}:${i}.${f.key}`}
                      onChange={(v) => setItem(slide.id, i, f.key, v)}
                    />
                  ))}
                </div>
                {items.length > spec.items!.min && (
                  <button type="button" className="icon-btn" aria-label={`${spec.items!.label} ${i + 1} 빼기`} onClick={() => removeItem(slide.id, i)}>
                    <TrashIcon />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <button type="button" className="ol-thumb" aria-label={`${page}번 장 열기`} onClick={() => onOpen(slide.id)}>
        <ScaledSlide width={288}>
          <SlideCanvas
            deck={look}
            slide={slide}
            mode="preview"
            page={page}
            total={total}
            sections={sections}
            sectionIndex={sectionIndex}
          />
        </ScaledSlide>
      </button>
    </section>
  )
})

/** 부품 장의 부품 하나: 부품 이름 아래에 그 부품의 칸과 항목 */
function BlockFields({ slide, block }: { slide: Slide; block: Block }) {
  const updateBlock = useDeck((s) => s.updateBlock)
  const spec = BLOCKS[block.type]
  const inner = blockSlide(slide, block)
  const items = blockItems(block)
  const prefix = `${slide.id}:${blockFieldPrefix(block.id)}`
  const update = (fn: (b: Block) => Block, key?: string) => updateBlock(slide.id, block.id, fn, key)
  return (
    <div className="ol-block">
      <p className="ol-block-name">{spec.name}</p>
      {spec.fields
        .filter((f) => !f.key.startsWith('$'))
        .map((f) => (
          <FieldInput
            key={f.key}
            spec={f}
            value={block.fields[f.key] ?? ''}
            hint={hintFor(inner.layout, inner.hints, f.key)}
            dataField={`${prefix}${f.key}`}
            onChange={(v) => update((b) => ({ ...b, fields: { ...b.fields, [f.key]: v } }), `${block.id}.${f.key}`)}
          />
        ))}
      {spec.items && (
        <div className="ol-items">
          <div className="ol-items-head">
            <span>
              {spec.items.label} {items.length}개
            </span>
            {items.length < spec.items.max && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  update((b) => {
                    const next = [...b.items]
                    next.splice(blockItems(b).length, 0, emptyItem())
                    return { ...b, items: next }
                  })
                }
              >
                <PlusIcon />
                {spec.items.label} 추가
              </button>
            )}
          </div>
          {items.map((item, i) => (
            <div key={item.id} className="ol-item">
              <span className="ol-item-n">{i + 1}</span>
              <div className="ol-item-fields">
                {spec.items!.fields.map((f) => (
                  <FieldInput
                    key={f.key}
                    spec={f}
                    compact
                    value={item[f.key]}
                    hint={hintFor(inner.layout, inner.hints, f.key, f.key, i)}
                    dataField={`${prefix}${i}.${f.key}`}
                    onChange={(v) => update((b) => ({ ...b, items: b.items.map((it, j) => (j === i ? { ...it, [f.key]: v } : it)) }), `${block.id}.${i}.${f.key}`)}
                  />
                ))}
              </div>
              {items.length > spec.items!.min && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${spec.items!.label} ${i + 1} 빼기`}
                  onClick={() => update((b) => ({ ...b, items: b.items.filter((_, j) => j !== i) }))}
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FieldInput({
  spec,
  value,
  hint,
  dataField,
  onChange,
  compact,
}: {
  spec: FieldSpec | ItemFieldSpec
  value: string
  hint: string
  dataField: string
  onChange: (v: string) => void
  compact?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  if (spec.image) {
    return (
      <div className={cx('field', compact && 'field-compact')}>
        <span className="field-label">{spec.label}</span>
        <div className="ol-image">
          {value && <img src={value} alt="" />}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            data-doc-field={dataField}
            onClick={async () => {
              const file = await pickImage()
              if (file) onChange(await imageToDataUrl(file))
            }}
          >
            {value ? '바꾸기' : '이미지 올리기'}
          </button>
          {value && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange('')}>
              지우기
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <label className={cx('field', compact && 'field-compact')}>
      <span className="field-label">
        {spec.label}
        {spec.optional && <span className="field-opt">선택</span>}
      </span>
      {spec.multiline ? (
        <textarea
          ref={ref}
          className="input textarea"
          rows={1}
          value={value}
          placeholder={hint}
          data-doc-field={dataField}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input className="input" value={value} placeholder={hint} data-doc-field={dataField} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}
