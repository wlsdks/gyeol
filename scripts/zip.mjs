// 의존성 없는 작은 zip 만들기.
//
// 맥의 zip 명령으로 묶으면 윈도우 탐색기에서 한글 파일 이름이 깨지거나 자모가 풀려 보인다.
// 파일 이름을 NFC로 모으고, 이름이 UTF-8이라는 표시(일반 플래그 11번 비트)를 붙여서 직접 쓴다.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { crc32, deflateRawSync } from 'node:zlib'

const UTF8 = 1 << 11

function dosTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, day }
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir).sort()) {
    const file = join(dir, name)
    if (statSync(file).isDirectory()) out.push(...walk(file))
    else out.push(file)
  }
  return out
}

/**
 * `dir` 폴더를 통째로 `zipFile`에 묶는다. zip 안에서는 `dir`의 폴더 이름이 맨 위에 온다.
 * @param {string} dir
 * @param {string} zipFile
 * @param {{ executable?: (name: string) => boolean }} [opts]
 */
export function zipDir(dir, zipFile, opts = {}) {
  const base = join(dir, '..')
  const locals = []
  const centrals = []
  let offset = 0

  for (const file of walk(dir)) {
    const name = relative(base, file).split(sep).join('/').normalize('NFC')
    const nameBuf = Buffer.from(name, 'utf8')
    const data = readFileSync(file)
    const packed = deflateRawSync(data, { level: 9 })
    const stored = packed.length >= data.length
    const body = stored ? data : packed
    const crc = crc32(data)
    const { time, day } = dosTime(statSync(file).mtime)
    const mode = opts.executable?.(name) ? 0o100755 : 0o100644

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(UTF8, 6)
    local.writeUInt16LE(stored ? 0 : 8, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(day, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, nameBuf, body)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    // 만든 곳 3(유닉스): 맥에서 풀어도 .command 실행 권한이 남는다
    central.writeUInt16LE((3 << 8) | 20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(UTF8, 8)
    central.writeUInt16LE(stored ? 0 : 8, 10)
    central.writeUInt16LE(time, 12)
    central.writeUInt16LE(day, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(body.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE((mode << 16) >>> 0, 38)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBuf)

    offset += local.length + nameBuf.length + body.length
  }

  const centralSize = centrals.reduce((n, b) => n + b.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(centrals.length / 2, 8)
  end.writeUInt16LE(centrals.length / 2, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  writeFileSync(zipFile, Buffer.concat([...locals, ...centrals, end]))
}
