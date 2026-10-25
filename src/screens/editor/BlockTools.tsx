import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { BLOCK_EFFECTS, BLOCK_LOOKS, BLOCKS, blockItems, effectOf, isAlone, shownLook, variantOfBlock, type NoRoom, type SavedKind } from '../../deck/blocks'
import type { Block, BlockEffect } from '../../deck/types'
import { cx } from '../../lib/cx'
import { BookmarkIcon, CopyIcon, GripIcon, MotionIcon, PlusIcon, ShapesIcon, TrashIcon } from '../ui'
import { noRoomText } from './noRoom'

// 고른 컴포넌트 바로 위에 뜨는 도구 (옮기기, 바탕, 움직임, 모양, 항목과 칸 더하기, 복제, 빼기). 띄우는 자리는 SelectionBar의 FloatTools

/** 내 컴포넌트로 저장하는 것의 이름 */
const SAVE_NAMES: Record<SavedKind, string> = { block: '이 컴포넌트', row: '이 줄', slide: '이 장 전체' }

/** 바탕 메뉴의 설명 */
const LOOK_NOTES: Record<Block['look'] & string, string> = {
  plain: '장 바탕 위에 바로 놓여요. 가장 가벼워요.',
  card: '옅은 면 위에 놓여 한 묶음으로 보여요.',
  bold: '진한 면 위에 놓여 가장 눈에 띄어요. 한 장에 하나만 써요.',
}

export function BlockTools({
  block,
  itemIssue,
  variantIssue,
  lookIssue,
  onBlocked,
  onGrip,
  onShift,
  onLook,
  onEffect,
  onPreview,
  onVariant,
  onAddItem,
  adds,
  onOpenField,
  onDuplicate,
  onRemove,
  saves,
  onSave,
}: {
  block: Block
  /** 항목을 더하거나 모양, 바탕을 바꾸면 장에 들어가지 않을 때 그 까닭 */
  itemIssue: NoRoom | null
  variantIssue(variant: string): NoRoom | null
  lookIssue(look: Block['look']): NoRoom | null
  /** 그런 단추를 눌렀을 때 (막아 두되, 누르면 까닭을 보여 준다) */
  onBlocked(r: NoRoom): void
  onGrip(e: ReactPointerEvent<HTMLElement>): void
  onShift(dir: -1 | 1): void
  onLook(look: Block['look']): void
  onEffect(effect: BlockEffect): void
  onPreview(effect: BlockEffect): void
  onVariant(variant: string): void
  onAddItem(): void
  /** 비어 있어서 접어 둔 칸. '칸 더하기'로 연다 */
  adds: { key: string; label: string; item: boolean; use: string }[]
  onOpenField(key: string): void
  onDuplicate(): void
  onRemove(): void
  /** 내 컴포넌트로 저장할 수 있는 것과 든 컴포넌트 수 */
  saves: { kind: SavedKind; count: number }[]
  onSave(kind: SavedKind): void
}) {
  const spec = BLOCKS[block.type]
  const [menu, setMenu] = useState<'look' | 'motion' | 'variant' | 'fields' | 'save' | null>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  // 메뉴는 도구 아래로 연다. 고른 부품이 장 아래쪽이라 아래에 자리가 모자라면 위로 (위 끝은 머리 띠 아래).
  // 남은 높이만큼만 쓰고 나머지는 메뉴 안에서 스크롤 (노트북의 낮은 창에서 잘리지 않게)
  useLayoutEffect(() => {
    const el = menuRef.current
    const at = el?.parentElement?.getBoundingClientRect()
    if (!el || !at) return
    const below = innerHeight - at.bottom - 16
    const above = at.top - 64
    const up = below < 260 && above > below
    el.classList.toggle('is-up', up)
    el.style.maxHeight = `${Math.max(160, Math.min(520, up ? above : below))}px`
  }, [menu])
  // 메뉴 밖을 누르면 닫는다. Esc는 메뉴만 닫는다 (먼저 받아서 부품 고르기 닫기, 부품 고르기 끝내기로 넘기지 않는다)
  useEffect(() => {
    if (!menu) return
    const close = (e: PointerEvent) => !(e.target as Element).closest?.('.bk-tool-menu') && setMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setMenu(null)
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [menu])
  // 그려지는 면을 보인다: 혼자 장 너비를 다 쓰는 작은 부품은 고른 면이 있어도 바탕 없이 그려진다
  const look = shownLook(block, isAlone(block))
  const effect = effectOf(block)
  const variants = spec.variants ?? []
  const variant = variantOfBlock(block)
  const canAdd = !!spec.items && blockItems(block).length < spec.items.max
  const tip = (r: NoRoom | null, ok: string) => (r ? noRoomText(r, block.type, 'change').why : ok)
  return (
    <div className="bk-tools" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="bk-tool bk-grip"
        title="끌어서 옮기기 (화살표 키로도 옮겨요)"
        aria-label={`${spec.name} 옮기기`}
        onPointerDown={(e) => {
          e.preventDefault()
          onGrip(e)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') onShift(-1)
          else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') onShift(1)
          else return
          e.preventDefault()
        }}
      >
        <GripIcon />
        <span>{spec.name}</span>
      </button>
      <span className="bk-tool-sep" />
      {/* 바탕: 견본만 늘어놓으면 무엇을 고르는지 알 수 없어서, 지금 바탕의 이름을 보이고 누르면 설명과 함께 고른다 */}
      <div className="bk-tool-menu">
        <button type="button" className={cx('bk-tool', menu === 'look' && 'is-on')} aria-expanded={menu === 'look'} title="컴포넌트의 바탕" onClick={() => setMenu(menu === 'look' ? null : 'look')}>
          <span className={cx('bk-look', `is-${look}`)} aria-hidden="true" />
          <span>{BLOCK_LOOKS.find((l) => l.id === look)?.name}</span>
        </button>
        {menu === 'look' && (
          <ul ref={menuRef} className="bk-menu is-looks" role="menu">
            {BLOCK_LOOKS.map((l) => {
              // 옅은 면과 진한 면은 안쪽 여백만큼 높아져서, 장이 꽉 찼으면 바꿀 수 없다
              const r = look === l.id ? null : lookIssue(l.id)
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={look === l.id}
                    aria-disabled={!!r}
                    className={cx('bk-menu-item', look === l.id && 'is-on', r && 'is-blocked')}
                    onClick={() => {
                      if (r) onBlocked(r)
                      else onLook(l.id)
                      setMenu(null)
                    }}
                  >
                    <span className={cx('bk-look', `is-${l.id}`)} aria-hidden="true" />
                    <b>{l.name}</b>
                    <span className="bk-menu-d">{r ? noRoomText(r, block.type, 'change').why : LOOK_NOTES[l.id]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className="bk-tool-menu">
        <button
          type="button"
          className={cx('bk-tool', menu === 'motion' && 'is-on')}
          aria-expanded={menu === 'motion'}
          title="발표할 때의 움직임"
          onClick={() => setMenu(menu === 'motion' ? null : 'motion')}
        >
          <MotionIcon />
          {/* 기본이면 무엇을 하는 단추인지를, 고른 것이 있으면 그 이름을 ('기본'만 보이면 무엇의 기본인지 모른다) */}
          <span>{effect === 'auto' ? '움직임' : BLOCK_EFFECTS.find((x) => x.id === effect)?.name}</span>
        </button>
        {menu === 'motion' && (
          <ul ref={menuRef} className="bk-menu" role="menu">
            {BLOCK_EFFECTS.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={effect === x.id}
                  className={cx('bk-menu-item', effect === x.id && 'is-on')}
                  onMouseEnter={() => onPreview(x.id)}
                  onFocus={() => onPreview(x.id)}
                  onClick={() => {
                    onEffect(x.id)
                    setMenu(null)
                  }}
                >
                  {/* 작은 그림: 마우스를 올리면 그 움직임을 되풀이한다 */}
                  <span className={cx('fx-demo', `is-${x.id}`)} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <b>{x.name}</b>
                  <span className="bk-menu-d">{x.id === 'auto' ? spec.motion : x.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* 모양: 누를 때마다 다음 모양으로 넘기면 무엇이 나올지 몰라서, 이름을 늘어놓고 고른다 */}
      {variants.length > 1 && (
        <div className="bk-tool-menu">
          <button
            type="button"
            className={cx('bk-tool', menu === 'variant' && 'is-on')}
            aria-expanded={menu === 'variant'}
            title="컴포넌트의 모양"
            onClick={() => setMenu(menu === 'variant' ? null : 'variant')}
          >
            <ShapesIcon />
            <span>{variants.find((v) => v.id === variant)?.name}</span>
          </button>
          {menu === 'variant' && (
            <ul ref={menuRef} className="bk-menu is-variants" role="menu">
              {variants.map((v) => {
                const r = v.id === variant ? null : variantIssue(v.id)
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={v.id === variant}
                      aria-disabled={!!r}
                      className={cx('bk-menu-item', v.id === variant && 'is-on', r && 'is-blocked')}
                      onClick={() => {
                        if (r) onBlocked(r)
                        else onVariant(v.id)
                        setMenu(null)
                      }}
                    >
                      <b>{v.name}</b>
                      {r && <span className="bk-menu-d">{tip(r, '')}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
      {spec.items && (
        <button
          type="button"
          className={cx('bk-tool', canAdd && itemIssue && 'is-blocked')}
          disabled={!canAdd}
          aria-disabled={!canAdd || !!itemIssue}
          title={!canAdd ? `${spec.items.label} ${spec.items.max}개까지 넣을 수 있어요` : tip(itemIssue, `${spec.items.label} 추가`)}
          onClick={() => (itemIssue ? onBlocked(itemIssue) : onAddItem())}
        >
          <PlusIcon />
          <span>{spec.items.label}</span>
        </button>
      )}
      {adds.length > 0 && (
        <div className="bk-tool-menu">
          <button
            type="button"
            className={cx('bk-tool', menu === 'fields' && 'is-on')}
            aria-expanded={menu === 'fields'}
            title="비워 두어 숨긴 칸을 꺼내 써요"
            onClick={() => setMenu(menu === 'fields' ? null : 'fields')}
          >
            <PlusIcon />
            <span>칸 더하기</span>
          </button>
          {menu === 'fields' && (
            <ul ref={menuRef} className="bk-menu is-fields" role="menu">
              {adds.map((f) => (
                <li key={f.key}>
                  <button
                    type="button"
                    role="menuitem"
                    className="bk-menu-item"
                    onClick={() => {
                      onOpenField(f.key)
                      setMenu(null)
                    }}
                  >
                    <b>{f.label}</b>
                    <span className="bk-menu-d">{f.use}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <span className="bk-tool-sep" />
      {/* 내 컴포넌트로 저장: 이 컴포넌트, 이 줄, 이 장 가운데 고른다 (다른 장, 다른 발표에서 다시 넣는다) */}
      <div className="bk-tool-menu">
        <button
          type="button"
          className={cx('bk-tool is-icon', menu === 'save' && 'is-on')}
          aria-expanded={menu === 'save'}
          title="내 컴포넌트로 저장"
          aria-label="내 컴포넌트로 저장"
          onClick={() => setMenu(menu === 'save' ? null : 'save')}
        >
          <BookmarkIcon />
        </button>
        {menu === 'save' && (
          <ul ref={menuRef} className="bk-menu is-save" role="menu" aria-label="내 컴포넌트로 저장">
            {saves.map((x) => (
              <li key={x.kind}>
                <button
                  type="button"
                  role="menuitem"
                  className="bk-menu-item"
                  onClick={() => {
                    onSave(x.kind)
                    setMenu(null)
                  }}
                >
                  <b>{SAVE_NAMES[x.kind]}</b>
                  <span className="bk-menu-d">{x.kind === 'block' ? `${spec.name}, 글과 바탕, 움직임까지` : x.kind === 'row' ? `컴포넌트 ${x.count}개를 놓인 비율 그대로` : `제목과 컴포넌트 ${x.count}개, 바탕과 움직임까지`}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" className="bk-tool is-icon" title="복제" aria-label="복제" onClick={onDuplicate}>
        <CopyIcon />
      </button>
      <button type="button" className="bk-tool is-icon" title="빼기 (Delete)" aria-label="빼기" onClick={onRemove}>
        <TrashIcon />
      </button>
    </div>
  )
}
