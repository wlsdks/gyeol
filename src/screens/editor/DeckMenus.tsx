import { useMemo } from 'react'
import { makeSlide } from '../../deck/generate'
import { ACCENT_PRESETS, THEMES, THEME_ORDER, accentOf } from '../../deck/themes'
import type { Deck } from '../../deck/types'
import { cx } from '../../lib/cx'
import { ScaledSlide, SlideCanvas } from '../../slides/SlideCanvas'
import { useDeck } from '../../store/deckStore'
import { CheckIcon, DownloadIcon, Popover } from '../ui'

export function ThemeMenu({ deck }: { deck: Deck }) {
  const setTheme = useDeck((s) => s.setTheme)
  const setAccent = useDeck((s) => s.setAccent)
  const cover = useMemo(() => {
    const s = makeSlide('cover')
    s.fields.title = deck.slides.find((x) => x.layout === 'cover')?.fields.title || deck.title
    return s
  }, [deck.slides, deck.title])
  const accent = accentOf(deck.theme)

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
      {() => (
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
          <p className="menu-h">강조색</p>
          <p className="menu-note">회사의 대표 색을 고르면 표지와 숫자에 쓰여요.</p>
          <div className="swatches">
            <button
              type="button"
              className={cx('swatch swatch-default', !deck.theme.accent && 'is-on')}
              onClick={() => setAccent(undefined)}
              title="테마 기본색"
              aria-label="테마 기본색"
              style={{ background: THEMES[deck.theme.id].accent }}
            >
              {!deck.theme.accent && <CheckIcon />}
            </button>
            {ACCENT_PRESETS.filter((c) => c !== THEMES[deck.theme.id].accent).map((c) => (
              <button
                key={c}
                type="button"
                className={cx('swatch', deck.theme.accent === c && 'is-on')}
                style={{ background: c }}
                aria-label={`강조색 ${c}`}
                onClick={() => setAccent(c)}
              >
                {deck.theme.accent === c && <CheckIcon />}
              </button>
            ))}
            <label className="swatch swatch-custom" title="직접 고르기">
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} aria-label="강조색 직접 고르기" />
            </label>
          </div>
        </div>
      )}
    </Popover>
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
            <span className="menu-item-name">PDF</span>
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
