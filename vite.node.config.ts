import { defineConfig } from 'vite'

// 로컬 서버와 MCP 서버를 Node에서 바로 도는 파일 하나씩으로 묶는다. 받는 사람이 npm install을 하지 않아도 되게.
export default defineConfig({
  build: {
    ssr: true,
    outDir: 'dist-node',
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    rollupOptions: {
      input: { serve: 'server/serve.ts', 'gyeol-mcp': 'mcp/server.ts' },
      output: { entryFileNames: '[name].mjs', chunkFileNames: 'shared-[hash].mjs', format: 'es' },
    },
  },
  ssr: { noExternal: true, target: 'node' },
})
