/// <reference types="vitest/config" />
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createAiHandler, SHARE_DIR_NAME } from './server/ai'
import { CSP } from './server/csp'

/** 빌드한 화면에도 서버와 같은 CSP를 넣는다. 다른 방법으로 열어도 이 PC 밖으로는 연결하지 못한다. */
function cspMeta(): Plugin {
  return {
    name: 'html-maker-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '<meta charset="UTF-8" />',
        // frame-ancestors는 meta에서 무시되므로 뺀다. 서버 헤더에는 있다.
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP.replace(/; frame-ancestors 'none'/, '')}" />`,
      ),
  }
}

/** 개발 서버에서도 'AI 공유' 창구를 연다. 실제 서버(server/serve.ts)와 같은 처리기를 쓴다. */
function aiShare(): Plugin {
  return {
    name: 'html-maker-ai',
    apply: 'serve',
    configureServer(server) {
      const root = process.cwd()
      const handle = createAiHandler(join(root, SHARE_DIR_NAME), { mcpPath: join(root, 'dist-node', 'html-maker-mcp.mjs') })
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
