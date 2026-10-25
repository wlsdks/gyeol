/// <reference types="vitest/config" />
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
// 설정 파일이 가져오는 것은 다른 파일을 가져오지 않는 두 파일뿐이다. 확장자까지 적어야 Node가 설정을 바로 읽는다
import { CSP_META } from './server/csp.ts'
import { SHARE_DIR_NAME } from './src/ai/protocol.ts'

/** 빌드한 화면에도 서버와 같은 CSP를 넣는다. 다른 방법으로 열어도 이 PC 밖으로는 연결하지 못한다. */
function cspMeta(): Plugin {
  const anchor = '<meta charset="UTF-8" />'
  return {
    name: 'gyeol-csp',
    apply: 'build',
    transformIndexHtml(html) {
      // 예전에는 이 줄을 찾지 못하면 CSP 없이 조용히 빌드됐다. index.html을 고치다 줄이 바뀌면 빌드를 멈춘다
      if (!html.includes(anchor)) throw new Error(`index.html에 ${anchor}가 없어서 CSP를 넣지 못했어요.`)
      return html.replace(anchor, `${anchor}\n    <meta http-equiv="Content-Security-Policy" content="${CSP_META}" />`)
    },
  }
}

/**
 * 개발 서버에서도 'AI 공유' 창구를 연다. 실제 서버(server/serve.ts)와 같은 처리기를 쓴다.
 * 처리기는 개발 서버를 띄울 때 개발 서버의 모듈 로더로 가져온다. 예전에는 설정 파일 맨 위에서 가져와서,
 * 빌드와 시험 때도 발표 모델까지 설정과 함께 묶어 읽었고 시험을 돌릴 때마다 설정 읽기 경고가 났다.
 */
function aiShare(): Plugin {
  return {
    name: 'gyeol-ai',
    apply: 'serve',
    async configureServer(server) {
      const { createAiHandler } = (await server.ssrLoadModule('/server/ai.ts')) as typeof import('./server/ai')
      const root = process.cwd()
      const handle = createAiHandler(join(root, SHARE_DIR_NAME), { mcpPath: join(root, 'dist-node', 'gyeol-mcp.mjs') })
      server.middlewares.use((req, res, next) => {
        handle(req, res).then((done) => done || next(), next)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), cspMeta(), aiShare()],
  base: './',
  // 에이전트가 따로 쓰는 작업 폴더(.claude/worktrees)는 지켜보지 않는다. 그 안의 index.html, tsconfig.json이 생기거나 바뀌면
  // 이 개발 서버가 열린 화면을 모두 새로 고쳐서, 갤러리에서 부품 높이를 재던 것이 중간에 끊겼다
  server: { watch: { ignored: ['**/.claude/**'] } },
  // 그 폴더의 시험 사본도 돌리지 않는다
  test: { exclude: ['**/node_modules/**', '**/.git/**', '.claude/**'] },
})
