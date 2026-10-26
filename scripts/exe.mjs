// 윈도우용 Framo.exe를 만든다. Node.js의 단일 실행 파일(SEA) 기능으로, 공식 node.exe에 launch/framo-exe.cjs를 넣는다.
//
// 1. 같은 판의 node로 framo-exe.cjs를 SEA 덩어리(blob)로 만든다. 코드 캐시, 스냅숏은 쓰지 않아서 맥에서 만든 덩어리도
//    윈도우 node.exe에 들어간다.
// 2. node.exe를 복사하고 Node.js의 서명을 걷어 낸다. 고친 파일에 남은 서명은 맞지 않는 서명이라, 서명이 없는 것보다
//    백신이 더 의심한다.
// 3. 윈도우에서는 rcedit로 아이콘(launch/framo.ico)과 파일 정보(Framo, 버전)를 바꾼다. rcedit는 윈도우 프로그램이라
//    맥에서는 건너뛴다(아이콘 없는 exe가 된다). 릴리스와 검수는 윈도우에서 묶는다.
// 4. postject로 덩어리를 넣는다. rcedit가 리소스를 다시 쓰므로 반드시 rcedit 다음에 넣는다.
//
// rcedit, postject는 만들 때만 쓰는 도구다(devDependencies, MIT). 받는 사람 PC에는 들어가지 않는다.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
/** Node.js가 SEA 덩어리가 들었는지 보는 표시. 넣으면 끝의 0이 1로 바뀐다 */
export const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'

/**
 * PE(윈도우 실행 파일)에서 Authenticode 서명을 걷어 낸 새 Buffer. 서명이 없으면 그대로.
 * 서명은 파일 끝에 붙고 머리의 '보안' 목록 칸(데이터 디렉터리 4번)이 그 자리를 가리킨다. 칸을 비우고 끝을 자른다.
 * @param {Buffer} buf
 */
export function stripSignature(buf) {
  if (buf.length < 0x40 || buf.toString('latin1', 0, 2) !== 'MZ') throw new Error('윈도우 실행 파일이 아니에요')
  const pe = buf.readUInt32LE(0x3c)
  if (buf.toString('latin1', pe, pe + 4) !== 'PE\0\0') throw new Error('윈도우 실행 파일이 아니에요')
  const opt = pe + 4 + 20
  const magic = buf.readUInt16LE(opt)
  // PE32+(64비트)는 데이터 디렉터리가 112바이트 뒤, PE32는 96바이트 뒤
  const dirs = opt + (magic === 0x20b ? 112 : magic === 0x10b ? 96 : NaN)
  if (Number.isNaN(dirs)) throw new Error('윈도우 실행 파일이 아니에요')
  const entry = dirs + 4 * 8
  const at = buf.readUInt32LE(entry)
  const size = buf.readUInt32LE(entry + 4)
  if (size === 0) return buf
  // 서명은 8바이트로 맞춘 끝에만 붙는다. 다른 데 있으면 이 파일을 모르는 꼴로 보고 멈춘다
  if (at + size > buf.length || buf.length - (at + size) > 7) throw new Error('서명이 파일 끝에 있지 않아요')
  const out = Buffer.from(buf.subarray(0, at))
  out.writeUInt32LE(0, entry)
  out.writeUInt32LE(0, entry + 4)
  return out
}

/** 탐색기의 '자세히' 탭과 작업 관리자에 보이는 정보 */
export function exeInfo(version) {
  return {
    'version-string': {
      FileDescription: 'Framo',
      ProductName: 'Framo',
      CompanyName: 'Framo',
      InternalFilename: 'Framo',
      OriginalFilename: 'Framo.exe',
      // 고친 Node.js라서 Node.js의 저작권 표시도 남긴다 (라이선스 전문은 node\LICENSE.txt)
      LegalCopyright: 'Framo contributors. Built on Node.js (Copyright Node.js contributors). MIT license.',
    },
    'file-version': version,
    'product-version': version,
  }
}

/**
 * @param {object} o
 * @param {string} o.nodeExe 공식 win-x64 node.exe
 * @param {string} o.blobNode 덩어리를 만들 node. nodeExe와 같은 판이어야 한다
 * @param {string} o.out 만들 Framo.exe
 * @param {string} o.work 잠깐 쓸 폴더
 * @param {string} o.version
 * @returns {Promise<{ icon: boolean }>}
 */
export async function buildExe({ nodeExe, blobNode, out, work, version }) {
  const config = join(work, 'sea-config.json')
  const blob = join(work, 'sea.blob')
  writeFileSync(
    config,
    JSON.stringify({ main: join(root, 'launch', 'framo-exe.cjs'), output: blob, disableExperimentalSEAWarning: true, useSnapshot: false, useCodeCache: false }),
  )
  execFileSync(blobNode, ['--experimental-sea-config', config], { cwd: work, stdio: 'inherit' })

  writeFileSync(out, stripSignature(readFileSync(nodeExe)))

  const icon = process.platform === 'win32'
  if (icon) {
    const { rcedit } = await import('rcedit')
    await rcedit(out, { ...exeInfo(version), icon: join(root, 'launch', 'framo.ico') })
  }

  const { inject } = (await import('postject')).default
  await inject(out, 'NODE_SEA_BLOB', readFileSync(blob), { sentinelFuse: SEA_FUSE })
  if (!readFileSync(out).includes(`${SEA_FUSE}:1`)) throw new Error('Framo.exe에 SEA 덩어리가 들어가지 않았어요')
  return { icon }
}
