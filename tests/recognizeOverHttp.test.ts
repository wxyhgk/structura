import assert from "node:assert/strict"
import test from "node:test"
import type { StructureEvent } from "@structura/ai"
import { readStructureEvents, structureEventOf } from "@/recognizeOverHttp"

/** A body arriving in these chunks. */
const body = (...chunks: string[]) =>
  new ReadableStream<BufferSource>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
      controller.close()
    },
  })

async function events(...chunks: string[]): Promise<StructureEvent[]> {
  const seen: StructureEvent[] = []
  await readStructureEvents(body(...chunks), (event) => seen.push(event))
  return seen
}

const step = JSON.stringify({ type: "step", step: { n: 1 } })
const done = JSON.stringify({ type: "result", result: { ok: true, drawing: {}, steps: 1 } })

test("events are read line by line, however the lines are split across chunks", async () => {
  const seen = await events(step.slice(0, 5), `${step.slice(5)}\n${done.slice(0, 9)}`, `${done.slice(9)}\n`)
  assert.deepEqual(seen.map((event) => event.type), ["step", "result"])
})

test("a line that is not an event is passed over, and reading goes on to the result", async () => {
  const seen = await events(`${step}\n<html>502 Bad Gateway</html>\n{"type":"step"}\n${done}`)
  assert.deepEqual(seen.map((event) => event.type), ["step", "result"])
  assert.equal(seen[1].type === "result" && seen[1].result.ok, true)
})

test("an answer that ends without its result gets one that says why", async () => {
  const failure = (event: StructureEvent | undefined) => (event?.type === "result" && !event.result.ok ? event.result.error : "")
  const cut = await events(`${step}\n`)
  assert.match(failure(cut.at(-1)), /断开/)
  const garbled = await events("<html>oops</html>")
  assert.equal(garbled.length, 1)
  assert.match(failure(garbled[0]), /读不懂/)
})

test("only well-formed events count", () => {
  assert.equal(structureEventOf("not json"), null)
  assert.equal(structureEventOf("null"), null)
  assert.equal(structureEventOf('{"type":"result","result":{}}'), null)
  assert.deepEqual(structureEventOf(done), JSON.parse(done))
})
