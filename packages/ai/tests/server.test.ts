import assert from "node:assert/strict"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import test from "node:test"
import { fillHandler } from "../src/server.ts"

/** Serves fillHandler on a free port for the length of `check`. */
async function serving(check: (url: string) => Promise<void>) {
  const server = createServer(fillHandler({ apiKey: "sk-ant-test-not-a-key" }))
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
    const bad = await fetch(url, { method: "POST", body: "{not json" })
    assert.equal(bad.status, 400)
    assert.deepEqual(await bad.json(), { ok: false, error: "请求不是有效的 JSON" })
    const empty = await fetch(url, { method: "POST", body: JSON.stringify({ text: " ", variables: [] }) })
    assert.equal(empty.status, 400)
    assert.equal((await empty.json()).ok, false)
  })
})
