import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { blockCount, blockMinH, BLOCK_GROUPS, BLOCKS, canCompose, MAX_BLOCKS } from '../../deck/blocks'
import { sampleBlock } from '../../deck/blockSamples'
import { motionOf } from '../../deck/themes'
import type { BlockType, Deck, Slide } from '../../deck/types'
import { cx } from '../../lib/cx'
import { motionEngine } from '../../motion/engine'
import { SlideCanvas } from '../../slides/SlideCanvas'
import { CloseIcon } from '../ui'
import { soloSlide, type BlockEditing } from './BlockEditor'

// 부품 고르기: 부품마다 예시 내용을 넣은 작은 그림을 보여 주고, 마우스를 올리면 발표할 때의 움직임을 한 번 보여 준다.
// 카드를 슬라이드로 끌어다 놓거나, 누르면 알맞은 자리에 넣는다.

type Look = Pick<Deck, 'meta' | 'theme' | 'title' | 'motion'>

const THUMB_RATIO = 1.5

/** 예시 부품 하나를 작은 그림으로. 부품이 잘리지 않을 높이로 그린 뒤 같은 비율의 카드에 맞춰 줄인다 */
const Thumb = memo(function Thumb({ deck, type }: { deck: Look; type: BlockType }) {
  const block = useMemo(() => sampleBlock(type), [type])
  const slide = useMemo(() => soloSlide(block), [block])
  const h = Math.max(480, blockMinH(block) + 80)
  const canvas = { w: Math.round(h * THUMB_RATIO), h }
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="lib-thumb">
      {width > 0 && (
        <div className="lib-thumb-scale" style={{ width: canvas.w, height: canvas.h, transform: `scale(${width / canvas.w})` }}>
          <SlideCanvas deck={deck} slide={slide} mode="preview" solo={canvas} />
        </div>
      )}
    </div>
  )
})

export function BlockLibrary({ deck, slide, blocks }: { deck: Deck; slide: Slide; blocks: BlockEditing }) {
  const [group, setGroup] = useState<string | null>(null)
  const look = useMemo<Look>(() => ({ meta: deck.meta, theme: deck.theme, title: deck.title, motion: deck.motion }), [deck.meta, deck.theme, deck.title, deck.motion])
  const engine = useMemo(() => motionEngine(), [])
  const playing = useRef(new WeakMap<Element, number>())
  const level = motionOf(deck, slide)
  const close = () => blocks.setLibraryOpen(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.body.classList.contains('is-block-dragging')) return
      if ((e.target as HTMLElement).closest?.('input, textarea, [contenteditable]')) return
      blocks.setLibraryOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [blocks])

  /** 마우스를 올리면 그 부품의 움직임을 한 번. 움직이는 중에 다시 올려도 처음부터 다시 하지 않는다 */
  const preview = (card: HTMLElement) => {
    const cell = card.querySelector<HTMLElement>('.bk')
    if (!cell) return
    const now = performance.now()
    if (now - (playing.current.get(cell) ?? -1e9) < 1400) return
    playing.current.set(cell, now)
    engine.play(cell, level === 'lively' ? 'lively' : 'calm')
  }

  const full = slide.layout === 'compose' && blockCount(slide.rows ?? []) >= MAX_BLOCKS
  const note =
    slide.layout === 'compose'
      ? full
        ? `이 장에는 부품이 ${MAX_BLOCKS}개 다 찼어요. 더 넣으면 다음 장에 새로 만들어 넣어요.`
        : null
      : canCompose(slide.layout)
        ? '부품을 넣으면 이 장이 부품 장으로 바뀌어요. 지금 내용은 그대로 남고, 부품으로 나뉘어 옮길 수 있게 돼요.'
        : '표지와 단락 장에는 부품을 넣지 않아요. 넣으면 이 장 다음에 부품 장을 새로 만들어요.'
  const groups = group ? BLOCK_GROUPS.filter((g) => g.name === group) : BLOCK_GROUPS

  return (
    <aside className="lib" aria-label="부품 고르기">
      <header className="lib-head">
        <div className="lib-head-t">
          <h2 className="lib-title">부품 고르기</h2>
          <p className="lib-sub">슬라이드로 끌어다 놓거나 눌러서 넣어요. 아무 데나 놓아도 알맞은 자리에 맞춰져요.</p>
        </div>
        <button type="button" className="icon-btn" aria-label="부품 고르기 닫기" title="닫기 (Esc)" onClick={close}>
          <CloseIcon />
        </button>
      </header>

      {note && (
        <div className="lib-note">
          <p>{note}</p>
          {slide.layout !== 'compose' && canCompose(slide.layout) && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={blocks.convert}>
              지금 부품 장으로 바꾸기
            </button>
          )}
        </div>
      )}

      <div className="lib-tabs" role="group" aria-label="부품 묶음">
        <button type="button" className={cx('lib-tab', !group && 'is-on')} aria-pressed={!group} onClick={() => setGroup(null)}>
          전체
        </button>
        {BLOCK_GROUPS.map((g) => (
          <button key={g.name} type="button" className={cx('lib-tab', group === g.name && 'is-on')} aria-pressed={group === g.name} onClick={() => setGroup(g.name)}>
            {g.name}
          </button>
        ))}
      </div>

      <div className="lib-list">
        {groups.map((g) => (
          <section key={g.name} className="lib-sec">
            <h3 className="lib-group">{g.name}</h3>
            <div className="lib-grid">
              {g.types.map((type) => {
                const spec = BLOCKS[type]
                return (
                  <button
                    key={type}
                    type="button"
                    className="lib-card"
                    title={`${spec.name}: ${spec.motion}`}
                    onPointerDown={(e) => blocks.pressCard(e, type)}
                    // 키보드로 누를 때만 (마우스는 위의 누르기에서 끌기와 나눠 다룬다)
                    onClick={(e) => e.detail === 0 && blocks.insert(type, e.currentTarget)}
                    onPointerEnter={(e) => preview(e.currentTarget)}
                    onFocus={(e) => preview(e.currentTarget)}
                  >
                    <Thumb deck={look} type={type} />
                    <span className="lib-name">{spec.name}</span>
                    <span className="lib-desc">{spec.description}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  )
}
