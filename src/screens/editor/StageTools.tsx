import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { withLayout } from '../../deck/blocks'
import { LAYOUTS } from '../../deck/layouts'
import { unshownCount, visibleItems } from '../../deck/fields'
import type { Deck, Slide } from '../../deck/types'
import type { AiAsk } from '../../ai/useAiAsk'
import type { AiShare } from '../../ai/useAiShare'
import { cx } from '../../lib/cx'
import { keys } from '../../lib/keys'
import { useDeck } from '../../store/deckStore'
import { BlocksIcon, CopyIcon, EyeIcon, EyeOffIcon, MoreIcon, PlayIcon, PlusIcon, Popover, ScreenIcon, SlidersIcon, TrashIcon } from '../ui'
import { SlideAsk } from './AiShare'
import type { BlockEditing } from './BlockEditor'
import type { SidePanel } from './sidePanel'
import { VariantMenu } from './VariantMenu'

/**
 * 슬라이드 아래 단추줄: 왼쪽과 오른쪽 단추가 한 줄에 다 들어가지 않으면 글자를 숨긴다.
 * 1단계는 오른쪽 단추, 2단계는 왼쪽의 덜 쓰는 단추(다른 모양, 항목 추가)까지. 왼쪽 단추 수가 장마다 달라서 너비 하나로 정하지 않고 잰다
 */
function useTightTools(ref: RefObject<HTMLDivElement | null>) {
  const check = useCallback(() => {
    const el = ref.current
    if (!el) return
    const need = () => {
      const l = el.querySelector<HTMLElement>('.stage-tools-l')
      const r = el.querySelector<HTMLElement>('.stage-tools-r')
      return (l?.scrollWidth ?? 0) + (r?.scrollWidth ?? 0) + 16
    }
    for (const level of ['', '1', '2']) {
      if (level) el.dataset.tight = level
      else delete el.dataset.tight
      if (need() <= el.clientWidth) return
    }
  }, [ref])
  useLayoutEffect(check)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [check, ref])
}

/**
 * '레이아웃 바꾸기'에서 그림에 마우스를 올린 동안 장 아래의 말. 바꿨을 때 가려질 칸이 있으면 그 수도 말한다:
 * 미리 보이는 장에서 글이 사라져도 지워지는지 남는지 알 수 없었다
 */
function PeekNote({ slide, layout }: { slide: Slide; layout: Slide['layout'] }) {
  const hides = unshownCount(withLayout(slide, layout))
  const text = `‘${LAYOUTS[layout].name}’ 레이아웃으로 바꾸면 이렇게 보여요. ${hides ? `채워 둔 칸 ${hides}곳은 이 레이아웃에 없어 가려지지만 지우지는 않아요.` : '누르면 바뀌어요.'}`
  return (
    <p className={cx('stage-peek', hides > 0 && 'is-hiding')} title={text}>
      {text}
    </p>
  )
}

/** 슬라이드 아래 단추줄: 왼쪽은 이 장에 넣고 바꾸는 일, 오른쪽은 미리 보기, 발표, 그리고 '더 보기'(복제, 빼기, 지우기) */
export function StageTools({
  deck,
  slide,
  ai,
  ask,
  blocks,
  side,
  peekSlide,
  peek,
  overflow,
  onTogglePeek,
  onReplay,
  onPresentHere,
  onRemove,
}: {
  deck: Deck
  slide: Slide
  ai: AiShare
  ask: AiAsk
  blocks: Pick<BlockEditing, 'libraryOpen'>
  side: SidePanel
  /** '레이아웃 바꾸기'에서 그림에 올린 레이아웃으로 바꾼 모습을 보이는 중 */
  peekSlide: Slide | null
  /** 이 장 미리보기 중 */
  peek: boolean
  overflow: 'over' | 'tight' | null
  onTogglePeek: () => void
  /** 미리보기의 움직임을 한 번 더 */
  onReplay: () => void
  onPresentHere: () => void
  onRemove: (s: Slide) => void
}) {
  // 할 일(액션)만 쓴다
  const store = useDeck.getState()
  const spec = LAYOUTS[slide.layout]
  const canAddItem = !!spec.items && visibleItems(slide).length < spec.items.max
  const variants = spec.variants ?? []
  const toolsRef = useRef<HTMLDivElement>(null)
  useTightTools(toolsRef)
  return (
    <div ref={toolsRef} className="stage-tools">
      {peekSlide ? (
        <div className="stage-tools-l">
          <PeekNote slide={slide} layout={peekSlide.layout} />
        </div>
      ) : peek ? (
        <div className="stage-tools-l">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onReplay}>
            <PlayIcon />
            움직임 다시 보기
          </button>
          <p className="stage-peek" title="빈칸과 편집 표시는 보이지 않아요">발표 화면에서 보이는 모습이에요</p>
        </div>
      ) : (
        <div className="stage-tools-l">
          <button
            type="button"
            className={cx('btn btn-sm stage-blocks', blocks.libraryOpen ? 'is-on' : 'btn-ghost')}
            aria-pressed={blocks.libraryOpen}
            title="컴포넌트를 골라 이 장에 넣어요"
            onClick={side.toggleLibrary}
          >
            <BlocksIcon />
            컴포넌트 넣기
          </button>
          {/* 오른쪽 칸을 접는 좁은 창에서만 보인다. 레이아웃, 모양, 바탕을 여기서 연다 */}
          <button
            type="button"
            className={cx('btn btn-sm stage-side', side.settingsShown ? 'is-on' : 'btn-ghost')}
            aria-pressed={side.settingsShown}
            title="이 장의 레이아웃, 모양, 바탕, 움직임"
            onClick={side.toggleSettings}
          >
            <SlidersIcon />
            <span className="btn-t">이 장 설정</span>
          </button>
          <SlideAsk deck={deck} slide={slide} ai={ai} ask={ask} />
          {variants.length > 1 && <VariantMenu deck={deck} slide={slide} />}
          {spec.items && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              // 막아 둔 단추는 왜 안 되는지를 말한다
              title={canAddItem ? `${spec.items.label} 추가` : `${spec.items.label} ${spec.items.max}개까지 넣을 수 있어요`}
              disabled={!canAddItem}
              onClick={() => store.addItem(slide.id)}
            >
              <PlusIcon />
              <span className="btn-t">{spec.items.label} 추가</span>
            </button>
          )}
          {overflow === 'over' && (
            // 자리가 모자라면 짧은 말만 (말줄임으로 '글이 슬...'처럼 잘리면 무슨 뜻인지 모른다)
            <p className="stage-warn" role="status" title="글이 슬라이드 밖으로 넘쳤어요. 글을 줄이거나 ‘이 장 설정’에서 레이아웃을 바꿔 보세요.">
              <span className="stage-warn-l">글이 슬라이드 밖으로 넘쳤어요. 글을 줄이거나 레이아웃을 바꿔 보세요.</span>
              <span className="stage-warn-s">글이 넘쳤어요</span>
            </p>
          )}
          {overflow === 'tight' && (
            <p className="stage-warn" role="status" title="컴포넌트가 들어갈 높이가 모자라 줄여서 보여요. 제목이나 부제를 줄이거나 컴포넌트를 하나 빼 주세요.">
              <span className="stage-warn-l">높이가 모자라 컴포넌트를 줄여서 보여요. 제목이나 부제를 줄이거나 컴포넌트를 빼 주세요.</span>
              <span className="stage-warn-s">자리가 모자라요</span>
            </p>
          )}
        </div>
      )}
      {/* 단추가 한 줄에 다 들어가지 않으면 오른쪽부터 글자를 숨기고 그림만 남긴다 (이름은 title로, useTightTools) */}
      <div className="stage-tools-r">
        <button
          type="button"
          className={cx('btn btn-ghost btn-sm', peek && 'is-on')}
          aria-pressed={peek}
          title={peek ? '편집으로 돌아가기' : '발표 화면처럼 미리 보기'}
          onClick={onTogglePeek}
        >
          <ScreenIcon />
          <span className="btn-t">{peek ? '편집으로' : '미리 보기'}</span>
        </button>
        <button type="button" className="btn btn-ghost btn-sm" title={`지금 장부터 발표 (${keys('shift+F5')})`} onClick={onPresentHere}>
          <PlayIcon />
          <span className="btn-t">지금 장부터 발표</span>
        </button>
        {/* 복제, 빼기, 지우기는 덜 쓰는 일이라 '더 보기'에 이름과 함께 둔다. 예전에는 그림만 남은 단추 셋이 나란히 있어서
            빗금 친 눈이 '발표에서 빼기'인지 알기 어려웠다(1280 너비에서는 늘 그림만 보였다) */}
        <Popover
          flip
          button={({ open, toggle }) => (
            <button
              type="button"
              className={cx('btn btn-ghost btn-sm stage-more', open && 'is-on')}
              aria-label="이 장 더 보기"
              aria-expanded={open}
              aria-haspopup="menu"
              title="복제, 발표에서 빼기, 지우기"
              onClick={toggle}
            >
              <MoreIcon />
            </button>
          )}
        >
          {(close) => (
            <div className="menu stage-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  close()
                  store.duplicateSlide(slide.id)
                }}
              >
                <CopyIcon />
                복제
              </button>
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  close()
                  store.setHidden(slide.id, !slide.hidden)
                }}
              >
                {slide.hidden ? <EyeIcon /> : <EyeOffIcon />}
                <span className="menu-item-t">
                  {slide.hidden ? '발표에 다시 넣기' : '발표에서 빼기'}
                  <span className="menu-item-desc">{slide.hidden ? '발표할 때 이 장을 다시 보여요' : '지우지 않고 발표할 때만 건너뛰어요'}</span>
                </span>
              </button>
              <div className="menu-sep" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="menu-item is-danger"
                // 막아 둔 일은 왜 안 되는지를 말한다
                title={deck.slides.length <= 1 ? '장이 하나뿐이라 지울 수 없어요' : undefined}
                disabled={deck.slides.length <= 1}
                onClick={() => {
                  close()
                  onRemove(slide)
                }}
              >
                <TrashIcon />
                이 장 지우기
              </button>
            </div>
          )}
        </Popover>
      </div>
    </div>
  )
}
