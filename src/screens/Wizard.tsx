import { useMemo, useState } from 'react'
import { AUDIENCES, BLUEPRINTS, DECK_TYPES, DURATIONS, METHODS } from '../deck/blueprints'
import { createDeck, formatDate, makeSlide, planRecipes } from '../deck/generate'
import { LAYOUTS } from '../deck/layouts'
import { THEMES, THEME_ORDER } from '../deck/themes'
import type { Audience, DeckMeta, DeckType, Method, ThemeId } from '../deck/types'
import { cx } from '../lib/cx'
import { go } from '../lib/router'
import { ScaledSlide, SlideCanvas } from '../slides/SlideCanvas'
import { persistNow } from '../store/persist'
import { Brand, ChevronIcon } from './ui'

const STEPS = ['발표 종류', '청중과 시간', '기본 정보']

export function Wizard() {
  const [step, setStep] = useState(0)
  const [type, setType] = useState<DeckType>('proposal')
  const [audience, setAudience] = useState<Audience>('mixed')
  const [minutes, setMinutes] = useState(20)
  const [method, setMethod] = useState<Method>('live')
  const [title, setTitle] = useState('')
  const [customer, setCustomer] = useState('')
  const [presenter, setPresenter] = useState('')
  const [theme, setTheme] = useState<ThemeId>('white')
  const [busy, setBusy] = useState(false)

  const blueprint = BLUEPRINTS[type]
  const plan = useMemo(() => planRecipes(type, audience, minutes), [type, audience, minutes])

  const chooseType = (t: DeckType) => {
    setType(t)
    setStep(t === 'blank' ? 2 : 1)
  }

  const create = async () => {
    setBusy(true)
    const deck = createDeck({ type, audience, minutes, method, title, customer, presenter, theme })
    await persistNow(deck)
    go({ name: 'edit', id: deck.id })
  }

  return (
    <div className="wz">
      <header className="wz-top">
        <Brand />
        <ol className="wz-steps" aria-label="진행 단계">
          {STEPS.map((name, i) => (
            <li key={name} className={cx(i === step && 'is-current', i < step && 'is-done')}>
              <span className="wz-step-n">{i + 1}</span>
              {name}
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn-ghost" onClick={() => go({ name: 'home' })}>
          취소
        </button>
      </header>

      <main className="wz-main">
        {step === 0 && (
          <section className="wz-sec">
            <h1 className="wz-h">어떤 발표인가요?</h1>
            <p className="wz-sub">고르면 발표에 맞는 순서와 장 구성을 잡아 드려요.</p>
            <div className="wz-types">
              {DECK_TYPES.map((t) => {
                const bp = BLUEPRINTS[t]
                return (
                  <button
                    key={t}
                    type="button"
                    className={cx('wz-type', type === t && 'is-on')}
                    onClick={() => chooseType(t)}
                  >
                    <span className="wz-type-name">{bp.name}</span>
                    <span className="wz-type-desc">{bp.description}</span>
                    <span className="wz-flow" aria-label={`이야기 흐름: ${bp.storyline.join(', ')}`}>
                      {bp.storyline.map((s, i) => (
                        <span key={s} className="wz-flow-step">
                          {i > 0 && <ChevronIcon />}
                          {s}
                        </span>
                      ))}
                    </span>
                  </button>
                )
              })}
            </div>
            <button type="button" className="btn-link wz-blank" onClick={() => chooseType('blank')}>
              정해진 구성 없이 빈 발표로 시작하기
            </button>
          </section>
        )}

        {step === 1 && (
          <section className="wz-sec wz-split">
            <div className="wz-form">
              <h1 className="wz-h">누구 앞에서, 얼마나 발표하나요?</h1>
              <p className="wz-sub">고르는 대로 오른쪽 구성이 바로 바뀌어요.</p>

              <fieldset className="wz-group">
                <legend>듣는 사람</legend>
                <div className="wz-options">
                  {AUDIENCES.map((a) => (
                    <Option key={a.id} on={audience === a.id} onClick={() => setAudience(a.id)} name={a.name} desc={a.description} />
                  ))}
                </div>
              </fieldset>

              <fieldset className="wz-group">
                <legend>발표 시간</legend>
                <div className="wz-chips">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.minutes}
                      type="button"
                      className={cx('chip', minutes === d.minutes && 'is-on')}
                      aria-pressed={minutes === d.minutes}
                      onClick={() => setMinutes(d.minutes)}
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="wz-group">
                <legend>발표 방식</legend>
                <div className="wz-options">
                  {METHODS.map((m) => (
                    <Option key={m.id} on={method === m.id} onClick={() => setMethod(m.id)} name={m.name} desc={m.description} />
                  ))}
                </div>
              </fieldset>
            </div>

            <aside className="wz-plan" aria-live="polite">
              <p className="wz-plan-k">{blueprint.name}</p>
              <p className="wz-plan-h">{plan.length}장으로 구성돼요</p>
              <ol className="wz-plan-list">
                {plan.map((r, i) => (
                  <li key={`${r.purpose}-${i}`} className={cx(r.layout === 'section' && 'is-section')}>
                    <span className="wz-plan-n">{i + 1}</span>
                    <span className="wz-plan-name">{r.layout === 'section' ? r.section : r.purpose}</span>
                    <span className="wz-plan-layout">{LAYOUTS[r.layout].name}</span>
                  </li>
                ))}
              </ol>
            </aside>
          </section>
        )}

        {step === 2 && (
          <section className="wz-sec">
            <h1 className="wz-h">기본 정보를 알려 주세요</h1>
            <p className="wz-sub">나중에 언제든 바꿀 수 있어요. 비워 두어도 괜찮아요.</p>
            <div className="wz-fields">
              <label className="field">
                <span className="field-label">발표 제목</span>
                <input
                  className="input"
                  value={title}
                  placeholder={blueprint.defaultTitle}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="field">
                <span className="field-label">고객사</span>
                <input className="input" value={customer} placeholder="예: 한빛제조" onChange={(e) => setCustomer(e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">발표자</span>
                <input className="input" value={presenter} placeholder="예: 김민준 매니저" onChange={(e) => setPresenter(e.target.value)} />
              </label>
            </div>

            <fieldset className="wz-group">
              <legend>테마</legend>
              <div className="wz-themes">
                {THEME_ORDER.map((id) => (
                  <ThemeCard
                    key={id}
                    id={id}
                    on={theme === id}
                    onClick={() => setTheme(id)}
                    title={title || blueprint.defaultTitle}
                    customer={customer}
                    presenter={presenter}
                  />
                ))}
              </div>
            </fieldset>

            <p className="wz-privacy">
              입력한 내용은 이 브라우저에만 저장돼요. 어디에도 전송하지 않아요.
            </p>
          </section>
        )}
      </main>

      <footer className="wz-bottom">
        {step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => setStep(type === 'blank' && step === 2 ? 0 : step - 1)}>
            이전
          </button>
        ) : (
          <span />
        )}
        {step === 0 && (
          <button type="button" className="btn btn-primary btn-lg" onClick={() => setStep(1)}>
            다음
          </button>
        )}
        {step === 1 && (
          <button type="button" className="btn btn-primary btn-lg" onClick={() => setStep(2)}>
            다음
          </button>
        )}
        {step === 2 && (
          <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={create}>
            발표 만들기
          </button>
        )}
      </footer>
    </div>
  )
}

function Option({ on, onClick, name, desc }: { on: boolean; onClick: () => void; name: string; desc: string }) {
  return (
    <button type="button" className={cx('opt', on && 'is-on')} aria-pressed={on} onClick={onClick}>
      <span className="opt-radio" aria-hidden="true" />
      <span className="opt-text">
        <span className="opt-name">{name}</span>
        <span className="opt-desc">{desc}</span>
      </span>
    </button>
  )
}

function ThemeCard(props: { id: ThemeId; on: boolean; onClick: () => void; title: string; customer: string; presenter: string }) {
  const { id, on, onClick, title, customer, presenter } = props
  const slide = useMemo(() => {
    const s = makeSlide('cover')
    s.fields.title = title
    return s
  }, [title])
  const meta: DeckMeta = {
    type: 'proposal',
    audience: 'mixed',
    duration: 20,
    method: 'live',
    customer,
    presenter,
    date: formatDate(),
    contact: '',
    logo: '',
  }
  return (
    <button type="button" className={cx('wz-theme', on && 'is-on')} aria-pressed={on} onClick={onClick}>
      <ScaledSlide width={300}>
        <SlideCanvas deck={{ meta, theme: { id }, title }} slide={slide} mode="final" />
      </ScaledSlide>
      <span className="wz-theme-name">{THEMES[id].name}</span>
      <span className="wz-theme-desc">{THEMES[id].description}</span>
    </button>
  )
}
