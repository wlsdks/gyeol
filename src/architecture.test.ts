import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, normalize, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// 폴더끼리 기대는 방향. 아래쪽(발표 모델)이 위쪽(화면)을 가져오면 모델만 따로 시험하거나 MCP 서버에 넣을 수 없고,
// 고칠 때 한 곳을 바꾸면 어디까지 번지는지 알기 어려워진다. docs/ARCHITECTURE.md의 '층'과 같다
const ALLOWED: Record<string, string[]> = {
  lib: [],
  deck: ['lib'],
  motion: ['lib'],
  present: ['deck', 'lib'],
  slides: ['deck', 'lib', 'motion'],
  ai: ['deck', 'lib'],
  // 발표를 지울 때 AI 공유도 끈다(persist.ts의 removeDeck)
  store: ['deck', 'lib', 'ai'],
  export: ['deck', 'lib', 'motion', 'slides', 'store'],
}

const SRC = dirname(fileURLToPath(import.meta.url))

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return sourceFiles(p)
    return /\.tsx?$/.test(e.name) && !/\.(test|d)\.tsx?$/.test(e.name) ? [p] : []
  })
}

const FILES = sourceFiles(SRC)
const KNOWN = new Set(FILES)

/** 이 파일이 가져오는 src 안의 파일. 실행할 때 불러오는 것만(import type은 빼고) */
function imports(file: string): string[] {
  const text = readFileSync(file, 'utf8')
  const out: string[] = []
  for (const m of text.matchAll(/^(?:import|export)\s+(type\s+)?(?:[^'"]*?\sfrom\s+)?['"](\.[^'"]+)['"]/gm)) {
    if (m[1]) continue
    const base = normalize(join(dirname(file), m[2].split('?')[0]))
    const hit = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((p) => KNOWN.has(p))
    if (hit) out.push(hit)
  }
  return out
}

const GRAPH = new Map(FILES.map((f) => [f, imports(f)]))
const folder = (file: string) => {
  const parts = relative(SRC, file).split(sep)
  return parts.length > 1 ? parts[0] : ''
}
const name = (file: string) => relative(SRC, file).split(sep).join('/')

describe('구조', () => {
  it('폴더는 정한 방향으로만 기댄다', () => {
    const wrong: string[] = []
    for (const [file, deps] of GRAPH) {
      const from = folder(file)
      const allowed = ALLOWED[from]
      if (!allowed) continue
      for (const dep of deps) {
        const to = folder(dep)
        if (to !== from && !allowed.includes(to)) wrong.push(`${name(file)} → ${name(dep)}`)
      }
    }
    expect(wrong).toEqual([])
  })

  it('파일끼리 서로를 가져오지 않는다 (순환이 있으면 불러오는 차례에 따라 아직 없는 값을 읽는다)', () => {
    // 강한 연결 요소(Tarjan). 둘 이상이 묶이면 순환이다
    const index = new Map<string, number>()
    const low = new Map<string, number>()
    const stack: string[] = []
    const onStack = new Set<string>()
    const cycles: string[][] = []
    let n = 0
    const visit = (v: string) => {
      index.set(v, n)
      low.set(v, n++)
      stack.push(v)
      onStack.add(v)
      for (const w of GRAPH.get(v) ?? []) {
        if (!index.has(w)) {
          visit(w)
          low.set(v, Math.min(low.get(v)!, low.get(w)!))
        } else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!))
      }
      if (low.get(v) === index.get(v)) {
        const group: string[] = []
        let w: string
        do {
          w = stack.pop()!
          onStack.delete(w)
          group.push(name(w))
        } while (w !== v)
        if (group.length > 1) cycles.push(group.sort())
      }
    }
    for (const f of FILES) if (!index.has(f)) visit(f)
    expect(cycles).toEqual([])
  })
})
