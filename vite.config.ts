import path from 'node:path'
import { structuraAi } from '@structura/ai/server'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defaultClientConditions, defineConfig, loadEnv } from 'vite'
import { structuraWord } from './backend/src/word.ts'

export default defineConfig(({ mode }) => ({
  // "AI 填写" runs on this server, with its settings and keys from .env.local or the environment
  // (AI_PROVIDER, ANTHROPIC_*, OPENAI_*); the browser never sees them. So does 导出 Word with
  // editable ChemDraw objects, through chem2office on this machine (CHEM2OFFICE_DIR, CHEM2OFFICE_PYTHON).
  plugins: [
    react(),
    tailwindcss(),
    structuraAi(loadEnv(mode, import.meta.dirname, ['AI_', 'ANTHROPIC_', 'OPENAI_'])),
    structuraWord({ ...process.env, ...loadEnv(mode, import.meta.dirname, ['CHEM2OFFICE_']) }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
    // The workspace packages (@structura/*) are used from their TypeScript sources, not a built dist/.
    conditions: ['structura-source', ...defaultClientConditions],
  },
  // Agent worktrees live under .claude/; their edits must not reload this app's pages.
  server: {
    watch: { ignored: ['**/.claude/**'] },
    // The user's templates are kept by the backend (npm run backend); the app calls same-origin paths.
    proxy: Object.fromEntries(['/api/templates', '/api/health'].map((route) => [route, `http://127.0.0.1:${process.env.STRUCTURA_BACKEND_PORT ?? 25174}`])),
  },
}))
