import assert from "node:assert/strict"
import test from "node:test"
import { openDatabase, SCHEMA_VERSION, schemaVersion } from "../src/db.ts"
import {
  countTemplates,
  createTemplate,
  exportLibrary,
  getTemplate,
  importLibrary,
  InvalidInput,
  listTemplates,
  removeTemplate,
  updateTemplate,
} from "../src/templates.ts"
import { alkylTemplate, phenylene, phenylTemplate, stamped } from "./support/fixtures.ts"

const fresh = () => openDatabase(":memory:")
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

test("a fresh database is migrated to the current schema", () => {
  const db = fresh()
  assert.equal(schemaVersion(db), SCHEMA_VERSION)
  assert.equal(countTemplates(db), 0)
  assert.deepEqual(listTemplates(db), [])
})

test("a created template gets a uuid, source user and both times now, and reads back the same", () => {
  const db = fresh()
  const before = new Date().toISOString()
  const made = createTemplate(db, { ...phenylTemplate(), name: "  苯基  " })
  assert.match(made.id, UUID)
  assert.equal(made.source, "user")
  assert.equal(made.name, "苯基")
  assert.equal(made.createdAt, made.updatedAt)
  assert.ok(made.createdAt >= before)
  assert.deepEqual(getTemplate(db, made.id), made)
  assert.deepEqual(listTemplates(db), [made])
  assert.equal(countTemplates(db), 1)
})

test("fields a client adds are not stored, and missing aliases come back empty", () => {
  const db = fresh()
  const made = createTemplate(db, { ...alkylTemplate(), id: "mine", source: "builtin", extra: 1 } as never)
  assert.notEqual(made.id, "mine")
  assert.equal(made.source, "user")
  assert.deepEqual(made.aliases, [])
  assert.equal("extra" in (getTemplate(db, made.id) ?? {}), false)
})

test("a template that will not do is refused with templateProblem's reason", () => {
  const db = fresh()
  assert.throws(() => createTemplate(db, phenylTemplate({ site: "link" })), (error) => error instanceof InvalidInput && /two atoms/.test(error.message))
  assert.throws(() => createTemplate(db, phenylTemplate({ name: "" })), InvalidInput)
  assert.throws(() => createTemplate(db, null as never), InvalidInput)
  assert.equal(countTemplates(db), 0)
})

test("templates are listed oldest first", async () => {
  const db = fresh()
  const first = createTemplate(db, phenylTemplate())
  await new Promise((done) => setTimeout(done, 5))
  const second = createTemplate(db, alkylTemplate())
  importLibrary(db, { format: "structura-templates", version: 1, templates: [stamped(phenylTemplate({ name: "旧的" }), "x", "2020-01-01T00:00:00Z")] })
  assert.deepEqual(
    listTemplates(db).map((template) => template.id),
    [listTemplates(db)[0].id, first.id, second.id],
  )
  assert.equal(listTemplates(db)[0].name, "旧的")
})

test("updating keeps the id and createdAt and moves updatedAt", async () => {
  const db = fresh()
  const made = createTemplate(db, phenylTemplate())
  await new Promise((done) => setTimeout(done, 5))
  const changed = updateTemplate(db, made.id, { name: "对亚苯基", group: "连接基", site: "link", alternative: phenylene() })
  assert.ok(changed)
  assert.equal(changed.id, made.id)
  assert.equal(changed.createdAt, made.createdAt)
  assert.ok(changed.updatedAt > made.updatedAt)
  assert.equal(changed.site, "link")
  assert.deepEqual(getTemplate(db, made.id), changed)
})

test("updating or removing a template that is not there says so", () => {
  const db = fresh()
  assert.equal(updateTemplate(db, "nope", phenylTemplate()), null)
  assert.equal(removeTemplate(db, "nope"), false)
  const made = createTemplate(db, phenylTemplate())
  assert.throws(() => updateTemplate(db, made.id, phenylTemplate({ group: "" })), InvalidInput)
  assert.equal(removeTemplate(db, made.id), true)
  assert.equal(getTemplate(db, made.id), null)
})

test("export is a library file of every template, which libraryProblem accepts", () => {
  const db = fresh()
  createTemplate(db, phenylTemplate())
  createTemplate(db, alkylTemplate())
  const library = exportLibrary(db)
  assert.equal(library.format, "structura-templates")
  assert.equal(library.version, 1)
  assert.deepEqual(library.templates, listTemplates(db))
})

test("re-importing an export into the same database skips everything", () => {
  const db = fresh()
  createTemplate(db, phenylTemplate())
  createTemplate(db, alkylTemplate())
  const library = exportLibrary(db)
  assert.deepEqual(importLibrary(db, library), { added: 0, skipped: 2, problems: [] })
  assert.equal(countTemplates(db), 2)
})

test("same content in another key order still counts as the same", () => {
  const db = fresh()
  const made = createTemplate(db, alkylTemplate())
  const reordered = { updatedAt: made.updatedAt, alternative: { max: 6, min: 1, class: "alkyl", kind: "class" }, site: "end", group: made.group, aliases: [], name: made.name, id: made.id, source: "user", createdAt: made.createdAt }
  assert.deepEqual(importLibrary(db, { format: "structura-templates", version: 1, templates: [reordered as never] }), { added: 0, skipped: 1, problems: [] })
})

test("an export imported into another database adds everything with new ids, keeping createdAt", () => {
  const from = fresh()
  createTemplate(from, phenylTemplate())
  const library = exportLibrary(from)
  const into = fresh()
  assert.deepEqual(importLibrary(into, library), { added: 1, skipped: 0, problems: [] })
  const [copy] = listTemplates(into)
  assert.notEqual(copy.id, library.templates[0].id)
  assert.equal(copy.createdAt, library.templates[0].createdAt)
  assert.equal(copy.source, "user")
  assert.deepEqual(copy.alternative, library.templates[0].alternative)
})

test("a stored id with changed content is added as a new template, the old one left alone", () => {
  const db = fresh()
  const made = createTemplate(db, phenylTemplate())
  const report = importLibrary(db, { format: "structura-templates", version: 1, templates: [{ ...made, name: "改过的苯基" }] })
  assert.deepEqual(report, { added: 1, skipped: 0, problems: [] })
  assert.equal(getTemplate(db, made.id)?.name, "苯基")
  assert.equal(countTemplates(db), 2)
})

test("built-in ids in a file are added as user copies", () => {
  const db = fresh()
  const builtin = { ...alkylTemplate(), id: "builtin:alkyl-c1-c6", source: "builtin" as const, createdAt: "2026-10-07T00:00:00.000Z", updatedAt: "2026-10-07T00:00:00.000Z" }
  assert.deepEqual(importLibrary(db, { format: "structura-templates", version: 1, templates: [builtin] }), { added: 1, skipped: 0, problems: [] })
  const [copy] = listTemplates(db)
  assert.match(copy.id, UUID)
  assert.equal(copy.source, "user")
})

test("bad templates in a file are listed and skipped, the rest still go in", () => {
  const db = fresh()
  const report = importLibrary(db, {
    format: "structura-templates",
    version: 1,
    templates: [stamped(phenylTemplate(), "a"), stamped(phenylTemplate({ name: "坏的", site: "ring" }), "b"), stamped(alkylTemplate(), "c")],
  })
  assert.equal(report.added, 2)
  assert.equal(report.skipped, 0)
  assert.equal(report.problems.length, 1)
  assert.match(report.problems[0], /^template 2 \(坏的\): .*one atom/)
  assert.equal(countTemplates(db), 2)
})

test("a time that is not one becomes now; times are stored as ISO UTC", () => {
  const db = fresh()
  importLibrary(db, {
    format: "structura-templates",
    version: 1,
    templates: [
      { ...stamped(phenylTemplate(), "a"), createdAt: "yesterday" },
      { ...stamped(alkylTemplate(), "b"), createdAt: "2026-01-01T08:00:00+08:00" },
    ],
  })
  const [old, odd] = listTemplates(db)
  assert.equal(old.createdAt, "2026-01-01T00:00:00.000Z")
  assert.ok(!Number.isNaN(Date.parse(odd.createdAt)))
  assert.equal(odd.name, "苯基")
})

test("a file that is not a library is refused as a whole", () => {
  const db = fresh()
  assert.throws(() => importLibrary(db, { format: "other", version: 1, templates: [] } as never), InvalidInput)
  assert.throws(() => importLibrary(db, { format: "structura-templates", version: 2, templates: [] } as never), /version 2/)
  assert.throws(() => importLibrary(db, { format: "structura-templates", version: 1 } as never), InvalidInput)
  assert.throws(() => importLibrary(db, null as never), InvalidInput)
  assert.throws(() => importLibrary(db, [] as never), InvalidInput)
})
