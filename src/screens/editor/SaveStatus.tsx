import { useState } from 'react'
import type { Deck } from '../../deck/types'
import { cx } from '../../lib/cx'
import { keys } from '../../lib/keys'
import { downloadDeckFile } from '../../store/deckFile'
import { useDeck } from '../../store/deckStore'
import { saveToBrowser, saveToFolder, useStorage } from '../../store/persist'
import { AlertIcon, CheckIcon, FolderIcon, Popover } from '../ui'

type Tone = 'ok' | 'warn' | 'bad' | 'busy'

function useSaveSummary(): { tone: Tone; label: string } {
  const { folder, browser, folderWrite } = useStorage()
  if (browser === 'failed' && folderWrite !== 'saved') return { tone: 'bad', label: '저장하지 못했어요' }
  if (folder?.kind === 'ready') {
    if (folderWrite === 'failed') return { tone: 'bad', label: '폴더에 저장하지 못했어요' }
    if (browser === 'saving' || folderWrite === 'saving') return { tone: 'busy', label: '저장 중' }
    return { tone: 'ok', label: '폴더에 저장됨' }
  }
  if (folder?.kind === 'locked') return { tone: 'warn', label: '폴더 저장 멈춤' }
  if (browser === 'saving') return { tone: 'busy', label: '저장 중' }
  return { tone: 'warn', label: '이 브라우저에만 저장됨' }
}

/** 편집기 위쪽의 저장 상태. 누르면 어디에 저장되는지와 할 일을 알려 준다. */
export function SaveStatus({ deck, onOpenVersions }: { deck: Deck; onOpenVersions: () => void }) {
  const { tone, label } = useSaveSummary()
  return (
    <Popover
      align="left"
      className="pop-save"
      button={({ toggle, open }) => (
        <button
          type="button"
          className={cx('save', `is-${tone}`)}
          aria-expanded={open}
          // 따로 저장하지 않아도 된다는 것을 마우스만 올려도 알 수 있게
          title={`고칠 때마다 저장돼요. 바로 저장하려면 ${keys('mod+S')}`}
          onClick={toggle}
          aria-live="polite"
        >
          {tone === 'ok' ? <CheckIcon /> : tone === 'busy' ? <span className="save-dot" /> : <AlertIcon />}
          {label}
        </button>
      )}
    >
      {(close) => <SaveDetails deck={deck} close={close} onOpenVersions={onOpenVersions} />}
    </Popover>
  )
}

function SaveDetails({ deck, close, onOpenVersions }: { deck: Deck; close: () => void; onOpenVersions?: () => void }) {
  const { folder, browser, folderWrite, choose, allow } = useStorage()
  const [busy, setBusy] = useState(false)
  // 위쪽 단추가 '저장하지 못했어요'라고 할 때와 같은 조건 (useSaveSummary)
  const browserFailed = browser === 'failed' && folderWrite !== 'saved'
  const folderFailed = folder?.kind === 'ready' && folderWrite === 'failed'
  // 다시 저장할 때는 열려 있는 지금 발표를 쓴다 (이 창을 연 뒤에 더 고쳤을 수 있다)
  const current = () => useDeck.getState().deck ?? deck
  const download = () => {
    downloadDeckFile(current())
    close()
  }
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }
  // 폴더에 못 쓴 까닭이 허용이 풀린 것이면 다시 묻는다 (단추를 누른 지금만 물을 수 있다). 이미 허용돼 있으면 묻지 않고 넘어간다
  const retryFolder = () =>
    run(async () => {
      if ((await allow()).kind === 'ready') await saveToFolder(current())
    })
  const pickFolder = () =>
    run(async () => {
      if ((await choose()).kind === 'ready') await saveToFolder(current())
    })

  if (browserFailed) {
    return (
      <div className="save-pop">
        <p className="save-pop-h">
          <AlertIcon />이 브라우저에 저장하지 못했어요
        </p>
        <p className="save-pop-p">
          브라우저 저장 공간이 모자라면 저장되지 않아요. 고친 내용을 잃지 않게 먼저 작업 파일을 내려받아 두고, 쓰지 않는 발표를 지우거나 큰 이미지를 줄인 뒤 다시
          저장해 주세요.
        </p>
        <div className="save-pop-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={download}>
            작업 파일 내려받기
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => saveToBrowser(current()))}>
            다시 저장하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="save-pop">
      {folder?.kind === 'ready' && folderFailed && (
        <>
          <p className="save-pop-h">
            <AlertIcon />‘{folder.name}’ 폴더에 저장하지 못했어요
          </p>
          <p className="save-pop-p">
            폴더를 옮기거나 지웠거나, 공유 드라이브 연결이 끊겼거나, 폴더 허용이 풀렸을 수 있어요. 고친 내용은 이 브라우저에는 저장돼 있어요.
          </p>
          <div className="save-pop-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={retryFolder}>
              다시 허용하고 저장하기
            </button>
            <button type="button" className="btn-link" disabled={busy} onClick={pickFolder}>
              다른 폴더 고르기
            </button>
          </div>
        </>
      )}

      {folder?.kind === 'ready' && !folderFailed && (
        <>
          <p className="save-pop-h">
            <FolderIcon />‘{folder.name}’ 폴더에 저장하고 있어요
          </p>
          <p className="save-pop-p">고칠 때마다 이 폴더의 작업 파일에 바로 저장되고, 이 브라우저에도 같이 저장돼요. 브라우저 기록을 지워도 파일은 남아요.</p>
          <div className="save-pop-actions">
            {onOpenVersions && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  close()
                  onOpenVersions()
                }}
              >
                버전 기록 보기
              </button>
            )}
            <button type="button" className="btn-link" onClick={() => choose()}>
              다른 폴더로 바꾸기
            </button>
          </div>
        </>
      )}

      {folder?.kind === 'locked' && (
        <>
          <p className="save-pop-h">‘{folder.name}’ 폴더에 저장하려면 허용이 필요해요</p>
          <p className="save-pop-p">브라우저를 다시 열면 한 번 더 허용해야 해요. 허용하기 전까지는 이 브라우저에만 저장돼요.</p>
          <div className="save-pop-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => allow()}>
              허용하기
            </button>
          </div>
        </>
      )}

      {folder?.kind === 'none' && (
        <>
          <p className="save-pop-h">지금은 이 브라우저에만 저장돼요</p>
          <p className="save-pop-p">
            브라우저 기록을 지우거나 PC를 바꾸면 사라질 수 있어요. PC나 팀 공유 드라이브의 폴더를 골라 두면 고칠 때마다 그 폴더에도 자동으로 저장돼요.
          </p>
          <div className="save-pop-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => choose()}>
              <FolderIcon />
              보관 폴더 고르기
            </button>
          </div>
        </>
      )}

      {(!folder || folder.kind === 'unsupported') && (
        <>
          <p className="save-pop-h">지금은 이 브라우저에만 저장돼요</p>
          <p className="save-pop-p">
            이 브라우저는 폴더 저장을 지원하지 않아요. 크롬이나 엣지에서 열면 PC 폴더에 자동으로 보관돼요. 그 전까지는 작업 파일을 내려받아 두세요.
          </p>
          <div className="save-pop-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={download}>
              작업 파일 내려받기
            </button>
          </div>
        </>
      )}

      <p className="save-pop-keys">
        <kbd>{keys('mod+S')}</kbd>
        <span>지금 바로 저장해요. 따로 누르지 않아도 고칠 때마다 저장돼요.</span>
      </p>
      {folder && folder.kind !== 'unsupported' && (
        <p className="save-pop-foot">
          <button type="button" className="btn-link" onClick={download}>
            작업 파일 내려받기
          </button>
          <span>발표자 노트까지 들어 있어요. 다른 분께 보낼 때는 ‘내보내기’의 발표 파일을 쓰세요.</span>
        </p>
      )}
    </div>
  )
}
