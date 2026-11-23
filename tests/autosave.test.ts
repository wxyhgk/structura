import assert from "node:assert/strict"
import test from "node:test"
import { forgetUnsaved, KEEP_COPIES, KEEP_MS, keepUnsaved, readUnsaved } from "@/autosave"
import { installStorage } from "./support/storage.ts"

const PREFIX = "test:unsaved"

/** A copy another page left, as autosave.ts writes it. */
const left = (storage: Storage, id: string, document: string, at: number) => storage.setItem(`${PREFIX}:${id}`, JSON.stringify({ document, at }))

test("a page's own copy is not offered back to itself, a copy of another page is", () => {
  const storage = installStorage()
  assert.equal(keepUnsaved(PREFIX, "mine"), true)
  assert.equal(readUnsaved(PREFIX), null)
  left(storage, "other", "theirs", Date.now() - 1000)
  assert.equal(readUnsaved(PREFIX)?.document, "theirs")
})

test("the newest copy of the others is the one offered; a page's copy never replaces another's", () => {
  const storage = installStorage()
  left(storage, "a", "older", Date.now() - 5000)
  left(storage, "b", "newer", Date.now() - 1000)
  keepUnsaved(PREFIX, "mine")
  assert.equal(storage.length, 3)
  const offered = readUnsaved(PREFIX)!
  assert.equal(offered.document, "newer")
  forgetUnsaved(PREFIX, offered)
  assert.equal(readUnsaved(PREFIX)?.document, "older")
  // Saved: only this page's own copy goes.
  forgetUnsaved(PREFIX)
  assert.equal(storage.length, 1)
})

test("the single copy an earlier version kept under the bare key is still offered", () => {
  const storage = installStorage()
  storage.setItem(PREFIX, JSON.stringify({ document: "old", at: Date.now() - 1000 }))
  const offered = readUnsaved(PREFIX)!
  assert.equal(offered.document, "old")
  forgetUnsaved(PREFIX, offered)
  assert.equal(storage.length, 0)
})

test("copies older than a week, and all but the newest few, are cleared", () => {
  const storage = installStorage()
  const now = Date.now()
  left(storage, "stale", "stale", now - KEEP_MS - 1000)
  for (let index = 0; index < KEEP_COPIES + 2; index++) left(storage, `p${index}`, `copy ${index}`, now - 1000 * (index + 1))
  assert.equal(readUnsaved(PREFIX)?.document, "copy 0")
  assert.equal(storage.length, KEEP_COPIES)
  assert.equal(storage.getItem(`${PREFIX}:stale`), null)
  assert.equal(storage.getItem(`${PREFIX}:p${KEEP_COPIES}`), null)
})

test("a full store gives way to the other pages' oldest copies, and says so when that is not enough", () => {
  const storage = installStorage()
  left(storage, "a", "x".repeat(100), Date.now() - 5000)
  left(storage, "b", "y".repeat(100), Date.now() - 1000)
  storage.capacity = 330
  assert.equal(keepUnsaved(PREFIX, "z".repeat(100)), true)
  assert.equal(storage.getItem(`${PREFIX}:a`), null, "the oldest went first")
  assert.notEqual(storage.getItem(`${PREFIX}:b`), null)
  storage.capacity = 10
  assert.equal(keepUnsaved(PREFIX, "z".repeat(100)), false)
})

test("storage that cannot be used is no failure of the page", () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("blocked", "SecurityError")
    },
  })
  assert.equal(keepUnsaved(PREFIX, "text"), false)
  assert.equal(readUnsaved(PREFIX), null)
  forgetUnsaved(PREFIX)
})
