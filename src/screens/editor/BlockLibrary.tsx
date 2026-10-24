import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { blockCount, blockPrefH, BLOCK_GAP, BLOCK_GROUPS, BLOCKS, canCompose, MAX_BLOCKS } from '../../deck/blocks'
import { sampleBlock } from '../../deck/blockSamples'
import { emptyItem } from '../../deck/generate'
import { motionOf } from '../../deck/themes'
import type { BlockType, Deck, Slide } from '../../deck/types'
import { cx } from '../../lib/cx'
import { motionEngine } from '../../motion/engine'
import type { SlideMode } from '../../slides/context'
import { SlideCanvas } from '../../slides/SlideCanvas'
import { CloseIcon, Icon } from '../ui'
import { soloSlide, type BlockEditing } from './BlockEditor'
import { josa, noRoomText } from './noRoom'

// 부품 고르기: 부품마다 예시 내용을 넣은 작은 그림을 보여 주고, 마우스를 올리면 발표할 때의 움직임을 한 번 보여 준다.
// 카드를 슬라이드로 끌어다 놓거나, 누르면 알맞은 자리에 넣는다.

export type Look = Pick<Deck, 'meta' | 'theme' | 'title' | 'motion'>

/** 묶음 단추의 그림. 짧은 이름만으로는 무엇이 들어 있는지 알기 어려워서 생김새를 같이 보인다 */
const GROUP_ICONS: Record<string, string> = {
  전체: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  '글과 메시지': 'M5 6h14M5 11h14M5 16h9',
  숫자: 'M10 4L8 20M16 4l-2 16M4.5 9h15M4.5 15h15',
  차트: 'M4 20h16M7 16v-5M12 16V6M17 16v-8',
  '흐름과 일정': 'M4 6.5h16v13H4zM4 10.5h16M8.5 4v4M15.5 4v4',
  '비교와 표': 'M4 5h16v14H4zM4 10h16M12 10v9',
  '그림과 사람': 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 7.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z',
}

const THUMB_RATIO = 1.5
/** 장 본문(1680) 12칸 격자의 한 칸 너비 */
const COL_W = (1680 - 11 * BLOCK_GAP) / 12

/**
 * 예시 부품 하나를 작은 그림으로. 부품이 잘리지 않을 높이로 그린 뒤 같은 비율의 카드에 맞춰 줄인다.
 * blank면 글을 비워 칸마다 안내만 (장 모음의 '빈 칸' 보기)
 */
export const BlockThumb = memo(function BlockThumb({ deck, type, blank, mode = 'preview' }: { deck: Look; type: BlockType; blank?: boolean; mode?: SlideMode }) {
  const block = useMemo(() => {
    const b = sampleBlock(type)
    return blank ? { ...b, fields: {}, items: b.items.map(() => emptyItem()) } : b
  }, [type, blank])
  const slide = useMemo(() => soloSlide(block), [block])
  // 부품이 들어갈 수 있는 가장 좁은 칸보다 좁게 그리지 않는다 (표나 차트가 찌그러져 보이지 않게)
  const minW = BLOCKS[type].minSpan * (COL_W + BLOCK_GAP) - BLOCK_GAP + 80
  const h = Math.max(480, blockPrefH(block) + 80, Math.round(minW / THUMB_RATIO))
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
          <SlideCanvas deck={deck} slide={slide} mode={mode} solo={canvas} />
        </div>
      )}
    </div>
  )
})

export function BlockLibrary({ deck, slide, blocks }: { deck: Deck; slide: Slide; blocks: BlockEditing }) {
  const [group, setGroup] = useState<string | null>(null)
  // 이 장에 넣을 수 없는 카드를 눌렀을 때 그 까닭을 보여 줄 부품
  const [why, setWhy] = useState<{ type: BlockType; card: HTMLElement } | null>(null)
  const look = useMemo<Look>(() => ({ meta: deck.meta, theme: deck.theme, title: deck.title, motion: deck.motion }), [deck.meta, deck.theme, deck.title, deck.motion])
  const engine = useMemo(() => motionEngine(), [])
  const playing = useRef(new WeakMap<Element, number>())
  const level = motionOf(deck, slide)
  const close = () => blocks.setLibraryOpen(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.body.classList.contains('is-block-dragging')) return
      if ((e.target as HTMLElement).closest?.('input, textarea, [contenteditable]')) return
      // 까닭을 펼쳐 두었으면 그것만 닫는다
      if (why) setWhy(null)
      else blocks.setLibraryOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [blocks, why])

  /** 마우스를 올리면 그 부품의 움직임을 한 번. 움직이는 중에 다시 올려도 처음부터 다시 하지 않는다 */
  const preview = (card: HTMLElement) => {
    const cell = card.querySelector<HTMLElement>('.bk')
    if (!cell) return
    const now = performance.now()
    if (now - (playing.current.get(cell) ?? -1e9) < 1400) return
    playing.current.set(cell, now)
    engine.play(cell, level === 'lively' ? 'lively' : 'calm')
  }

  const types = BLOCK_GROUPS.flatMap((g) => g.types)
  const counted = slide.layout === 'compose' && blockCount(slide.rows ?? []) >= MAX_BLOCKS
  // 어느 부품도 들어가지 않으면(개수가 찼거나 높이가 모자라) 카드마다 표를 붙이지 않고 위에 한 번만 알린다
  const full = counted || (slide.layout === 'compose' && types.every((t) => blocks.issueFor(t)))
  const note =
    slide.layout === 'compose'
      ? full
        ? counted
          ? `이 장에는 부품이 ${MAX_BLOCKS}개 다 찼어요. 고르면 다음 장을 새로 만들어 넣어요.`
          : '이 장에는 더 넣을 자리가 없어요. 고르면 다음 장을 새로 만들어 넣어요.'
        : null
      : canCompose(slide.layout)
        ? '부품을 넣으면 이 장이 부품 장으로 바뀌어요. 지금 내용은 그대로 남고, 부품으로 나뉘어 옮길 수 있게 돼요.'
        : '표지와 단락 장에는 부품을 넣지 않아요. 넣으면 이 장 다음에 부품 장을 새로 만들어요.'
  const groups = group ? BLOCK_GROUPS.filter((g) => g.name === group) : BLOCK_GROUPS
  // 카드마다의 까닭은 장이 바뀔 때마다 다시 본다 (부품을 빼면 바로 넣을 수 있게 바뀐다)
  const issues = new Map(types.map((t) => [t, full ? null : blocks.issueFor(t)]))
  const shownWhy = why && issues.get(why.type) ? { ...why, text: noRoomText(issues.get(why.type)!, why.type, 'slide') } : null

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

      {/* 묶음 단추는 한 줄에: 두 줄로 접히면 어디까지가 묶음인지 읽히지 않는다. 묶음의 긴 이름과 설명은 목록의 제목에 */}
      <div className="lib-tabs" role="group" aria-label="부품 묶음">
        <button type="button" className={cx('lib-tab', !group && 'is-on')} aria-pressed={!group} onClick={() => setGroup(null)}>
          <Icon d={GROUP_ICONS.전체} />
          전체
        </button>
        {BLOCK_GROUPS.map((g) => (
          <button
            key={g.name}
            type="button"
            className={cx('lib-tab', group === g.name && 'is-on')}
            aria-pressed={group === g.name}
            title={`${g.name}: ${g.description}`}
            onClick={() => setGroup(g.name)}
          >
            <Icon d={GROUP_ICONS[g.name]} />
            {g.short}
          </button>
        ))}
      </div>

      <div className="lib-list">
        {groups.map((g) => (
          <section key={g.name} className="lib-sec">
            <h3 className="lib-group">
              {g.name}
              <span className="lib-group-n">{g.types.length}</span>
            </h3>
            <p className="lib-group-d">{g.description}</p>
            <div className="lib-grid">
              {g.types.map((type) => {
                const spec = BLOCKS[type]
                const issue = issues.get(type)
                // 이 장에 넣을 수 없는 부품: 눌러도 바로 넣지 않고 까닭을 보여 준다 (끌어서 놓으면 다음 장에 들어간다)
                const tap = (card: HTMLElement) => (issue ? setWhy(why?.type === type ? null : { type, card }) : blocks.insert(type, card))
                return (
                  <button
                    key={type}
                    type="button"
                    className={cx('lib-card', issue && 'is-blocked', why?.type === type && 'is-why')}
                    title={issue ? `${spec.name}: 이 장에는 자리가 없어요. 눌러서 까닭을 보세요` : `${spec.name}: ${spec.motion}`}
                    onPointerDown={(e) => {
                      const card = e.currentTarget
                      blocks.pressCard(e, type, () => tap(card))
                    }}
                    // 키보드로 누를 때만 (마우스는 위의 누르기에서 끌기와 나눠 다룬다)
                    onClick={(e) => e.detail === 0 && tap(e.currentTarget)}
                    onPointerEnter={(e) => preview(e.currentTarget)}
                    onFocus={(e) => preview(e.currentTarget)}
                  >
                    <BlockThumb deck={look} type={type} />
                    <span className="lib-name">{spec.name}</span>
                    <span className="lib-desc">{spec.description}</span>
                    {issue && <span className="lib-no">이 장엔 자리가 없어요</span>}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {shownWhy && (
        <div className="lib-why" role="dialog" aria-label={`${BLOCKS[shownWhy.type].name}을 넣을 수 없는 까닭`}>
          <p className="lib-why-t">{josa(BLOCKS[shownWhy.type].name, '은', '는')} 이 장에 넣을 수 없어요</p>
          <p className="lib-why-p">{shownWhy.text.why}</p>
          <p className="lib-why-p is-fix">{shownWhy.text.fix}</p>
          <div className="lib-why-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                blocks.insert(shownWhy.type, shownWhy.card)
                setWhy(null)
              }}
            >
              다음 장에 새로 넣기
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWhy(null)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
