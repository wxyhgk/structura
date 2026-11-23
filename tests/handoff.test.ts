import assert from "node:assert/strict"
import test from "node:test"
import { sweepHandoffs, WAIT_COUNT, WAIT_MS } from "@/handoff"
import { FakeStorage } from "./support/storage.ts"

const wait = (storage: Storage, id: string, at: number) => storage.setItem(`structura:handoff:${id}`, JSON.stringify({ document: id, at }))

test("a document nobody took is cleared after a day, with whatever is not in the current form", () => {
  const storage = new FakeStorage()
  const now = Date.now()
  wait(storage, "fresh", now - 1000)
  wait(storage, "old", now - WAIT_MS - 1000)
  storage.setItem("structura:handoff:raw", "a document stored before the time was kept")
  storage.setItem("structura:theme", "dark")
  sweepHandoffs(storage, now)
  assert.deepEqual([...Array(storage.length).keys()].map((index) => storage.key(index)).sort(), ["structura:handoff:fresh", "structura:theme"])
})

test("only the newest few that wait are kept", () => {
  const storage = new FakeStorage()
  const now = Date.now()
  for (let index = 0; index < WAIT_COUNT + 3; index++) wait(storage, `h${index}`, now - 1000 * (index + 1))
  sweepHandoffs(storage, now)
  assert.equal(storage.length, WAIT_COUNT)
  assert.notEqual(storage.getItem("structura:handoff:h0"), null)
  assert.equal(storage.getItem(`structura:handoff:h${WAIT_COUNT}`), null)
})
