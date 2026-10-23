import { useEffect, useMemo, useState } from 'react'
import { applyOps, type Applied, type ChangeRequest, type Op, type OpCode } from '../../ai/ops'
import { shapeSlideId, toShape } from '../../ai/share'
import { mcpCommand } from '../../ai/client'
import type { AiShare } from '../../ai/useAiShare'
import { pageInfo } from '../../deck/fields'
import { LAYOUTS } from '../../deck/layouts'
import { MOTIONS, THEMES } from '../../deck/themes'
import type { Deck } from '../../deck/types'
import { cx } from '../../lib/cx'
import { isMac, keys } from '../../lib/keys'
import { pageProps, ScaledSlide, SlideCanvas } from '../../slides/SlideCanvas'
import { useDeck } from '../../store/deckStore'
import { CheckIcon, CopyIcon, Popover, SparkIcon, Toggle } from '../ui'

const SKIP_REASON: Record<Exclude<OpCode, 'applied'>, string> = {
  no_slide: '그 장이 지금은 없어요',
  has_content: '적은 내용이 있어서 지우지 않아요',
  out_of_range: '이 레이아웃이 담을 수 있는 수를 넘어요',
  not_for_layout: '이 레이아웃에는 없는 설정이에요',
  last_slide: '마지막 남은 장은 지울 수 없어요',
  unknown_role: '모르는 장이에요',
  no_change: '이미 그렇게 되어 있어요',
  not_reviewed: '보지 않았어요',
}

// ---------- 위쪽 AI 버튼 ----------

export function AiMenu({ deck, ai }: { deck: Deck; ai: AiShare }) {
  return (
    <Popover
      className="pop-ai"
      button={({ toggle, open }) => (
        <button type="button" className={cx('btn btn-ghost ai-btn', deck.aiShare && ai.status && 'is-on')} aria-expanded={open} onClick={toggle}>
          <SparkIcon />
          AI
          {deck.aiShare && ai.status && <span className="ai-dot" aria-label="AI에게 공유 중" />}
        </button>
      )}
    >
      {() => <AiDetails deck={deck} ai={ai} />}
    </Popover>
  )
}

function AiDetails({ deck, ai }: { deck: Deck; ai: AiShare }) {
  const setAiShare = useDeck((s) => s.setAiShare)
  const shape = useMemo(() => JSON.stringify(toShape(deck), null, 2), [deck])
  return (
    <div className="ai-pop">
      <p className="save-pop-h">AI에게 구성 맡기기</p>
      <p className="save-pop-p">
        Claude Code나 Codex가 이 발표의 장 구성과 모양을 보고 바꾸자고 제안할 수 있어요. 적은 글은 AI에게 보이지 않아요.
      </p>

      {ai.status === undefined && <p className="ai-pop-note">연결을 확인하고 있어요…</p>}
      {ai.status === null && (
        <p className="ai-pop-note is-warn">AI 연결은 ‘html-maker 시작’ 파일로 켰을 때만 쓸 수 있어요. 지금 화면은 다른 방법으로 열려 있어요.</p>
      )}
      {ai.status && (
        <div className="ai-pop-toggle">
          <Toggle label="이 발표를 AI에게 보여 주기" on={!!deck.aiShare} onChange={setAiShare} />
        </div>
      )}

      <div className="ai-pop-cols">
        <div>
          <p className="ai-pop-k">AI에게 보이는 것</p>
          <ul>
            <li>보고 종류와 시간</li>
            <li>장 순서와 레이아웃</li>
            <li>칸이 비었는지, 긴지</li>
            <li>테마와 강조색</li>
          </ul>
        </div>
        <div>
          <p className="ai-pop-k">보이지 않는 것</p>
          <ul>
            <li>제목과 적은 글</li>
            <li>숫자와 이미지</li>
            <li>발표자 노트</li>
            <li>소속, 이름, 연락처</li>
          </ul>
        </div>
      </div>

      <details className="ai-pop-more">
        <summary>AI에게 보이는 내용 그대로 보기</summary>
        <pre className="ai-pop-pre">{shape}</pre>
      </details>

      {ai.status && (
        <details className="ai-pop-more">
          <summary>Claude Code, Codex에 연결하기</summary>
          <p className="ai-pop-step">{isMac ? '터미널' : 'PowerShell'}에 한 번만 입력하세요. 쓰는 쪽 하나만 하면 돼요.</p>
          <Command label="Claude Code" text={`claude mcp add html-maker -- ${mcpCommand(ai.status)}`} />
          <Command label="Codex" text={`codex mcp add html-maker -- ${mcpCommand(ai.status)}`} />
          <p className="ai-pop-step">그다음 AI에게 이렇게 말해 보세요. “html-maker에 공유한 발표를 본부장 보고에 맞게 구성을 다듬어 줘”</p>
        </details>
      )}

      <p className="save-pop-foot">
        <span>AI는 제안만 해요. 바뀌는 모습을 미리 보고 적용하거나 거절할 수 있고, 적용하기 전 상태는 버전으로 남아요.</span>
      </p>
    </div>
  )
}

function Command({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="ai-cmd">
      <span className="ai-cmd-label">{label}</span>
      <code className="ai-cmd-text">{text}</code>
      <button type="button" className="icon-btn icon-btn-sm" aria-label={`${label} 명령 복사`} title="복사" onClick={copy}>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  )
}

// ---------- 제안이 왔을 때 ----------

export function AiInbox({ ai, onOpen }: { ai: AiShare; onOpen: (r: ChangeRequest) => void }) {
  const first = ai.requests[0]
  if (!first) return null
  return (
    <div className="ai-inbox" role="status">
      <span className="ai-inbox-icon" aria-hidden="true">
        <SparkIcon />
      </span>
      <div className="ai-inbox-text">
        <p className="ai-inbox-h">{ai.requests.length > 1 ? `AI 제안이 ${ai.requests.length}개 왔어요` : 'AI 제안이 왔어요'}</p>
        <p className="ai-inbox-p">{first.note || `바꾸는 것 ${first.ops.length}가지`}</p>
      </div>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpen(first)}>
        보기
      </button>
    </div>
  )
}

// ---------- 제안 미리 보기 ----------

function describe(deck: Deck, op: Op, named: Map<string, string>, applied: Applied): { text: string; detail?: string } {
  const name = (ref: string | null) => {
    if (ref === null) return '맨 앞'
    if (/^n\d+$/.test(ref)) return named.get(ref) ?? '새 장'
    const i = deck.slides.findIndex((s) => shapeSlideId(s) === ref)
    return i < 0 ? '없는 장' : `${i + 1}장 ‘${deck.slides[i].purpose}’`
  }
  const slide =
    'slide' in op
      ? /^n\d+$/.test(op.slide)
        ? applied.deck.slides.find((s) => s.id === applied.named.get(op.slide))
        : deck.slides.find((s) => shapeSlideId(s) === op.slide)
      : undefined
  switch (op.op) {
    case 'add_slide': {
      const label = `‘${op.role ?? LAYOUTS[op.layout!].name}’`
      if (op.as) named.set(op.as, `새 장 ${label}`)
      return { text: `${label} 장 넣기`, detail: op.after === null ? '맨 앞에' : `${name(op.after)} 뒤에` }
    }
    case 'remove_slide':
      return { text: `${name(op.slide)} 지우기`, detail: '빈 장만 지워요' }
    case 'move_slide':
      return { text: `${name(op.slide)} 옮기기`, detail: op.after === null ? '맨 앞으로' : `${name(op.after)} 뒤로` }
    case 'set_layout': {
      const variantName = (id?: string) => LAYOUTS[op.layout].variants?.find((v) => v.id === id)?.name
      const to = op.variant && variantName(op.variant) ? `${LAYOUTS[op.layout].name}(${variantName(op.variant)})` : LAYOUTS[op.layout].name
      if (slide && slide.layout === op.layout) return { text: `${name(op.slide)} 모양 바꾸기`, detail: to }
      return { text: `${name(op.slide)} 레이아웃 바꾸기`, detail: `${slide ? LAYOUTS[slide.layout].name : '?'} → ${to}` }
    }
    case 'set_hidden':
      return { text: `${name(op.slide)} ${op.hidden ? '발표에서 빼기' : '발표에 다시 넣기'}` }
    case 'set_item_count': {
      const spec = slide && LAYOUTS[slide.layout].items
      return { text: `${name(op.slide)} ${spec?.label ?? '항목'} 수 바꾸기`, detail: `${slide ? Math.min(slide.items.length, spec?.max ?? 0) : '?'}개 → ${op.count}개` }
    }
    case 'set_options': {
      const parts: string[] = []
      if (op.highlight !== undefined) parts.push(op.highlight < 0 ? '강조 없음' : `${op.highlight + 1}번째를 강조`)
      if (op.flip !== undefined) parts.push(op.flip ? '이미지를 오른쪽에' : '이미지를 왼쪽에')
      if (op.contain !== undefined) parts.push(op.contain ? '이미지 전체 보이기' : '이미지로 채우기')
      return { text: `${name(op.slide)} 모양 설정`, detail: parts.join(', ') }
    }
    case 'set_theme': {
      const parts: string[] = []
      if (op.theme) parts.push(`테마: ${THEMES[deck.theme.id].name} → ${THEMES[op.theme].name}`)
      if (op.accent !== undefined) parts.push(op.accent === null ? '강조색: 테마 기본색' : `강조색: ${op.accent}`)
      if (op.motion) parts.push(`발표할 때 움직임: ${MOTIONS.find((m) => m.id === (deck.motion ?? 'calm'))?.name} → ${MOTIONS.find((m) => m.id === op.motion)?.name}`)
      return { text: op.theme || op.accent !== undefined ? '테마 바꾸기' : '발표할 때 움직임 바꾸기', detail: parts.join(', ') }
    }
    case 'set_guide':
      return { text: `${name(op.slide)} 장 안내 바꾸기`, detail: op.text }
    case 'set_hint': {
      const spec = slide && LAYOUTS[slide.layout]
      const label = spec?.fields.find((f) => f.key === op.field)?.label ?? spec?.items?.fields.find((f) => f.key === op.field)?.label ?? op.field
      return { text: `${name(op.slide)} 안내 문구: ${op.item !== undefined ? `${op.item + 1}번째 ` : ''}${label}`, detail: op.text }
    }
  }
}

export function AiReview({
  deck,
  request,
  onClose,
  onApply,
  onReject,
}: {
  deck: Deck
  request: ChangeRequest
  onClose: () => void
  onApply: (applied: Applied) => void
  onReject: () => void
}) {
  const applied = useMemo(() => applyOps(deck, request.ops), [deck, request])
  const lines = useMemo(() => {
    const named = new Map<string, string>()
    return request.ops.map((op, i) => ({ ...describe(deck, op, named, applied), result: applied.results[i] }))
  }, [deck, request, applied])
  const okCount = applied.results.filter((r) => r.ok).length
  const before = new Set(deck.slides.map((s) => s.id))
  const info = pageInfo(applied.deck.slides)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="vpp air" role="dialog" aria-modal="true" aria-label="AI 제안 미리 보기">
      <header className="vpp-head">
        <div>
          <p className="vpp-title">AI가 구성을 바꾸자고 해요</p>
          <p className="vpp-sub">
            바꾸는 것 {okCount}가지{okCount < lines.length ? `, 건너뛰는 것 ${lines.length - okCount}가지` : ''}. 적은 글은 그대로예요.
          </p>
        </div>
        <div className="vpp-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            나중에
          </button>
          <button type="button" className="btn btn-ghost" onClick={onReject}>
            거절하기
          </button>
          <button type="button" className="btn btn-primary" disabled={!okCount} onClick={() => onApply(applied)}>
            적용하기
          </button>
        </div>
      </header>
      <div className="air-body">
        <aside className="air-side">
          {request.note && (
            <figure className="air-note">
              <figcaption>AI의 설명</figcaption>
              <p>{request.note}</p>
            </figure>
          )}
          <ol className="air-list">
            {lines.map((l, i) => (
              <li key={i} className={cx(!l.result.ok && 'is-skip')}>
                <span className="air-mark" aria-hidden="true">
                  {l.result.ok ? <CheckIcon /> : '–'}
                </span>
                <span>
                  <span className="air-line">{l.text}</span>
                  {l.detail && <span className="air-detail">{l.detail}</span>}
                  {!l.result.ok && <span className="air-skip">건너뜀: {SKIP_REASON[l.result.code as Exclude<OpCode, 'applied'>]}</span>}
                </span>
              </li>
            ))}
          </ol>
          <p className="air-foot">적용하기 전 지금 상태를 버전으로 남겨요. 되돌리기({keys('mod+Z')})로도 바로 돌아올 수 있어요.</p>
        </aside>
        <div className="vpp-body air-slides">
          {applied.deck.slides.map((s, i) => {
            const note = !before.has(s.id) ? '새 장' : s.hidden ? '발표에서 빠짐' : applied.touched.has(s.id) ? '바뀌는 장' : null
            return (
              <figure key={s.id} className={cx('vpp-item', note && 'is-diff', s.hidden && 'is-hidden')}>
                <ScaledSlide width={480} className="vpp-slide">
                  <SlideCanvas deck={applied.deck} slide={s} mode="preview" {...pageProps(info, s.id)} />
                </ScaledSlide>
                <figcaption className="vpp-cap">
                  <span>{i + 1}</span>
                  {s.purpose}
                  {note && <em>{note}</em>}
                </figcaption>
              </figure>
            )
          })}
        </div>
      </div>
    </div>
  )
}
