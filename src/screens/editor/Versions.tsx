import { useEffect, useState } from 'react'
import { pageInfo } from '../../deck/fields'
import { uid } from '../../deck/generate'
import type { Deck } from '../../deck/types'
import { cx } from '../../lib/cx'
import { go } from '../../lib/router'
import { pageProps, ScaledSlide, SlideCanvas } from '../../slides/SlideCanvas'
import { useDeck } from '../../store/deckStore'
import { persistNow, useStorage } from '../../store/persist'
import {
  deckSignature,
  deleteVersion,
  listVersions,
  loadVersionDeck,
  onVersionsChange,
  REASON_LABEL,
  renameVersion,
  saveVersion,
  versionChanges,
  type DeckVersion,
} from '../../store/versions'
import { CloseIcon, HistoryIcon, Modal, MoreIcon, Popover } from '../ui'

const timeFmt = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
const fullFmt = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function dayLabel(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((start(today) - start(d)) / 86400000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  return dayFmt.format(d)
}

function versionTitle(v: DeckVersion): string {
  return v.named ? v.name : '자동 저장'
}

function changeText(v: DeckVersion, older?: DeckVersion): string {
  if (!older) return '처음 남긴 버전'
  if (v.signature === older.signature) return '앞 버전과 내용이 같아요'
  const c = versionChanges(v, older)
  const parts: string[] = []
  const list = (names: string[]) => (names.length > 3 ? `${names.slice(0, 3).join(', ')} 외 ${names.length - 3}장` : names.join(', '))
  if (c.changed.length) parts.push(`고친 장: ${list(c.changed)}`)
  if (c.added.length) parts.push(`더한 장: ${list(c.added)}`)
  if (c.removed.length) parts.push(`뺀 장: ${list(c.removed)}`)
  return parts.join(' · ') || '발표 이름, 테마, 발표 정보가 바뀜'
}

/** 편집기 오른쪽에서 열리는 버전 기록 */
export function VersionPanel({ deck, onClose, notify }: { deck: Deck; onClose: () => void; notify: (text: string) => void }) {
  const [versions, setVersions] = useState<DeckVersion[] | null>(null)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [preview, setPreview] = useState<{ version: DeckVersion; deck: Deck } | null>(null)
  const [restoring, setRestoring] = useState<DeckVersion | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const folder = useStorage((s) => s.folder)
  const current = deckSignature(deck)

  useEffect(() => {
    const load = () => {
      listVersions(deck.id).then(setVersions)
    }
    load()
    return onVersionsChange(load)
  }, [deck.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !preview && !restoring && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, preview, restoring])

  const saveNamed = async () => {
    const label = name.trim() || `${fullFmt.format(Date.now())} 버전`
    const v = await saveVersion(deck, { name: label })
    setNaming(false)
    setName('')
    notify(v ? `‘${label}’ 버전을 남겼어요` : '버전을 남기지 못했어요. 다시 시도해 주세요.')
  }

  const openPreview = async (version: DeckVersion) => {
    const d = await loadVersionDeck(version.id)
    if (d) setPreview({ version, deck: d })
    else notify('이 버전을 불러오지 못했어요')
  }

  const restore = async (version: DeckVersion) => {
    const d = await loadVersionDeck(version.id)
    setRestoring(null)
    setPreview(null)
    if (!d) {
      notify('이 버전을 불러오지 못했어요')
      return
    }
    await saveVersion(deck, { reason: 'restore' })
    const next: Deck = { ...d, id: deck.id, updatedAt: Date.now() }
    useDeck.getState().open(next)
    await persistNow(next)
    notify(`${fullFmt.format(version.createdAt)} 버전으로 되돌렸어요. 되돌리기 전 상태도 기록에 남겨 뒀어요.`)
  }

  const openCopy = async (version: DeckVersion) => {
    const d = await loadVersionDeck(version.id)
    if (!d) return notify('이 버전을 불러오지 못했어요')
    const now = Date.now()
    const copy: Deck = { ...d, id: uid(), title: `${d.title} (${fullFmt.format(version.createdAt)})`, createdAt: now, updatedAt: now }
    await persistNow(copy)
    go({ name: 'edit', id: copy.id })
  }

  const rename = async (version: DeckVersion, next: string) => {
    setRenaming(null)
    if (next.trim() && next.trim() !== version.name) await renameVersion(version, next)
  }

  const remove = async (version: DeckVersion) => {
    await deleteVersion(version.id)
  }

  const groups: { day: string; items: { v: DeckVersion; older?: DeckVersion }[] }[] = []
  versions?.forEach((v, i) => {
    const day = dayLabel(v.createdAt)
    const last = groups[groups.length - 1]
    const entry = { v, older: versions[i + 1] }
    if (last?.day === day) last.items.push(entry)
    else groups.push({ day, items: [entry] })
  })

  return (
    <aside className="vp" aria-label="버전 기록">
      <header className="vp-head">
        <h2 className="vp-title">
          <HistoryIcon />
          버전 기록
        </h2>
        <button type="button" className="icon-btn" aria-label="닫기" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>

      <div className="vp-save">
        {naming ? (
          <form
            className="vp-name-form"
            onSubmit={(e) => {
              e.preventDefault()
              saveNamed()
            }}
          >
            <input
              className="input"
              autoFocus
              value={name}
              placeholder="예: 고객 전달본, 1차 미팅 후 수정"
              aria-label="버전 이름"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setNaming(false))}
            />
            <div className="vp-name-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNaming(false)}>
                취소
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                남기기
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn btn-primary vp-save-btn" onClick={() => setNaming(true)}>
            지금 상태를 버전으로 남기기
          </button>
        )}
        <p className="vp-note">
          버전을 누르면 그때 모습을 보고 되돌릴 수 있어요. 이름 붙인 버전은 지우기 전까지 보관되고, 자동 저장은 고치는 중 10분마다, 발표하거나 내보내기 전에 남아요.
          {folder?.kind === 'ready' && ` ‘${folder.name}/버전 기록’ 폴더에도 같이 저장돼요.`}
        </p>
      </div>

      <div className="vp-list">
        {versions && versions.length === 0 && <p className="vp-empty">아직 남긴 버전이 없어요.</p>}
        {groups.map((g) => (
          <section key={g.day} className="vp-group">
            <h3 className="vp-day">{g.day}</h3>
            <ol>
              {g.items.map(({ v, older }) => (
                <li key={v.id} className={cx('vp-item', v.named && 'is-named', v.signature === current && 'is-current')}>
                  {renaming === v.id ? (
                    <form
                      className="vp-rename"
                      onSubmit={(e) => {
                        e.preventDefault()
                        rename(v, new FormData(e.currentTarget).get('name') as string)
                      }}
                    >
                      <input
                        className="input"
                        name="name"
                        autoFocus
                        defaultValue={v.named ? v.name : ''}
                        placeholder="예: 고객 전달본"
                        aria-label="버전 이름"
                        onBlur={(e) => rename(v, e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setRenaming(null))}
                      />
                    </form>
                  ) : (
                    <button type="button" className="vp-open" onClick={() => openPreview(v)}>
                      <span className="vp-item-top">
                        <span className="vp-name">
                          {versionTitle(v)}
                          {!v.named && v.reason && <span className="vp-reason">{REASON_LABEL[v.reason]}</span>}
                        </span>
                        <span className="vp-time">{timeFmt.format(v.createdAt)}</span>
                      </span>
                      <span className="vp-changes">
                        {v.signature === current ? <span className="vp-same">지금 화면과 같아요</span> : changeText(v, older)}
                      </span>
                    </button>
                  )}
                  <Popover
                    className="vp-menu"
                    button={({ toggle, open }) => (
                      <button type="button" className="icon-btn vp-more" aria-label={`${versionTitle(v)} 더 보기`} aria-expanded={open} onClick={toggle}>
                        <MoreIcon />
                      </button>
                    )}
                  >
                    {(close) => (
                      <div className="menu">
                        <button type="button" className="menu-item" disabled={v.signature === current} onClick={() => (close(), setRestoring(v))}>
                          이 버전으로 되돌리기
                        </button>
                        <button type="button" className="menu-item" onClick={() => (close(), openCopy(v))}>
                          새 발표로 꺼내기
                        </button>
                        <button type="button" className="menu-item" onClick={() => (close(), setRenaming(v.id))}>
                          {v.named ? '이름 바꾸기' : '이름 붙여 보관하기'}
                        </button>
                        <div className="menu-sep" role="separator" />
                        <button type="button" className="menu-item is-danger" onClick={() => (close(), remove(v))}>
                          이 버전 지우기
                        </button>
                      </div>
                    )}
                  </Popover>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      {preview && (
        <VersionPreview
          version={preview.version}
          deck={preview.deck}
          current={deck}
          isCurrent={preview.version.signature === current}
          onClose={() => setPreview(null)}
          onRestore={() => setRestoring(preview.version)}
        />
      )}

      {restoring && (
        <Modal
          title="이 버전으로 되돌릴까요?"
          onClose={() => setRestoring(null)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" data-autofocus onClick={() => setRestoring(null)}>
                취소
              </button>
              <button type="button" className="btn btn-primary" onClick={() => restore(restoring)}>
                되돌리기
              </button>
            </>
          }
        >
          <p>
            {fullFmt.format(restoring.createdAt)}에 남긴 ‘{versionTitle(restoring)}’로 되돌려요. 지금 상태는 버전 기록에 남겨 두니 언제든 다시 돌아올 수 있어요.
          </p>
        </Modal>
      )}
    </aside>
  )
}

function VersionPreview({
  version,
  deck,
  current,
  isCurrent,
  onClose,
  onRestore,
}: {
  version: DeckVersion
  deck: Deck
  current: Deck
  isCurrent: boolean
  onClose: () => void
  onRestore: () => void
}) {
  const info = pageInfo(deck.slides)
  const now = new Map(current.slides.map((s) => [s.id, JSON.stringify(s)]))
  const diff = (s: Deck['slides'][number]) => (!now.has(s.id) ? '지금은 없는 장' : now.get(s.id) !== JSON.stringify(s) ? '지금과 달라요' : null)
  const visible = deck.slides.filter((s) => !s.hidden)
  const differs = visible.filter((s) => diff(s)).length
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="vpp" role="dialog" aria-modal="true" aria-label="버전 미리 보기">
      <header className="vpp-head">
        <div>
          <p className="vpp-title">{versionTitle(version)}</p>
          <p className="vpp-sub">
            {fullFmt.format(version.createdAt)}에 남김, {version.slideCount}장
            {isCurrent ? ', 지금 화면과 같아요' : differs > 0 ? `, 지금과 다른 장 ${differs}개` : ''}
          </p>
        </div>
        <div className="vpp-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="btn btn-primary" disabled={isCurrent} onClick={onRestore}>
            이 버전으로 되돌리기
          </button>
        </div>
      </header>
      <div className="vpp-body">
        {visible.map((s, i) => {
          const note = diff(s)
          return (
            <figure key={s.id} className={cx('vpp-item', note && 'is-diff')}>
              <ScaledSlide width={640} className="vpp-slide">
                <SlideCanvas deck={deck} slide={s} mode="final" {...pageProps(info, s.id)} />
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
  )
}
