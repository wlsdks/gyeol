import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { exeInfo, icoImages, stripSignature } from './exe.mjs'
import { icoFromPngs } from './icon.mjs'

/** 머리만 있는 64비트 PE. sig: 끝에 붙일 서명 크기 */
function fakePe(sig: number) {
  const pe = 0x80
  const body = 0x400
  const buf = Buffer.alloc(body + sig)
  buf.write('MZ', 0, 'latin1')
  buf.writeUInt32LE(pe, 0x3c)
  buf.write('PE\0\0', pe, 'latin1')
  const opt = pe + 4 + 20
  buf.writeUInt16LE(0x20b, opt)
  if (sig) {
    buf.writeUInt32LE(body, opt + 112 + 32)
    buf.writeUInt32LE(sig, opt + 112 + 36)
    buf.fill(7, body)
  }
  return { buf, entry: opt + 112 + 32, body }
}

describe('Framo.exe 만들기', () => {
  it('node.exe의 서명을 걷어 낸다: 보안 칸을 비우고 끝을 자른다', () => {
    const { buf, entry, body } = fakePe(64)
    const out = stripSignature(buf)
    expect(out.length).toBe(body)
    expect(out.readUInt32LE(entry)).toBe(0)
    expect(out.readUInt32LE(entry + 4)).toBe(0)
    // 원래 것은 건드리지 않는다
    expect(buf.readUInt32LE(entry + 4)).toBe(64)
  })

  it('서명이 없으면 그대로, 실행 파일이 아니거나 서명이 끝에 있지 않으면 멈춘다', () => {
    const { buf } = fakePe(0)
    expect(stripSignature(buf)).toBe(buf)
    expect(() => stripSignature(Buffer.alloc(0x100))).toThrow()
    const odd = fakePe(64)
    expect(() => stripSignature(Buffer.concat([odd.buf, Buffer.alloc(64)]))).toThrow()
  })

  it('파일 정보는 Framo와 이 판 번호', () => {
    const info = exeInfo('1.2.3')
    expect(info['version-string'].FileDescription).toBe('Framo')
    expect(info['version-string'].OriginalFilename).toBe('Framo.exe')
    expect(info['product-version']).toBe('1.2.3')
    expect(info['file-version']).toBe('1.2.3')
  })

  it('아이콘(.ico)은 크기마다 PNG를 담고, 저장소의 아이콘에 작은 것부터 256까지 있다', () => {
    const png = (n: number) => ({ size: n, data: Buffer.from([0x89, 0x50, 0x4e, 0x47, n % 256]) })
    const ico = icoFromPngs([png(16), png(256)])
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt16LE(4)).toBe(2)
    expect(ico[6]).toBe(16)
    expect(ico[6 + 16]).toBe(0) // 256은 0으로 적는다
    expect(icoImages(ico)).toEqual([png(16).data, png(256).data])

    const real = readFileSync(join(__dirname, '..', 'launch', 'framo.ico'))
    const count = real.readUInt16LE(4)
    const sizes = Array.from({ length: count }, (_, i) => real[6 + 16 * i] || 256)
    expect(sizes).toContain(16)
    expect(sizes).toContain(32)
    expect(sizes).toContain(48)
    expect(sizes).toContain(256)
  })
})
