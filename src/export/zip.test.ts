import { crc32 as nodeCrc32 } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { crc32, zip } from './zip'
import { readZip } from './zipReader'

const utf8 = new TextEncoder()

describe('CRC-32', () => {
  it('알려진 값과 같다', () => {
    expect(crc32(new Uint8Array())).toBe(0)
    expect(crc32(utf8.encode('a'))).toBe(0xe8b7be43)
    expect(crc32(utf8.encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(utf8.encode('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339)
  })

  it('이어서 계산해도 한 번에 한 것과 같고, Node의 zlib과 같다', () => {
    const data = new Uint8Array(100_000).map((_, i) => (i * 7919 + (i >> 3)) & 0xff)
    expect(crc32(data.subarray(40_000), crc32(data.subarray(0, 40_000)))).toBe(crc32(data))
    expect(crc32(data)).toBe(nodeCrc32(data))
  })
})

describe('ZIP', () => {
  it('넣은 그대로 다시 읽힌다 (그대로 두기와 deflate, 한글 이름)', async () => {
    const xml = utf8.encode('<a>' + '반복되는 글 '.repeat(500) + '</a>')
    const png = new Uint8Array(3000).map((_, i) => (i * 31) & 0xff)
    const bytes = await zip([
      { name: '[Content_Types].xml', data: xml, deflate: true },
      { name: 'ppt/media/image1.png', data: png },
      { name: '빈 파일.txt', data: new Uint8Array() },
    ])
    const entries = readZip(bytes)
    expect(entries.map((e) => e.name)).toEqual(['[Content_Types].xml', 'ppt/media/image1.png', '빈 파일.txt'])
    expect(entries[0].method).toBe(8)
    expect(entries[0].data).toEqual(xml)
    expect(entries[1].method).toBe(0)
    expect(entries[1].data).toEqual(png)
    expect(entries[2].data.length).toBe(0)
    // ASCII 이름은 UTF-8 표시 없이, 한글 이름은 표시를 붙인다
    expect(entries[0].flags & 0x0800).toBe(0)
    expect(entries[2].flags & 0x0800).toBe(0x0800)
  })

  it('줄지 않는 것은 deflate를 달라고 해도 그대로 둔다', async () => {
    const noise = new Uint8Array(64).map((_, i) => (i * 151 + 17) & 0xff)
    const [entry] = readZip(await zip([{ name: 'a.bin', data: noise, deflate: true }]))
    expect(entry.method).toBe(0)
    expect(entry.data).toEqual(noise)
  })

  it('날짜는 MS-DOS 형식으로 적힌다', async () => {
    const bytes = await zip([{ name: 'a', data: new Uint8Array([1]) }], new Date(2026, 9, 25, 14, 30, 58))
    const view = new DataView(bytes.buffer)
    expect(view.getUint16(10, true)).toBe((14 << 11) | (30 << 5) | 29)
    expect(view.getUint16(12, true)).toBe(((2026 - 1980) << 9) | (10 << 5) | 25)
  })
})
