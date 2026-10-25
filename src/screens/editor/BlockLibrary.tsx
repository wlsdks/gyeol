import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react'
import { blockCount, blockPrefH, BLOCK_COL_GAP, BLOCK_GROUPS, BLOCK_LINKS, BLOCKS, canCompose, linkTargets, makeBlock, MAX_BLOCKS } from '../../deck/blocks'
import { sampleBlock } from '../../deck/blockSamples'
import { emptyItem } from '../../deck/generate'
import { motionOf } from '../../deck/themes'
import type { BlockLink, BlockType, Deck, Slide } from '../../deck/types'
import { cx } from '../../lib/cx'
import { josa } from '../../lib/josa'
import { motionEngine } from '../../motion/engine'
import type { SlideMode } from '../../slides/context'
import { SlideCanvas } from '../../slides/SlideCanvas'
import { loadSaved, useSaved } from '../../store/saved'
import { soloSlide, type BlockEditing, type LibraryView } from './BlockEditor'
import { COL_W } from './canvas'
import { dialogOpen, isTyping, Segmented, type Toast } from '../ui'
import { useLook, type Look } from './look'
import { noRoomText } from './noRoom'
import { SavedParts } from './SavedParts'

// 부품 고르기: 부품마다 예시 내용을 넣은 작은 그림을 보여 주고, 마우스를 올리면 발표할 때의 움직임을 한 번 보여 준다.
// 카드를 슬라이드로 끌어다 놓거나, 누르면 알맞은 자리에 넣는다.

const THUMB_RATIO = 1.5

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
  const minW = BLOCKS[type].minSpan * (COL_W + BLOCK_COL_GAP) - BLOCK_COL_GAP + 80
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

/** 이음표 카드의 예시: 큰 숫자 둘 사이에 그 이음표 (지어낸 숫자) */
const LINK_SAMPLES: Record<BlockLink, [string, string, string, string]> = {
  arrow: ['지금 처리 시간', '4.2일', '추진 후', '1.5일'],
  plus: ['현장 교육', '12회', '도구 도입', '3종'],
  equals: ['줄어드는 시간', '2.7일', '한 해 절감', '3.1억 원'],
  versus: ['A안 비용', '4.8억 원', 'B안 비용', '3.6억 원'],
}

const LINK_CANVAS = { w: 660, h: 440 }

/** 이음표 하나를 작은 그림으로: 컴포넌트 둘 사이에 선 모습 그대로 */
export const LinkThumb = memo(function LinkThumb({ deck, link, mode = 'preview' }: { deck: Look; link: BlockLink; mode?: SlideMode }) {
  const slide = useMemo<Slide>(() => {
    const [l1, v1, l2, v2] = LINK_SAMPLES[link]
    const a = { ...makeBlock('number'), id: `lk-a-${link}`, fields: { label: l1, value: v1 }, link }
    const b = { ...makeBlock('number'), id: `lk-b-${link}`, fields: { label: l2, value: v2 } }
    return { ...soloSlide(a), id: `solo-link-${link}`, rows: [{ id: 'solo', blocks: [a, b] }] }
  }, [link])
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
        <div className="lib-thumb-scale" style={{ width: LINK_CANVAS.w, height: LINK_CANVAS.h, transform: `scale(${width / LINK_CANVAS.w})` }}>
          <SlideCanvas deck={deck} slide={slide} mode={mode} solo={LINK_CANVAS} />
        </div>
      )}
    </div>
  )
})

/** 부품 고르기의 묶음 탭에 더하는 이음표 묶음 */
const LINK_GROUP = { name: '이음표', short: '이음표', description: '컴포넌트 사이에 끼워 둘이 어떻게 이어지는지 보여 줘요' }

export function BlockLibrary({ deck, slide, blocks, toast }: { deck: Deck; slide: Slide; blocks: BlockEditing; toast: Toast }) {
  const [group, setGroup] = useState<string | null>(null)
  // 이 장에 넣을 수 없는 카드를 눌렀을 때 그 까닭을 보여 줄 부품
  const [why, setWhy] = useState<{ type: BlockType; card: HTMLElement } | null>(null)
  const look = useLook(deck)
  const engine = useMemo(() => motionEngine(), [])
  const playing = useRef(new WeakMap<Element, number>())
  const level = motionOf(deck, slide)
  const saved = useSaved((s) => s.parts.length)
  const mine = blocks.libraryView === 'mine'

  // 내 컴포넌트는 열 때마다 다시 읽는다 (그 사이 보관 폴더를 허용했거나 다른 창에서 저장했을 수 있다)
  useEffect(() => {
    void loadSaved()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.body.classList.contains('is-block-dragging')) return
      if (isTyping(e)) return
      // 대화 창을 닫는 Esc로 컴포넌트 고르기까지 닫지 않는다
      if (e.defaultPrevented || dialogOpen()) return
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
  // 카드마다 이 장 어디에도 넣을 수 없는 까닭. 누를 때도 이것 하나로 정한다: 까닭이 있으면 바로 넣지 않고 까닭과
  // '다음 장에 새로 넣기'를 보인다. 예전에는 어느 카드도 들어가지 않는 장이면 까닭을 아예 재지 않아서, 누르면 묻지 않고
  // 다음 장을 만들었고 몇 카드만 막힌 장에서는 물었다 (같은 결과인데 흐름이 둘). 장이 바뀔 때마다 다시 본다
  const issues = new Map(types.map((t) => [t, blocks.issueFor(t)]))
  // 어느 부품도 들어가지 않으면(개수가 찼거나 높이가 모자라) 카드마다 표를 붙이지 않고 위에 한 번만 알린다
  const full = counted || (slide.layout === 'compose' && types.every((t) => issues.get(t)))
  // 알림은 상자 없이 한 줄로 (목록이 위에서부터 바로 보이게). 무엇이 어디에 들어가는지만 말한다
  const note =
    slide.layout === 'compose'
      ? full
        ? counted
          ? `${MAX_BLOCKS}개가 다 차서 다음 장에 새로 넣어요`
          : '자리가 모자라 다음 장에 새로 넣어요'
        : null
      : canCompose(slide.layout)
        ? '넣으면 컴포넌트 장이 돼요'
        : // 표지와 섹션 장: 놓으면 다음 장에 새로 넣는다. 끄는 동안 놓을 자리에 그렇게 보이니 따로 적지 않는다
          null
  const groups = group ? BLOCK_GROUPS.filter((g) => g.name === group) : BLOCK_GROUPS
  const showLinks = !group || group === LINK_GROUP.name
  const chips: { id: string | null; name: string; title?: string }[] = [
    { id: null, name: '전체' },
    ...BLOCK_GROUPS.map((g) => ({ id: g.name, name: g.short, title: `${g.name}: ${g.description}` })),
    { id: LINK_GROUP.name, name: LINK_GROUP.short, title: `${LINK_GROUP.name}: ${LINK_GROUP.description}` },
  ]
  // 이음표는 컴포넌트 장에서 컴포넌트가 둘 이상일 때만 끼울 수 있다
  const linkable = slide.layout === 'compose' && linkTargets(slide.rows ?? []).length > 0
  const shownWhy = why && issues.get(why.type) ? { ...why, text: noRoomText(issues.get(why.type)!, why.type, 'slide') } : null

  return (
    <div className="lib" role="tabpanel" aria-label="컴포넌트">
      {/* 기본 컴포넌트와 내가 저장해 둔 것. 묶음 칩은 기본 컴포넌트에만 */}
      <Segmented<LibraryView>
        className="seg-fill lib-source"
        label="보일 컴포넌트"
        options={[
          { id: 'base', name: '기본 컴포넌트' },
          { id: 'mine', name: saved ? `내 컴포넌트 ${saved}` : '내 컴포넌트', description: '저장해 둔 컴포넌트, 줄, 장을 어느 발표에서든 다시 넣어요' },
        ]}
        value={blocks.libraryView}
        onPick={(v) => {
          setWhy(null)
          blocks.setLibraryView(v)
        }}
      />
      {note && (
        <div className="lib-note">
          <p className="lib-note-t">{note}</p>
          {slide.layout !== 'compose' && canCompose(slide.layout) && (
            <button type="button" className="lib-note-btn" title="지금 내용은 그대로 남고, 내용이 컴포넌트로 나뉘어 하나씩 옮길 수 있게 돼요" onClick={blocks.convert}>
              컴포넌트 장으로 바꾸기
            </button>
          )}
        </div>
      )}

      {mine && <SavedParts deck={deck} slide={slide} blocks={blocks} toast={toast} />}

      {/* 묶음은 글자 칩. 한 줄에 다 들지 않아 두 줄로 반씩 나누고, 줄마다 칩이 너비를 똑같이 나눠 끝까지 채운다
          (넘친 칩 하나가 아랫줄에 홀로 남지 않게). 긴 이름과 설명은 목록의 묶음 제목에 */}
      {!mine && (
        <>
          <div className="lib-tabs" role="group" aria-label="컴포넌트 묶음">
            {chips.map((c, i) => (
              <Fragment key={c.id ?? '전체'}>
                {i === Math.ceil(chips.length / 2) && <span className="lib-tabs-br" aria-hidden="true" />}
                <button
                  type="button"
                  className={cx('lib-tab', group === c.id && 'is-on')}
                  aria-pressed={group === c.id}
                  title={c.title}
                  onClick={() => setGroup(c.id)}
                >
                  {c.name}
                </button>
              </Fragment>
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
                    // 카드의 표는 몇 카드만 막혔을 때만 (다 막혔으면 위의 알림 한 줄로)
                    const marked = !!issue && !full
                    // 이 장에 넣을 수 없는 부품: 눌러도 바로 넣지 않고 까닭을 보여 준다 (끌어서 놓으면 다음 장에 들어간다)
                    const tap = (card: HTMLElement) => (issue ? setWhy(why?.type === type ? null : { type, card }) : blocks.insert(type, card))
                    return (
                      <button
                        key={type}
                        type="button"
                        className={cx('lib-card', marked && 'is-blocked', why?.type === type && 'is-why')}
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
                        {marked && <span className="lib-no">이 장엔 자리가 없어요</span>}
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
            {showLinks && (
              <section className="lib-sec">
                <h3 className="lib-group">
                  {LINK_GROUP.name}
                  <span className="lib-group-n">{BLOCK_LINKS.length}</span>
                </h3>
                <p className="lib-group-d">{linkable ? `${LINK_GROUP.description}. 끌어서 컴포넌트 사이에 놓아요.` : '컴포넌트 장에 컴포넌트를 둘 이상 넣으면 그 사이에 끼울 수 있어요.'}</p>
                <div className="lib-grid">
                  {BLOCK_LINKS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className={cx('lib-card', !linkable && 'is-blocked')}
                      title={`${l.name}: ${l.description}`}
                      onPointerDown={(e) => blocks.pressLinkCard(e, l.id)}
                      onClick={(e) => e.detail === 0 && blocks.insertLink(l.id)}
                    >
                      <LinkThumb deck={look} link={l.id} />
                      <span className="lib-name">{l.name}</span>
                      <span className="lib-desc">{l.description}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </>
      )}

      {shownWhy && (
        <div className="lib-why" role="dialog" aria-label={`${josa(BLOCKS[shownWhy.type].name, '을', '를')} 넣을 수 없는 까닭`}>
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
    </div>
  )
}
