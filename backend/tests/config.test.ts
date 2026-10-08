import assert from "node:assert/strict"
import { resolve } from "node:path"
import test from "node:test"
import { DEFAULT_DB, DEFAULT_HOST, DEFAULT_PORT, readConfig } from "../src/config.ts"

test("without settings: port 25174 on 127.0.0.1, the database in backend/data", () => {
  assert.deepEqual(readConfig({}), { host: DEFAULT_HOST, port: DEFAULT_PORT, dbPath: DEFAULT_DB })
  assert.equal(DEFAULT_PORT, 25174)
  assert.match(DEFAULT_DB, /backend[/\\]data[/\\]structura\.db$/)
})

test("settings come from the environment", () => {
  assert.deepEqual(readConfig({ STRUCTURA_BACKEND_PORT: "8080", STRUCTURA_BACKEND_HOST: "0.0.0.0", STRUCTURA_DB: "some/where.db" }), {
    host: "0.0.0.0",
    port: 8080,
    dbPath: resolve("some/where.db"),
  })
  assert.equal(readConfig({ STRUCTURA_DB: ":memory:" }).dbPath, ":memory:")
})

test("a port that is not one is refused", () => {
  assert.throws(() => readConfig({ STRUCTURA_BACKEND_PORT: "http" }), /not a port/)
  assert.throws(() => readConfig({ STRUCTURA_BACKEND_PORT: "70000" }), /not a port/)
})
