import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { pageInfo } from '../deck/fields'
import { uid } from '../deck/generate'
import type { Deck } from '../deck/types'
import { pageProps, SlideCanvas } from '../slides/SlideCanvas'
import { safeFileName } from '../store/deckFile'
import motionCss from '../motion/motion.css?inline'
import slidesCss from '../slides/slides.css?inline'
import blocksCss from '../slides/blocks.css?inline'
import { embedFonts, fontFamiliesOf } from './fonts'
import { VIEWER_CSS, VIEWER_JS, VIEWER_TEXT } from './viewer'

const DATA_ID = 'html-maker-deck'

function ExportSlides({ deck }: { deck: Deck }) {
  const info = pageInfo(deck.slides)
  return (
    <>
      {deck.slides
        .filter((s) => !s.hidden)
        .map((s) => (
          <section key={s.id} className="v-slide">
            <div className="v-frame">
              <div className="v-scale">
                <SlideCanvas deck={deck} slide={s} mode="final" {...pageProps(info, s.id)} />
              </div>
            </div>
          </section>
        ))}
    </>
  )
}

function renderSlides(deck: Deck): string {
  const host = document.createElement('div')
  const root = createRoot(host)
  flushSync(() => root.render(<ExportSlides deck={deck} />))
  const html = host.innerHTML
  root.unmount()
  return html
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

/** 다시 열어 편집할 수 있게 덱을 넣어 둔다. 발표자 노트는 빼서 다른 사람에게 보내도 안전하다. */
function deckData(deck: Deck): string {
  const safe: Deck = { ...deck, slides: deck.slides.map((s) => ({ ...s, notes: '' })) }
  return JSON.stringify(safe).replace(/</g, '\\u003c')
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
}

/**
 * 내보낸 파일은 메일로 오가며 어디서 열릴지 모른다. 어떤 주소로도 연결하지 못하게 막고,
 * 스크립트는 들어 있는 뷰어 하나만 돌게 한다.
 */
async function exportCsp(): Promise<string> {
  return [
    "default-src 'none'",
    `script-src 'sha256-${await sha256(VIEWER_JS)}'`,
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    'font-src data:',
    'media-src data: blob:',
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
}

export async function buildHtml(deck: Deck): Promise<string> {
  const slides = renderSlides(deck)
  const families = fontFamiliesOf(deck.theme)
  const text = (slides.replace(/<[^>]+>/g, ' ') + deck.title + VIEWER_TEXT).replace(/&[a-z]+;/g, ' ')
  const fonts = await embedFonts(text, families)
  const csp = await exportCsp()
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="html-maker">
<title>${escapeHtml(deck.title)}</title>
<style>
${fonts}
${slidesCss}
${blocksCss}
${motionCss}
${VIEWER_CSS}
</style>
</head>
<body>
<header class="v-bar">
  <span class="v-title">${escapeHtml(deck.title)}</span>
  <span class="v-actions">
    <button type="button" class="v-btn" id="v-print">PDF로 저장</button>
    <button type="button" class="v-btn v-btn-primary" id="v-present">발표 시작</button>
  </span>
</header>
<main class="v-deck">
${slides}
</main>
<div class="v-count" aria-live="polite"></div>
<div class="v-blank" hidden></div>
<script type="application/json" id="${DATA_ID}">${deckData(deck)}</script>
<script>${VIEWER_JS}</script>
</body>
</html>`
}

function fileName(title: string): string {
  return `${safeFileName(title, '발표')}.html`
}

export async function downloadHtml(deck: Deck): Promise<void> {
  const html = await buildHtml(deck)
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName(deck.title)
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** 내보낸 HTML 파일에서 덱을 되살린다. 새 발표로 저장된다. */
export function readDeckFromHtml(html: string): Deck | null {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const raw = doc.getElementById(DATA_ID)?.textContent
    if (!raw) return null
    const deck = JSON.parse(raw) as Deck
    if (!Array.isArray(deck.slides) || !deck.meta || !deck.theme) return null
    return { ...deck, id: uid(), updatedAt: Date.now() }
  } catch {
    return null
  }
}
