import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"

// Opening the database and bringing its tables up to date. Each migration runs once, in
// order; PRAGMA user_version records how many have run. Add new ones at the end, never edit old ones.

const MIGRATIONS: readonly string[] = [
  `CREATE TABLE templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    aliases TEXT NOT NULL,
    group_name TEXT NOT NULL,
    site TEXT NOT NULL,
    alternative TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX templates_created ON templates (created_at);`,
]

/** The schema version this code expects. */
export const SCHEMA_VERSION = MIGRATIONS.length

/** Opens (creating it and its folder if need be) the database at `path`, or ":memory:", migrated. */
export function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  try {
    if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL")
    db.exec("PRAGMA busy_timeout = 5000")
    migrate(db)
  } catch (error) {
    db.close()
    throw error
  }
  return db
}

/** The database's schema version. */
export function schemaVersion(db: DatabaseSync): number {
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number }
  return row.user_version
}

/** Runs the migrations `db` has not had yet, each in its own transaction. */
export function migrate(db: DatabaseSync): void {
  const current = schemaVersion(db)
  if (current > SCHEMA_VERSION) throw new Error(`the database is from a newer Structura (schema ${current}, this one knows ${SCHEMA_VERSION})`)
  for (let version = current; version < SCHEMA_VERSION; version++) {
    db.exec("BEGIN")
    try {
      db.exec(MIGRATIONS[version])
      db.exec(`PRAGMA user_version = ${version + 1}`)
      db.exec("COMMIT")
    } catch (error) {
      db.exec("ROLLBACK")
      throw error
    }
  }
}
