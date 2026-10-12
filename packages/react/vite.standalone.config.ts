// The editor for pages without React: src/standalone.ts with React and everything else bundled
// in, as an ES module (dist/standalone.js, RDKit's loader a separate chunk fetched on first use)
// and for a plain <script> (dist/chem-structura.iife.js, setting window.ChemStructura). Runs
// after vite.config.ts, whose style.css both use; see that file.
import react from "@vitejs/plugin-react"
import { defaultClientConditions, defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ["structura-source", ...defaultClientConditions] },
  // Library builds leave process.env alone; React picks its production build from it.
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    // No source maps: they would add 8 MB to the package, for pages that use the files as they are.
    sourcemap: false,
    lib: {
      entry: "src/standalone.ts",
      name: "ChemStructura",
      formats: ["es", "iife"],
      fileName: (format) => (format === "es" ? "standalone.js" : "chem-structura.iife.js"),
    },
    rolldownOptions: {
      // Library builds keep an ES module's whitespace (for the host's bundler to shake); this one
      // is used as it is, so it is minified like the <script> one.
      output: { chunkFileNames: "chunks/[name]-[hash].js", minify: true },
    },
  },
})
