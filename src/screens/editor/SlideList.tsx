import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type Announcements, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memo, useEffect, useMemo, useState } from 'react'
import { keys } from '../../lib/keys'
import { slideName } from '../../deck/blocks'
import { missingFields, pageInfo } from '../../deck/fields'
import type { Deck, Slide } from '../../deck/types'
import { cx } from '../../lib/cx'
import { josa } from '../../lib/josa'
import { LIST_AUTO_SCROLL, keepInList } from '../../lib/listDrag'
import { ScaledSlide, SlideCanvas, useStableSections } from '../../slides/SlideCanvas'
import { useDeck } from '../../store/deckStore'
import { EyeOffIcon, PlusIcon, Popover } from '../ui'
import { AddSlide } from './AddSlide'
import { useAfterPaint, useLook } from './look'

export function SlideList({ deck, selectedId }: { deck: Deck; selectedId: string | null }) {
  const select = useDeck((s) => s.select)
  const moveSlide = useDeck((s) => s.moveSlide)
  const addSlide = useDeck((s) => s.addSlide)
  const look = useLook(deck)
  const info = pageInfo(deck.slides)
  const sections = useStableSections(info)
  // 끌기는 마우스로만. dnd-kit의 키보드 끌기는 Space와 Enter로 시작해서, 장을 고르려고 Enter를 누르면 끌기가 시작됐다.
  // 키보드로는 Alt+위아래 화살표로 한 칸씩 옮긴다 (아래 onKeyDown)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  // 화면 읽기 프로그램에 들려줄 말. dnd-kit의 기본 안내는 영어라 한국어로 바꾼다
  const [said, setSaid] = useState('')
  // 고른 장이 목록 밖에 있으면 보이는 곳으로 (장을 더하거나 장 위에서 넘겼을 때. 목록 안에서 고르면 이미 보인다)
  useEffect(() => {
    if (selectedId) document.getElementById(`thumb-${selectedId}`)?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  const nameOf = (id: UniqueIdentifier) => {
    const i = deck.slides.findIndex((s) => s.id === id)
    return i < 0 ? '장' : `${i + 1}번째 장 ‘${slideName(deck.slides[i])}’`
  }
  const placeOf = (id: UniqueIdentifier) => deck.slides.findIndex((s) => s.id === id) + 1
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${josa(nameOf(active.id), '을', '를')} 집었어요.`,
    onDragOver: ({ over }) => (over ? `${placeOf(over.id)}번째 자리 위에 있어요.` : '목록 밖에 있어요.'),
    onDragEnd: ({ active, over }) =>
      over && over.id !== active.id ? `${josa(nameOf(active.id), '을', '를')} ${placeOf(over.id)}번째 자리에 놓았어요.` : `${josa(nameOf(active.id), '은', '는')} 제자리에 있어요.`,
    onDragCancel: ({ active }) => `옮기기를 그만뒀어요. ${josa(nameOf(active.id), '은', '는')} 제자리에 있어요.`,
  }
  const accessibility = {
    announcements,
    screenReaderInstructions: { draggable: `마우스로 끌어 순서를 바꿔요. 키보드로는 ${keys('alt+↑')}, ${keys('alt+↓')}로 한 칸씩 옮겨요.` },
  }

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = deck.slides.findIndex((s) => s.id === e.active.id)
    const to = deck.slides.findIndex((s) => s.id === e.over!.id)
    moveSlide(from, to)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    if (e.ctrlKey || e.metaKey || e.shiftKey) return
    const i = deck.slides.findIndex((s) => s.id === selectedId)
    const to = i + (e.key === 'ArrowDown' ? 1 : -1)
    if (i < 0 || to < 0 || to >= deck.slides.length) return
    e.preventDefault()
    const id = deck.slides[i].id
    if (e.altKey) {
      // 고른 장을 한 칸 옮긴다. 옮기면서 단추가 다시 붙어 초점이 빠지므로 다시 둔다
      setSaid(`${josa(nameOf(id), '을', '를')} ${to + 1}번째로 옮겼어요.`)
      moveSlide(i, to)
      requestAnimationFrame(() => document.getElementById(`thumb-${id}`)?.focus())
      return
    }
    const next = deck.slides[to]
    select(next.id)
    document.getElementById(`thumb-${next.id}`)?.focus()
  }

  return (
    <nav className="sl" aria-label="슬라이드 목록">
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
      <div className="sl-scroll" onKeyDown={onKeyDown}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[keepInList]}
          autoScroll={LIST_AUTO_SCROLL}
          onDragEnd={onDragEnd}
          accessibility={accessibility}
        >
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
          <AddSlide
            look={look}
            onPick={(id) => {
              addSlide(id, selectedId ?? undefined)
              close()
            }}
          />
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
  // 장 그림은 고친 것이 화면에 그려진 다음에 고친다 (look.ts의 useAfterPaint)
  const shown = useAfterPaint(slide)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id, attributes: { roleDescription: '옮길 수 있는 장' } })
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
        aria-label={`${page || '숨김'}. ${slideName(slide)}${missing ? `, 빈칸 ${missing}곳` : ''}`}
        onClick={() => onSelect(slide.id)}
        {...attributes}
        {...listeners}
        role="button"
      >
        <ScaledSlide width={170}>
          <SlideCanvas
            deck={look}
            slide={shown}
            mode="preview"
            page={page}
            total={total}
            sections={sections}
            sectionIndex={sectionIndex}
          />
        </ScaledSlide>
        {/* 이 장에 무엇을 쓰면 되는지는 이름에 마우스를 올리면 (오른쪽 칸에 늘 펼쳐 두지 않는다) */}
        <span className="thumb-label" title={slide.guide || undefined}>
          {missing > 0 && <span className="thumb-dot" aria-hidden="true" />}
          {slideName(slide)}
        </span>
      </button>
    </div>
  )
})
