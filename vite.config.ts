/// <reference types="vitest/config" />
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createAiHandler } from './server/ai'
import { CSP_META } from './server/csp'
import { SHARE_DIR_NAME } from './src/ai/protocol'

/** 빌드한 화면에도 서버와 같은 CSP를 넣는다. 다른 방법으로 열어도 이 PC 밖으로는 연결하지 못한다. */
function cspMeta(): Plugin {
  const anchor = '<meta charset="UTF-8" />'
  return {
    name: 'gyeol-csp',
    apply: 'build',
    transformIndexHtml(html) {
      // 예전에는 이 줄을 찾지 못하면 CSP 없이 조용히 빌드됐다. index.html을 고치다 줄이 바뀌면 빌드를 멈춘다
      if (!html.includes(anchor)) throw new Error(`index.html에 ${anchor}가 없어서 CSP를 넣지 못했어요.`)
      // frame-ancestors는 meta에서 무시되므로 뺀다. 서버 헤더에는 있다.
      return html.replace(anchor, `${anchor}\n    <meta http-equiv="Content-Security-Policy" content="${CSP_META}" />`)
    },
  }
}

/** 개발 서버에서도 'AI 공유' 창구를 연다. 실제 서버(server/serve.ts)와 같은 처리기를 쓴다. */
function aiShare(): Plugin {
  return {
    name: 'gyeol-ai',
    apply: 'serve',
    configureServer(server) {
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
  // 에이전트가 따로 쓰는 작업 폴더(.claude/worktrees)의 시험 사본은 돌리지 않는다
  test: { exclude: ['**/node_modules/**', '**/.git/**', '.claude/**'] },
})
