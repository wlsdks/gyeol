// 이미지의 크기와 종류를 data URL에서 바로 읽는다. DOM을 쓰지 않는다.
// 발표 모델(src/deck)이 이 파일을 가져오고, 로컬 서버와 MCP 서버도 발표 모델을 묶어 가므로 여기에 DOM 코드를
// 두면 서버의 타입 확인(tsconfig.node.json)에서 막힌다. 파일을 고르고 줄이는 일은 imageFile.ts에.

/**
 * data URL로 든 이미지의 그려지는 가로세로(px). 파일 머리만 읽어서 그 자리에서 바로 안다(불러오기를 기다리지 않는다).
 * 내보낸 HTML도 자바스크립트 없이 이미지 비율대로 그리려고 그릴 때 쓴다. 모르는 형식이면 null.
 * 휴대폰 사진(JPEG)은 회전 정보(EXIF)로 눕혀 찍은 것을 세워 보여 주므로 그때는 가로세로를 바꾼다
 */
export function imageSize(url: string): { w: number; h: number } | null {
  if (!url.startsWith('data:image/')) return null
  const known = sizes.get(url)
  if (known !== undefined) return known
  let size: { w: number; h: number } | null = null
  try {
    size = readSize(url)
  } catch {
    size = null
  }
  if (sizes.size > 200) sizes.clear()
  sizes.set(url, size)
  return size
}

const sizes = new Map<string, { w: number; h: number } | null>()

function readSize(url: string): { w: number; h: number } | null {
  const comma = url.indexOf(',')
  const head = url.slice(5, comma)
  const base64 = head.endsWith(';base64')
  const type = head.split(';')[0]
  // 앞쪽만 푼다: 4글자가 3바이트라 4의 배수로 자른다. JPEG는 회전 정보와 크기가 앞쪽 몇십 KB 안에 있다
  const front = (n: number) => {
    const chunk = url.slice(comma + 1, comma + 1 + n)
    return atob(chunk.slice(0, chunk.length - (chunk.length % 4)))
  }
  if (type === 'image/svg+xml') return svgSize(base64 ? front(8000) : decodeURIComponent(url.slice(comma + 1, comma + 1 + 6000).replace(/%[0-9a-f]?$/i, '')))
  if (!base64) return null
  const bin = front(96000)
  const b = (i: number) => bin.charCodeAt(i)
  const u16 = (i: number, le = false) => (le ? b(i) | (b(i + 1) << 8) : (b(i) << 8) | b(i + 1))
  const u32 = (i: number, le = false) => (le ? (u16(i, true) | (u16(i + 2, true) << 16)) >>> 0 : ((u16(i) << 16) | u16(i + 2)) >>> 0)
  if (bin.startsWith('\x89PNG')) return { w: u32(16), h: u32(20) }
  if (bin.startsWith('GIF8')) return { w: u16(6, true), h: u16(8, true) }
  if (bin.startsWith('RIFF') && bin.slice(8, 12) === 'WEBP') {
    const kind = bin.slice(12, 16)
    if (kind === 'VP8 ') return { w: u16(26, true) & 0x3fff, h: u16(28, true) & 0x3fff }
    if (kind === 'VP8L') return { w: 1 + (((b(22) & 0x3f) << 8) | b(21)), h: 1 + (((b(24) & 0xf) << 10) | (b(23) << 2) | ((b(22) & 0xc0) >> 6)) }
    if (kind === 'VP8X') return { w: 1 + (b(24) | (b(25) << 8) | (b(26) << 16)), h: 1 + (b(27) | (b(28) << 8) | (b(29) << 16)) }
    return null
  }
  if (b(0) === 0xff && b(1) === 0xd8) {
    let turned = false
    let i = 2
    while (i + 9 < bin.length) {
      if (b(i) !== 0xff) return null
      const marker = b(i + 1)
      const len = u16(i + 2)
      // APP1의 Exif: 방향(0x0112)이 5~8이면 옆으로 누운 사진을 세워 보여 준다
      if (marker === 0xe1 && bin.slice(i + 4, i + 10) === 'Exif\0\0') {
        const t = i + 10
        const le = bin.slice(t, t + 2) === 'II'
        const ifd = t + u32(t + 4, le)
        const n = u16(ifd, le)
        for (let k = 0; k < n; k++) {
          const e = ifd + 2 + k * 12
          if (u16(e, le) === 0x0112) turned = u16(e + 8, le) >= 5
        }
      }
      // SOF0~SOF15 (C4 허프만 표, C8, CC 산술 부호 표는 크기가 아니다)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const h = u16(i + 5)
        const w = u16(i + 7)
        return turned ? { w: h, h: w } : { w, h }
      }
      i += 2 + len
    }
  }
  return null
}

function svgSize(text: string): { w: number; h: number } | null {
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0]
  if (!tag) return null
  const attr = (name: string) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(tag)?.[1]
  const box = attr('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (box && box.length === 4 && box[2] > 0 && box[3] > 0) return { w: box[2], h: box[3] }
  const w = parseFloat(attr('width') ?? '')
  const h = parseFloat(attr('height') ?? '')
  return w > 0 && h > 0 ? { w, h } : null
}

/** 사진(JPEG)인지. 사진은 칸을 꽉 채우고, 화면 캡처·도면·로고(PNG, SVG 같은)는 잘리지 않게 전체를 보인다 */
export const isPhoto = (url: string) => /^data:image\/jpe?g[;,]/i.test(url)
