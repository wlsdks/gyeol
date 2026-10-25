import { createStore, get, set } from 'idb-keyval'
import { create } from 'zustand'
import { SAVED_NAME_MAX, type SavedPart } from '../deck/blocks'
import { readPartsFromFolder, writePartsToFolder } from './folder'
import { decodePartsFile, encodePartsFile } from './partsFile'

// 내 컴포넌트를 두는 곳: 이 브라우저(IndexedDB)와, 보관 폴더를 골랐으면 그 폴더의 파일 하나(내 컴포넌트.components).
// 발표와 따로 둔다: 발표를 지워도 남고, 어느 발표에서든 쓴다. 서버나 AI로 보내지 않는다.
// 두 곳 가운데 updatedAt이 큰 쪽을 쓴다(발표 맞추기와 같은 규칙). 브라우저 데이터를 지워도 폴더에서 돌아온다.

const store = createStore('html-maker-parts', 'parts')
const KEY = 'all'

interface SavedList {
  updatedAt: number
  parts: SavedPart[]
}

interface SavedState {
  parts: SavedPart[]
  /** 처음 읽기를 마쳤는지 (그 전에는 '저장한 것이 없어요'를 보이지 않는다) */
  loaded: boolean
}

export const useSaved = create<SavedState>(() => ({ parts: [], loaded: false }))

let updatedAt = 0

async function readBrowser(): Promise<SavedList | null> {
  try {
    return (await get<SavedList>(KEY, store)) ?? null
  } catch {
    return null
  }
}

/** 두 곳에 쓴다. 폴더는 골랐고 허용했을 때만 (아니면 브라우저에만) */
async function write(parts: SavedPart[]): Promise<boolean> {
  updatedAt = Date.now()
  useSaved.setState({ parts, loaded: true })
  let ok = true
  try {
    await set(KEY, { updatedAt, parts } satisfies SavedList, store)
  } catch {
    ok = false
  }
  await writePartsToFolder(encodePartsFile(parts, updatedAt))
  return ok
}

/** 브라우저와 폴더에서 읽어 새것을 쓴다. 컴포넌트 탭을 열 때마다 (그 사이 폴더를 허용했을 수 있다) */
export async function loadSaved(): Promise<void> {
  const browser = await readBrowser()
  const text = await readPartsFromFolder()
  const folder = text ? decodePartsFile(text) : null
  const best = folder && folder.updatedAt > (browser?.updatedAt ?? 0) ? folder : browser
  updatedAt = best?.updatedAt ?? 0
  useSaved.setState({ parts: best?.parts ?? [], loaded: true })
  if (best === folder && folder) {
    // 폴더 쪽이 새것이면 브라우저도 맞춰 둔다
    await set(KEY, { updatedAt: folder.updatedAt, parts: folder.parts } satisfies SavedList, store).catch(() => {})
  } else if (browser && (!folder || browser.updatedAt > folder.updatedAt)) {
    await writePartsToFolder(encodePartsFile(browser.parts, browser.updatedAt))
  }
}

/** 새로 저장한 것은 맨 앞에 */
export function addSaved(part: SavedPart): Promise<boolean> {
  return write([part, ...useSaved.getState().parts])
}

export function addManySaved(parts: SavedPart[]): Promise<boolean> {
  return write([...parts, ...useSaved.getState().parts])
}

export function renameSaved(id: string, name: string): Promise<boolean> {
  const clean = name.trim().slice(0, SAVED_NAME_MAX)
  if (!clean) return Promise.resolve(false)
  return write(useSaved.getState().parts.map((p) => (p.id === id ? { ...p, name: clean } : p)))
}

/** 지운 것과 그 자리 (알림의 '되돌리기'로 그 자리에 돌려놓는다) */
export async function removeSaved(id: string): Promise<{ part: SavedPart; index: number } | null> {
  const parts = useSaved.getState().parts
  const index = parts.findIndex((p) => p.id === id)
  if (index < 0) return null
  await write(parts.filter((p) => p.id !== id))
  return { part: parts[index], index }
}

export function restoreSaved(part: SavedPart, index: number): Promise<boolean> {
  const parts = useSaved.getState().parts.filter((p) => p.id !== part.id)
  parts.splice(Math.min(index, parts.length), 0, part)
  return write(parts)
}
