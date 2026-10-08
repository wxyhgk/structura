import type { ImportReport, Template, TemplateInput, TemplateLibrary } from "@structura/markush"
import type { TemplateStore } from "./store.ts"

/** Why a request failed, in the user's words: the server's own `error`, or what went wrong on the way. */
async function failureOf(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body?.error === "string" && body.error) return new Error(body.error)
  } catch {
    // Not JSON: fall through to the status.
  }
  return new Error(`后端出错（HTTP ${response.status}）`)
}

/**
 * The user's templates kept by the Structura backend (backend/API.md), over fetch. A failed
 * request throws an Error carrying the server's message; an answer that is not the backend's
 * (a page served in its place, as when no backend runs behind the dev server) throws too.
 */
export function httpTemplateStore(base = "/api"): TemplateStore {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${base}${path}`, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      throw new Error(`连不上后端：${error instanceof Error ? error.message : String(error)}`)
    }
    if (!response.ok) throw await failureOf(response)
    if (response.status === 204) return undefined as T
    try {
      return (await response.json()) as T
    } catch {
      throw new Error("后端的回答不是 JSON，可能没有启动后端")
    }
  }

  return {
    async list() {
      const answer = await call<{ templates?: Template[] }>("GET", "/templates")
      if (!Array.isArray(answer?.templates)) throw new Error("后端的回答里没有模板列表")
      return answer.templates
    },
    create: (input: TemplateInput) => call<Template>("POST", "/templates", input),
    update: (id: string, input: TemplateInput) => call<Template>("PUT", `/templates/${encodeURIComponent(id)}`, input),
    remove: (id: string) => call<void>("DELETE", `/templates/${encodeURIComponent(id)}`),
    exportLibrary: () => call<TemplateLibrary>("GET", "/templates/export"),
    importLibrary: (library: TemplateLibrary) => call<ImportReport>("POST", "/templates/import", library),
  }
}
