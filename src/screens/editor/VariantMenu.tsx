import { useMemo } from 'react'
import { LAYOUTS, variantOf } from '../../deck/layouts'
import type { Deck, Slide } from '../../deck/types'
import { cx } from '../../lib/cx'
import { useDeck } from '../../store/deckStore'
import { Popover, ShapesIcon } from '../ui'
import { LayoutChoice } from './Inspector'

/**
 * 슬라이드 아래의 '모양': 이 레이아웃의 다른 모양을 그림으로 보고 고른다.
 * 예전에는 '다른 모양'을 누를 때마다 다음 모양으로 넘어가기만 해서, 무엇이 나올지 몰랐다
 */
export function VariantMenu({ deck, slide, compact }: { deck: Deck; slide: Slide; compact?: boolean }) {
  const setVariant = useDeck((s) => s.setVariant)
  const variants = LAYOUTS[slide.layout].variants ?? []
  const current = variantOf(slide)
  const look = useMemo(() => ({ meta: deck.meta, theme: deck.theme, title: deck.title }), [deck.meta, deck.theme, deck.title])
  return (
    <Popover
      align="left"
      flip
      className="pop-variant"
      button={({ toggle, open }) => (
        <button
          type="button"
          className={compact ? cx('sel-btn has-t', open && 'is-on') : cx('btn btn-ghost btn-sm', open && 'is-on')}
          aria-expanded={open}
          title="이 레이아웃의 다른 모양을 골라요"
          onClick={toggle}
        >
          <ShapesIcon />
          <span className="btn-t">모양</span>
        </button>
      )}
    >
      {(close) => (
        <div className="variant-pop">
          <p className="menu-h">모양</p>
          <div className="variant-grid">
            {variants.map((v) => (
              <LayoutChoice
                key={v.id}
                id={slide.layout}
                variant={v.id}
                name={v.name}
                look={look}
                slide={slide}
                width={150}
                on={current === v.id}
                onPick={() => {
                  setVariant(slide.id, v.id)
                  close()
                }}
              />
            ))}
          </div>
        </div>
      )}
    </Popover>
  )
}
