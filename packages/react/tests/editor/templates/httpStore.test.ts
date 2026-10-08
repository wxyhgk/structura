import assert from "node:assert/strict"
import { afterEach } from "node:test"
import test from "node:test"
import type { Template, TemplateInput } from "@structura/markush"
import { httpTemplateStore } from "../../../src/editor/templates/httpStore.ts"

type Call = { url: string; method: string; body: unknown; type: string | null }

const real = globalThis.fetch
afterEach(() => {
  globalThis.fetch = real
})

/** Answers every request with `answer`, keeping what was asked. */
function stub(answer: () => Response | Promise<Response>): Call[] {
  const calls: Call[] = []
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined, type: headers.get("Content-Type") })
    return answer()
  }) as typeof fetch
  return calls
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

const input: TemplateInput = { name: "烷基", group: "我的模板", site: "end", alternative: { kind: "class", class: "alkyl" } }
const template: Template = { ...input, id: "u1", source: "user", createdAt: "t", updatedAt: "t" }

test("listing asks for the user's templates and hands back the list", async () => {
  const calls = stub(() => json({ templates: [template] }))
  assert.deepEqual(await httpTemplateStore().list(), [template])
  assert.deepEqual(calls, [{ url: "/api/templates", method: "GET", body: undefined, type: null }])
})

test("each change goes to its path with its method, as JSON", async () => {
  const calls = stub(() => json(template, 201))
  const store = httpTemplateStore("http://host/api")
  await store.create(input)
  await store.update("a b", input)
  assert.deepEqual(calls[0], { url: "http://host/api/templates", method: "POST", body: input, type: "application/json" })
  assert.deepEqual(calls[1], { url: "http://host/api/templates/a%20b", method: "PUT", body: input, type: "application/json" })
})

test("removing takes a 204 with no body", async () => {
  const calls = stub(() => new Response(null, { status: 204 }))
  assert.equal(await httpTemplateStore().remove("u1"), undefined)
  assert.equal(calls[0]!.method, "DELETE")
  assert.equal(calls[0]!.url, "/api/templates/u1")
})

test("export and import use their own paths", async () => {
  const library = { format: "structura-templates", version: 1, templates: [template] } as const
  const calls = stub(() => json(calls.length === 1 ? library : { added: 1, skipped: 0, problems: [] }))
  const store = httpTemplateStore()
  assert.deepEqual(await store.exportLibrary(), library)
  assert.deepEqual(await store.importLibrary({ ...library, templates: [template] }), { added: 1, skipped: 0, problems: [] })
  assert.deepEqual(
    calls.map((call) => `${call.method} ${call.url}`),
    ["GET /api/templates/export", "POST /api/templates/import"],
  )
})

test("a refusal throws the server's own message", async () => {
  stub(() => json({ error: "a template's name is 1 to 60 characters" }, 400))
  await assert.rejects(httpTemplateStore().create(input), { message: "a template's name is 1 to 60 characters" })
})

test("a failure without a message says the status", async () => {
  stub(() => new Response("oops", { status: 500 }))
  await assert.rejects(httpTemplateStore().list(), /HTTP 500/)
})

test("no backend: a network failure, or a page served in its place, throws", async () => {
  stub(() => Promise.reject(new TypeError("Failed to fetch")))
  await assert.rejects(httpTemplateStore().list(), /连不上后端/)
  stub(() => new Response("<!doctype html>", { status: 200, headers: { "Content-Type": "text/html" } }))
  await assert.rejects(httpTemplateStore().list(), /不是 JSON/)
  stub(() => json({ something: "else" }))
  await assert.rejects(httpTemplateStore().list(), /没有模板列表/)
})
