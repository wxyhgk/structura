// Resolves the app's "@/..." imports (see tsconfig paths) when Node runs the tests directly.
import { existsSync } from "node:fs"
import { registerHooks } from "node:module"
import { fileURLToPath } from "node:url"

const SRC = new URL("../../src/", import.meta.url)

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context)
    const base = new URL(specifier.slice(2), SRC)
    const found = [".ts", ".tsx", "/index.ts"].map((suffix) => new URL(base.href + suffix)).find((url) => existsSync(fileURLToPath(url)))
    return nextResolve(found?.href ?? base.href, context)
  },
})
