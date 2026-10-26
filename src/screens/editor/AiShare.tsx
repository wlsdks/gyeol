import { useEffect, useMemo, useRef, useState } from 'react'
import { ASKS, askOf, askSentence, type AskError, type AskId, type AskScope, type AskStep } from '../../ai/asks'
import { applyOps, type Applied, type ChangeRequest, type Op, type OpCode } from '../../ai/ops'
import { shapeBlockId, shapeDeckId, shapeSlideId, toShape } from '../../ai/share'
import { mcpCommand } from '../../ai/client'
import type { AiAsk, AskJob } from '../../ai/useAiAsk'
import type { AiShare } from '../../ai/useAiShare'
import { BLOCK_EFFECTS, BLOCK_FROMS, BLOCK_LINKS, BLOCK_LOOKS, BLOCK_SPEEDS, BLOCK_WHENS, BLOCKS, slideName } from '../../deck/blocks'
import { pageInfo } from '../../deck/fields'
import { LAYOUTS } from '../../deck/layouts'
import { MOTIONS, THEMES, TONES, TRANSITIONS } from '../../deck/themes'
import type { Deck, Slide } from '../../deck/types'
import { cx } from '../../lib/cx'
import { josa } from '../../lib/josa'
import { isMac, keys } from '../../lib/keys'
import { pageProps, ScaledSlide, SlideCanvas } from '../../slides/SlideCanvas'
import { sideName } from '../../slides/panes'
import { useDeck } from '../../store/deckStore'
import { AskIcon, BackIcon, CheckIcon, ChevronIcon, CopyIcon, Info, Popover, Toggle, useDialog } from '../ui'

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
  link_clash: '이으면 뜻이 서지 않는 두 컴포넌트예요',
}

/**
 * 부탁이 지나가는 차례. 마지막 '미리 보기'는 서버의 단계가 아니라 다음에 일어날 일이다:
 * 맡긴 사람이 무엇을 기다리는지, 끝나면 무엇이 열리는지 한눈에 알게 한 줄에 같이 둔다
 */
const ASK_STEPS: { id: AskStep | 'review'; name: string }[] = [
  { id: 'starting', name: '켜기' },
  { id: 'looking', name: '살펴보기' },
  { id: 'proposing', name: '정리하기' },
  { id: 'review', name: '미리 보기' },
]

export const ASK_ERROR: Record<AskError, string> = {
  busy: 'AI가 다른 부탁을 하고 있어요. 끝난 뒤에 다시 눌러 주세요.',
  no_agent: '이 PC에서 Claude Code를 찾지 못했어요. Claude Code를 설치한 뒤 다시 눌러 주세요.',
  not_shared: '발표의 모양을 AI에게 보여 주지 못했어요. 다시 눌러 주세요.',
  bad_ask: '이 장에는 할 수 없는 부탁이에요.',
  timeout: 'AI가 3분 안에 끝내지 못해서 멈췄어요. 다시 눌러 주세요.',
  // '직접 연결하기'의 안내와 같게, 윈도우에서는 PowerShell
  login: `Claude Code에 로그인돼 있지 않아요. ${isMac ? '터미널' : 'PowerShell'}에서 claude를 한 번 실행해 로그인한 뒤 다시 눌러 주세요.`,
  failed: 'AI가 부탁을 끝내지 못했어요. 잠시 뒤 다시 눌러 주세요.',
}

const jobTarget = (deck: Deck, job: AskJob) => {
  const i = job.slideId ? deck.slides.findIndex((s) => s.id === job.slideId) : -1
  return i >= 0 ? `${i + 1}장 ‘${slideName(deck.slides[i])}’` : '발표 전체'
}

// ---------- 부탁 고르기 ----------

/** 맡긴 부탁이 어디까지 왔는지. 지난 단계는 짙게, 지금 단계는 파랗게 */
function AskSteps({ job }: { job: AskJob }) {
  const now = job.state === 'done' ? ASK_STEPS.length - 1 : ASK_STEPS.findIndex((s) => s.id === job.step)
  return (
    <ol className="ask-steps" aria-label="진행">
      {ASK_STEPS.map((s, i) => (
        <li key={s.id} className={cx(i < now && 'is-done', i === now && 'is-now')} aria-current={i === now ? 'step' : undefined}>
          {s.name}
        </li>
      ))}
    </ol>
  )
}

/**
 * 공유를 켜지 않은 발표에서 부탁을 눌렀을 때 그 자리에 펴지는 확인.
 * 예전에는 부탁을 누르면 말없이 공유를 켰고, 미리 켜 두려면 아래쪽 켜고 끄기를 찾아야 해서
 * 먼저 무엇을 해야 하는지 몰랐다. 보여 주는 것이 무엇인지 한 줄로 말하고, 누르는 단추가 보여 준다고 말한다
 */
function Consent({ direct, onMore, onCancel, onOk }: { direct: boolean; onMore?: () => void; onCancel: () => void; onOk: () => void }) {
  const ok = useRef<HTMLButtonElement>(null)
  // 펼치면 초점을 확인 단추로: 키보드로 고른 사람이 Enter 한 번 더로 맡긴다
  useEffect(() => ok.current?.focus(), [])
  return (
    <div className="ask-consent" role="group" aria-label="AI에게 모양 보여 주기">
      <p className="ask-consent-p">
        이 발표의 모양만 AI에게 보여 줘요. 적은 글은 보내지 않아요.
        {!onMore && <Info label="AI에게 보이는 것">장 순서, 레이아웃, 칸이 비었는지, 테마가 보여요. 제목과 적은 글, 숫자, 이미지, 노트는 보이지 않아요.</Info>}
      </p>
      <div className="ask-consent-actions">
        {onMore && (
          <button type="button" className="ask-link" onClick={onMore}>
            무엇이 보이나요?
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          취소
        </button>
        <button type="button" ref={ok} className="btn btn-primary btn-sm" onClick={onOk}>
          {direct ? '보여 주고 맡기기' : '보여 주고 복사하기'}
        </button>
      </div>
    </div>
  )
}

/**
 * 고를 수 있는 부탁. 이 PC에 Claude Code가 있으면 누르는 대로 바로 맡기고,
 * 없으면 Claude Code나 Codex에 붙여 넣을 문장을 복사한다 (그 문장도 정해진 말과 해시 id뿐).
 * 공유를 켜지 않은 발표면 맡기기 전에 그 자리에서 한 번 묻는다.
 */
function AskList({
  scope,
  deck,
  slide,
  ai,
  ask,
  onPicked,
  onMore,
}: {
  scope: AskScope
  deck: Deck
  slide: Slide | null
  ai: AiShare
  ask: AiAsk
  onPicked: () => void
  onMore?: () => void
}) {
  const setAiShare = useDeck((s) => s.setAiShare)
  // 보여 줘도 되는지 묻고 있는 부탁
  const [asking, setAsking] = useState<AskId | null>(null)
  const [copied, setCopied] = useState<AskId | null>(null)
  // 복사하지 못한 부탁의 글. 화면에 보여서 직접 골라 복사하게 한다 (정해진 말과 해시 id뿐이라 보여도 된다)
  const [failed, setFailed] = useState<{ id: AskId; text: string } | null>(null)
  const direct = !!ai.status?.agent
  const job = ask.job
  const busy = job?.state === 'running'

  const run = async (id: AskId) => {
    setAsking(null)
    // 확인 단추를 눌렀거나 이미 공유 중일 때만 온다. 붙여 넣은 부탁도 AI가 들어주려면 모양이 공유돼 있어야 한다
    if (!deck.aiShare) setAiShare(true)
    if (direct) {
      onPicked()
      void ask.start(id, slide)
      return
    }
    const text = askSentence(id, shapeDeckId(deck), slide ? shapeSlideId(slide) : null)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setFailed(null)
    } catch {
      setCopied(null)
      setFailed({ id, text })
    }
  }

  const pick = (id: AskId) => {
    setCopied(null)
    setFailed(null)
    if (deck.aiShare) void run(id)
    else setAsking((a) => (a === id ? null : id))
  }

  return (
    <div className="ask">
      {busy && job && (
        <div className="ask-run" role="status">
          <span className="ask-run-h">
            <span className="ask-run-icon" aria-hidden="true">
              <AskIcon />
            </span>
            ‘{askOf(job.ask)?.name}’ 하는 중
            <button type="button" className="ask-link" onClick={ask.cancel}>
              그만두기
            </button>
          </span>
          <AskSteps job={job} />
        </div>
      )}
      <ul className="ask-list">
        {/* 묻는 동안은 고른 부탁 하나만 남긴다: 무엇을 맡기려는지 그 자리에서 보이고, 슬라이드 아래 창이 1280×600에서도 넘치지 않게 */}
        {ASKS.filter((a) => a.scope === scope && (!asking || a.id === asking)).map((a) => (
          <li key={a.id}>
            <button
              type="button"
              className={cx('ask-item', asking === a.id && 'is-on')}
              disabled={busy}
              aria-expanded={deck.aiShare ? undefined : asking === a.id}
              onClick={() => pick(a.id)}
            >
              <span className="ask-name">{a.name}</span>
              <span className="ask-desc">{a.description}</span>
              {/* 누르면 무엇을 하는지: 맡기기(›)인지 복사인지 */}
              <span className="ask-go" aria-hidden="true">
                {direct ? <ChevronIcon /> : copied === a.id ? <CheckIcon /> : <CopyIcon />}
              </span>
            </button>
            {asking === a.id && <Consent direct={direct} onMore={onMore} onCancel={() => setAsking(null)} onOk={() => void run(a.id)} />}
            {copied === a.id && (
              <p className="ask-done" role="status">
                복사했어요. Claude Code나 Codex에 붙여 넣어 주세요.
                {onMore && (
                  <button type="button" className="ask-link" onClick={onMore}>
                    처음이면 먼저 연결하기
                  </button>
                )}
              </p>
            )}
            {failed?.id === a.id && (
              <div className="ask-done" role="alert">
                <p className="copy-fail">
                  복사하지 못했어요. 아래 글을 눌러 고른 뒤 직접 복사해 주세요(
                  {keys('mod+C')}).
                </p>
                <pre className="ai-pop-pre ask-fail">{failed.text}</pre>
              </div>
            )}
          </li>
        ))}
      </ul>
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
        <button
          type="button"
          className={cx('btn btn-ghost btn-sm ask-btn', busy && 'is-busy')}
          aria-expanded={open}
          title="레이아웃, 강조, 칸 안내를 AI가 제안해요. 적은 글은 보내지 않아요"
          onClick={toggle}
        >
          <AskIcon />
          {busy ? 'AI가 보는 중' : 'AI로 다듬기'}
        </button>
      )}
    >
      {(close) => (
        <div className="ask-pop">
          <AiHead title="이 장에서 무엇을 맡길까요?" status={ai.status} />
          <AskList scope="slide" deck={deck} slide={slide} ai={ai} ask={ask} onPicked={close} />
        </div>
      )}
    </Popover>
  )
}

/** 맡긴 동안 흐른 시간. 길게는 몇 분 걸려서, 멈춘 게 아니라 하고 있다는 것을 숫자로 */
function useElapsed(running: boolean): string {
  const [t0] = useState(() => Date.now())
  const [now, setNow] = useState(t0)
  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [running])
  const s = Math.max(0, Math.round((now - t0) / 1000))
  return s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${s % 60}초`
}

/** 부탁을 맡긴 뒤 오른쪽 아래에 뜨는 진행 상황. 제안이 오면 미리 보기가 바로 열린다 */
export function AskStatus({ deck, job, onCancel }: { deck: Deck; job: AskJob; onCancel: () => void }) {
  const target = jobTarget(deck, job)
  const elapsed = useElapsed(job.state === 'running')
  if (job.state === 'no_change') {
    return (
      <div className="ai-inbox" role="status">
        <span className="ai-inbox-icon" aria-hidden="true">
          <CheckIcon />
        </span>
        <div className="ai-inbox-text">
          <p className="ai-inbox-h">바꿀 곳을 찾지 못했어요</p>
          <p className="ai-inbox-p ai-reason">{job.reason ?? `${josa(target, '은', '는')} 지금 모양이 이미 잘 맞는다는 뜻이에요.`}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          닫기
        </button>
      </div>
    )
  }
  return (
    <div className="ai-inbox ask-card" role="status">
      <span className="ai-inbox-icon is-busy" aria-hidden="true">
        <AskIcon />
      </span>
      <div className="ai-inbox-text">
        <p className="ai-inbox-h">‘{askOf(job.ask)?.name}’ 맡겼어요</p>
        <p className="ai-inbox-p">
          {target} · {elapsed}
        </p>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
        그만두기
      </button>
      <AskSteps job={job} />
    </div>
  )
}

// ---------- 위쪽 AI 버튼 ----------

export function AiMenu({ deck, ai, ask }: { deck: Deck; ai: AiShare; ask: AiAsk }) {
  return (
    <Popover
      className="pop-ai"
      button={({ toggle, open }) => (
        // 이름은 사용법, README, MCP 안내가 모두 'AI 버튼'으로 부르므로 그대로 두고, 하는 일은 말풍선으로 알린다
        <button type="button" className="btn btn-ghost ai-btn" title="AI에게 장 구성과 모양을 제안받아요" aria-expanded={open} onClick={toggle}>
          <AskIcon />
          AI
          {deck.aiShare && ai.status && <span className="ai-dot" aria-label="AI에게 공유 중" />}
        </button>
      )}
    >
      {(close) => <AiDetails deck={deck} ai={ai} ask={ask} onPicked={close} />}
    </Popover>
  )
}

/**
 * 창의 머리: 무엇을 고르면 되는지 묻는 한 줄과, 그 아래에 이 PC의 사정 한 줄.
 * 예전에는 설명 두 줄과 'Claude Code를 찾지 못했어요' 두 줄이 부탁보다 먼저 와서 무엇부터 할지 몰랐다
 */
function AiHead({ title, status }: { title: string; status: AiShare['status'] }) {
  return (
    <header className="ai-head">
      <p className="ai-head-h">
        {title}
        <Info label="AI로 다듬기 설명">고르면 AI가 발표의 모양을 살펴보고 바꿀 것을 제안해요. 바뀌는 모습을 미리 보고 적용할지 정해요. 적용한 뒤에도 되돌릴 수 있어요.</Info>
      </p>
      {status === undefined && <p className="ai-env">연결을 확인하고 있어요</p>}
      {status === null && <p className="ai-env is-warn">‘결 시작’ 파일로 켰을 때만 쓸 수 있어요.</p>}
      {status && (
        <p className={cx('ai-env', status.agent && 'is-ready')}>
          <span className="ai-env-dot" aria-hidden="true" />
          {status.agent ? '이 PC의 Claude Code가 맡아요' : 'Claude Code가 없어서, 누르면 부탁을 복사해요'}
          {!status.agent && (
            <Info label="복사한 부탁 쓰는 법" align="start">
              Claude Code나 Codex에 붙여 넣으면 돼요. 이 PC에 Claude Code를 설치하면 누르는 대로 바로 맡길 수 있어요.
            </Info>
          )}
        </p>
      )}
    </header>
  )
}

function AiDetails({ deck, ai, ask, onPicked }: { deck: Deck; ai: AiShare; ask: AiAsk; onPicked: () => void }) {
  const setAiShare = useDeck((s) => s.setAiShare)
  // 보이는 것, 그대로 보기, 터미널 연결은 한 장 뒤로 넘겨 둔다. 처음 화면은 고르는 것만
  const [more, setMore] = useState(false)
  const shared = !!deck.aiShare && !!ai.status
  return (
    <>
      {more && <AiMore deck={deck} ai={ai} onBack={() => setMore(false)} />}
      {/* 넘어가도 숨기기만 한다: '무엇이 보이나요?'를 보고 돌아오면 묻던 자리가 그대로 있게 */}
      <div className="ai-pop" hidden={more}>
        <AiHead title="발표 전체에서 무엇을 맡길까요?" status={ai.status} />
        {ai.status && <AskList scope="deck" deck={deck} slide={null} ai={ai} ask={ask} onPicked={onPicked} onMore={() => setMore(true)} />}
        <footer className="ai-foot">
          {shared ? (
            <span className="ai-foot-on">
              <span className="ai-dot" aria-hidden="true" />
              모양을 보여 주는 중
              <button type="button" className="ask-link" onClick={() => setAiShare(false)}>
                그만 보여 주기
              </button>
            </span>
          ) : (
            <span>적은 글은 AI에게 보내지 않아요</span>
          )}
          <button type="button" className="ai-foot-more" onClick={() => setMore(true)}>
            {ai.status ? '보이는 것, 직접 연결' : 'AI에게 보이는 것'}
            <ChevronIcon />
          </button>
        </footer>
      </div>
    </>
  )
}

/** 한 장 뒤: AI에게 보이는 것과 보이지 않는 것, 보이는 그대로, 터미널에서 직접 연결하기 */
function AiMore({ deck, ai, onBack }: { deck: Deck; ai: AiShare; onBack: () => void }) {
  const setAiShare = useDeck((s) => s.setAiShare)
  const shape = useMemo(() => JSON.stringify(toShape(deck), null, 2), [deck])
  const back = useRef<HTMLButtonElement>(null)
  // 넘어오면 초점을 '뒤로'에: 누른 링크가 사라져 초점이 문서 맨 앞으로 가지 않게
  useEffect(() => back.current?.focus(), [])
  return (
    <div className="ai-pop">
      <header className="ai-more-head">
        <button type="button" ref={back} className="icon-btn icon-btn-sm" aria-label="뒤로" title="뒤로" onClick={onBack}>
          <BackIcon />
        </button>
        <p className="ai-head-h">AI에게 보이는 것</p>
      </header>
      <div className="ai-pop-cols">
        <div>
          <p className="ai-pop-k">보여요</p>
          <ul>
            <li>보고 종류와 시간</li>
            <li>장 순서와 레이아웃</li>
            <li>칸이 비었는지, 긴지</li>
            <li>테마와 강조색</li>
          </ul>
        </div>
        <div>
          <p className="ai-pop-k">보이지 않아요</p>
          <ul>
            <li>제목과 적은 글</li>
            <li>숫자와 이미지</li>
            <li>발표자 노트</li>
            <li>소속, 이름, 연락처</li>
          </ul>
        </div>
      </div>
      <details className="ai-pop-more">
        <summary>보이는 내용 그대로 보기</summary>
        <pre className="ai-pop-pre">{shape}</pre>
      </details>

      {ai.status && (
        <section className="ai-more-sec">
          <p className="ai-pop-k">Claude Code, Codex에서 직접 쓰기</p>
          <p className="ai-pop-step">{isMac ? '터미널' : 'PowerShell'}에 한 번만 넣어요. 쓰는 쪽 하나면 돼요.</p>
          <Command label="Claude Code" text={`claude mcp add gyeol -- ${mcpCommand(ai.status)}`} />
          <Command label="Codex" text={`codex mcp add gyeol -- ${mcpCommand(ai.status)}`} />
          <p className="ai-pop-step">그다음 이 발표를 보여 주고 말로 부탁해요. 예: “결에 공유한 발표를 본부장 보고에 맞게 다듬어 줘”</p>
          <div className="ai-pop-toggle">
            <Toggle label="이 발표를 AI에게 보여 주기" on={!!deck.aiShare} onChange={setAiShare} />
          </div>
        </section>
      )}
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
          복사하지 못했어요. 명령을 눌러 고른 뒤 직접 복사해 주세요(
          {keys('mod+C')}).
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
        <AskIcon />
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
    return i < 0 ? '없는 장' : `${i + 1}장 ‘${slideName(deck.slides[i])}’`
  }
  // 부품: 모양 파일의 id면 지금 발표에서, 같은 제안에서 넣은 부품(p1...)이면 넣을 때 붙인 이름으로
  const blockName = (ref: string) => {
    if (/^p\d+$/.test(ref)) return named.get(ref) ?? '새 컴포넌트'
    const b = deck.slides.flatMap((s) => s.blocks ?? []).find((x) => shapeBlockId(x) === ref)
    return b ? `‘${BLOCKS[b.type].name}’ 컴포넌트` : '없는 컴포넌트'
  }
  const SIDE_TEXT = { before: '왼쪽에', after: '오른쪽에', above: '위에', below: '아래에' } as const
  const placeText = (p: { beside?: string; side?: keyof typeof SIDE_TEXT; edge?: 'top' | 'bottom'; swap?: string }) =>
    p.swap
      ? `${blockName(p.swap)}와 자리 바꾸기`
      : p.edge
        ? p.edge === 'top'
          ? '맨 위에 장 너비로'
          : '맨 아래에 장 너비로'
        : p.beside
          ? `${blockName(p.beside)} ${SIDE_TEXT[p.side ?? 'after']}`
          : '빈자리에'
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
      if (op.transition !== undefined)
        parts.push(op.transition === null || op.transition === 'auto' ? '장 넘기기: 발표 전체 설정대로' : `장 넘기기: ${TRANSITIONS.find((t) => t.id === op.transition)?.name}`)
      return { text: `${name(op.slide)} 모양 설정`, detail: parts.join(', ') }
    }
    case 'set_theme': {
      const parts: string[] = []
      if (op.theme) parts.push(`테마: ${THEMES[deck.theme.id].name} → ${THEMES[op.theme].name}`)
      if (op.accent !== undefined) parts.push(op.accent === null ? '강조색: 테마 기본색' : `강조색: ${op.accent}`)
      if (op.motion) parts.push(`움직임 정도: ${MOTIONS.find((m) => m.id === (deck.motion ?? 'calm'))?.name} → ${MOTIONS.find((m) => m.id === op.motion)?.name}`)
      return { text: op.theme || op.accent !== undefined ? '테마 바꾸기' : '움직임 정도 바꾸기', detail: parts.join(', ') }
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
      const b = /^p\d+$/.test(op.block) ? undefined : deck.slides.flatMap((s) => s.blocks ?? []).find((x) => shapeBlockId(x) === op.block)
      if (op.variant) parts.push(`모양: ${(b && BLOCKS[b.type].variants?.find((v) => v.id === op.variant)?.name) ?? op.variant}`)
      if (op.look) parts.push(`바탕: ${BLOCK_LOOKS.find((l) => l.id === op.look)?.name}`)
      if (op.effect) parts.push(`움직임: ${BLOCK_EFFECTS.find((e) => e.id === op.effect)?.name}`)
      if (op.when) parts.push(`나오는 때: ${BLOCK_WHENS.find((w) => w.id === op.when)?.name}`)
      if (op.from) parts.push(`들어오는 쪽: ${BLOCK_FROMS.find((f) => f.id === op.from)?.name}`)
      if (op.speed) parts.push(`빠르기: ${BLOCK_SPEEDS.find((x) => x.id === op.speed)?.name}`)
      if (op.count !== undefined) parts.push(`${(b && BLOCKS[b.type].items?.label) ?? '항목'} ${op.count}개`)
      if (op.highlight !== undefined) parts.push(op.highlight < 0 ? '강조 없음' : `${op.highlight + 1}번째를 강조`)
      return { text: `${name(op.slide)}의 ${blockName(op.block)} 모양 바꾸기`, detail: parts.join(', ') }
    }
    case 'set_size': {
      const parts = [op.w !== undefined && `너비 ${op.w}칸`, op.h !== undefined && `높이 ${op.h}칸`].filter(Boolean)
      return { text: `${name(op.slide)}의 ${blockName(op.block)} 크기 바꾸기`, detail: `${parts.join(', ')} (장 너비와 높이를 12칸으로 볼 때)` }
    }
    case 'set_link': {
      const where = op.side === 'right' ? `${blockName(op.block)}와 오른쪽 컴포넌트 사이` : `${blockName(op.block)}와 아래 컴포넌트 사이`
      const kind = BLOCK_LINKS.find((l) => l.id === op.link)?.name
      return op.link ? { text: `${name(op.slide)}에 이음표 ‘${kind}’ 넣기`, detail: where } : { text: `${name(op.slide)}에서 이음표 빼기`, detail: where }
    }
    case 'set_order':
      return { text: `${name(op.slide)}의 컴포넌트 나오는 차례 바꾸기`, detail: op.order.length ? op.order.map(blockName).join(' → ') : '놓인 차례대로' }
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
                    {slideName(was)}: 지금
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
                    {slideName(s)}
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
                  {slideName(s)}
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
