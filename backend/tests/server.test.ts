import assert from "node:assert/strict"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { after, before, test } from "node:test"
import type { ImportReport, Template, TemplateLibrary } from "@structura/markush"
import { openDatabase, SCHEMA_VERSION, schemaVersion } from "../src/db.ts"
import { createServer } from "../src/server.ts"
import { alkylTemplate, phenylene, phenylTemplate, stamped } from "./support/fixtures.ts"

// The API of API.md over real HTTP: a server on a free port, over a database in a temp folder.

const folder = mkdtempSync(join(tmpdir(), "structura-backend-"))
const dbPath = join(folder, "nested", "templates.db")
let db: DatabaseSync
let base = ""
let server: ReturnType<typeof createServer>

before(async () => {
  db = openDatabase(dbPath)
  server = createServer(db)
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(async () => {
  server.closeAllConnections()
  await new Promise((done) => server.close(done))
  db.close()
  rmSync(folder, { recursive: true, force: true })
})

const call = async (method: string, path: string, body?: unknown, raw?: string) => {
  const response = await fetch(base + path, {
    method,
    headers: body !== undefined || raw !== undefined ? { "Content-Type": "application/json" } : {},
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  })
  const text = await response.text()
  return { status: response.status, headers: response.headers, body: text ? (JSON.parse(text) as unknown) : undefined }
}

const reset = () => db.exec("DELETE FROM templates")

test("the database file and its folder are made and migrated", () => {
  assert.ok(existsSync(dbPath))
  assert.equal(schemaVersion(db), SCHEMA_VERSION)
  assert.equal((db.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode, "wal")
})

test("health counts the templates", async () => {
  reset()
  assert.deepEqual((await call("GET", "/api/health")).body, { ok: true, templates: 0 })
  await call("POST", "/api/templates", alkylTemplate())
  const health = await call("GET", "/api/health")
  assert.equal(health.status, 200)
  assert.match(health.headers.get("content-type") ?? "", /application\/json/)
  assert.deepEqual(health.body, { ok: true, templates: 1 })
})

test("create, list, update and delete a template", async () => {
  reset()
  const created = await call("POST", "/api/templates", phenylTemplate())
  assert.equal(created.status, 201)
  const made = created.body as Template
  assert.equal(made.source, "user")
  assert.equal(made.name, "苯基")
  assert.equal(made.createdAt, made.updatedAt)

  const listed = await call("GET", "/api/templates")
  assert.equal(listed.status, 200)
  assert.deepEqual(listed.body, { templates: [made] })

  const updated = await call("PUT", `/api/templates/${made.id}`, { name: "对亚苯基", group: "连接基", site: "link", alternative: phenylene() })
  assert.equal(updated.status, 200)
  const changed = updated.body as Template
  assert.equal(changed.id, made.id)
  assert.equal(changed.createdAt, made.createdAt)
  assert.ok(changed.updatedAt >= made.updatedAt)
  assert.equal(changed.site, "link")

  const deleted = await call("DELETE", `/api/templates/${made.id}`)
  assert.equal(deleted.status, 204)
  assert.equal(deleted.body, undefined)
  assert.deepEqual((await call("GET", "/api/templates")).body, { templates: [] })
})

test("an invalid template is a 400 with templateProblem's reason", async () => {
  reset()
  const wrongSite = await call("POST", "/api/templates", phenylTemplate({ site: "link" }))
  assert.equal(wrongSite.status, 400)
  assert.match((wrongSite.body as { error: string }).error, /two atoms/)
  assert.equal((await call("POST", "/api/templates", [])).status, 400)
  const made = (await call("POST", "/api/templates", alkylTemplate())).body as Template
  const badUpdate = await call("PUT", `/api/templates/${made.id}`, alkylTemplate({ name: "" }))
  assert.equal(badUpdate.status, 400)
  assert.ok((badUpdate.body as { error: string }).error)
})

test("a missing template or route is a 404", async () => {
  reset()
  const put = await call("PUT", "/api/templates/nope", alkylTemplate())
  assert.equal(put.status, 404)
  assert.match((put.body as { error: string }).error, /nope/)
  assert.equal((await call("DELETE", "/api/templates/nope")).status, 404)
  assert.equal((await call("GET", "/api/nothing")).status, 404)
  assert.equal((await call("GET", "/api/templates/a/b")).status, 404)
})

test("a method a path does not take is a 405 naming those it does", async () => {
  const response = await call("PATCH", "/api/templates")
  assert.equal(response.status, 405)
  assert.equal(response.headers.get("allow"), "GET, POST")
})

test("a body that is not JSON, or none at all, is a 400", async () => {
  const broken = await call("POST", "/api/templates", undefined, "{ not json")
  assert.equal(broken.status, 400)
  assert.match((broken.body as { error: string }).error, /JSON/)
  assert.equal((await call("POST", "/api/templates", undefined, "")).status, 400)
  assert.equal((await call("POST", "/api/templates/import", undefined, "nope")).status, 400)
})

test("a body over 2 MB is a 413", async () => {
  const big = await call("POST", "/api/templates", { ...alkylTemplate(), padding: "x".repeat(2 * 1024 * 1024) })
  assert.equal(big.status, 413)
  assert.match((big.body as { error: string }).error, /2 MB/)
  // The server still answers afterwards.
  assert.equal((await call("GET", "/api/health")).status, 200)
})

test("export, then import back: nothing twice; into an empty store: everything", async () => {
  reset()
  await call("POST", "/api/templates", phenylTemplate())
  await call("POST", "/api/templates", alkylTemplate())
  const exported = await call("GET", "/api/templates/export")
  assert.equal(exported.status, 200)
  assert.equal(exported.headers.get("content-disposition"), 'attachment; filename="structura-templates.json"')
  const library = exported.body as TemplateLibrary
  assert.equal(library.format, "structura-templates")
  assert.equal(library.version, 1)
  assert.equal(library.templates.length, 2)

  const again = await call("POST", "/api/templates/import", library)
  assert.equal(again.status, 200)
  assert.deepEqual(again.body, { added: 0, skipped: 2, problems: [] } satisfies ImportReport)

  reset()
  assert.deepEqual((await call("POST", "/api/templates/import", library)).body, { added: 2, skipped: 0, problems: [] })
  const restored = ((await call("GET", "/api/templates")).body as { templates: Template[] }).templates
  assert.deepEqual(
    restored.map((template) => [template.name, template.createdAt]),
    library.templates.map((template) => [template.name, template.createdAt]),
  )
  assert.ok(restored.every((template, index) => template.id !== library.templates[index].id))
})

test("import lists bad templates and adds the rest; a file that is not a library is a 400", async () => {
  reset()
  const report = await call("POST", "/api/templates/import", {
    format: "structura-templates",
    version: 1,
    templates: [stamped(alkylTemplate(), "builtin:alkyl"), stamped(phenylTemplate({ site: "link" }), "x")],
  })
  assert.equal(report.status, 200)
  const { added, skipped, problems } = report.body as ImportReport
  assert.deepEqual([added, skipped, problems.length], [1, 0, 1])
  assert.match(problems[0], /^template 2/)
  const notLibrary = await call("POST", "/api/templates/import", { format: "something", templates: [] })
  assert.equal(notLibrary.status, 400)
  assert.match((notLibrary.body as { error: string }).error, /not a Structura template library/)
})

test("an older database file is brought up to date when opened", () => {
  const old = join(folder, "old.db")
  new DatabaseSync(old).close()
  const reopened = openDatabase(old)
  assert.equal(schemaVersion(reopened), SCHEMA_VERSION)
  reopened.close()
  // Opening it again runs nothing twice.
  const again = openDatabase(old)
  assert.equal(schemaVersion(again), SCHEMA_VERSION)
  again.close()
})

test("a database from a newer Structura is refused", () => {
  const newer = join(folder, "newer.db")
  const handle = new DatabaseSync(newer)
  handle.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`)
  handle.close()
  assert.throws(() => openDatabase(newer), /newer Structura/)
})
