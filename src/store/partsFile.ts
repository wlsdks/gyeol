import { cleanPart, type SavedPart } from '../deck/blocks'

// 내 컴포넌트 파일(.components): 저장해 둔 컴포넌트를 통째로 담는다. 보관 폴더에 하나를 두고(사라지지 않게),
// 다른 사람과 주고받을 때도 같은 파일을 쓴다. 발표 파일(.deck)과 따로다.

export const PARTS_EXT = '.components'
const FORMAT = 'html-maker/components'

/** 2: 판(blocks와 자리). 1(0.4까지)은 줄(rows)로 적었고, 읽을 때 판으로 바꾼다(cleanPart) */
const VERSION = 2

interface PartsFileData {
  format: typeof FORMAT
  version: number
  /** 목록을 마지막으로 바꾼 때 (브라우저의 목록과 폴더의 파일 가운데 새것을 고른다) */
  updatedAt: number
  parts: SavedPart[]
}

export function encodePartsFile(parts: SavedPart[], updatedAt = Date.now()): string {
  const data: PartsFileData = { format: FORMAT, version: VERSION, updatedAt, parts }
  return JSON.stringify(data)
}

/**
 * 파일을 읽어 정해진 꼴로 맞춘다. 모르는 컴포넌트와 값은 빼고 몇 개를 뺐는지(lost) 센다.
 * 새 버전에서 만든 파일도 읽는다: 이 버전이 아는 것만 넣고, 뺀 것이 있으면 부르는 쪽이 알린다
 */
export function decodePartsFile(text: string): { parts: SavedPart[]; updatedAt: number; lost: number } | null {
  try {
    const data = JSON.parse(text) as Partial<PartsFileData>
    if (data.format !== FORMAT || !Array.isArray(data.parts)) return null
    const lost = { n: 0 }
    const parts = data.parts.map((p) => cleanPart(p, lost)).filter((p): p is SavedPart => !!p)
    lost.n += data.parts.length - parts.length
    return { parts, updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0, lost: lost.n }
  } catch {
    return null
  }
}
