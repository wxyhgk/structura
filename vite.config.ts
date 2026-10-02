import path from 'node:path'
import { structuraAi } from '@structura/ai/server'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defaultClientConditions, defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  // "AI 填写" runs on this server, with its settings and keys from .env.local or the environment
  // (AI_PROVIDER, ANTHROPIC_*, OPENAI_*); the browser never sees them.
  plugins: [react(), tailwindcss(), structuraAi(loadEnv(mode, import.meta.dirname, ['AI_', 'ANTHROPIC_', 'OPENAI_']))],
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
