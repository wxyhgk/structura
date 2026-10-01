import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defaultClientConditions, defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
    // @structura/core is used from its TypeScript sources, not a built dist/.
    conditions: ['source', ...defaultClientConditions],
  },
  // Agent worktrees live under .claude/; their edits must not reload this app's pages.
  server: { watch: { ignored: ['**/.claude/**'] } },
})
