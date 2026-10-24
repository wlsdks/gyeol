import { useMemo, useRef, useState } from 'react'
import { ASKS, askOf, askSentence, type AskError, type AskScope, type AskStep } from '../../ai/asks'
import { applyOps, type Applied, type ChangeRequest, type Op, type OpCode } from '../../ai/ops'
import { shapeBlockId, shapeDeckId, shapeSlideId, toShape } from '../../ai/share'
import { mcpCommand } from '../../ai/client'
import type { AiAsk, AskJob } from '../../ai/useAiAsk'
import type { AiShare } from '../../ai/useAiShare'
import { BLOCK_EFFECTS, BLOCK_LINKS, BLOCK_LOOKS, BLOCKS } from '../../deck/blocks'
import { pageInfo } from '../../deck/fields'
import { LAYOUTS } from '../../deck/layouts'
import { MOTIONS, THEMES, TONES } from '../../deck/themes'
import type { Deck, Slide } from '../../deck/types'
import { cx } from '../../lib/cx'
import { isMac, keys } from '../../lib/keys'
import { pageProps, ScaledSlide, SlideCanvas } from '../../slides/SlideCanvas'
import { sideName } from '../../slides/panes'
import { useDeck } from '../../store/deckStore'
import { CheckIcon, ChevronIcon, CopyIcon, Popover, SparkIcon, Toggle, useDialog } from '../ui'
import { josa } from './noRoom'

const SKIP_REASON: Record<Exclude<OpCode, 'applied'>, string> = {
  no_slide: '그 장이 지금은 없어요',
  has_content: '적은 내용이 있어서 지우지 않아요',
  out_of_range: '고를 수 있는 범위를 넘어요',
  not_for_layout: '이 레이아웃에는 없는 설정이에요',
  last_slide: '마지막 남은 장은 지울 수 없어요',
  unknown_role: '모르는 장이에요',
  no_change: '이미 그렇게 되어 있어요',
  not_reviewed: '보지 않았어요',
  no_block: '그 컴포넌트가 지금은 없어요',
  no_room: '장에 자리가 모자라요',
  look_clash: '이 장의 다른 컴포넌트와 면이 어울리지 않아요',
}

const ASK_STEP: Record<AskStep, string> = {
  starting: 'Claude Code를 켜고 있어요',
  looking: '발표의 모양을 보고 있어요',
  proposing: '바꿀 것을 정리하고 있어요',
}

export const ASK_ERROR: Record<AskError, string> = {
  busy: 'AI가 다른 부탁을 하고 있어요. 끝난 뒤에 다시 눌러 주세요.',
  no_agent: '이 PC에서 Claude Code를 찾지 못했어요. Claude Code를 설치한 뒤 다시 눌러 주세요.',
  not_shared: '발표의 모양을 AI에게 보여 주지 못했어요. 다시 눌러 주세요.',
  bad_ask: '이 장에는 할 수 없는 부탁이에요.',
  timeout: 'AI가 3분 안에 끝내지 못해서 멈췄어요. 다시 눌러 주세요.',
  // 아래 '직접 부탁하기'의 안내와 같게, 윈도우에서는 PowerShell
  login: `Claude Code에 로그인돼 있지 않아요. ${isMac ? '터미널' : 'PowerShell'}에서 claude를 한 번 실행해 로그인한 뒤 다시 눌러 주세요.`,
  failed: 'AI가 부탁을 끝내지 못했어요. 잠시 뒤 다시 눌러 주세요.',
}

// ---------- 부탁 고르기 ----------

/**
 * 고를 수 있는 부탁. 이 PC에 Claude Code가 있으면 누르는 대로 바로 맡기고,
 * 없으면 Claude Code나 Codex에 붙여 넣을 문장을 복사한다 (그 문장도 정해진 말과 해시 id뿐).
 */
function AskList({ scope, deck, slide, ai, ask, onPicked }: { scope: AskScope; deck: Deck; slide: Slide | null; ai: AiShare; ask: AiAsk; onPicked: () => void }) {
  const setAiShare = useDeck((s) => s.setAiShare)
  const [copied, setCopied] = useState<string | null>(null)
  // 복사하지 못한 부탁의 글. 화면에 보여서 직접 골라 복사하게 한다 (정해진 말과 해시 id뿐이라 보여도 된다)
  const [failed, setFailed] = useState<string | null>(null)
  const direct = !!ai.status?.agent
  const busy = ask.job?.state === 'running'

  const pick = async (id: (typeof ASKS)[number]['id']) => {
    if (direct) {
      onPicked()
      void ask.start(id, slide)
      return
    }
    // 붙여 넣은 부탁을 AI가 들어주려면 모양이 공유돼 있어야 한다
    if (!deck.aiShare) setAiShare(true)
    const text = askSentence(id, shapeDeckId(deck), slide ? shapeSlideId(slide) : null)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setFailed(null)
    } catch {
      setCopied(null)
      setFailed(text)
    }
  }

  return (
    <div className="ask">
      {!direct && <p className="ask-note">이 PC에서 Claude Code를 찾지 못했어요. 누르면 부탁을 복사해요. Claude Code나 Codex에 붙여 넣어 주세요.</p>}
      <div className="ask-list">
        {ASKS.filter((a) => a.scope === scope).map((a) => (
          <button key={a.id} type="button" className="ask-item" disabled={busy} onClick={() => void pick(a.id)}>
            <span className="ask-name">
              {a.name}
              {copied === a.id && (
                <span className="ask-copied">
                  <CheckIcon />
                  복사했어요
                </span>
              )}
            </span>
            <span className="ask-desc">{a.description}</span>
          </button>
        ))}
      </div>
      {failed && (
        <div role="alert">
          <p className="ask-note copy-fail">복사하지 못했어요. 아래 글을 눌러 고른 뒤 직접 복사해 주세요({keys('mod+C')}).</p>
          <pre className="ai-pop-pre ask-fail">{failed}</pre>
        </div>
      )}
      {busy && <p className="ask-note">AI가 다른 부탁을 하고 있어요. 끝나면 고를 수 있어요.</p>}
    </div>
  )
}

/** 슬라이드 아래의 'AI로 다듬기'. 이 장 하나를 맡긴다 */
export function SlideAsk({ deck, slide, ai, ask }: { deck: Deck; slide: Slide; ai: AiShare; ask: AiAsk }) {
  if (!ai.status) return null
  const busy = ask.job?.state === 'running'
  return (
    <Popover
      align="left"
      className="pop-ask"
      button={({ toggle, open }) => (
        <button type="button" className={cx('btn btn-ghost btn-sm ask-btn', busy && 'is-busy')} aria-expanded={open} title="레이아웃, 강조, 칸 안내를 AI가 제안해요. 적은 글은 보내지 않아요" onClick={toggle}>
          <SparkIcon />
          {busy ? 'AI가 보는 중' : 'AI로 다듬기'}
        </button>
      )}
    >
      {(close) => (
        <div className="ask-pop">
          <p className="menu-h">이 장을 AI로 다듬기</p>
          <AskList scope="slide" deck={deck} slide={slide} ai={ai} ask={ask} onPicked={close} />
          <p className="ask-foot">AI에게는 장 순서, 레이아웃, 칸이 비었는지만 보여요. 적은 글은 보내지 않아요. 바뀌는 모습을 미리 보고 적용할지 정해요.</p>
        </div>
      )}
    </Popover>
  )
}

/** 부탁을 맡긴 뒤 오른쪽 아래에 뜨는 진행 상황. 제안이 오면 미리 보기가 바로 열린다 */
export function AskStatus({ deck, job, onCancel }: { deck: Deck; job: AskJob; onCancel: () => void }) {
  const i = job.slideId ? deck.slides.findIndex((s) => s.id === job.slideId) : -1
  const target = i >= 0 ? `${i + 1}장 ‘${deck.slides[i].purpose}’` : '발표 전체'
  if (job.state === 'no_change') {
    return (
      <div className="ai-inbox" role="status">
        <span className="ai-inbox-icon" aria-hidden="true">
          <CheckIcon />
        </span>
        <div className="ai-inbox-text">
          <p className="ai-inbox-h">AI가 바꿀 곳을 찾지 못했어요</p>
          <p className="ai-inbox-p ai-reason">{job.reason ?? `${josa(target, '은', '는')} 지금 모양이 이미 잘 맞는다는 뜻이에요.`}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          닫기
        </button>
      </div>
    )
  }
  return (
    <div className="ai-inbox" role="status">
      <span className="ai-inbox-icon is-busy" aria-hidden="true">
        <SparkIcon />
      </span>
      <div className="ai-inbox-text">
        <p className="ai-inbox-h">AI에게 ‘{askOf(job.ask)?.name}’ 부탁했어요</p>
        <p className="ai-inbox-p">
          {target}: {job.state === 'done' ? '제안을 가져오고 있어요' : ASK_STEP[job.step]}
        </p>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
        그만두기
      </button>
    </div>
  )
}

// ---------- 위쪽 AI 버튼 ----------

export function AiMenu({ deck, ai, ask }: { deck: Deck; ai: AiShare; ask: AiAsk }) {
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
      {(close) => <AiDetails deck={deck} ai={ai} ask={ask} onPicked={close} />}
    </Popover>
  )
}

function AiDetails({ deck, ai, ask, onPicked }: { deck: Deck; ai: AiShare; ask: AiAsk; onPicked: () => void }) {
  const setAiShare = useDeck((s) => s.setAiShare)
  const shape = useMemo(() => JSON.stringify(toShape(deck), null, 2), [deck])
  return (
    <div className="ai-pop">
      <p className="save-pop-h">AI로 다듬기</p>
      <p className="save-pop-p">AI가 이 발표의 장 구성과 모양을 보고 바꾸자고 제안해요. 적은 글은 AI에게 보이지 않아요.</p>

      {ai.status === undefined && <p className="ai-pop-note">연결을 확인하고 있어요…</p>}
      {ai.status === null && (
        <p className="ai-pop-note is-warn">AI 연결은 ‘결 시작’ 파일로 켰을 때만 쓸 수 있어요. 지금 화면은 다른 방법으로 열려 있어요.</p>
      )}
      {ai.status && (
        <>
          <AskList scope="deck" deck={deck} slide={null} ai={ai} ask={ask} onPicked={onPicked} />
          <p className="ai-pop-note">장 하나만 맡기려면 슬라이드 아래 ‘AI로 다듬기’를 눌러요.</p>
        </>
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
          <summary>터미널에서 Claude Code, Codex로 직접 부탁하기</summary>
          <p className="ai-pop-step">위의 부탁 말고 직접 말로 부탁하려면 {isMac ? '터미널' : 'PowerShell'}에 한 번만 입력하세요. 쓰는 쪽 하나만 하면 돼요.</p>
          <Command label="Claude Code" text={`claude mcp add gyeol -- ${mcpCommand(ai.status)}`} />
          <Command label="Codex" text={`codex mcp add gyeol -- ${mcpCommand(ai.status)}`} />
          <p className="ai-pop-step">그다음 AI에게 이렇게 말해 보세요. “결(gyeol)에 공유한 발표를 본부장 보고에 맞게 구성을 다듬어 줘”</p>
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
  const [failed, setFailed] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setFailed(false)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
      setFailed(true)
    }
  }
  return (
    <>
      <div className="ai-cmd">
        <span className="ai-cmd-label">{label}</span>
        {/* 복사하지 못했으면 명령 전체를 펼쳐, 눌러서 한 번에 고를 수 있게 */}
        <code className={cx('ai-cmd-text', failed && 'is-open')}>{text}</code>
        <button type="button" className="icon-btn icon-btn-sm" aria-label={`${label} 명령 복사`} title="복사" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
      {failed && (
        <p className="copy-fail" role="alert">
          복사하지 못했어요. 명령을 눌러 고른 뒤 직접 복사해 주세요({keys('mod+C')}).
        </p>
      )}
    </>
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
  // 부품: 모양 파일의 id면 지금 발표에서, 같은 제안에서 넣은 부품(p1...)이면 넣을 때 붙인 이름으로
  const blockName = (ref: string) => {
    if (/^p\d+$/.test(ref)) return named.get(ref) ?? '새 컴포넌트'
    const b = deck.slides.flatMap((s) => (s.rows ?? []).flatMap((r) => r.blocks)).find((x) => shapeBlockId(x) === ref)
    return b ? `‘${BLOCKS[b.type].name}’ 컴포넌트` : '없는 컴포넌트'
  }
  const placeText = (p: { row?: number; beside?: string; side?: 'before' | 'after' }) =>
    p.row !== undefined ? `${p.row + 1}번째 줄로` : p.beside ? `${blockName(p.beside)} ${p.side === 'before' ? '앞에' : '옆에'}` : '빈자리에'
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
      const panes = slide && LAYOUTS[slide.layout].panes
      if (panes && op.flip !== undefined) {
        // 처음에 왼쪽에 있는 판(이미지)은 반대쪽이 오른쪽
        const right = panes.start ? op.flip : !op.flip
        parts.push(`${panes.name} 위치: ${right ? '오른쪽' : '왼쪽'}`)
      }
      if (panes && op.pane !== undefined) parts.push(`${panes.name} 너비: ${sideName(op.pane ?? panes.base, panes.base)}`)
      if (op.contain !== undefined) parts.push(op.contain ? '이미지 전체 보이기' : '이미지로 채우기')
      if (op.tone) parts.push(`바탕: ${TONES.find((t) => t.id === op.tone)?.name}`)
      if (op.motion !== undefined) parts.push(op.motion === null ? '움직임: 발표 전체 설정대로' : `움직임: ${MOTIONS.find((m) => m.id === op.motion)?.name}`)
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
    case 'add_block': {
      const label = `‘${BLOCKS[op.type].name}’ 컴포넌트`
      if (op.as) named.set(op.as, `새 ${label}`)
      return { text: `${name(op.slide)}에 빈 ${label} 넣기`, detail: placeText(op) }
    }
    case 'remove_block':
      return { text: `${name(op.slide)}에서 ${blockName(op.block)} 빼기`, detail: '빈 컴포넌트만 빼요' }
    case 'move_block':
      return { text: `${name(op.slide)}의 ${blockName(op.block)} 옮기기`, detail: placeText(op) }
    case 'set_block': {
      const parts: string[] = []
      const b = /^p\d+$/.test(op.block) ? undefined : deck.slides.flatMap((s) => (s.rows ?? []).flatMap((r) => r.blocks)).find((x) => shapeBlockId(x) === op.block)
      if (op.variant) parts.push(`모양: ${(b && BLOCKS[b.type].variants?.find((v) => v.id === op.variant)?.name) ?? op.variant}`)
      if (op.look) parts.push(`바탕: ${BLOCK_LOOKS.find((l) => l.id === op.look)?.name}`)
      if (op.effect) parts.push(`움직임: ${BLOCK_EFFECTS.find((e) => e.id === op.effect)?.name}`)
      if (op.count !== undefined) parts.push(`${(b && BLOCKS[b.type].items?.label) ?? '항목'} ${op.count}개`)
      if (op.highlight !== undefined) parts.push(op.highlight < 0 ? '강조 없음' : `${op.highlight + 1}번째를 강조`)
      return { text: `${name(op.slide)}의 ${blockName(op.block)} 모양 바꾸기`, detail: parts.join(', ') }
    }
    case 'set_spans':
      return { text: `${name(op.slide)}의 칸 너비 바꾸기`, detail: `${blockName(op.block)}가 있는 줄을 ${op.spans.join(' : ')}로` }
    case 'set_link': {
      const where = op.side === 'right' ? `${blockName(op.block)}와 오른쪽 컴포넌트 사이` : `${blockName(op.block)}의 줄과 아래 줄 사이`
      const kind = BLOCK_LINKS.find((l) => l.id === op.link)?.name
      return op.link ? { text: `${name(op.slide)}에 이음표 ‘${kind}’ 넣기`, detail: where } : { text: `${name(op.slide)}에서 이음표 빼기`, detail: where }
    }
    case 'set_row_grow':
      return { text: `${name(op.slide)}의 줄 높이 바꾸기`, detail: op.grow.length ? `위에서부터 ${op.grow.join(' : ')}로` : '줄 높이를 똑같이' }
    case 'set_hint': {
      if (op.block) return { text: `${name(op.slide)}의 ${blockName(op.block)} 안내 문구`, detail: op.text }
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
  const beforeInfo = pageInfo(deck.slides)
  // 장 몇 개만 바뀌면 (장 하나를 부탁했을 때처럼) 그 장의 지금과 바꾼 뒤를 맨 위에 나란히 보여 준다
  const changed = applied.deck.slides.filter((s) => before.has(s.id) && applied.touched.has(s.id))
  const pairs = changed.length > 0 && changed.length <= 3 ? changed : []

  // 열면 초점이 '나중에'로 들어온다. 적용하기에 바로 두면 Enter 한 번에 적용돼 버린다
  const ref = useRef<HTMLDivElement>(null)
  useDialog(ref, onClose)

  return (
    <div className="vpp air" role="dialog" aria-modal="true" aria-label="AI 제안 미리 보기" ref={ref} tabIndex={-1}>
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
          {pairs.map((s) => {
            const was = deck.slides.find((x) => x.id === s.id)!
            const n = applied.deck.slides.indexOf(s) + 1
            return (
              <section key={`pair-${s.id}`} className="air-pair" aria-label={`${n}장 바뀌기 전과 뒤`}>
                <figure className="vpp-item">
                  <ScaledSlide width={400} className="vpp-slide">
                    <SlideCanvas deck={deck} slide={was} mode="preview" {...pageProps(beforeInfo, was.id)} />
                  </ScaledSlide>
                  <figcaption className="vpp-cap">
                    <span>{n}</span>
                    {was.purpose}: 지금
                  </figcaption>
                </figure>
                <span className="air-arrow" aria-hidden="true">
                  <ChevronIcon />
                </span>
                <figure className="vpp-item is-diff">
                  <ScaledSlide width={400} className="vpp-slide">
                    <SlideCanvas deck={applied.deck} slide={s} mode="preview" {...pageProps(info, s.id)} />
                  </ScaledSlide>
                  <figcaption className="vpp-cap">
                    <span>{n}</span>
                    {s.purpose}
                    <em>적용하면</em>
                  </figcaption>
                </figure>
              </section>
            )
          })}
          {pairs.length > 0 && <p className="air-all">발표 전체</p>}
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
