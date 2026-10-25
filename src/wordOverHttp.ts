import type { WordExport } from '@structura/markush-page'

/** This app's own server (the dev and preview servers' structuraWord plugin, backend/src/word.ts). */
const WORD_PATH = '/api/word'

/** What the server said went wrong, or a plain account of the answer. */
async function failureOf(response: Response): Promise<string> {
  if (response.headers.get('content-type')?.includes('application/json')) {
    const body = (await response.json()) as { error?: string }
    if (body.error) return body.error
  }
  return `服务器没有提供 Word 接口（${response.status}）。请用 npm run dev 或 npm run preview 启动。`
}

/** Editable Word through chem2office on this app's server: asked first whether it can, then sent the package. */
export const wordOverHttp: WordExport = {
  async check() {
    try {
      const response = await fetch(WORD_PATH)
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) return (await response.json()) as Awaited<ReturnType<WordExport['check']>>
      return { available: false, reason: await failureOf(response) }
    } catch {
      return { available: false, reason: '连不上本应用的服务器' }
    }
  },
  async make(pack, { columns }) {
    const response = await fetch(`${WORD_PATH}?columns=${columns}`, { method: 'POST', headers: { 'content-type': 'application/zip' }, body: pack })
    if (!response.ok) throw new Error(await failureOf(response))
    return response.blob()
  },
}
