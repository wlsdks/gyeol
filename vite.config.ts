import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { CSP } from './server/serve.mjs'

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

export default defineConfig({
  plugins: [react(), cspMeta()],
  base: './',
})
