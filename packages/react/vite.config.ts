// Builds the publishable package's code into dist/: index.js (ESM, React and the third-party UI
// kit left to the host's install, Structura's own workspace packages bundled in) and style.css
// (the editor's styles, confined to it). The types come after, from scripts/build-types.mjs.
// Run both with: npm run build -w chem-structura
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defaultClientConditions, defineConfig } from "vite"
import pkg from "./package.json" with { type: "json" }

/** The editor's roots: its own element and its overlays (see src/style.css). */
const SCOPE = ":where(.chem-app,.chem-overlay)"

/**
 * Tailwind puts its design tokens on :root and its property defaults on every element; in a
 * page embedding the editor they would override the page's own Tailwind theme. Confined to the
 * editor's roots, the editor's utilities still find them.
 */
const confineTailwindGlobals = {
  name: "confine-tailwind-globals",
  generateBundle(_: unknown, bundle: Record<string, { type: string; fileName: string; source?: string | Uint8Array }>) {
    const css = Object.values(bundle).find((file) => file.type === "asset" && file.fileName.endsWith(".css"))
    if (!css || typeof css.source !== "string") return
    const everything = [SCOPE, `${SCOPE} *`, `${SCOPE} :before`, `${SCOPE} :after`, `${SCOPE} ::backdrop`].join(",")
    const next = css.source.replaceAll(":root,:host{", `${SCOPE}{`).replaceAll("*,:before,:after,::backdrop{", `${everything}{`)
    if (/(^|[}\s]):root[,{]/.test(next)) throw new Error("style.css still has :root rules; confine them")
    css.source = next
  },
}

/** Left to the host: React, and the packages listed as dependencies (installed with ours). */
const external = [...Object.keys(pkg.peerDependencies), ...Object.keys(pkg.dependencies)]
const isExternal = (id: string) => external.some((name) => id === name || id.startsWith(`${name}/`))

export default defineConfig({
  plugins: [react(), tailwindcss(), confineTailwindGlobals],
  resolve: { conditions: ["structura-source", ...defaultClientConditions] },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: { index: "src/index.ts", style: "src/style.css" },
      formats: ["es"],
    },
    cssCodeSplit: true,
    rolldownOptions: {
      external: isExternal,
      output: { assetFileNames: "[name][extname]" },
    },
  },
})
