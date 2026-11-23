import assert from "node:assert/strict"
import { createServer, type IncomingMessage } from "node:http"
import type { AddressInfo } from "node:net"
import test from "node:test"
import { Readable } from "node:stream"
import { readJsonBody } from "../src/body.ts"
import { fillHandler, structureHandler } from "../src/server.ts"

const JSON_TYPE = { "content-type": "application/json" }

/** A request of the given chunks, as the HTTP server would hand them to a handler. */
const requestOf = (chunks: Buffer[], type = "application/json"): IncomingMessage =>
  Object.assign(Readable.from(chunks), { headers: { "content-type": type } }) as unknown as IncomingMessage

/** Serves fillHandler on a free port for the length of `check`. */
async function serving(check: (url: string) => Promise<void>) {
  const server = createServer(fillHandler({ ANTHROPIC_API_KEY: "sk-ant-test-not-a-key" }))
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  try {
    await check(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
  } finally {
    server.close()
  }
}

test("the endpoint takes only POSTed, well-formed requests, and never calls Claude for a bad one", async () => {
  await serving(async (url) => {
    assert.equal((await fetch(url)).status, 405)
    const bad = await fetch(url, { method: "POST", headers: JSON_TYPE, body: "{not json" })
    assert.equal(bad.status, 400)
    assert.deepEqual(await bad.json(), { ok: false, error: "请求不是有效的 JSON" })
    const empty = await fetch(url, { method: "POST", headers: JSON_TYPE, body: JSON.stringify({ text: " ", variables: [] }) })
    assert.equal(empty.status, 400)
    assert.equal((await empty.json()).ok, false)
  })
})

test("a body cut between two chunks inside a Chinese character is read whole", async () => {
  const bytes = Buffer.from(JSON.stringify({ text: "含氮杂环：吡啶、嘧啶" }))
  // Three bytes make one character; cut after the first byte of "氮".
  const cut = bytes.indexOf(Buffer.from("氮")) + 1
  const read = await readJsonBody(requestOf([bytes.subarray(0, cut), bytes.subarray(cut)]), 1000)
  assert.deepEqual(read, { value: { text: "含氮杂环：吡啶、嘧啶" } })
})

test("the limit counts characters, not bytes, and stops a long body early", async () => {
  const chinese = JSON.stringify({ text: "字".repeat(100) })
  assert.ok("value" in (await readJsonBody(requestOf([Buffer.from(chinese)]), chinese.length)))
  assert.deepEqual(await readJsonBody(requestOf([Buffer.from(chinese)]), chinese.length - 1), { error: "请求太大", status: 413 })
  // Far over: the second chunk is never asked for.
  let pulled = 0
  async function* endless() {
    for (;;) {
      pulled++
      yield Buffer.alloc(1000, "a")
    }
  }
  const request = Object.assign(Readable.from(endless()), { headers: JSON_TYPE }) as unknown as IncomingMessage
  assert.deepEqual(await readJsonBody(request, 1000), { error: "请求太大", status: 413 })
  assert.ok(pulled <= 5, `${pulled} chunks read`)
})

test("a POST not sent as application/json is a 415 before anything is read or asked, so a page on another site cannot trigger it", async () => {
  await serving(async (url) => {
    const body = JSON.stringify({ text: "x", variables: [] })
    // What a cross-site no-cors fetch can send without a preflight.
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"]) {
      const response = await fetch(url, { method: "POST", headers: { "content-type": type }, body })
      assert.equal(response.status, 415, type)
      assert.equal((await response.json()).ok, false)
    }
    assert.equal((await fetch(url, { method: "POST", body })).status, 415, "text/plain by default")
    const fine = await fetch(url, { method: "POST", headers: { "content-type": "Application/JSON; charset=utf-8" }, body: "{not json" })
    assert.equal(fine.status, 400, "the parameters and case of the type do not matter")
  })
  const server = createServer(structureHandler({ error: "no key" }))
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  try {
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    const response = await fetch(url, { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" })
    assert.equal(response.status, 415)
    assert.equal((await fetch(url, { method: "POST", headers: JSON_TYPE, body: "{}" })).status, 400)
  } finally {
    server.close()
  }
})
