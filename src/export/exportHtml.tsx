import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { pageInfo } from '../deck/fields'
import { uid } from '../deck/generate'
import type { Deck } from '../deck/types'
import { pageProps, SlideCanvas } from '../slides/SlideCanvas'
import { safeFileName } from '../store/deckFile'
import slidesCss from '../slides/slides.css?inline'
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

// ---------- 폰트: 실제로 쓴 글자가 들어 있는 묶음만 파일에 넣는다 ----------

type Range = [number, number]

function parseRanges(value: string): Range[] {
  return value.split(',').flatMap((part) => {
    const m = /U\+([0-9a-f?]+)(?:-([0-9a-f]+))?/i.exec(part.trim())
    if (!m) return []
    if (m[1].includes('?')) return [[parseInt(m[1].replace(/\?/g, '0'), 16), parseInt(m[1].replace(/\?/g, 'f'), 16)] as Range]
    const start = parseInt(m[1], 16)
    return [[start, m[2] ? parseInt(m[2], 16) : start] as Range]
  })
}

const fontCache = new Map<string, string>()

async function toDataUrl(url: string): Promise<string> {
  const cached = fontCache.get(url)
  if (cached) return cached
  const blob = await (await fetch(url)).blob()
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
  fontCache.set(url, dataUrl)
  return dataUrl
}

async function embedFonts(text: string, families: RegExp): Promise<string> {
  const used = [...new Set([...text].map((ch) => ch.codePointAt(0)!))]
  const out: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue
      const family = rule.style.getPropertyValue('font-family')
      if (!families.test(family)) continue
      const range = rule.style.getPropertyValue('unicode-range')
      if (range) {
        const ranges = parseRanges(range)
        if (!used.some((cp) => ranges.some(([a, b]) => cp >= a && cp <= b))) continue
      }
      const url = /url\(["']?([^"')]+)["']?\)/.exec(rule.style.getPropertyValue('src'))?.[1]
      if (!url) continue
      const data = await toDataUrl(new URL(url, sheet.href ?? location.href).href)
      out.push(
        `@font-face{font-family:${family};font-style:normal;font-weight:${rule.style.getPropertyValue('font-weight') || '100 900'};font-display:block;src:url(${data}) format('woff2');${range ? `unicode-range:${range};` : ''}}`,
      )
    }
  }
  return out.join('\n')
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
  const families = deck.theme.id === 'serif' ? /Pretendard|Hahmlet/i : /Pretendard/i
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
