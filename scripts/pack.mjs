// 나눠 줄 폴더와 zip을 만든다: release/gyeol-<버전>/
//
// 쓰는 사람은 대부분 윈도우라 윈도우를 기본으로 묶는다.
// - node.exe(Node.js 공식 윈도우 배포본)를 같이 넣어서, 받는 사람이 Node.js를 설치하지 않아도 된다.
//   회사 PC는 프로그램 설치가 막혀 있는 경우가 많다. 맥에서는 설치된 Node.js를 쓴다.
// - .bat은 CRLF, 안내 .txt는 메모장이 한글을 바로 알아보게 BOM과 CRLF로 쓴다.
// - zip은 한글 파일 이름이 윈도우에서 깨지지 않게 직접 만든다 (scripts/zip.mjs).
//
// node.exe는 이 스크립트를 돌리는 개발 PC에서만 nodejs.org에서 받고(체크섬 확인), .cache/에 둔다.
// 받는 사람 PC에서는 어디로도 연결하지 않는다.
//
//   npm run pack              윈도우용 node.exe까지 넣어서
//   npm run pack -- --no-node node.exe 없이 (받는 사람이 Node.js를 설치해야 함)

import { createHash } from 'node:crypto'
import { execFileSync, execSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { zipDir } from './zip.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const name = `gyeol-${version}`
const out = join(root, 'release', name)
const withNode = !process.argv.includes('--no-node')

/** 윈도우 배포본에 넣는 Node.js. LTS 중에서 고르고, 바꿀 때는 docs/OPEN-SOURCE.md도 고친다. */
const NODE_VERSION = 'v24.16.0'
const NODE_DIST = `node-${NODE_VERSION}-win-x64`

// 사내에서 써도 되는 라이선스가 아니면 여기서 멈춘다
execSync('node scripts/licenses.mjs', { cwd: root, stdio: 'inherit' })
execSync('npm run build', { cwd: root, stdio: 'inherit' })

// 빌드 결과에 바깥 주소가 섞이면 멈춘다. SVG 네임스페이스와 문서 주소는 연결이 아니라서 뺀다.
const allowed = [
  /^http:\/\/www\.w3\.org\//,
  // PPT 파일(.pptx)의 XML 이름공간(export/pptx.ts). 이름표일 뿐 PowerPoint도 이 주소로 연결하지 않는다
  /^http:\/\/schemas\.openxmlformats\.org\//,
  /^http:\/\/purl\.org\/dc\//,
  /^https?:\/\/(reactjs\.org|react\.dev)\//,
  // 로컬 서버가 자기 주소(127.0.0.1)를 만드는 곳
  /^http:\/\/(127\.0\.0\.1|\$\{HOST\}|\$\{req\.headers\.host\})/,
]
const external = new Set()
for (const file of execSync('find dist dist-node -type f', { cwd: root, encoding: 'utf8' }).trim().split('\n')) {
  if (!/\.(m?js|css|html)$/.test(file)) continue
  for (const [url] of readFileSync(join(root, file), 'utf8').matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) {
    if (!allowed.some((re) => re.test(url))) external.add(`${file}: ${url}`)
  }
}
if (external.size) {
  console.error('빌드 결과에 바깥 주소가 있어요. 확인해 주세요:\n' + [...external].join('\n'))
  process.exit(1)
}

// 빌드한 화면에 서버와 같은 CSP가 들어갔는지. 서버 없이 파일로 열어도 이 PC 밖으로 연결하지 못하게 하는 장치다
const { CSP_META } = await import(pathToFileURL(join(root, 'dist-node', 'serve.mjs')).href)
const cspTag = `<meta http-equiv="Content-Security-Policy" content="${CSP_META}" />`
if (!readFileSync(join(root, 'dist', 'index.html'), 'utf8').includes(cspTag)) {
  console.error('dist/index.html에 CSP가 없거나 서버의 CSP와 달라요. vite.config.ts의 cspMeta를 확인해 주세요.')
  process.exit(1)
}

/** nodejs.org의 공식 윈도우 배포본에서 node.exe와 LICENSE를 꺼낸다. 받은 파일은 .cache/에 둔다. */
async function windowsNode() {
  const cache = join(root, '.cache', 'node')
  const zip = join(cache, `${NODE_DIST}.zip`)
  mkdirSync(cache, { recursive: true })
  const base = `https://nodejs.org/dist/${NODE_VERSION}/`
  const sums = join(cache, `SHASUMS256-${NODE_VERSION}.txt`)
  if (!existsSync(sums)) writeFileSync(sums, await (await fetch(base + 'SHASUMS256.txt')).text())
  const expected = readFileSync(sums, 'utf8')
    .split('\n')
    .find((line) => line.endsWith(`  ${NODE_DIST}.zip`))
    ?.split(' ')[0]
  if (!expected) throw new Error(`SHASUMS256.txt에 ${NODE_DIST}.zip이 없어요`)
  if (!existsSync(zip)) {
    console.log(`윈도우용 Node.js를 받는 중: ${base}${NODE_DIST}.zip`)
    const res = await fetch(base + `${NODE_DIST}.zip`)
    if (!res.ok) throw new Error(`받지 못했어요 (${res.status})`)
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()))
  }
  const actual = createHash('sha256').update(readFileSync(zip)).digest('hex')
  if (actual !== expected) {
    rmSync(zip, { force: true })
    throw new Error('받은 Node.js의 체크섬이 맞지 않아요. 다시 실행해 주세요.')
  }
  const tmp = mkdtempSync(join(tmpdir(), 'gyeol-node-'))
  // 맥과 윈도우 10 이상의 tar(bsdtar)는 zip도 푼다
  execFileSync('tar', ['-xf', zip, '-C', tmp, `${NODE_DIST}/node.exe`, `${NODE_DIST}/LICENSE`])
  return { dir: join(tmp, NODE_DIST), cleanup: () => rmSync(tmp, { recursive: true, force: true }) }
}

/** 윈도우 메모장과 명령 프롬프트가 바로 읽는 줄바꿈과 인코딩 */
function windowsText(file, { bom }) {
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r?\n/g, '\r\n')
  writeFileSync(file, (bom ? '﻿' : '') + text)
}

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
cpSync(join(root, 'dist'), join(out, 'dist'), { recursive: true })
cpSync(join(root, 'dist-node'), join(out, 'dist-node'), { recursive: true })
execSync(`node scripts/licenses.mjs --notices "${join(out, '오픈소스 라이선스.txt')}"`, { cwd: root, stdio: 'ignore' })
for (const file of ['결 시작.command', '결 시작.bat', '사용법.txt']) {
  cpSync(join(root, 'launch', file), join(out, file))
}
chmodSync(join(out, '결 시작.command'), 0o755)
// dist-node의 .mjs는 그 자체로 ES 모듈이지만, 폴더를 알아보기 쉽게 이름과 버전을 남긴다
writeFileSync(join(out, 'package.json'), JSON.stringify({ name: 'gyeol', version, private: true, type: 'module' }, null, 2) + '\n')

if (withNode) {
  try {
    const node = await windowsNode()
    mkdirSync(join(out, 'node'))
    cpSync(join(node.dir, 'node.exe'), join(out, 'node', 'node.exe'))
    cpSync(join(node.dir, 'LICENSE'), join(out, 'node', 'LICENSE.txt'))
    node.cleanup()
    console.log(`윈도우용 Node.js ${NODE_VERSION}을 넣었어요.`)
  } catch (err) {
    console.error(`윈도우용 Node.js를 넣지 못했어요: ${err.message}`)
    console.error('받는 사람이 Node.js를 직접 설치해야 해요. node.exe 없이 묶으려면 --no-node를 붙이세요.')
    process.exit(1)
  }
}

windowsText(join(out, '결 시작.bat'), { bom: false })
for (const file of ['사용법.txt', '오픈소스 라이선스.txt']) windowsText(join(out, file), { bom: true })
if (withNode) windowsText(join(out, 'node', 'LICENSE.txt'), { bom: true })

console.log(`\n나눠 줄 폴더를 만들었어요: ${out}`)
const zipFile = join(root, 'release', `${name}.zip`)
zipDir(out, zipFile, { executable: (file) => file.endsWith('.command') })
console.log(`압축 파일: ${zipFile}`)
