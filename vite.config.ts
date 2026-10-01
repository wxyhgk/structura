import path from 'node:path'
import { structuraAi } from '@structura/ai/server'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defaultClientConditions, defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  // The API key for "AI 填写" is read on the server only (ANTHROPIC_API_KEY, e.g. in .env.local).
  plugins: [react(), tailwindcss(), structuraAi({ apiKey: loadEnv(mode, import.meta.dirname, 'ANTHROPIC_').ANTHROPIC_API_KEY })],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
    // The workspace packages (@structura/*) are used from their TypeScript sources, not a built dist/.
    conditions: ['structura-source', ...defaultClientConditions],
  },
  // Agent worktrees live under .claude/; their edits must not reload this app's pages.
  server: { watch: { ignored: ['**/.claude/**'] } },
}))
