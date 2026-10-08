import assert from "node:assert/strict"
import test from "node:test"
import type { TemplateInput } from "@structura/markush"
import { memoryTemplateStore } from "../../../src/editor/templates/memoryStore.ts"

const alkyl: TemplateInput = { name: " C1–C6 烷基 ", group: "我的模板", site: "end", alternative: { kind: "class", class: "alkyl", min: 1, max: 6 } }
const arylene: TemplateInput = { name: "亚芳基", aliases: ["arylene"], group: "连接基", site: "link", alternative: { kind: "class", class: "arylene", min: 6, max: 12 } }

test("a new template is the user's, with an id and both times, its names trimmed", async () => {
  const store = memoryTemplateStore()
  const made = await store.create(alkyl)
  assert.equal(made.source, "user")
  assert.equal(made.name, "C1–C6 烷基")
  assert.ok(made.id)
  assert.equal(made.createdAt, made.updatedAt)
  assert.deepEqual(await store.list(), [made])
})

test("a template that will not do is refused with the reason", async () => {
  const store = memoryTemplateStore()
  await assert.rejects(store.create({ ...alkyl, name: "" }), /name/)
  await assert.rejects(store.create({ name: "单键", group: "x", site: "end", alternative: { kind: "bond" } }), /links two atoms/)
  assert.deepEqual(await store.list(), [])
})

test("changing keeps the id and creation time; removing takes it away; an unknown id is an error", async () => {
  const store = memoryTemplateStore()
  const made = await store.create(alkyl)
  const changed = await store.update(made.id, { ...alkyl, name: "短烷基", group: "烷基" })
  assert.equal(changed.id, made.id)
  assert.equal(changed.createdAt, made.createdAt)
  assert.equal(changed.group, "烷基")
  assert.deepEqual((await store.list()).map((template) => template.name), ["短烷基"])
  await assert.rejects(store.update("nope", alkyl), /no template/)
  await store.remove(made.id)
  assert.deepEqual(await store.list(), [])
  await assert.rejects(store.remove(made.id), /no template/)
})

test("what the store hands out is a copy: changing it changes nothing kept", async () => {
  const store = memoryTemplateStore()
  const made = await store.create(alkyl)
  made.name = "改了"
  ;(await store.list())[0]!.group = "改了"
  assert.equal((await store.list())[0]!.name, "C1–C6 烷基")
  assert.equal((await store.list())[0]!.group, "我的模板")
})

test("a library exported is imported again with nothing added; others are added as the user's, bad ones listed", async () => {
  const store = memoryTemplateStore()
  await store.create(alkyl)
  const library = await store.exportLibrary()
  assert.equal(library.format, "structura-templates")
  assert.equal(library.version, 1)
  assert.deepEqual(await store.importLibrary(library), { added: 0, skipped: 1, problems: [] })

  const other = memoryTemplateStore()
  const builtin = { ...arylene, id: "builtin:arylene", source: "builtin" as const, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }
  const bad = { ...builtin, id: "x", name: "" }
  const report = await other.importLibrary({ format: "structura-templates", version: 1, templates: [...library.templates, builtin, bad] })
  assert.equal(report.added, 2)
  assert.equal(report.skipped, 0)
  assert.equal(report.problems.length, 1)
  const kept = await other.list()
  assert.ok(kept.every((template) => template.source === "user" && !template.id.startsWith("builtin:")))
  assert.equal(kept[1]!.createdAt, "2026-01-01T00:00:00.000Z")
  await assert.rejects(other.importLibrary({ format: "nope" } as never), /not a Structura template library/)
})

test("it can start with templates", async () => {
  const store = memoryTemplateStore([{ ...alkyl, id: "a", source: "user", createdAt: "t", updatedAt: "t" }])
  assert.deepEqual((await store.list()).map((template) => template.id), ["a"])
})
