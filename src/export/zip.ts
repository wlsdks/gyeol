// PPT 파일(.pptx)은 ZIP 묶음이다. 의존성을 늘리지 않으려고 ZIP을 직접 쓴다(PKWARE APPNOTE의 기본 형식만).
// - 파일마다 '로컬 머리' + 내용, 끝에 '중앙 목록'과 '목록 끝 표시'. 크기를 미리 알아서 데이터 설명자는 쓰지 않는다.
// - 압축은 그대로 두기(STORE)와 deflate만. PNG는 이미 압축돼 있어 그대로 두고, XML은 브라우저의 CompressionStream으로 줄인다.
//   CompressionStream이 없거나 줄지 않으면 그대로 둔다. 어느 쪽이든 PowerPoint가 읽는다.
// - ZIP64는 쓰지 않는다. 한 파일 4GB, 파일 65535개를 넘으면 만들지 않고 알린다(장 수백 장도 한참 못 미친다).

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/** ZIP과 PNG가 쓰는 CRC-32 (다항식 0xEDB88320). crc에 앞 조각의 값을 넣으면 이어서 계산한다 */
export function crc32(data: Uint8Array, crc = 0): number {
  let c = ~crc >>> 0
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return ~c >>> 0
}

export interface ZipEntry {
  /** 묶음 안의 경로. 앞에 /를 붙이지 않는다 (예: ppt/slides/slide1.xml) */
  name: string
  data: Uint8Array
  /** XML처럼 잘 줄어드는 것만. PNG는 이미 압축돼 있어 시간만 든다 */
  deflate?: boolean
}

const utf8 = new TextEncoder()

async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

/** ZIP의 날짜와 시각 (MS-DOS 형식, 2초 단위, 이 PC의 시각). 1980년 앞은 쓸 수 없다 */
function dosTime(date: Date): { time: number; date: number } {
  const y = Math.min(2107, Math.max(1980, date.getFullYear()))
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((y - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

/** 파일들을 ZIP 하나로 묶는다. 넣은 차례대로 들어간다 */
export async function zip(entries: ZipEntry[], when = new Date()): Promise<Uint8Array<ArrayBuffer>> {
  if (entries.length > 0xffff) throw new Error('zip: too many entries')
  const stamp = dosTime(when)
  const files = await Promise.all(
    entries.map(async (e) => {
      const name = utf8.encode(e.name)
      const packed = e.deflate ? await deflateRaw(e.data) : null
      const deflated = !!packed && packed.length < e.data.length
      return {
        name,
        // 이름에 ASCII 밖의 글자가 있으면 UTF-8이라고 표시한다(일반 목적 비트 11). 윈도우 탐색기도 이것을 본다
        flags: /^[\x20-\x7e]*$/.test(e.name) ? 0 : 0x0800,
        method: deflated ? 8 : 0,
        crc: crc32(e.data),
        size: e.data.length,
        body: deflated ? packed : e.data,
      }
    }),
  )

  const localSize = files.reduce((a, f) => a + 30 + f.name.length + f.body.length, 0)
  const centralSize = files.reduce((a, f) => a + 46 + f.name.length, 0)
  const total = localSize + centralSize + 22
  if (total > 0xffffffff) throw new Error('zip: too large')

  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  let at = 0
  const u16 = (v: number) => {
    view.setUint16(at, v, true)
    at += 2
  }
  const u32 = (v: number) => {
    view.setUint32(at, v >>> 0, true)
    at += 4
  }
  const bytes = (b: Uint8Array) => {
    out.set(b, at)
    at += b.length
  }

  const offsets: number[] = []
  for (const f of files) {
    offsets.push(at)
    u32(0x04034b50) // 로컬 머리
    u16(20) // 풀 때 필요한 판 2.0 (deflate)
    u16(f.flags)
    u16(f.method)
    u16(stamp.time)
    u16(stamp.date)
    u32(f.crc)
    u32(f.body.length)
    u32(f.size)
    u16(f.name.length)
    u16(0) // 덧붙임 칸 없음
    bytes(f.name)
    bytes(f.body)
  }

  const centralAt = at
  files.forEach((f, i) => {
    u32(0x02014b50) // 중앙 목록
    u16(20) // 만든 판 2.0, MS-DOS 속성
    u16(20)
    u16(f.flags)
    u16(f.method)
    u16(stamp.time)
    u16(stamp.date)
    u32(f.crc)
    u32(f.body.length)
    u32(f.size)
    u16(f.name.length)
    u16(0) // 덧붙임 칸
    u16(0) // 설명
    u16(0) // 시작 디스크
    u16(0) // 내부 속성
    u32(0) // 외부 속성
    u32(offsets[i])
    bytes(f.name)
  })

  u32(0x06054b50) // 목록 끝
  u16(0)
  u16(0)
  u16(files.length)
  u16(files.length)
  u32(centralSize)
  u32(centralAt)
  u16(0)
  return out
}
