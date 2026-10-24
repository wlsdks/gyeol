import { useEffect, useMemo, useState } from 'react'
import { AUDIENCES, BLUEPRINTS, DECK_TYPES, DURATIONS, METHODS } from '../deck/blueprints'
import { pageInfo } from '../deck/fields'
import { createDeck, formatDate, makeSlide } from '../deck/generate'
import { LAYOUTS } from '../deck/layouts'
import { THEMES, THEME_ORDER } from '../deck/themes'
import type { Audience, Deck, DeckMeta, DeckType, Method, Slide, ThemeId } from '../deck/types'
import { cx } from '../lib/cx'
import { go } from '../lib/router'
import { FitSlide, pageProps, SlideCanvas } from '../slides/SlideCanvas'
import { persistNow } from '../store/persist'
import { Brand, SAVE_HELP, useToast } from './ui'

// 보고 상황: 누구에게, 얼마나, 어떻게 보고하는지. 표지: 제목, 결정 요청, 발표자와 테마
const STEPS = ['보고 종류', '보고 상황', '표지']

/** 보고 종류 카드의 작은 그림들: 이야기 흐름의 차례마다 그 보고에서 만들어지는 장 하나 (blueprints의 showcase) */
function filmOf(type: DeckType): { deck: Deck; slides: Slide[] } {
  const bp = BLUEPRINTS[type]
  const deck = createDeck({ type, audience: 'mixed', minutes: 20, method: 'live', title: '', org: '', presenter: '', theme: 'white' })
  const slides = (bp.showcase ?? []).flatMap((purpose) => {
    const recipe = bp.recipes.find((r) => r.purpose === purpose)
    return recipe ? [makeSlide(recipe.layout, recipe)] : []
  })
  return { deck: { ...deck, slides }, slides }
}

export function Wizard() {
  const [step, setStep] = useState(0)
  const [type, setType] = useState<DeckType>('business')
  const [audience, setAudience] = useState<Audience>('mixed')
  const [minutes, setMinutes] = useState(20)
  const [method, setMethod] = useState<Method>('live')
  const [title, setTitle] = useState('')
  const [org, setOrg] = useState('')
  const [presenter, setPresenter] = useState('')
  const [ask, setAsk] = useState('')
  const [theme, setTheme] = useState<ThemeId>('white')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const blueprint = BLUEPRINTS[type]
  // 2단계 오른쪽에 보여 줄 구성. 고르는 대로 바로 바뀐다
  const preview = useMemo(
    () => createDeck({ type, audience, minutes, method, title: '', org: '', presenter: '', theme }),
    [type, audience, minutes, method, theme],
  )
  const previewInfo = useMemo(() => pageInfo(preview.slides), [preview])

  // 단계를 넘기면 맨 위부터 보이게. 앞 단계에서 내려 둔 스크롤이 남으면 제목과 단계 표시가 가려진다
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  // 빈 발표를 골랐다가 '이전'으로 돌아오면 그 전에 골라 둔 보고 종류로 되돌린다.
  // 빈 발표인 채로 두면 1단계에 골라진 카드가 없고, '다음'이 구성이 빈 2단계를 연다
  const [typeBefore, setTypeBefore] = useState<DeckType>('business')
  const chooseType = (t: DeckType) => {
    if (t === 'blank' && type !== 'blank') setTypeBefore(type)
    setType(t)
    setStep(t === 'blank' ? 2 : 1)
  }
  const back = () => {
    if (type === 'blank' && step === 2) {
      setType(typeBefore)
      setStep(0)
    } else setStep(step - 1)
  }

  const create = async () => {
    setBusy(true)
    try {
      const deck = createDeck({ type, audience, minutes, method, title, org, presenter, ask, theme })
      // 저장하지 못한 채 편집기로 가면 '찾을 수 없는 발표'로 보인다. 여기 머물러 다시 누를 수 있게
      if (await persistNow(deck)) go({ name: 'edit', id: deck.id })
      else toast.show(`발표를 만들지 못했어요. ${SAVE_HELP}`, undefined, 8000)
    } catch {
      toast.show(`발표를 만들지 못했어요. ${SAVE_HELP}`, undefined, 8000)
    } finally {
      setBusy(false)
    }
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
            <h1 className="wz-h">어떤 보고인가요?</h1>
            <p className="wz-sub">무엇을 보고하는지 고르면 그에 맞는 순서로 장을 만들어 드려요. 그림은 그 순서대로 만들어지는 장이에요.</p>
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
                    <Film type={t} label={bp.storyline} />
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="wz-sec wz-split">
            <div className="wz-form">
              <h1 className="wz-h">누구에게, 얼마나 보고하나요?</h1>
              <p className="wz-sub">고르는 대로 오른쪽 구성이 바로 바뀌어요.</p>

              <fieldset className="wz-group">
                <legend>보고 받는 분</legend>
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

            <aside className="wz-plan">
              <p className="wz-plan-k">{blueprint.name}</p>
              <p className="wz-plan-h" aria-live="polite">
                {preview.slides.length}장으로 만들어요
              </p>
              {/* 실제로 만들어질 장을 작게 그린다. 칸마다 들어갈 예시가 보이고, 편집기에서는 이 자리에 회색 안내로 남는다 */}
              <ol className="wz-plan-grid wz-real">
                {planKeys(preview.slides).map(([key, s], i) => (
                  <li key={key} className={cx(s.layout === 'section' && 'is-section')} title={LAYOUTS[s.layout].name}>
                    <span className="wz-shot" aria-hidden="true">
                      <FitSlide>
                        <SlideCanvas deck={preview} slide={s} mode="preview" {...pageProps(previewInfo, s.id)} />
                      </FitSlide>
                    </span>
                    <span className="wz-plan-name">
                      <span className="wz-plan-n">{i + 1}</span>
                      {s.layout === 'section' ? s.section : s.purpose}
                    </span>
                  </li>
                ))}
              </ol>
            </aside>
          </section>
        )}

        {step === 2 && (
          <section className="wz-sec wz-split">
            <div className="wz-form">
              <h1 className="wz-h">표지를 채워 주세요</h1>
              <p className="wz-sub">적는 대로 오른쪽 표지가 바뀌어요. 비워 두고 나중에 채워도 돼요.</p>
              <div className="wz-fields">
                <label className="field">
                  <span className="field-label">발표 제목</span>
                  <input
                    className="input"
                    value={title}
                    placeholder={`예: ${blueprint.examples.title}`}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                  />
                </label>
                <label className="field">
                  <span className="field-label">
                    결정받고 싶은 것 <span className="field-opt">표지에 크게 보여요</span>
                  </span>
                  <input className="input" value={ask} placeholder={`예: ${blueprint.examples.ask}`} onChange={(e) => setAsk(e.target.value)} />
                </label>
                <div className="wz-pair">
                  <label className="field">
                    <span className="field-label">소속</span>
                    <input className="input" value={org} placeholder="예: 영업 2팀" onChange={(e) => setOrg(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="field-label">발표자</span>
                    <input className="input" value={presenter} placeholder="예: 김민준 매니저" onChange={(e) => setPresenter(e.target.value)} />
                  </label>
                </div>
              </div>

              <fieldset className="wz-group">
                <legend>테마</legend>
                <div className="wz-options wz-options-2">
                  {THEME_ORDER.map((id) => (
                    <Option key={id} on={theme === id} onClick={() => setTheme(id)} name={THEMES[id].name} desc={THEMES[id].description} swatch={id} />
                  ))}
                </div>
              </fieldset>
            </div>

            <aside className="wz-plan wz-cover" aria-label="표지 미리 보기">
              <p className="wz-plan-k">표지 미리 보기</p>
              <span className="wz-shot" aria-hidden="true">
                <FitSlide>
                  <CoverPreview id={theme} title={title || blueprint.defaultTitle} org={org} presenter={presenter} ask={ask} />
                </FitSlide>
              </span>
              <p className="wz-cover-note">나머지 {preview.slides.length - 1}장은 만든 뒤 편집기에서 채워요.</p>
            </aside>
          </section>
        )}
      </main>

      <footer className="wz-bottom">
        {/* 빈 발표는 고르는 카드 밖의 다른 길이라 아래 줄 왼쪽에 (낮은 화면에서도 카드 두 줄이 스크롤 없이 보이게) */}
        {step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={back}>
            이전
          </button>
        ) : (
          <button type="button" className="btn-link wz-blank" onClick={() => chooseType('blank')}>
            정해진 구성 없이 빈 발표로 시작하기
          </button>
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
        {/* 낮은 화면에서도 가리지 않게, 만들기 단추 바로 옆에 */}
        {step === 2 && <p className="wz-privacy">입력한 내용은 이 PC 안(브라우저와 고른 보관 폴더)에만 저장돼요. 인터넷으로 보내지 않아요.</p>}
        {step === 2 && (
          <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={create}>
            발표 만들기
          </button>
        )}
      </footer>
      {toast.node}
    </div>
  )
}

/** 같은 장이 두 번 나와도(단락 장 같은) 고를 때마다 다시 그려지지 않게, 장의 역할과 차례로 이름을 붙인다 */
function planKeys(slides: Slide[]): [string, Slide][] {
  const seen = new Map<string, number>()
  return slides.map((s) => {
    const base = `${s.layout}:${s.layout === 'section' ? s.section : s.purpose}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return [`${base}:${n}`, s]
  })
}

/** 보고 종류 카드의 작은 그림 줄. 그림 아래에 이야기 흐름의 이름 */
function Film({ type, label }: { type: DeckType; label: string[] }) {
  const film = useMemo(() => filmOf(type), [type])
  const info = useMemo(() => pageInfo(film.slides), [film])
  if (!film.slides.length) return null
  return (
    <span className="wz-film wz-real" aria-label={`이야기 흐름: ${label.join(', ')}`}>
      {film.slides.map((s, i) => (
        <span key={s.id} className="wz-film-item">
          <span className="wz-shot" aria-hidden="true">
            <FitSlide>
              <SlideCanvas deck={film.deck} slide={s} mode="preview" {...pageProps(info, s.id)} />
            </FitSlide>
          </span>
          <span className="wz-film-cap">
            <span className="wz-plan-n">{i + 1}</span>
            {label[i]}
          </span>
        </span>
      ))}
    </span>
  )
}

function Option({ on, onClick, name, desc, swatch }: { on: boolean; onClick: () => void; name: string; desc: string; swatch?: ThemeId }) {
  return (
    <button type="button" className={cx('opt', on && 'is-on')} aria-pressed={on} onClick={onClick}>
      <span className="opt-radio" aria-hidden="true" />
      {swatch && <span className={cx('wz-swatch', `wz-swatch-${swatch}`)} aria-hidden="true" />}
      <span className="opt-text">
        <span className="opt-name">{name}</span>
        <span className="opt-desc">{desc}</span>
      </span>
    </button>
  )
}

function CoverPreview(props: { id: ThemeId; title: string; org: string; presenter: string; ask: string }) {
  const { id, title, org, presenter, ask } = props
  const slide = useMemo(() => {
    const s = makeSlide('cover')
    s.fields.title = title
    s.fields.ask = ask
    return s
  }, [title, ask])
  const meta: DeckMeta = {
    type: 'business',
    audience: 'mixed',
    duration: 20,
    method: 'live',
    org,
    presenter,
    date: formatDate(),
    contact: '',
    logo: '',
  }
  return <SlideCanvas deck={{ meta, theme: { id }, title }} slide={slide} mode="preview" />
}
