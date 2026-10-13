import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// 导出 Word with editable ChemDraw objects: the page sends the compound-table package that
// 化合物表 also downloads (packages/react/src/editor/markush/compoundTable.ts), and chem2office,
// a Python project on this machine, turns it into a .docx. GET says whether it can now (and
// why not); POST does it. Nothing leaves the machine.

export const WORD_PATH = "/api/word"

/** Where chem2office is and the Python that runs it: CHEM2OFFICE_DIR (else ../chem2office beside this repository) and CHEM2OFFICE_PYTHON (else python3). */
export type WordConfig = { dir: string | null; python: string }

const SCRIPT = ["scripts", "cli", "structura_table_to_docx.py"]
const SIBLING = fileURLToPath(new URL("../../../chem2office", import.meta.url))
/** A package bigger than this is refused (a few thousand compounds' CDXML is far less). */
const MAX_PACKAGE = 64 * 1024 * 1024
/** chem2office takes about a second for a table; this much is surely stuck. */
const TIMEOUT_MS = 5 * 60 * 1000
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

export function readWordConfig(env: NodeJS.ProcessEnv = process.env): WordConfig {
  const dir = env.CHEM2OFFICE_DIR?.trim()
  return { dir: dir ? resolve(dir) : existsSync(SIBLING) ? SIBLING : null, python: env.CHEM2OFFICE_PYTHON?.trim() || "python3" }
}

export type Availability = { available: true } | { available: false; reason: string }

/** Runs a program, resolving to its output or rejecting with what it said on stderr. */
function run(program: string, args: string[], cwd: string, timeout: number): Promise<string> {
  return new Promise((done, fail) => {
    execFile(program, args, { cwd, timeout, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (!error) return done(stdout)
      const said = stderr.trim().split("\n").slice(-6).join("\n")
      fail(new Error(said || error.message))
    })
  })
}

/** Whether chem2office is there and its Python can load it; the reason, in Chinese, when not. */
export async function wordAvailability(config: WordConfig): Promise<Availability> {
  if (!config.dir) return { available: false, reason: "没有找到 chem2office：把它放在本仓库旁边（../chem2office），或在 .env.local 里设 CHEM2OFFICE_DIR" }
  if (!existsSync(join(config.dir, ...SCRIPT))) return { available: false, reason: `${config.dir} 里没有 ${SCRIPT.join("/")}，chem2office 版本太旧或路径不对` }
  try {
    await run(config.python, ["-c", "import retain_cdx, pycdxml"], config.dir, 60_000)
    return { available: true }
  } catch (error) {
    return { available: false, reason: `用 ${config.python} 加载 chem2office 失败：${error instanceof Error ? error.message : error}（可用 CHEM2OFFICE_PYTHON 指定 Python）` }
  }
}

/** The package as a .docx: chem2office's CLI in a folder of its own, removed after. */
export async function makeWord(config: WordConfig, pack: Uint8Array, columns: number | null): Promise<Uint8Array> {
  if (!config.dir) throw new Error("没有找到 chem2office")
  const work = await mkdtemp(join(tmpdir(), "structura-word-"))
  try {
    const input = join(work, "table.zip")
    const output = join(work, "table.docx")
    await writeFile(input, pack)
    const args = ["-m", "scripts.cli.structura_table_to_docx", "--input", input, "--output", output, ...(columns ? ["--columns", String(columns)] : [])]
    await run(config.python, args, config.dir, TIMEOUT_MS)
    return await readFile(output)
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

async function readBody(req: IncomingMessage, limit: number): Promise<Uint8Array> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > limit) throw new Error("请求太大")
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function json(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status
  res.setHeader("content-type", "application/json; charset=utf-8")
  res.end(JSON.stringify(value))
}

/**
 * GET: { available: true } or { available: false, reason }. POST with the package (a zip) as
 * the body, ?columns=N optional: the .docx, or { error } as JSON. Availability is checked once
 * and kept while it holds; a failed check is tried again next time.
 */
export function wordHandler(config: WordConfig) {
  let known: Availability | null = null
  const availability = async () => (known?.available ? known : (known = await wordAvailability(config)))
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method === "GET") return json(res, 200, await availability())
      if (req.method !== "POST") return json(res, 405, { error: "只接受 GET 或 POST" })
      const ready = await availability()
      if (!ready.available) return json(res, 503, { error: ready.reason })
      const columnsText = new URL(req.url ?? "/", "http://local").searchParams.get("columns")
      const columns = columnsText && /^[1-9]\d?$/.test(columnsText) ? Number(columnsText) : null
      const docx = await makeWord(config, await readBody(req, MAX_PACKAGE), columns)
      res.statusCode = 200
      res.setHeader("content-type", DOCX)
      res.end(docx)
    } catch (error) {
      json(res, 500, { error: `生成 Word 失败：${error instanceof Error ? error.message : error}` })
    }
  }
}

/** The endpoint on Vite's dev and preview servers, as the app's other server features are. */
export function structuraWord(env: NodeJS.ProcessEnv = process.env) {
  const handler = wordHandler(readWordConfig(env))
  const mount = (server: { middlewares: { use(path: string, handle: typeof handler): unknown } }) => {
    server.middlewares.use(WORD_PATH, handler)
  }
  return { name: "structura-word", configureServer: mount, configurePreviewServer: mount }
}
