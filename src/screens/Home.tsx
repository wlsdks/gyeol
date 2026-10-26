import { useEffect, useState } from 'react'
import { BLUEPRINTS } from '../deck/blueprints'
import { knownOnly, unknownParts } from '../deck/compat'
import { createSampleDeck } from '../deck/sample'
import type { Deck } from '../deck/types'
import { readDeckFromHtml } from '../export/exportHtml'
import { particle } from '../lib/josa'
import { go, timeAgo } from '../lib/router'
import { APP_VERSION } from '../lib/version'
import { FitSlide, SlideCanvas } from '../slides/SlideCanvas'
import { copyDeck } from '../store/copy'
import { decodeDeckFile, DECK_EXT } from '../store/deckFile'
import { useDeck } from '../store/deckStore'
import { listDecks } from '../store/library'
import { importDeck, persistNow, removeDeck, syncWithFolder, useStorage } from '../store/persist'
import { Brand, CopyIcon, FolderIcon, Info, Modal, MoreIcon, noticeAfterGo, PlusIcon, Popover, SAVE_HELP, TrashIcon, UploadIcon, useToast } from './ui'

const SAMPLE_ID = 'sample'

export function Home() {
  const [decks, setDecks] = useState<Deck[] | null>(null)
  const [toDelete, setToDelete] = useState<Deck | null>(null)
  const folder = useStorage((s) => s.folder)
  const toast = useToast()

  const refresh = () => listDecks().then(setDecks)
  useEffect(() => {
    // 편집기에 들고 있던 발표는 놓는다. 폴더에서 더 새것이 들어올 수 있다.
    useDeck.getState().close()
    refresh()
    useStorage
      .getState()
      .refresh()
      .then(async (status) => {
        if (status.kind !== 'ready') return
        await syncWithFolder()
        refresh()
      })
  }, [])

  const duplicate = async (deck: Deck) => {
    const copy = copyDeck(deck, `${deck.title} 사본`)
    if (!(await persistNow(copy))) toast.show(`사본을 만들지 못했어요. ${SAVE_HELP}`, undefined, 8000)
    refresh()
  }

  // 예시는 하나만 둔다. 누를 때마다 새로 만들면 같은 예시가 목록에 쌓인다. 지웠으면 다시 만든다.
  const openSample = async () => {
    const existing = (await listDecks()).find((d) => d.id === SAMPLE_ID)
    if (existing) {
      go({ name: 'edit', id: existing.id })
      return
    }
    const deck = { ...createSampleDeck(), id: SAMPLE_ID }
    // 저장하지 못한 채 편집기로 가면 '찾을 수 없는 발표'로 보인다
    if (!(await persistNow(deck))) {
      toast.show(`예시를 열지 못했어요. ${SAVE_HELP}`, undefined, 8000)
      return
    }
    go({ name: 'edit', id: deck.id })
  }

  const openFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = `${DECK_EXT},.html,text/html`
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      const deck = file.name.endsWith(DECK_EXT) ? decodeDeckFile(text) : readDeckFromHtml(text)
      if (!deck) {
        toast.show('결에서 저장한 작업 파일이나 내보낸 발표 파일(HTML)만 열 수 있어요.')
        return
      }
      const opened = await importDeck(deck)
      if (!opened.saved) {
        toast.show(`파일을 열지 못했어요. ${SAVE_HELP}`, undefined, 8000)
        refresh()
        return
      }
      // 같은 발표를 말없이 덮어쓰지 않았다는 것을 편집기에서 알린다
      if (opened.replaced) noticeAfterGo('있던 발표를 파일 내용으로 바꿨어요. 바뀌기 전 모습은 버전 기록에 있어요.')
      else if (opened.copied) noticeAfterGo('같은 발표가 이미 있어서 사본으로 열었어요. 있던 발표는 그대로예요.')
      go({ name: 'edit', id: opened.deck.id })
    }
    input.click()
  }

  return (
    <div className="home">
      <header className="home-top">
        <div className="home-brand">
          <Brand />
          <span className="home-ver">{APP_VERSION} 버전</span>
        </div>
        <button type="button" className="btn btn-ghost" onClick={openFile}>
          <UploadIcon />
          파일 열기
        </button>
      </header>

      <main className="home-main">
        <div className="home-head">
          <h1 className="home-h">
            내 발표
            {decks && decks.length > 0 && <span className="home-count">{decks.length}</span>}
          </h1>
          <div className="home-links">
            <button type="button" className="btn-link" onClick={() => go({ name: 'system' })}>
              장 모음 보기
            </button>
            {decks && decks.length > 0 && (
              <button type="button" className="btn-link" onClick={openSample}>
                완성된 예시 보기
              </button>
            )}
          </div>
        </div>

        <StorageNote onSynced={refresh} />

        {decks && decks.length === 0 && (
          <div className="home-empty">
            <p className="home-empty-h">아직 만든 발표가 없어요</p>
            <p className="home-empty-p">발표 종류를 고르면 장 구성을 잡아 드려요. 내용만 채우면 돼요.</p>
            <div className="home-empty-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => go({ name: 'new' })}>
                <PlusIcon />새 발표 만들기
              </button>
              <button type="button" className="btn btn-ghost btn-lg" onClick={openSample}>
                완성된 예시 보기
              </button>
            </div>
          </div>
        )}

        {decks && decks.length > 0 && (
          <div className="home-grid">
            <button type="button" className="home-new" onClick={() => go({ name: 'new' })}>
              <PlusIcon />
              <span>새 발표 만들기</span>
            </button>
            {decks.map((deck) => (
              <DeckCard key={deck.id} deck={deck} onDuplicate={() => duplicate(deck)} onDelete={() => setToDelete(deck)} />
            ))}
          </div>
        )}
      </main>

      {toDelete && (
        <Modal
          title="이 발표를 지울까요?"
          onClose={() => setToDelete(null)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" data-autofocus onClick={() => setToDelete(null)}>
                취소
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  await removeDeck(toDelete)
                  setToDelete(null)
                  refresh()
                }}
              >
                지우기
              </button>
            </>
          }
        >
          <p>
            {folder?.kind === 'ready'
              ? `‘${toDelete.title}’${particle(toDelete.title, '을', '를')} 목록에서 지워요. 보관 폴더의 작업 파일은 ‘지운 발표’ 폴더로 옮겨 두니, 필요하면 파일 열기로 다시 불러올 수 있어요.`
              : `‘${toDelete.title}’${particle(toDelete.title, '을', '를')} 지우면 되돌릴 수 없어요. 버전 기록도 함께 지워지고, 내보낸 파일은 그대로 남아요.`}
          </p>
        </Modal>
      )}
      {toast.node}
    </div>
  )
}

function DeckCard({ deck, onDuplicate, onDelete }: { deck: Deck; onDuplicate: () => void; onDelete: () => void }) {
  // 새 버전에서 만든 발표면 이 버전이 그릴 수 있는 것만으로 작은 그림을 그린다
  const shown = unknownParts(deck) ? knownOnly(deck) : deck
  const first = shown.slides.find((s) => !s.hidden) ?? shown.slides[0]
  const typeName = BLUEPRINTS[deck.meta.type]?.name ?? ''
  return (
    <article className="card">
      <a className="card-link" href={`#/edit/${deck.id}`} aria-label={`${deck.title} 열기`}>
        <div className="card-thumb">
          <FitSlide>{first && <SlideCanvas deck={shown} slide={first} mode="final" />}</FitSlide>
        </div>
      </a>
      <div className="card-info">
        <div className="card-text">
          <h2 className="card-title">{deck.title}</h2>
          {/* 한 줄로: 두 줄이면 카드마다 글이 길어져 그림보다 글이 먼저 읽힌다 */}
          <p className="card-meta">
            {typeName && <span>{typeName}</span>}
            <span>{deck.slides.length}장</span>
            <span>{timeAgo(deck.updatedAt)} 수정</span>
          </p>
        </div>
        <Popover
          button={({ toggle, open }) => (
            <button type="button" className="icon-btn" aria-label={`${deck.title} 더 보기`} aria-expanded={open} onClick={toggle}>
              <MoreIcon />
            </button>
          )}
        >
          {(close) => (
            <div className="menu">
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  close()
                  onDuplicate()
                }}
              >
                <CopyIcon />
                사본 만들기
              </button>
              <button
                type="button"
                className="menu-item is-danger"
                onClick={() => {
                  close()
                  onDelete()
                }}
              >
                <TrashIcon />
                지우기
              </button>
            </div>
          )}
        </Popover>
      </div>
    </article>
  )
}

/** 발표가 어디에 보관되는지. 폴더를 정하지 않았으면 정하도록 권한다. */
function StorageNote({ onSynced }: { onSynced: () => void }) {
  const { folder, choose, allow } = useStorage()
  if (!folder) return null

  const run = async (fn: () => Promise<{ kind: string }>) => {
    const next = await fn()
    if (next.kind === 'ready') onSynced()
  }

  if (folder.kind === 'ready') {
    return (
      <p className="store-note is-ready">
        <FolderIcon />
        <span>
          ‘<b>{folder.name}</b>’ 폴더에 자동으로 보관해요
          <Info label="보관 폴더 설명" align="start">
            고칠 때마다 저장되고, 버전 기록도 이 폴더에 남아요.
          </Info>
        </span>
        <button type="button" className="btn-link" onClick={() => run(choose)}>
          폴더 바꾸기
        </button>
      </p>
    )
  }

  if (folder.kind === 'locked') {
    return (
      <div className="store-note is-warn">
        <FolderIcon />
        <p>
          <b>‘{folder.name}’ 폴더와 다시 연결해 주세요.</b>
          <Info label="다시 연결하는 이유" align="start">
            브라우저를 새로 열면 한 번 더 허용해야 해요. 허용하기 전까지는 이 브라우저에만 저장돼요.
          </Info>
        </p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => run(allow)}>
          허용하기
        </button>
      </div>
    )
  }

  if (folder.kind === 'none') {
    return (
      <div className="store-note is-warn">
        <FolderIcon />
        <p>
          <b>보관 폴더를 정해 두세요.</b> 지금은 이 브라우저에만 저장돼요.
          <Info label="보관 폴더 설명" align="start">
            브라우저 기록을 지우거나 PC를 바꾸면 사라질 수 있어요. 폴더를 정하면 고칠 때마다 그 폴더에 파일로 저장되고, 버전 기록도 함께 남아요.
          </Info>
        </p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => run(choose)}>
          보관 폴더 고르기
        </button>
      </div>
    )
  }

  return (
    <p className="store-note is-warn">
      <FolderIcon />
      <span>
        <b>지금은 이 브라우저에만 저장돼요.</b> 크롬이나 엣지에서 열면 PC 폴더에 보관할 수 있어요.
        <Info label="보관 설명" align="start">
          그 전까지는 편집 화면의 저장 상태를 눌러 작업 파일을 다운로드해 두세요.
        </Info>
      </span>
    </p>
  )
}
