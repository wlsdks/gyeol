import { createStore, del, entries, get, set } from 'idb-keyval'
import { uid } from '../deck/generate'
import type { Deck } from '../deck/types'
import { writeVersionToFolder } from './folder'

/*
 * 버전 기록. 목록(가벼운 정보)과 내용(덱 전체)을 따로 저장해서 목록은 빨리 뜨게 한다.
 * - 이름 붙인 버전: 지우기 전까지 남는다.
 * - 자동 버전: 열 때, 고치는 중 10분마다, 발표·내보내기 전, 되돌리기 전에 남긴다. 발표마다 최근 30개.
 */

const listeners = new Set<() => void>()
/** 버전이 생기거나 지워질 때 알림을 받는다. 돌려준 함수를 부르면 그만 받는다. */
export function onVersionsChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const changed = () => listeners.forEach((fn) => fn())

const metaStore = createStore('html-maker-version-list', 'versions')
const dataStore = createStore('html-maker-version-data', 'versions')
const AUTO_KEEP = 30
export const AUTO_INTERVAL = 10 * 60 * 1000

export type VersionReason = 'open' | 'interval' | 'present' | 'export' | 'restore' | 'file' | 'ai'

export interface DeckVersion {
  id: string
  deckId: string
  createdAt: number
  /** 이름 붙인 버전이면 그 이름 */
  name: string
  named: boolean
  reason?: VersionReason
  title: string
  slideCount: number
  /** 같은 내용을 두 번 남기지 않으려고 비교하는 값 */
  signature: string
  /** 장마다의 비교 값. 앞 버전과 비교해 어느 장이 바뀌었는지 보여 준다. */
  slides: { id: string; purpose: string; sig: string }[]
}

export interface VersionChanges {
  changed: string[]
  added: string[]
  removed: string[]
}

/** older 버전에서 newer 버전으로 오면서 바뀐 장들 */
export function versionChanges(newer: DeckVersion, older?: DeckVersion): VersionChanges {
  if (!older || newer.signature === older.signature) return { changed: [], added: [], removed: [] }
  const before = new Map(older.slides.map((s) => [s.id, s]))
  const after = new Set(newer.slides.map((s) => s.id))
  return {
    changed: newer.slides.filter((s) => before.has(s.id) && before.get(s.id)!.sig !== s.sig).map((s) => s.purpose),
    added: newer.slides.filter((s) => !before.has(s.id)).map((s) => s.purpose),
    removed: older.slides.filter((s) => !after.has(s.id)).map((s) => s.purpose),
  }
}

export const REASON_LABEL: Record<VersionReason, string> = {
  open: '열었을 때',
  interval: '고치는 중',
  present: '발표하기 전',
  export: '내보내기 전',
  restore: '되돌리기 전',
  file: '파일을 열기 전',
  ai: 'AI 제안을 적용하기 전',
}

/** 내용이 같은지 보는 짧은 값. 수정 시각처럼 내용이 아닌 것은 뺀다. */
export function deckSignature(deck: Deck): string {
  return hash(JSON.stringify([deck.title, deck.meta, deck.theme, deck.slides]))
}

/** 장마다의 비교 값 */
export function slideSignatures(deck: Deck): DeckVersion['slides'] {
  return deck.slides.map((s) => ({ id: s.id, purpose: s.purpose, sig: hash(JSON.stringify(s)) }))
}

function hash(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `${text.length}:${(h >>> 0).toString(36)}`
}

export async function listVersions(deckId: string): Promise<DeckVersion[]> {
  try {
    const all = await entries<string, DeckVersion>(metaStore)
    return all
      .map(([, v]) => v)
      .filter((v) => v.deckId === deckId)
      .sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

export async function loadVersionDeck(id: string): Promise<Deck | undefined> {
  try {
    return await get<Deck>(id, dataStore)
  } catch {
    return undefined
  }
}

interface SaveOptions {
  name?: string
  reason?: VersionReason
}

/**
 * 버전을 남긴다. 자동 버전은 같은 내용이 이미 기록에 있으면 건너뛴다.
 * 남겼으면 그 버전을, 건너뛰었으면 null을 돌려준다.
 */
export function saveVersion(deck: Deck, options: SaveOptions = {}): Promise<DeckVersion | null> {
  // 한 줄로 세워야 '앞 버전과 같은지' 비교가 맞다
  const run = queue.then(() => saveVersionNow(deck, options))
  queue = run.catch(() => null)
  return run
}
let queue: Promise<unknown> = Promise.resolve()

async function saveVersionNow(deck: Deck, { name, reason }: SaveOptions): Promise<DeckVersion | null> {
  const named = !!name?.trim()
  const signature = deckSignature(deck)
  const existing = await listVersions(deck.id)
  // 자동 버전은 이미 같은 내용의 버전이 있으면 남기지 않는다 (되돌린 직후 등)
  if (!named && existing.some((v) => v.signature === signature)) return null

  const version: DeckVersion = {
    id: uid(),
    deckId: deck.id,
    createdAt: Date.now(),
    name: named ? name!.trim() : '',
    named,
    reason: named ? undefined : reason,
    title: deck.title,
    slideCount: deck.slides.filter((s) => !s.hidden).length,
    signature,
    slides: slideSignatures(deck),
  }
  try {
    await set(version.id, structuredClone(deck), dataStore)
    await set(version.id, version, metaStore)
  } catch {
    return null
  }
  void writeVersionToFolder(deck, { createdAt: version.createdAt, name: version.name, named })
  if (!named) await pruneAuto([version, ...existing])
  changed()
  return version
}

async function pruneAuto(versions: DeckVersion[]) {
  const autos = versions.filter((v) => !v.named)
  for (const v of autos.slice(AUTO_KEEP)) await deleteVersion(v.id)
}

/** 이름을 붙이면 자동 정리 대상에서 빠진다. 보관 폴더에도 그 이름으로 한 벌 남긴다. */
export async function renameVersion(version: DeckVersion, name: string): Promise<DeckVersion> {
  const next = { ...version, name: name.trim(), named: !!name.trim() || version.named }
  await set(version.id, next, metaStore).catch(() => {})
  const deck = await loadVersionDeck(version.id)
  if (deck && next.named) void writeVersionToFolder(deck, { createdAt: next.createdAt, name: next.name, named: true })
  changed()
  return next
}

export async function deleteVersion(id: string): Promise<void> {
  await del(id, metaStore).catch(() => {})
  await del(id, dataStore).catch(() => {})
  changed()
}

export async function deleteDeckVersions(deckId: string): Promise<void> {
  for (const v of await listVersions(deckId)) await deleteVersion(v.id)
}
