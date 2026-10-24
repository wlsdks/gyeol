import { useMemo, useState } from 'react'
import { makeSlide } from '../../deck/generate'
import { ACCENT_COMBOS, comboName, comboSwatch, FONTS, FOOTERS, MOTIONS, TEXT_SIZES, THEMES, THEME_ORDER, TRANSITIONS, accentOf, fontOf, footerOf } from '../../deck/themes'
import type { Deck } from '../../deck/types'
import { cx } from '../../lib/cx'
import { ScaledSlide, SlideCanvas } from '../../slides/SlideCanvas'
import { useDeck } from '../../store/deckStore'
import { keys } from '../../lib/keys'
import { presenterAuto, setPresenterAuto } from '../../present/link'
import { CheckIcon, ChevronIcon, DownloadIcon, PlayIcon, Popover, Toggle } from '../ui'

/** 편집 화면의 슬라이드가 이 신호를 받으면 발표할 때의 움직임을 한 번 보여 준다 */
export const PREVIEW_MOTION = 'html-maker:preview-motion'

export function ThemeMenu({ deck }: { deck: Deck }) {
  const setTheme = useDeck((s) => s.setTheme)
  const setAccent = useDeck((s) => s.setAccent)
  const setMotion = useDeck((s) => s.setMotion)
  const setLook = useDeck((s) => s.setLook)
  const motion = deck.motion ?? 'calm'
  const font = fontOf(deck.theme)
  const size = deck.theme.size ?? 'normal'
  const footer = footerOf(deck)
  const transition = deck.theme.transition ?? 'auto'
  const cover = useMemo(() => {
    const s = makeSlide('cover')
    s.fields.title = deck.slides.find((x) => x.layout === 'cover')?.fields.title || deck.title
    return s
  }, [deck.slides, deck.title])
  const accent = accentOf(deck.theme)
  // 색 고르기 창은 소문자(#2f55d4)로, 견본은 대문자로 적혀 있어서 대소문자 없이 견준다
  const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase()
  const combos = ACCENT_COMBOS.filter((c) => !same(c.accent, THEMES[deck.theme.id].accent))
  const isDefault = !deck.theme.accent || same(deck.theme.accent, THEMES[deck.theme.id].accent)
  // 견본에 없는 색을 직접 골랐으면 '직접 고르기' 칸이 그 색으로 골라진 것처럼 보인다
  const custom = !isDefault && !combos.some((c) => same(c.accent, deck.theme.accent))

  return (
    <Popover
      className="pop-theme"
      button={({ toggle, open }) => (
        <button type="button" className="btn btn-ghost" aria-expanded={open} onClick={toggle}>
          <span className="swatch-dot" style={{ background: accent }} aria-hidden="true" />
          테마
        </button>
      )}
    >
      {(close) => (
        <div className="theme-menu">
          <p className="menu-h">테마</p>
          <div className="theme-grid">
            {THEME_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className={cx('theme-opt', deck.theme.id === id && 'is-on')}
                aria-pressed={deck.theme.id === id}
                onClick={() => setTheme(id)}
              >
                <ScaledSlide width={156}>
                  <SlideCanvas deck={{ ...deck, theme: { ...deck.theme, id } }} slide={cover} mode="final" />
                </ScaledSlide>
                <span>{THEMES[id].name}</span>
              </button>
            ))}
          </div>
          <p className="menu-h">
            강조색 <span className="menu-h-v">{comboName(deck.theme)}</span>
          </p>
          <p className="menu-note">숫자와 강조할 항목에만 쓰여요. 바탕과 넓은 면은 늘 흰색이나 검은색이에요. 회사의 대표 색은 마지막 칸에서 직접 골라요.</p>
          <div className="swatches">
            <button
              type="button"
              className={cx('swatch swatch-default', isDefault && 'is-on')}
              onClick={() => setAccent(undefined)}
              title="테마 기본색"
              aria-label="테마 기본색"
              aria-pressed={isDefault}
              style={{ background: comboSwatch(THEMES[deck.theme.id]) }}
            >
              {isDefault && <CheckIcon />}
            </button>
            {combos.map((c) => (
              <button
                key={c.accent}
                type="button"
                className={cx('swatch', same(deck.theme.accent, c.accent) && 'is-on')}
                // 강조색과 짙은 면을 반씩: 고르면 어떤 짝으로 칠해지는지 보이게
                style={{ background: comboSwatch(c) }}
                title={c.name}
                aria-label={`강조색 ${c.name}`}
                aria-pressed={same(deck.theme.accent, c.accent)}
                onClick={() => setAccent(c.accent)}
              >
                {same(deck.theme.accent, c.accent) && <CheckIcon />}
              </button>
            ))}
            <label className={cx('swatch swatch-custom', custom && 'is-on')} title="직접 고르기" style={custom ? { background: accent } : undefined}>
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} aria-label={custom ? `강조색 직접 고르기, 지금 ${accent}` : '강조색 직접 고르기'} />
              {custom && <CheckIcon />}
            </label>
          </div>
          <p className="menu-h">제목 글꼴</p>
          <Choice label="제목 글꼴" options={FONTS} value={font} onPick={(id) => setLook({ font: id })} />
          <p className="menu-h">글자 크기</p>
          <Choice label="글자 크기" options={TEXT_SIZES} value={size} onPick={(id) => setLook({ size: id })} />
          <p className="menu-h">아래 표시</p>
          <Choice label="아래 표시" options={FOOTERS} value={footer} onPick={(id) => setLook({ footer: id })} />
          <p className="menu-h">발표할 때 움직임</p>
          <div className="seg seg-full" role="group" aria-label="발표할 때 움직임">
            {MOTIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={cx('seg-btn', motion === m.id && 'is-on')}
                aria-pressed={motion === m.id}
                onClick={() => {
                  setMotion(m.id)
                  // 메뉴가 슬라이드를 가리지 않게 닫고 보여 준다
                  if (m.id !== 'none') {
                    close()
                    window.dispatchEvent(new Event(PREVIEW_MOTION))
                  }
                }}
              >
                {m.name}
              </button>
            ))}
          </div>
          <p className="menu-note motion-note">
            {MOTIONS.find((m) => m.id === motion)?.description}
            {motion !== 'none' && (
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  close()
                  window.dispatchEvent(new Event(PREVIEW_MOTION))
                }}
              >
                지금 장에서 보기
              </button>
            )}
          </p>
          <p className="menu-h">장 넘기기</p>
          <Choice label="장 넘기기" options={TRANSITIONS} value={transition} onPick={(id) => setLook({ transition: id })} wrap />
        </div>
      )}
    </Popover>
  )
}

/** 몇 가지 중 하나를 고르는 줄. 고른 것의 설명을 아래에 보여 준다. */
function Choice<T extends string>({
  label,
  options,
  value,
  onPick,
  wrap,
}: {
  label: string
  options: { id: T; name: string; description: string }[]
  value: T
  onPick: (id: T) => void
  wrap?: boolean
}) {
  return (
    <>
      <div className={cx('seg', wrap ? 'seg-wrap seg-pad' : 'seg-full')} role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} type="button" className={cx('seg-btn', value === o.id && 'is-on')} aria-pressed={value === o.id} onClick={() => onPick(o.id)}>
            {o.name}
          </button>
        ))}
      </div>
      <p className="menu-note choice-note">{options.find((o) => o.id === value)?.description}</p>
    </>
  )
}

export function ExportMenu({ onHtml, onPdf, onDeckFile }: { onHtml: () => void; onPdf: () => void; onDeckFile: () => void }) {
  return (
    <Popover
      button={({ toggle, open }) => (
        <button type="button" className="btn btn-ghost" aria-expanded={open} onClick={toggle}>
          <DownloadIcon />
          내보내기
        </button>
      )}
    >
      {(close) => (
        <div className="menu menu-export">
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              close()
              onHtml()
            }}
          >
            <span className="menu-item-name">발표 파일 (HTML)</span>
            <span className="menu-item-desc">인터넷 없이도 열리는 파일이에요. 메일로 미리 보내도 발표자 노트는 들어가지 않아요.</span>
          </button>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              close()
              onPdf()
            }}
          >
            <span className="menu-item-name">PDF <kbd>{keys('mod+P')}</kbd></span>
            <span className="menu-item-desc">인쇄 창이 열리면 대상에서 ‘PDF로 저장’을 고르세요.</span>
          </button>
          <div className="menu-sep" role="separator" />
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              close()
              onDeckFile()
            }}
          >
            <span className="menu-item-name">작업 파일 (.deck)</span>
            <span className="menu-item-desc">발표자 노트까지 담긴 원본이에요. 다른 PC에서 이어서 고칠 때 ‘파일 열기’로 불러오세요. 다른 분께는 보내지 마세요.</span>
          </button>
        </div>
      )}
    </Popover>
  )
}

export type PresentHow = 'auto' | 'single' | 'presenter'

/** 발표하기. 옆의 화살표로 발표자 화면을 쓸지 고른다. */
export function PresentButton({ onStart }: { onStart: (how: PresentHow, here: boolean) => void }) {
  const [auto, setAuto] = useState(presenterAuto)
  return (
    <div className="split">
      <button type="button" className="btn btn-primary split-main" title="처음부터 발표 (F5)" onClick={() => onStart('auto', false)}>
        <PlayIcon />
        발표하기
      </button>
      <Popover
        button={({ toggle, open }) => (
          <button type="button" className="btn btn-primary split-more" aria-label="발표 방법 고르기" aria-expanded={open} onClick={toggle}>
            <ChevronIcon />
          </button>
        )}
      >
        {(close) => (
          <div className="menu menu-present">
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                close()
                onStart('presenter', false)
              }}
            >
              <span className="menu-item-name">발표자 화면과 함께 발표 <kbd>{keys('alt+F5')}</kbd></span>
              <span className="menu-item-desc">큰 화면에는 슬라이드만, 이 화면에는 다음 장, 노트, 시간이 보여요.</span>
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                close()
                onStart('single', false)
              }}
            >
              <span className="menu-item-name">슬라이드만 발표</span>
              <span className="menu-item-desc">화면 하나에 슬라이드만 꽉 차게 띄워요.</span>
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                close()
                onStart('auto', true)
              }}
            >
              <span className="menu-item-name">지금 장부터 발표 <kbd>{keys('shift+F5')}</kbd></span>
            </button>
            <div className="menu-sep" role="separator" />
            <div className="menu-toggle">
              <Toggle
                label="화면이 두 개면 발표자 화면 쓰기"
                on={auto}
                onChange={(v) => {
                  setAuto(v)
                  setPresenterAuto(v)
                }}
              />
            </div>
          </div>
        )}
      </Popover>
    </div>
  )
}
