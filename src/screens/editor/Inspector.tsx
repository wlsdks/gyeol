import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { missingFields, visibleItems, type Missing } from '../../deck/fields'
import { emptyItem } from '../../deck/generate'
import { highlightOf, LAYOUTS, LAYOUT_GROUPS, panesOf, placeOf, sideOf, variantOf } from '../../deck/layouts'
import { isDarkLook, MOTIONS, motionOf, PLACES, toneOf, TONES } from '../../deck/themes'
import type { Deck, LayoutId, Motion, Slide } from '../../deck/types'
import { cx } from '../../lib/cx'
import { BOLD_LAYOUTS } from '../../slides/layouts'
import { sideName } from '../../slides/panes'
import { ScaledSlide, SlideCanvas } from '../../slides/SlideCanvas'
import { PREVIEW_MOTION } from './DeckMenus'
import { BackIcon, CheckIcon, ChevronIcon, Info, PlayIcon, Toggle } from '../ui'
import { useDeck } from '../../store/deckStore'

const PREVIEW_SECTIONS = ['섹션 1', '섹션 2', '섹션 3']

type Look = Pick<Deck, 'meta' | 'theme' | 'title'>

/**
 * 오른쪽 칸의 '이 장 설정'. 늘 보는 것(지금 레이아웃, 빈칸, 모양, 바탕, 움직임)만 한 화면에 두고
 * 서른 가지가 넘는 레이아웃 목록은 '바꾸기'를 눌렀을 때만 따로 연다. 예전에는 한 칸에 다 늘어놓아
 * 3천 px 가까이 내려야 했고, 무엇을 고치는 칸인지 한눈에 들어오지 않았다.
 */
export function Inspector({
  deck,
  slide,
  onFocusField,
  onPeekLayout,
}: {
  deck: Deck
  slide: Slide
  onFocusField: (m: Missing) => void
  /** 레이아웃 그림에 마우스를 올리면 슬라이드 자리에 그 레이아웃으로 미리 보인다 (null이면 그만) */
  onPeekLayout: (layout: LayoutId | null) => void
}) {
  const changeLayout = useDeck((s) => s.changeLayout)
  const [picking, setPicking] = useState(false)
  // 다른 장을 고르면 레이아웃 고르기를 닫는다
  useEffect(() => setPicking(false), [slide.id])
  const look = useMemo<Look>(() => ({ meta: deck.meta, theme: deck.theme, title: deck.title }), [deck.meta, deck.theme, deck.title])

  if (picking) {
    const close = () => {
      onPeekLayout(null)
      setPicking(false)
    }
    return (
      <LayoutPicker
        slide={slide}
        look={look}
        onPeek={onPeekLayout}
        onPick={(id) => {
          if (id !== slide.layout) changeLayout(slide.id, id)
          close()
        }}
        onBack={close}
      />
    )
  }
  return (
    <div className="ins" role="tabpanel" aria-label="이 장 설정">
      <section className="ins-sec ins-top">
        <button type="button" className="ins-cur" title="레이아웃 바꾸기" onClick={() => setPicking(true)}>
          <ScaledSlide width={104}>
            <SlideCanvas deck={look} slide={slide} mode="preview" sections={PREVIEW_SECTIONS} sectionIndex={0} />
          </ScaledSlide>
          <span className="ins-cur-t">
            <span className="ins-cur-k">레이아웃</span>
            <span className="ins-cur-n">{LAYOUTS[slide.layout].name}</span>
          </span>
          <span className="ins-cur-go">
            바꾸기
            <ChevronIcon />
          </span>
        </button>
        <Blanks deck={deck} slide={slide} onFocusField={onFocusField} />
      </section>
      <ShapeSection slide={slide} look={look} />
      <LookSection deck={deck} slide={slide} />
    </div>
  )
}

/** 빈칸: 몇 곳 남았는지와 '다음 빈칸'. 목록은 펼쳐야 보인다 (빈칸이 열 곳이면 목록만으로 칸이 찬다) */
function Blanks({ deck, slide, onFocusField }: { deck: Deck; slide: Slide; onFocusField: (m: Missing) => void }) {
  const missing = missingFields(slide, deck.meta)
  const [open, setOpen] = useState(false)
  const [next, setNext] = useState(0)
  useEffect(() => setNext(0), [slide.id])
  // 컴포넌트가 하나도 없는 장은 채울 칸이 없을 뿐이지 다 채운 것이 아니다
  if (slide.layout === 'compose' && !slide.rows?.some((r) => r.blocks.length)) {
    return <p className="ins-blank">아직 넣은 컴포넌트가 없어요</p>
  }
  if (!missing.length) {
    return (
      <p className="ins-blank is-done">
        <CheckIcon />
        빈칸을 모두 채웠어요
      </p>
    )
  }
  const go = () => {
    const i = next % missing.length
    onFocusField(missing[i])
    setNext(i + 1)
  }
  return (
    <div className="ins-blank-wrap">
      <div className="ins-blank">
        <button type="button" className="ins-blank-n" aria-expanded={open} title={open ? '빈칸 목록 접기' : '빈칸 목록 보기'} onClick={() => setOpen((v) => !v)}>
          <span className="ins-blank-dot" aria-hidden="true" />
          빈칸 {missing.length}곳
          <span className={cx('ins-blank-chev', open && 'is-open')} aria-hidden="true">
            <ChevronIcon />
          </span>
        </button>
        <button type="button" className="btn btn-ghost btn-sm ins-blank-go" title="비어 있는 칸으로 차례로 옮겨 가요" onClick={go}>
          다음 빈칸
        </button>
      </div>
      {open && (
        <ul className="ins-missing">
          {missing.map((m) => (
            <li key={`${m.block ?? ''}.${m.item ?? ''}.${m.key}`}>
              <button type="button" className="ins-missing-btn" onClick={() => onFocusField(m)}>
                {m.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 레이아웃 안에서 고르는 것: 모양, 강조할 항목, 두 판의 자리와 너비, 그림 맞추기 */
function ShapeSection({ slide, look }: { slide: Slide; look: Look }) {
  const setOptions = useDeck((s) => s.setOptions)
  const setVariant = useDeck((s) => s.setVariant)
  const variants = LAYOUTS[slide.layout].variants ?? []
  const current = variantOf(slide)
  const highlight = LAYOUTS[slide.layout].highlight
  const panes = panesOf(slide)
  const side = sideOf(slide)
  const place = placeOf(slide)
  const placeSpec = LAYOUTS[slide.layout].place
  const hasOptions = !!highlight || slide.layout === 'imageText' || !!panes || !!place
  if (variants.length < 2 && !hasOptions) return null
  return (
    <section className="ins-sec">
      <h2 className="ins-h">모양</h2>
      {variants.length > 1 && (
        <div className="ins-variants">
          {variants.map((v) => (
            <LayoutChoice
              key={v.id}
              id={slide.layout}
              variant={v.id}
              name={v.name}
              look={look}
              slide={slide}
              width={86}
              on={current === v.id}
              onPick={() => setVariant(slide.id, v.id)}
            />
          ))}
        </div>
      )}
      {highlight && (
        <Opt label={highlight.label} wide={visibleItems(slide).length > 3}>
          <div className="seg seg-fill" role="group" aria-label={highlight.label}>
            {[-1, ...visibleItems(slide).map((_, i) => i)].map((i) => (
              <button
                key={i}
                type="button"
                className={cx('seg-btn', highlightOf(slide) === i && 'is-on')}
                aria-pressed={highlightOf(slide) === i}
                title={i < 0 ? '강조하지 않아요' : `${i + 1}번째 항목을 강조해요`}
                onClick={() => setOptions(slide.id, { highlight: i })}
              >
                {i < 0 ? '없음' : i + 1}
              </button>
            ))}
          </div>
        </Opt>
      )}
      {panes && side !== null && (
        <>
          <Opt label={`${panes.name} 위치`} tip="장 위에서 판의 이름표를 끌어 반대쪽에 놓아도 돼요.">
            <div className="seg" role="group" aria-label={`${panes.name} 위치`}>
              {(['left', 'right'] as const).map((at) => {
                // 처음에 왼쪽에 있는 판(이미지)은 반대쪽이 오른쪽
                const flip = panes.start ? at === 'right' : at === 'left'
                const on = !!slide.options.flip === flip
                return (
                  <button key={at} type="button" className={cx('seg-btn', on && 'is-on')} aria-pressed={on} onClick={() => setOptions(slide.id, { flip: flip || undefined })}>
                    {at === 'left' ? '왼쪽' : '오른쪽'}
                  </button>
                )
              })}
            </div>
          </Opt>
          <Opt label={`${panes.name} 너비`} wide={panes.sides.length > 3} tip="장 위에서 두 판 사이의 경계를 끌어도 돼요.">
            <div className={cx('seg', panes.sides.length > 3 && 'seg-fill')} role="group" aria-label={`${panes.name} 너비`}>
              {panes.sides.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={cx('seg-btn', side === n && 'is-on')}
                  aria-pressed={side === n}
                  onClick={() => setOptions(slide.id, { pane: n === panes.base ? undefined : n })}
                >
                  {sideName(n, panes.base)}
                </button>
              ))}
            </div>
          </Opt>
        </>
      )}
      {place && placeSpec && (
        <Opt label={`${placeSpec.name} 자리`} tip="장 위에서 제목을 누르고 위쪽 막대의 이름을 위아래로 끌어도 돼요.">
          <div className="seg" role="group" aria-label={`${placeSpec.name} 자리`}>
            {PLACES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={cx('seg-btn', place === p.id && 'is-on')}
                aria-pressed={place === p.id}
                title={p.description}
                onClick={() => setOptions(slide.id, { place: p.id === placeSpec.base ? undefined : p.id })}
              >
                {p.name}
              </button>
            ))}
          </div>
        </Opt>
      )}
      {slide.layout === 'imageText' && (
        <Toggle label="이미지를 자르지 않고 전체 보이기" on={!!slide.options.contain} onChange={(v) => setOptions(slide.id, { contain: v })} />
      )}
    </section>
  )
}

/** 이 장만의 바탕과 움직임 */
function LookSection({ deck, slide }: { deck: Deck; slide: Slide }) {
  const setOptions = useDeck((s) => s.setOptions)
  const moving = motionOf(deck, slide) !== 'none'
  return (
    <section className="ins-sec">
      <h2 className="ins-h">꾸미기</h2>
      {!BOLD_LAYOUTS.includes(slide.layout) && (
        <Opt label="바탕">
          <div className="seg" role="group" aria-label="바탕">
            {TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={cx('seg-btn', toneOf(slide) === t.id && 'is-on')}
                aria-pressed={toneOf(slide) === t.id}
                title={t.description}
                onClick={() => setOptions(slide.id, { tone: t.id === 'base' ? undefined : t.id })}
              >
                {t.id === 'base' ? '기본' : t.id === 'invert' ? (isDarkLook(deck.theme) ? '밝게' : '어둡게') : t.name}
              </button>
            ))}
          </div>
        </Opt>
      )}
      <Opt
        label="움직임"
        wide
        extra={
          moving && (
            <button type="button" className="icon-btn ins-play" title="이 장의 움직임 미리 보기" aria-label="이 장의 움직임 미리 보기" onClick={() => window.dispatchEvent(new Event(PREVIEW_MOTION))}>
              <PlayIcon />
            </button>
          )
        }
      >
        <div className="seg seg-fill" role="group" aria-label="이 장의 움직임">
          {[{ id: undefined, name: '기본', description: '테마 메뉴에서 정한 발표 전체의 움직임을 따라요.' }, ...MOTIONS].map((m) => {
            const on = (slide.options.motion ?? undefined) === m.id
            return (
              <button
                key={m.id ?? 'deck'}
                type="button"
                className={cx('seg-btn', on && 'is-on')}
                aria-pressed={on}
                title={m.description}
                onClick={() => setOptions(slide.id, { motion: m.id as Motion | undefined })}
              >
                {m.name}
              </button>
            )
          })}
        </div>
      </Opt>
    </section>
  )
}

/**
 * 고르기 한 줄: 이름은 왼쪽, 고르는 단추는 오른쪽. 단추가 많으면(wide) 이름 아래 한 줄을 다 쓴다.
 * 고르는 단추는 줄을 바꾸지 않는다 (넷이 두 줄로 꺾이면 무엇끼리 고르는지 헷갈린다)
 */
function Opt({ label, tip, wide, extra, children }: { label: string; tip?: string; wide?: boolean; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className={cx('ins-opt', wide && 'is-wide')}>
      <span className="ins-opt-l">
        {label}
        {tip && (
          <Info label={`${label} 도움말`} align="start">
            {tip}
          </Info>
        )}
        {extra}
      </span>
      {children}
    </div>
  )
}

/** 레이아웃 바꾸기: 묶음마다 그림으로 고른다. 그림에 올리면 슬라이드 자리에서 미리 보인다 */
function LayoutPicker({
  slide,
  look,
  onPeek,
  onPick,
  onBack,
}: {
  slide: Slide
  look: Look
  onPeek: (layout: LayoutId | null) => void
  onPick: (layout: LayoutId) => void
  onBack: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && onBack()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onBack])
  return (
    <div className="ins ins-picker" role="tabpanel" aria-label="레이아웃 바꾸기" onPointerLeave={() => onPeek(null)}>
      <div className="ins-picker-h">
        <button type="button" className="icon-btn" aria-label="이 장 설정으로 돌아가기" title="돌아가기 (Esc)" onClick={onBack}>
          <BackIcon />
        </button>
        <h2 className="ins-picker-t">레이아웃 바꾸기</h2>
        <Info label="레이아웃 바꾸기 도움말">적은 글은 그대로 두고 모양만 바뀌어요. 그림에 마우스를 올리면 슬라이드에서 미리 보여요.</Info>
      </div>
      {LAYOUT_GROUPS.map((g) => (
        <div key={g.name} className="ins-group" role="group" aria-label={g.name}>
          <p className="ins-group-h">{g.name}</p>
          <div className="ins-layouts">
            {g.layouts.map((id) => (
              <LayoutChoice
                key={id}
                id={id}
                name={LAYOUTS[id].name}
                look={look}
                slide={slide}
                on={slide.layout === id}
                onPick={() => onPick(id)}
                onPeek={(on) => onPeek(on && id !== slide.layout ? id : null)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** 이 장을 다른 레이아웃(이나 모양)으로 그린 모습. 항목이 모자라면 미리 보기에서만 빈 항목을 채워 모양을 보인다 */
export function layoutPreview(slide: Slide, id: LayoutId, variant?: string): Slide {
  const spec = LAYOUTS[id].items
  const want = spec ? Math.max(spec.min, slide.items.length || spec.default) : 0
  const items = [...slide.items]
  while (items.length < want) items.push(emptyItem())
  return { ...slide, layout: id, items, variant: variant ?? (id === slide.layout ? slide.variant : undefined) }
}

export function LayoutChoice({
  id,
  variant,
  name,
  look,
  slide,
  on,
  width = 136,
  onPick,
  onPeek,
}: {
  id: LayoutId
  variant?: string
  name: string
  look: Look
  slide: Slide
  on: boolean
  width?: number
  onPick: () => void
  onPeek?: (on: boolean) => void
}) {
  const preview = useMemo(() => layoutPreview(slide, id, variant), [slide, id, variant])
  return (
    <button
      type="button"
      className={cx('ins-layout', on && 'is-on')}
      aria-pressed={on}
      onClick={onPick}
      onPointerEnter={onPeek && (() => onPeek(true))}
      onFocus={onPeek && (() => onPeek(true))}
      onBlur={onPeek && (() => onPeek(false))}
    >
      <ScaledSlide width={width}>
        <SlideCanvas deck={look} slide={preview} mode="preview" sections={PREVIEW_SECTIONS} sectionIndex={0} />
      </ScaledSlide>
      <span>{name}</span>
    </button>
  )
}
