// 나눠 줄 폴더를 만든다: release/html-maker-<버전>/
// 받는 사람은 Node.js만 있으면 되고, npm install이나 인터넷 연결이 필요 없다.

import { execSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const out = join(root, 'release', `html-maker-${version}`)

execSync('npm run build', { cwd: root, stdio: 'inherit' })

// 빌드 결과에 바깥 주소가 섞이면 멈춘다. SVG 네임스페이스와 문서 주소는 연결이 아니라서 뺀다.
const allowed = [/^http:\/\/www\.w3\.org\//, /^https?:\/\/(reactjs\.org|react\.dev)\//]
const external = new Set()
for (const file of execSync('find dist -type f', { cwd: root, encoding: 'utf8' }).trim().split('\n')) {
  if (!/\.(js|css|html)$/.test(file)) continue
  for (const [url] of readFileSync(join(root, file), 'utf8').matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) {
    if (!allowed.some((re) => re.test(url))) external.add(`${file}: ${url}`)
  }
}
if (external.size) {
  console.error('빌드 결과에 바깥 주소가 있어요. 확인해 주세요:\n' + [...external].join('\n'))
  process.exit(1)
}

rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'server'), { recursive: true })
cpSync(join(root, 'dist'), join(out, 'dist'), { recursive: true })
cpSync(join(root, 'server', 'serve.mjs'), join(out, 'server', 'serve.mjs'))
for (const name of ['html-maker 시작.command', 'html-maker 시작.bat', '사용법.txt']) {
  cpSync(join(root, 'launch', name), join(out, name))
}
chmodSync(join(out, 'html-maker 시작.command'), 0o755)
// server/serve.mjs가 ES 모듈로 돌도록
writeFileSync(join(out, 'package.json'), JSON.stringify({ name: 'html-maker', version, private: true, type: 'module' }, null, 2) + '\n')

console.log(`\n나눠 줄 폴더를 만들었어요: ${out}`)
if (existsSync('/usr/bin/zip')) {
  execSync(`zip -qr "html-maker-${version}.zip" "html-maker-${version}"`, { cwd: join(root, 'release') })
  console.log(`압축 파일: ${join(root, 'release', `html-maker-${version}.zip`)}`)
}
