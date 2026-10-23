import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memo, useMemo } from 'react'
import { missingFields, pageInfo } from '../../deck/fields'
import { LAYOUTS, LAYOUT_ORDER } from '../../deck/layouts'
import type { Deck, Slide } from '../../deck/types'
import { cx } from '../../lib/cx'
import { ScaledSlide, SlideCanvas, useStableSections } from '../../slides/SlideCanvas'
import { useDeck } from '../../store/deckStore'
import { EyeOffIcon, PlusIcon, Popover } from '../ui'

export function SlideList({ deck, selectedId }: { deck: Deck; selectedId: string | null }) {
  const select = useDeck((s) => s.select)
  const moveSlide = useDeck((s) => s.moveSlide)
  const addSlide = useDeck((s) => s.addSlide)
  const info = pageInfo(deck.slides)
  const sections = useStableSections(info)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = deck.slides.findIndex((s) => s.id === e.active.id)
    const to = deck.slides.findIndex((s) => s.id === e.over!.id)
    moveSlide(from, to)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const i = deck.slides.findIndex((s) => s.id === selectedId)
    const next = deck.slides[i + (e.key === 'ArrowDown' ? 1 : -1)]
    if (next) {
      e.preventDefault()
      select(next.id)
      document.getElementById(`thumb-${next.id}`)?.focus()
    }
  }

  return (
    <nav className="sl" aria-label="슬라이드 목록">
      <div className="sl-scroll" onKeyDown={onKeyDown}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={deck.slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {deck.slides.map((slide) => (
              <Thumb
                key={slide.id}
                meta={deck.meta}
                theme={deck.theme}
                title={deck.title}
                slide={slide}
                page={info.page.get(slide.id) ?? 0}
                total={info.total}
                sections={sections}
                sectionIndex={info.sectionOf.get(slide.id) ?? -1}
                selected={slide.id === selectedId}
                missing={missingFields(slide, deck.meta).length}
                onSelect={select}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <Popover
        align="left"
        className="sl-add-pop"
        button={({ toggle, open }) => (
          <button type="button" className="btn btn-ghost sl-add" aria-expanded={open} onClick={toggle}>
            <PlusIcon />
            장 추가
          </button>
        )}
      >
        {(close) => (
          <div className="menu menu-layouts">
            <p className="menu-h">어떤 장을 추가할까요?</p>
            {LAYOUT_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className="menu-item"
                onClick={() => {
                  addSlide(id, selectedId ?? undefined)
                  close()
                }}
              >
                <span className="menu-item-name">{LAYOUTS[id].name}</span>
                <span className="menu-item-desc">{LAYOUTS[id].description}</span>
              </button>
            ))}
          </div>
        )}
      </Popover>
    </nav>
  )
}

interface ThumbProps {
  meta: Deck['meta']
  theme: Deck['theme']
  title: string
  slide: Slide
  page: number
  total: number
  sections: readonly string[]
  sectionIndex: number
  selected: boolean
  missing: number
  onSelect: (id: string) => void
}

const Thumb = memo(function Thumb(props: ThumbProps) {
  const { meta, theme, title, slide, page, total, sections, sectionIndex, selected, missing, onSelect } = props
  const look = useMemo(() => ({ meta, theme, title }), [meta, theme, title])
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id })
  return (
    <div
      ref={setNodeRef}
      className={cx('thumb', selected && 'is-on', slide.hidden && 'is-hidden', isDragging && 'is-drag')}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <span className="thumb-n">{slide.hidden ? <EyeOffIcon /> : page}</span>
      <button
        type="button"
        id={`thumb-${slide.id}`}
        className="thumb-btn"
        aria-current={selected || undefined}
        aria-label={`${page || '숨김'}. ${slide.purpose}${missing ? `, 빈칸 ${missing}곳` : ''}`}
        onClick={() => onSelect(slide.id)}
        {...attributes}
        {...listeners}
        role="button"
      >
        <ScaledSlide width={176}>
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
        <span className="thumb-label">
          {missing > 0 && <span className="thumb-dot" aria-hidden="true" />}
          {slide.purpose}
        </span>
      </button>
    </div>
  )
})
