import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

// The backend's settings, read from the environment once at start (see API.md).

export type Config = { host: string; port: number; dbPath: string }

export const DEFAULT_PORT = 25174
export const DEFAULT_HOST = "127.0.0.1"
/** backend/data/structura.db, wherever the server is started from. */
export const DEFAULT_DB = fileURLToPath(new URL("../data/structura.db", import.meta.url))

/** The settings in `env`; throws on a port that is not one. A relative STRUCTURA_DB is taken from the working folder. */
export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const portText = env.STRUCTURA_BACKEND_PORT?.trim()
  const port = portText ? Number(portText) : DEFAULT_PORT
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`STRUCTURA_BACKEND_PORT is not a port: ${portText}`)
  const host = env.STRUCTURA_BACKEND_HOST?.trim() || DEFAULT_HOST
  const db = env.STRUCTURA_DB?.trim()
  return { host, port, dbPath: db ? (db === ":memory:" ? db : resolve(db)) : DEFAULT_DB }
}
