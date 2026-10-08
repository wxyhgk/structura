import { createServer as createHttpServer, type Server } from "node:http"
import type { DatabaseSync } from "node:sqlite"
import { sendError } from "./http.ts"
import { route } from "./routes.ts"

// The HTTP server over an open database. It is not listening yet: the caller picks the port
// (tests use 0 for a free one).

export function createServer(db: DatabaseSync): Server {
  return createHttpServer((req, res) => {
    route(db, req, res).catch((error: unknown) => sendError(res, error))
  })
}
