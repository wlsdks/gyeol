import { useEffect, useState } from 'react'
import { BLUEPRINTS } from '../deck/blueprints'
import { uid } from '../deck/generate'
import { createSampleDeck } from '../deck/sample'
import type { Deck } from '../deck/types'
import { readDeckFromHtml } from '../export/exportHtml'
import { go, timeAgo } from '../lib/router'
import { FitSlide, SlideCanvas } from '../slides/SlideCanvas'
import { deleteDeck, listDecks, saveDeck } from '../store/library'
import { Brand, CopyIcon, Modal, MoreIcon, PlusIcon, Popover, TrashIcon, UploadIcon, useToast } from './ui'

export function Home() {
  const [decks, setDecks] = useState<Deck[] | null>(null)
  const [toDelete, setToDelete] = useState<Deck | null>(null)
  const toast = useToast()

  const refresh = () => listDecks().then(setDecks)
  useEffect(() => {
    refresh()
  }, [])

  const duplicate = async (deck: Deck) => {
    const copy: Deck = { ...structuredClone(deck), id: uid(), title: `${deck.title} 사본`, updatedAt: Date.now() }
    await saveDeck(copy)
    refresh()
  }

  const openSample = async () => {
    const deck = createSampleDeck()
    await saveDeck(deck)
    go({ name: 'edit', id: deck.id })
  }

  const openFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.html,text/html'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const deck = readDeckFromHtml(await file.text())
      if (!deck) {
        toast.show('html-maker에서 내보낸 HTML 파일만 열 수 있어요.')
        return
      }
      await saveDeck(deck)
      go({ name: 'edit', id: deck.id })
    }
    input.click()
  }

  return (
    <div className="home">
      <header className="home-top">
        <Brand />
        <button type="button" className="btn btn-ghost" onClick={openFile}>
          <UploadIcon />
          파일 열기
        </button>
      </header>

      <main className="home-main">
        <div className="home-head">
          <h1 className="home-h">내 발표</h1>
          {decks && decks.length > 0 && (
            <button type="button" className="btn-link" onClick={openSample}>
              완성된 예시 보기
            </button>
          )}
        </div>

        {decks && decks.length === 0 && (
          <div className="home-empty">
            <p className="home-empty-h">아직 만든 발표가 없어요</p>
            <p className="home-empty-p">어떤 발표인지 알려 주시면 순서와 장 구성을 잡아 드려요. 내용만 채우면 돼요.</p>
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
                  await deleteDeck(toDelete.id)
                  setToDelete(null)
                  refresh()
                }}
              >
                지우기
              </button>
            </>
          }
        >
          <p>‘{toDelete.title}’을 지우면 되돌릴 수 없어요. 내보낸 파일은 그대로 남아요.</p>
        </Modal>
      )}
      {toast.node}
    </div>
  )
}

function DeckCard({ deck, onDuplicate, onDelete }: { deck: Deck; onDuplicate: () => void; onDelete: () => void }) {
  const first = deck.slides.find((s) => !s.hidden) ?? deck.slides[0]
  const typeName = BLUEPRINTS[deck.meta.type]?.name ?? ''
  return (
    <article className="card">
      <a className="card-link" href={`#/edit/${deck.id}`} aria-label={`${deck.title} 열기`}>
        <div className="card-thumb">
          <FitSlide>{first && <SlideCanvas deck={deck} slide={first} mode="final" />}</FitSlide>
        </div>
      </a>
      <div className="card-info">
        <div className="card-text">
          <h2 className="card-title">{deck.title}</h2>
          <p className="card-meta">
            {typeName} {deck.slides.length}장
          </p>
          <p className="card-meta">{timeAgo(deck.updatedAt)} 수정</p>
        </div>
        <Popover
          button={({ toggle, open }) => (
            <button type="button" className="icon-btn" aria-label="더 보기" aria-expanded={open} onClick={toggle}>
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
