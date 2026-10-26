import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS as DndCss } from '@dnd-kit/utilities'
import { useMemo, useState } from 'react'
import { BLOCK_EFFECTS, BLOCK_FROMS, BLOCK_SPEEDS, BLOCK_WHENS, blockNames, effectOf, fromOf, playOrder, speedOf, whenOf } from '../../deck/blocks'
import { sceneOf } from '../../deck/scenes'
import { MOTIONS, motionOf, TRANSITIONS } from '../../deck/themes'
import type { Block, BlockEffect, BlockFrom, BlockSpeed, BlockWhen, Deck, Motion, Slide, Transition } from '../../deck/types'
import { cx } from '../../lib/cx'
import { keys } from '../../lib/keys'
import { useListDrag } from '../../lib/listDrag'
import { motionEngine } from '../../motion/engine'
import { useDeck } from '../../store/deckStore'
import { ChevronIcon, GripIcon, Icon, PlayIcon, Segmented, type Toast } from '../ui'
import type { BlockEditing } from './BlockEditor'
import { PREVIEW_MOTION } from './DeckMenus'
import { Opt } from './Inspector'
import { SceneAll, SceneOverride, ScenePicker } from './ScenePicker'

/**
 * 이 장만 바꾸지 않고 발표 전체 설정을 따르는 값의 이름. 예전에는 '기본'이라서, 기본이 무엇인지(차분하게? 없음?)
 * 테마 메뉴를 열어 봐야 알았다. 무엇을 따르는지는 머리말 아래에 지금 값으로 같이 보인다
 */
export const INHERIT = '전체대로'

/** 이 장 설정의 '장 넘기기'에 보일 것. 움직임에 맞춰(auto)는 발표 전체에만 있는 값이라 '전체대로' 하나로 묶는다 */
export const SLIDE_TRANSITIONS: { id: Transition | undefined; name: string; description: string }[] = [
  { id: undefined, name: INHERIT, description: '테마 메뉴에서 정한 발표 전체의 장 넘기기를 따라요.' },
  ...TRANSITIONS.filter((t) => t.id !== 'auto'),
]

export const nameOf = <T,>(list: { id: T; name: string }[], id: T) => list.find((o) => o.id === id)?.name ?? ''

/** 들어오는 쪽은 짧게 (네 단추가 한 줄에 들어가게) */
export const FROM_SHORT: Record<BlockFrom, string> = { below: '아래', above: '위', left: '왼쪽', right: '오른쪽' }

/**
 * 오른쪽 칸의 '움직임'. 이 장이 넘어올 때의 모습과 움직임 정도, 그리고 부품 장이면 컴포넌트가 나오는 차례를 정한다.
 * 시간 막대를 그리는 편집기가 아니라 고르는 방식이다: 컴포넌트마다 움직임, 언제(이어서, 함께, 누르면), 들어오는 쪽, 빠르기를 고르고
 * 목록을 끌어 차례를 바꾼다. 차례는 장의 options.order에, 나머지는 부품에 적고 발표 화면과 내보낸 HTML이 같은 엔진으로 움직인다
 */
export function MotionPanel({
  deck,
  slide,
  blocks,
  toast,
  onOpenStudio,
}: {
  deck: Deck
  slide: Slide
  blocks: Pick<BlockEditing, 'selected' | 'select' | 'convert'>
  toast?: Toast
  onOpenStudio(): void
}) {
  const setOptions = useDeck((s) => s.setOptions)
  const moving = motionOf(deck, slide) !== 'none'
  return (
    <div className="ins mp" role="tabpanel" aria-label="움직임">
      {/* 장면: 장 전체를 한 컷으로. 고르기만 하면 되는 것이라 맨 위에 둔다 */}
      <section className="ins-sec sp">
        <h2 className="ins-h">장면</h2>
        <ScenePicker deck={deck} slide={slide} />
        <SceneAll deck={deck} toast={toast} />
      </section>
      {/* 크게 보며 고치는 곳: 장을 발표 화면처럼 움직이고 시간표로 차례와 때를 본다 */}
      <button type="button" className="mp-studio" onClick={onOpenStudio}>
        <StudioIcon />
        <span>
          <b>움직임 편집</b>
          <span className="mp-studio-d">크게 보면서 차례와 움직임을 고쳐요</span>
        </span>
        <ChevronIcon />
      </button>
      <section className="ins-sec">
        <div className="mp-head">
          <h2 className="ins-h">이 장만</h2>
          <button type="button" className="btn btn-ghost btn-sm mp-preview" disabled={!moving} onClick={() => window.dispatchEvent(new Event(PREVIEW_MOTION))}>
            <PlayIcon />
            미리 보기
          </button>
        </div>
        {/* '전체대로'가 지금 무엇인지. 테마 메뉴의 값이 바뀌면 같이 바뀐다 */}
        <p className="mp-inherit">
          발표 전체는 움직임 {nameOf(MOTIONS, deck.motion ?? 'calm')}, 장 넘기기 {nameOf(TRANSITIONS, deck.theme.transition ?? 'auto')}
        </p>
        <Opt label="움직임 정도" wide>
          <Segmented<Motion | undefined>
            className="seg-fill"
            label="이 장의 움직임 정도"
            options={[{ id: undefined, name: INHERIT, description: '테마 메뉴에서 정한 발표 전체의 움직임 정도를 따라요.' }, ...MOTIONS]}
            value={slide.options.motion ?? undefined}
            onPick={(m) => setOptions(slide.id, { motion: m })}
          />
        </Opt>
        <Opt label="장 넘기기" wide tip="앞 장에서 이 장으로 넘어올 때의 모습이에요. 뒤로 돌아갈 때도 같은 모습으로 되돌아가요.">
          <div className="mp-grid" role="group" aria-label="이 장으로 넘어올 때">
            {SLIDE_TRANSITIONS.map((t) => {
              const on = (slide.options.transition ?? undefined) === t.id
              return (
                <button key={String(t.id)} type="button" className={cx('mp-pick', on && 'is-on')} aria-pressed={on} title={t.description} onClick={() => setOptions(slide.id, { transition: t.id })}>
                  {t.name}
                </button>
              )
            })}
          </div>
        </Opt>
      </section>
      {slide.layout === 'compose' ? (
        <Sequence deck={deck} slide={slide} blocks={blocks} />
      ) : (
        <section className="ins-sec mp-empty">
          <p>컴포넌트 장에서는 컴포넌트마다 나오는 차례와 때를 정할 수 있어요.</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={blocks.convert}>
            컴포넌트 장으로 바꾸기
          </button>
        </section>
      )}
    </div>
  )
}

/** 컴포넌트가 나오는 차례. '누르면'인 컴포넌트에서 새 묶음이 시작된다(그 위에 몇 번째 누를 때인지 줄을 긋는다) */
function Sequence({ deck, slide, blocks }: { deck: Deck; slide: Slide; blocks: Pick<BlockEditing, 'selected' | 'select'> }) {
  const setOptions = useDeck((s) => s.setOptions)
  const order = useMemo(() => playOrder(slide), [slide])
  const names = useMemo(() => blockNames(slide.blocks ?? []), [slide.blocks])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [said, setSaid] = useState('')
  const drag = useListDrag()
  const ids = order.map((b) => b.id)
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= ids.length) return
    setOptions(slide.id, { order: arrayMove(ids, from, to) }, 'order')
    setSaid(`${names.get(ids[from]) ?? '컴포넌트'}를 ${to + 1}번째로 옮겼어요.`)
  }
  const onDragEnd = (e: DragEndEvent) => {
    drag.end()
    if (!e.over || e.active.id === e.over.id) return
    move(ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)))
  }
  if (!order.length) {
    return (
      <section className="ins-sec mp-empty">
        <p>컴포넌트를 넣으면 나오는 차례를 여기서 정해요.</p>
      </section>
    )
  }
  // 몇 번째 누를 때 나오는지 (0은 장이 나올 때)
  let click = 0
  const steps = order.map((b) => (whenOf(b) === 'click' ? ++click : click))
  return (
    <section className="ins-sec mp-seq">
      <div className="mp-seq-h">
        <h2 className="ins-h">나오는 차례</h2>
        {slide.options.order && (
          <button type="button" className="mp-reset" onClick={() => setOptions(slide.id, { order: undefined })}>
            놓인 차례로
          </button>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
      <SceneOverride slide={slide} />
      {steps[0] === 0 && <p className="mp-step">장이 나올 때</p>}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={drag.modifiers}
        autoScroll={drag.autoScroll}
        onDragStart={drag.start}
        onDragEnd={onDragEnd}
        onDragCancel={drag.end}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className="mp-list" aria-label={`나오는 차례. 끌거나 ${keys('alt+↑')}, ${keys('alt+↓')}로 옮겨요`}>
            {order.map((b, i) => (
              <Row
                key={b.id}
                deck={deck}
                slide={slide}
                block={b}
                name={names.get(b.id) ?? ''}
                step={whenOf(b) === 'click' ? steps[i] : 0}
                open={blocks.selected === b.id}
                onOpen={() => blocks.select(blocks.selected === b.id ? null : b.id)}
                onMove={(d) => move(i, i + d)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </section>
  )
}

function Row({
  deck,
  slide,
  block,
  name,
  step,
  open,
  onOpen,
  onMove,
}: {
  deck: Deck
  slide: Slide
  block: Block
  name: string
  /** 이 컴포넌트에서 새로 시작하는 누름 (0이면 앞 묶음에 이어진다) */
  step: number
  open: boolean
  onOpen(): void
  onMove(d: 1 | -1): void
}) {
  const updateBlock = useDeck((s) => s.updateBlock)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  const effect = effectOf(block)
  const when = whenOf(block)
  const from = fromOf(block)
  const speed = speedOf(block)
  // 장면을 고른 동안은 장면이 움직임, 들어오는 쪽, 빠르기를 정한다 (고른 값은 남아 장면을 끄면 돌아온다)
  const scened = !!sceneOf(slide)
  const set = (patch: Partial<Block>) => updateBlock(slide.id, block.id, (b) => ({ ...b, ...patch }), `motion.${block.id}`)
  /** 편집 화면의 그 컴포넌트만 한 번 움직인다 (바꾼 값이 칸에 붙은 다음에) */
  const play = () =>
    requestAnimationFrame(() => {
      const cell = document.querySelector<HTMLElement>(`.ed-canvas .bk[data-block="${CSS.escape(block.id)}"]`)
      const level = motionOf(deck, slide)
      if (cell) motionEngine().play(cell, level === 'none' ? 'calm' : level)
    })
  const summary = scened
    ? ['장면대로', when === 'with' && '함께', when === 'click' && '누르면'].filter(Boolean).join(' · ')
    : [BLOCK_EFFECTS.find((e) => e.id === effect)?.name, when === 'with' && '함께', speed !== 'normal' && BLOCK_SPEEDS.find((s) => s.id === speed)?.name].filter(Boolean).join(' · ')
  return (
    <li ref={setNodeRef} className={cx('mp-row', open && 'is-open', isDragging && 'is-dragging', when === 'with' && 'is-with')} style={{ transform: DndCss.Translate.toString(transform), transition }}>
      {step > 0 && <p className="mp-step">{step}번 누르면</p>}
      <div className="mp-card">
        <div className="mp-row-h">
          <span className="mp-grip" aria-hidden="true" {...listeners}>
            <GripIcon />
          </span>
          <button
            type="button"
            className="mp-row-btn"
            aria-expanded={open}
            {...attributes}
            onClick={onOpen}
            onKeyDown={(e) => {
              if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
              e.preventDefault()
              onMove(e.key === 'ArrowUp' ? -1 : 1)
            }}
          >
            <span className="mp-name">{name}</span>
            <span className="mp-sum">{summary}</span>
          </button>
          <button type="button" className="icon-btn mp-play" title="이것만 보기" aria-label={`${name} 움직임 보기`} disabled={effect === 'none'} onClick={play}>
            <PlayIcon />
          </button>
        </div>
        {open && (
          <div className="mp-edit">
            <Opt label="움직임" wide>
              <div className="mp-grid" role="group" aria-label="움직임">
                {BLOCK_EFFECTS.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    className={cx('mp-pick', effect === x.id && 'is-on')}
                    aria-pressed={effect === x.id}
                    disabled={scened}
                    title={x.description}
                    onClick={() => {
                      set({ effect: x.id === 'auto' ? undefined : (x.id as BlockEffect) })
                      if (x.id !== 'none') play()
                    }}
                  >
                    {x.name}
                  </button>
                ))}
              </div>
            </Opt>
            <Opt label="언제" wide>
              <Segmented<BlockWhen> className="seg-fill" label="언제 나오는지" options={BLOCK_WHENS} value={when} onPick={(w) => set({ when: w === 'after' ? undefined : w })} />
            </Opt>
            {from && !scened && (
              <Opt label="들어오는 쪽" wide>
                <Segmented<BlockFrom>
                  className="seg-fill"
                  label="들어오는 쪽"
                  options={BLOCK_FROMS.map((f) => ({ ...f, name: FROM_SHORT[f.id] }))}
                  value={from}
                  onPick={(f) => {
                    set({ from: f })
                    play()
                  }}
                />
              </Opt>
            )}
            {!scened && (
              <Opt label="빠르기" wide>
                <Segmented<BlockSpeed>
                  className="seg-fill"
                  label="빠르기"
                  options={BLOCK_SPEEDS}
                  value={speed}
                  onPick={(s) => {
                    set({ speed: s === 'normal' ? undefined : s })
                    play()
                  }}
                />
              </Opt>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

/** 움직임 편집: 차례로 나오는 막대 셋 (시간표의 모습) */
const StudioIcon = () => <Icon className="mp-studio-i" d="M4 7h8M8 12h8M12 17h8" />
