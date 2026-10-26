// Framo.exe의 아이콘(launch/framo.ico)을 홍보 페이지의 표시(site/favicon.svg)로 다시 만든다.
// 표시를 바꿨을 때만 맥에서 한 번 돌리고, 만든 .ico를 저장소에 넣는다(묶을 때와 검수에서는 돌리지 않는다).
// 그림으로 바꾸는 것은 맥에 들어 있는 sips가 하고, 크기마다 PNG를 그대로 담은 .ico(윈도우 비스타부터 읽는 꼴)로 묶는다.
//
//   node scripts/icon.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
/** 탐색기, 작업 표시줄, 바탕 화면, 화면 배율(100~200%)이 고르는 크기 */
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]

/** PNG들을 .ico 하나로. 머리(6바이트) + 크기마다 목록 한 줄(16바이트) + PNG 그대로 */
export function icoFromPngs(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2) // 1: 아이콘
  head.writeUInt16LE(pngs.length, 4)
  let offset = head.length
  pngs.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i
    head.writeUInt8(size >= 256 ? 0 : size, at) // 0은 256
    head.writeUInt8(size >= 256 ? 0 : size, at + 1)
    head.writeUInt8(0, at + 2) // 팔레트 없음
    head.writeUInt8(0, at + 3)
    head.writeUInt16LE(1, at + 4) // 면
    head.writeUInt16LE(32, at + 6) // 색 깊이
    head.writeUInt32LE(data.length, at + 8)
    head.writeUInt32LE(offset, at + 12)
    offset += data.length
  })
  return Buffer.concat([head, ...pngs.map((p) => p.data)])
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.platform !== 'darwin') {
    console.error('맥에서 돌려 주세요 (sips로 그림을 만들어요).')
    process.exit(1)
  }
  const work = mkdtempSync(join(tmpdir(), 'gyeol-icon-'))
  const svg = join(root, 'site', 'favicon.svg')
  const pngs = SIZES.map((size) => {
    const out = join(work, `${size}.png`)
    execFileSync('sips', ['-s', 'format', 'png', svg, '--resampleHeightWidth', String(size), String(size), '--out', out], { stdio: 'ignore' })
    return { size, data: readFileSync(out) }
  })
  rmSync(work, { recursive: true, force: true })
  const ico = join(root, 'launch', 'framo.ico')
  writeFileSync(ico, icoFromPngs(pngs))
  console.log(`${ico} (${SIZES.join(', ')})`)
}
