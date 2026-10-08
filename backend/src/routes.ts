import type { IncomingMessage, ServerResponse } from "node:http"
import type { DatabaseSync } from "node:sqlite"
import type { TemplateInput, TemplateLibrary } from "@structura/markush"
import { HttpError, readJson, sendEmpty, sendJson } from "./http.ts"
import {
  countTemplates,
  createTemplate,
  exportLibrary,
  importLibrary,
  InvalidInput,
  listTemplates,
  removeTemplate,
  updateTemplate,
} from "./templates.ts"

// The routes of API.md: which method and path does what. Bodies are read and answers written
// here; what is stored and how is the repository's (templates.ts).

type Handler = (db: DatabaseSync, req: IncomingMessage, res: ServerResponse, id: string) => Promise<void> | void

type Route = { path: RegExp; methods: Partial<Record<string, Handler>> }

const EXPORT_FILE = "structura-templates.json"

const ROUTES: Route[] = [
  {
    path: /^\/api\/health$/,
    methods: { GET: (db, _req, res) => sendJson(res, 200, { ok: true, templates: countTemplates(db) }) },
  },
  {
    path: /^\/api\/templates$/,
    methods: {
      GET: (db, _req, res) => sendJson(res, 200, { templates: listTemplates(db) }),
      POST: async (db, req, res) => sendJson(res, 201, createTemplate(db, (await readJson(req)) as TemplateInput)),
    },
  },
  // Before /:id, so "export" and "import" are never taken for ids.
  {
    path: /^\/api\/templates\/export$/,
    methods: { GET: (db, _req, res) => sendJson(res, 200, exportLibrary(db), { "Content-Disposition": `attachment; filename="${EXPORT_FILE}"` }) },
  },
  {
    path: /^\/api\/templates\/import$/,
    methods: { POST: async (db, req, res) => sendJson(res, 200, importLibrary(db, (await readJson(req)) as TemplateLibrary)) },
  },
  {
    path: /^\/api\/templates\/([^/]+)$/,
    methods: {
      PUT: async (db, req, res, id) => {
        const template = updateTemplate(db, id, (await readJson(req)) as TemplateInput)
        if (!template) throw new HttpError(404, `no template ${id}`)
        sendJson(res, 200, template)
      },
      DELETE: (db, _req, res, id) => {
        if (!removeTemplate(db, id)) throw new HttpError(404, `no template ${id}`)
        sendEmpty(res, 204)
      },
    },
  },
]

/** Answers one request; throws HttpError for the errors the API names. */
export async function route(db: DatabaseSync, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = new URL(req.url ?? "/", "http://localhost").pathname
  for (const { path: pattern, methods } of ROUTES) {
    const match = pattern.exec(path)
    if (!match) continue
    const handler = methods[req.method ?? "GET"]
    if (!handler) {
      res.setHeader("Allow", Object.keys(methods).join(", "))
      throw new HttpError(405, `${req.method} is not allowed on ${path}`)
    }
    let id = ""
    if (match[1] != null) {
      try {
        id = decodeURIComponent(match[1])
      } catch {
        throw new HttpError(404, `no template ${match[1]}`)
      }
    }
    try {
      return await handler(db, req, res, id)
    } catch (error) {
      if (error instanceof InvalidInput) throw new HttpError(400, error.message)
      throw error
    }
  }
  throw new HttpError(404, `no route ${path}`)
}
