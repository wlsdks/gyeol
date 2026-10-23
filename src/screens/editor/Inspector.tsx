import { useMemo } from 'react'
import { missingFields, visibleItems, type Missing } from '../../deck/fields'
import { emptyItem } from '../../deck/generate'
import { highlightOf, LAYOUTS, LAYOUT_GROUPS, variantOf } from '../../deck/layouts'
import { isDarkLook, MOTIONS, motionOf, toneOf, TONES } from '../../deck/themes'
import type { Deck, LayoutId, Motion, Slide } from '../../deck/types'
import { cx } from '../../lib/cx'
import { BOLD_LAYOUTS } from '../../slides/layouts'
import { ScaledSlide, SlideCanvas } from '../../slides/SlideCanvas'
import { PREVIEW_MOTION } from './DeckMenus'
import { Toggle } from '../ui'
import { useDeck } from '../../store/deckStore'

const PREVIEW_SECTIONS = ['단락 1', '단락 2', '단락 3']

const METHOD_TIPS: Record<Deck['meta']['method'], string> = {
  live: '현장 발표에서는 화면의 글을 줄이고, 말로 할 설명은 아래 발표자 노트에 적어 두세요.',
  remote: '화면 공유에서는 글씨가 작게 보일 수 있어요. 한 장에 한 가지만 담아 주세요.',
  send: '보내는 자료는 혼자 읽어도 이해되게 설명을 문장으로 충분히 적어 주세요.',
}

export function Inspector({ deck, slide, onFocusField }: { deck: Deck; slide: Slide; onFocusField: (m: Missing) => void }) {
  const changeLayout = useDeck((s) => s.changeLayout)
  const setOptions = useDeck((s) => s.setOptions)
  const setHidden = useDeck((s) => s.setHidden)
  const setVariant = useDeck((s) => s.setVariant)
  const missing = missingFields(slide, deck.meta)
  const variants = LAYOUTS[slide.layout].variants ?? []
  const current = variantOf(slide)
  const highlight = LAYOUTS[slide.layout].highlight
  const hasOptions = !!highlight || slide.layout === 'imageText'
  const look = useMemo(() => ({ meta: deck.meta, theme: deck.theme, title: deck.title }), [deck.meta, deck.theme, deck.title])

  return (
    <aside className="ins" aria-label="이 장 설정">
      <section className="ins-sec">
        <h2 className="ins-h">이 장의 역할</h2>
        <p className="ins-purpose">{slide.purpose}</p>
        <p className="ins-guide">{slide.guide}</p>
        <p className="ins-tip">{METHOD_TIPS[deck.meta.method]}</p>
      </section>

      <section className="ins-sec">
        <h2 className="ins-h">{missing.length ? `빈칸 ${missing.length}곳` : '빈칸'}</h2>
        {missing.length === 0 ? (
          <p className="ins-done">모두 채웠어요</p>
        ) : (
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
      </section>

      {(variants.length > 1 || hasOptions) && (
        <section className="ins-sec">
          <h2 className="ins-h">모양</h2>
          {variants.length > 1 && (
            <div className="ins-layouts ins-variants">
              {variants.map((v) => (
                <LayoutChoice
                  key={v.id}
                  id={slide.layout}
                  variant={v.id}
                  name={v.name}
                  look={look}
                  slide={slide}
                  on={current === v.id}
                  onPick={() => setVariant(slide.id, v.id)}
                />
              ))}
            </div>
          )}
          {highlight && (
            <div className="ins-row ins-row-wrap">
              <span className="ins-label">{highlight.label}</span>
              <div className="seg seg-wrap" role="group" aria-label={highlight.label}>
                {[-1, ...visibleItems(slide).map((_, i) => i)].map((i) => (
                  <button
                    key={i}
                    type="button"
                    className={cx('seg-btn', highlightOf(slide) === i && 'is-on')}
                    aria-pressed={highlightOf(slide) === i}
                    onClick={() => setOptions(slide.id, { highlight: i })}
                  >
                    {i < 0 ? '없음' : `${i + 1}번`}
                  </button>
                ))}
              </div>
            </div>
          )}
          {slide.layout === 'imageText' && (
            <>
              <Toggle label="이미지를 오른쪽에" on={!!slide.options.flip} onChange={(v) => setOptions(slide.id, { flip: v })} />
              <Toggle
                label="이미지를 자르지 않고 전체 보이기"
                on={!!slide.options.contain}
                onChange={(v) => setOptions(slide.id, { contain: v })}
              />
            </>
          )}
        </section>
      )}

      <section className="ins-sec">
        <h2 className="ins-h">이 장 꾸미기</h2>
        {!BOLD_LAYOUTS.includes(slide.layout) && (
          <div className="ins-row ins-row-wrap">
            <span className="ins-label">바탕</span>
            <div className="seg seg-wrap" role="group" aria-label="바탕">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={cx('seg-btn', toneOf(slide) === t.id && 'is-on')}
                  aria-pressed={toneOf(slide) === t.id}
                  title={t.description}
                  onClick={() => setOptions(slide.id, { tone: t.id === 'base' ? undefined : t.id })}
                >
                  {t.id === 'invert' ? (isDarkLook(deck.theme) ? '밝게' : '어둡게') : t.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="ins-row ins-row-wrap">
          <span className="ins-label">움직임</span>
          <div className="seg seg-grid" role="group" aria-label="이 장의 움직임">
            {[{ id: undefined, name: '전체 설정' }, ...MOTIONS].map((m) => {
              const on = (slide.options.motion ?? undefined) === m.id
              return (
                <button
                  key={m.id ?? 'deck'}
                  type="button"
                  className={cx('seg-btn', on && 'is-on')}
                  aria-pressed={on}
                  title={m.id ? undefined : '테마 메뉴에서 정한 발표 전체의 움직임을 따라요'}
                  onClick={() => setOptions(slide.id, { motion: m.id as Motion | undefined })}
                >
                  {m.name}
                </button>
              )
            })}
          </div>
        </div>
        {motionOf(deck, slide) !== 'none' && (
          <button type="button" className="link-btn ins-link" onClick={() => window.dispatchEvent(new Event(PREVIEW_MOTION))}>
            이 장의 움직임 미리 보기
          </button>
        )}
      </section>

      <section className="ins-sec">
        <h2 className="ins-h">레이아웃 바꾸기</h2>
        <p className="ins-note">지금 쓴 내용 그대로 모양만 바뀌어요.</p>
        {LAYOUT_GROUPS.map((g) => (
          <div key={g.name} className="ins-group" role="group" aria-label={g.name}>
            <p className="ins-group-h">{g.name}</p>
            <div className="ins-layouts">
              {g.layouts.map((id) => (
                <LayoutChoice key={id} id={id} name={LAYOUTS[id].name} look={look} slide={slide} on={slide.layout === id} onPick={() => changeLayout(slide.id, id)} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="ins-sec">
        <Toggle label="발표할 때 이 장 건너뛰기" on={!!slide.hidden} onChange={(v) => setHidden(slide.id, v)} />
      </section>
    </aside>
  )
}

function LayoutChoice({
  id,
  variant,
  name,
  look,
  slide,
  on,
  onPick,
}: {
  id: LayoutId
  variant?: string
  name: string
  look: Pick<Deck, 'meta' | 'theme' | 'title'>
  slide: Slide
  on: boolean
  onPick: () => void
}) {
  const preview = useMemo(() => {
    // 항목이 모자라면 미리보기에서만 빈 항목을 채워 모양을 보여준다
    const spec = LAYOUTS[id].items
    const want = spec ? Math.max(spec.min, slide.items.length || spec.default) : 0
    const items = [...slide.items]
    while (items.length < want) items.push(emptyItem())
    return { ...slide, layout: id, items, variant: variant ?? (id === slide.layout ? slide.variant : undefined) }
  }, [slide, id, variant])
  return (
    <button type="button" className={cx('ins-layout', on && 'is-on')} aria-pressed={on} onClick={onPick}>
      <ScaledSlide width={124}>
        <SlideCanvas deck={look} slide={preview} mode="preview" sections={PREVIEW_SECTIONS} sectionIndex={0} />
      </ScaledSlide>
      <span>{name}</span>
    </button>
  )
}

