import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { createServer, type Server } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { makeWord, readWordConfig, WORD_PATH, wordAvailability, wordHandler, type WordConfig } from "../src/word.ts"

// 导出 Word through chem2office, with a stand-in for chem2office: a Python package of the same
// shape whose CLI writes, as the .docx, the zip it was given and the columns it was asked for.

const FAKE_CLI = `
import argparse, pathlib
parser = argparse.ArgumentParser()
parser.add_argument("--input"); parser.add_argument("--output"); parser.add_argument("--columns")
args = parser.parse_args()
data = pathlib.Path(args.input).read_bytes()
if data.startswith(b"fail"):
    raise SystemExit("chem2office could not read the package")
pathlib.Path(args.output).write_bytes(b"DOCX columns=" + str(args.columns).encode() + b" " + data)
`

async function fakeChem2office(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "fake-chem2office-"))
  for (const pkg of ["retain_cdx", "pycdxml", "scripts", "scripts/cli"]) {
    await mkdir(join(dir, pkg), { recursive: true })
    await writeFile(join(dir, pkg, "__init__.py"), "")
  }
  await writeFile(join(dir, "scripts/cli/structura_table_to_docx.py"), FAKE_CLI)
  return dir
}

async function serve(config: WordConfig): Promise<{ server: Server; url: string }> {
  const handler = wordHandler(config)
  const server = createServer((req, res) => {
    if (!req.url?.startsWith(WORD_PATH)) return res.writeHead(404).end()
    req.url = req.url.slice(WORD_PATH.length) || "/"
    void handler(req, res)
  })
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done))
  const address = server.address()
  return { server, url: `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}${WORD_PATH}` }
}

test("chem2office is found where it is said to be, or beside this repository; python3 by default", () => {
  assert.deepEqual(readWordConfig({ CHEM2OFFICE_DIR: "/opt/c2o", CHEM2OFFICE_PYTHON: "/venv/bin/python" }), { dir: "/opt/c2o", python: "/venv/bin/python" })
  assert.equal(readWordConfig({}).python, "python3")
})

test("without chem2office, or with one that cannot load, Word says why", async () => {
  const none = await wordAvailability({ dir: null, python: "python3" })
  assert.ok(!none.available && none.reason.includes("CHEM2OFFICE_DIR"))
  const empty = await mkdtemp(join(tmpdir(), "no-chem2office-"))
  const old = await wordAvailability({ dir: empty, python: "python3" })
  assert.ok(!old.available && old.reason.includes("structura_table_to_docx.py"))
  const dir = await fakeChem2office()
  // chem2office's own package missing (pycdxml may well be installed for real on this machine).
  await rm(join(dir, "retain_cdx"), { recursive: true })
  const broken = await wordAvailability({ dir, python: "python3" })
  assert.ok(!broken.available && broken.reason.includes("retain_cdx"), broken.available ? "" : broken.reason)
  await rm(empty, { recursive: true })
  await rm(dir, { recursive: true })
})

test("the package goes in, the .docx comes out, with the columns asked for; the work folder is gone after", async () => {
  const dir = await fakeChem2office()
  const config = { dir, python: "python3" }
  assert.deepEqual(await wordAvailability(config), { available: true })
  const docx = Buffer.from(await makeWord(config, new TextEncoder().encode("PK zip"), 4)).toString()
  assert.equal(docx, "DOCX columns=4 PK zip")
  await assert.rejects(makeWord(config, new TextEncoder().encode("fail"), null), /could not read the package/)
  await rm(dir, { recursive: true })
})

test("over HTTP: GET tells whether Word can be made, POST makes it, a failure comes back as JSON", async () => {
  const dir = await fakeChem2office()
  const { server, url } = await serve({ dir, python: "python3" })
  try {
    assert.deepEqual(await (await fetch(url)).json(), { available: true })
    const made = await fetch(`${url}?columns=3`, { method: "POST", body: "PK zip" })
    assert.equal(made.status, 200)
    assert.match(made.headers.get("content-type")!, /wordprocessingml/)
    assert.equal(await made.text(), "DOCX columns=3 PK zip")
    const failed = await fetch(url, { method: "POST", body: "fail" })
    assert.equal(failed.status, 500)
    assert.match((await failed.json()).error, /生成 Word 失败.*could not read/s)
  } finally {
    server.close()
    await rm(dir, { recursive: true })
  }
  const { server: missing, url: nowhere } = await serve({ dir: null, python: "python3" })
  try {
    const refused = await fetch(nowhere, { method: "POST", body: "PK" })
    assert.equal(refused.status, 503)
    assert.match((await refused.json()).error, /chem2office/)
  } finally {
    missing.close()
  }
})
