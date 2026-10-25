import { describe, expect, it } from 'vitest'
import { imageSize, isPhoto } from './image'

const bytes = (...parts: (string | number[])[]) => parts.map((p) => (typeof p === 'string' ? p : String.fromCharCode(...p))).join('')
const url = (type: string, bin: string) => `data:${type};base64,${btoa(bin)}`
const be16 = (n: number) => [n >> 8, n & 255]
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]

describe('imageSize', () => {
  it('PNG는 IHDR의 가로세로', () => {
    const png = bytes([0x89], 'PNG\r\n\x1a\n', be32(13), 'IHDR', be32(1600), be32(1000), [8, 6, 0, 0, 0])
    expect(imageSize(url('image/png', png))).toEqual({ w: 1600, h: 1000 })
  })

  it('GIF는 머리의 가로세로(작은 쪽이 먼저)', () => {
    expect(imageSize(url('image/gif', bytes('GIF89a', [0x20, 0x03, 0x58, 0x02], [0, 0, 0])))).toEqual({ w: 800, h: 600 })
  })

  it('JPEG는 SOF의 가로세로, 회전 정보가 옆으로 누운 사진이면 바꾼다', () => {
    const sof = bytes([0xff, 0xc0], be16(17), [8], be16(3000), be16(4000), [3])
    const plain = bytes([0xff, 0xd8], [0xff, 0xe0], be16(16), 'JFIF\0', new Array(9).fill(0), sof)
    expect(imageSize(url('image/jpeg', plain))).toEqual({ w: 4000, h: 3000 })
    // Exif: TIFF 머리(MM, 42, 첫 IFD는 8), 항목 하나(0x0112 방향 = 6, 시계 방향 90도)
    const tiff = bytes('MM', be16(42), be32(8), be16(1), be16(0x0112), be16(3), be32(1), be16(6), be16(0), be32(0))
    const exif = bytes([0xff, 0xe1], be16(2 + 6 + tiff.length), 'Exif\0\0', tiff)
    const turned = bytes([0xff, 0xd8], exif, sof)
    expect(imageSize(url('image/jpeg', turned))).toEqual({ w: 3000, h: 4000 })
  })

  it('WebP(VP8X)', () => {
    const webp = bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8X', [10, 0, 0, 0], [0, 0, 0, 0], [0x7f, 0x07, 0x00], [0x37, 0x04, 0x00])
    expect(imageSize(url('image/webp', webp))).toEqual({ w: 1920, h: 1080 })
  })

  it('SVG는 viewBox, 없으면 width와 height (글자 그대로든 base64든)', () => {
    expect(imageSize(`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 700"></svg>')}`)).toEqual({ w: 1400, h: 700 })
    expect(imageSize(url('image/svg+xml', '<svg width="320" height="200"></svg>'))).toEqual({ w: 320, h: 200 })
  })

  it('모르는 것은 null (깨진 data URL도 오류 없이)', () => {
    expect(imageSize('https://example.com/a.png')).toBeNull()
    expect(imageSize('data:image/png;base64,@@@')).toBeNull()
    expect(imageSize(url('image/bmp', 'BM'))).toBeNull()
  })
})

describe('isPhoto', () => {
  it('JPEG만 사진으로 본다', () => {
    expect(isPhoto('data:image/jpeg;base64,AAAA')).toBe(true)
    expect(isPhoto('data:image/png;base64,AAAA')).toBe(false)
    expect(isPhoto('data:image/svg+xml,<svg/>')).toBe(false)
  })
})
