import { readConfig } from "./config.ts"
import { openDatabase } from "./db.ts"
import { createServer } from "./server.ts"

// Starts the backend: settings from the environment, the database opened and migrated, then
// the server; stops cleanly on Ctrl+C or SIGTERM.

const config = readConfig()
const db = openDatabase(config.dbPath)
const server = createServer(db)

server.listen(config.port, config.host, () => {
  const address = server.address()
  const port = typeof address === "object" && address ? address.port : config.port
  console.log(`Structura 后端已启动：http://${config.host}:${port}（数据库 ${config.dbPath}）`)
})

function stop() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
  server.closeAllConnections()
}

process.on("SIGINT", stop)
process.on("SIGTERM", stop)
